import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateProblemInput,
  ERROR_CODES,
  type ListBookmarksQuery,
  type ProblemDetail,
  type ProblemSummary,
  type ProblemsListQuery,
  type ProblemsTagsResponse,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { bookmarks, problems, problemTags, tags, testCases, users } from '@syncode/db';
import type { ProblemSortBy } from '@syncode/shared';
import { type PaginatedResult, paginate } from '@syncode/shared/server';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';

type ProblemSummaryRow = ProblemSummary & { sortValue: string };
type BookmarkRow = ProblemSummary & { bookmarkedAt: Date };

@Injectable()
export class ProblemsService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async listProblems(
    userId: string,
    query: ProblemsListQuery,
  ): Promise<PaginatedResult<ProblemSummary>> {
    const sortField = query.sortBy ?? 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? asc : desc;
    const compareOp = query.sortOrder === 'asc' ? gt : lt;
    const canViewDrafts = await this.isAdmin(userId);

    const result = await paginate<ProblemSummaryRow>({
      cursor: query.cursor,
      limit: query.limit,
      getCursorValues: (row) => [row.sortValue, row.id],
      fetchPage: async (decoded, fetchLimit) => {
        const conditions = [isNull(problems.deletedAt)];
        if (!canViewDrafts) {
          conditions.push(eq(problems.isPublished, true));
        }

        if (query.difficulty?.length) {
          conditions.push(inArray(problems.difficulty, query.difficulty));
        }

        const attemptStatusCondition = this.buildAttemptStatusCondition(userId, query.status);
        if (attemptStatusCondition) {
          conditions.push(attemptStatusCondition);
        }

        if (query.company) {
          conditions.push(eq(problems.company, query.company));
        }

        if (query.search) {
          const pattern = `%${query.search}%`;
          conditions.push(
            or(ilike(problems.title, pattern), ilike(problems.description, pattern))!,
          );
        }

        if (query.tags) {
          const tagSlugs = query.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (tagSlugs.length > 0) {
            conditions.push(
              sql`EXISTS (
                SELECT 1 FROM problem_tags pt
                JOIN tags t ON t.id = pt.tag_id
                WHERE pt.problem_id = "problems"."id"
                AND t.slug IN (${sql.join(
                  tagSlugs.map((s) => sql`${s}`),
                  sql`, `,
                )})
              )`,
            );
          }
        }

        const sortColumn = this.getSortColumn(sortField);

        if (decoded?.length === 2 && decoded[0] && decoded[1]) {
          const cursorCondition = this.buildCursorCondition(
            sortField,
            decoded[0],
            decoded[1],
            compareOp,
          );
          if (cursorCondition) {
            conditions.push(cursorCondition);
          }
        }

        const rows = await this.db
          .select({
            id: problems.id,
            title: problems.title,
            difficulty: problems.difficulty,
            isPublished: problems.isPublished,
            tagsAgg: this.tagsAggExpr(),
            company: problems.company,
            acceptanceRate: this.acceptanceRateExpr(),
            isBookmarked: this.isBookmarkedExpr(userId),
            attemptStatus: this.attemptStatusExpr(userId),
            totalSubmissions: problems.totalSubmissions,
            acceptedSubmissions: problems.acceptedSubmissions,
            updatedAt: problems.updatedAt,
            createdAt: problems.createdAt,
          })
          .from(problems)
          .where(and(...conditions))
          .orderBy(sortDir(sortColumn), sortDir(problems.id))
          .limit(fetchLimit);

        return rows.map((row) => ({
          ...this.mapToSummary(row, Boolean(row.isBookmarked)),
          totalSubmissions: row.totalSubmissions,
          updatedAt: row.updatedAt.toISOString(),
          sortValue: this.computeSortValue(row, sortField),
        }));
      },
    });

    return {
      data: result.data.map(({ sortValue: _, ...rest }) => rest),
      pagination: result.pagination,
    };
  }

  async findById(userId: string, problemId: string): Promise<ProblemDetail> {
    const canViewDrafts = await this.isAdmin(userId);
    const userAttemptsExpr = sql<number>`(
      SELECT COUNT(*)::int FROM submissions s
      WHERE s.problem_id = "problems"."id"
      AND s.user_id = ${userId}
    )`.as('user_attempts');

    const [problemRows, visibleTestCases] = await Promise.all([
      this.db
        .select({
          id: problems.id,
          title: problems.title,
          description: problems.description,
          difficulty: problems.difficulty,
          isPublished: problems.isPublished,
          company: problems.company,
          constraints: problems.constraints,
          examples: problems.examples,
          starterCode: problems.starterCode,
          timeLimit: problems.timeLimit,
          memoryLimit: problems.memoryLimit,
          totalSubmissions: problems.totalSubmissions,
          tagsAgg: this.tagsAggExpr(),
          acceptanceRate: this.acceptanceRateExpr(),
          isBookmarked: this.isBookmarkedExpr(userId),
          attemptStatus: this.attemptStatusExpr(userId),
          userAttempts: userAttemptsExpr,
          createdAt: problems.createdAt,
          updatedAt: problems.updatedAt,
        })
        .from(problems)
        .where(
          and(
            ...[
              eq(problems.id, problemId),
              isNull(problems.deletedAt),
              canViewDrafts ? undefined : eq(problems.isPublished, true),
            ].filter((item): item is SQL => Boolean(item)),
          ),
        ),
      this.db
        .select({
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
          description: testCases.description,
          isHidden: testCases.isHidden,
          timeoutMs: testCases.timeoutMs,
          memoryMb: testCases.memoryMb,
        })
        .from(testCases)
        .where(and(eq(testCases.problemId, problemId), eq(testCases.isHidden, false)))
        .orderBy(asc(testCases.sortOrder)),
    ]);

    const problem = problemRows[0];

    if (!problem) {
      throw new NotFoundException({
        message: 'Problem not found',
        code: ERROR_CODES.PROBLEM_NOT_FOUND,
      });
    }

    return {
      id: problem.id,
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      isPublished: problem.isPublished,
      tags: problem.tagsAgg ? problem.tagsAgg.split(',') : [],
      company: problem.company ?? null,
      constraints: problem.constraints ?? null,
      examples: (problem.examples as ProblemDetail['examples']) ?? [],
      starterCode: (problem.starterCode as ProblemDetail['starterCode']) ?? null,
      timeLimit: problem.timeLimit ?? null,
      memoryLimit: problem.memoryLimit ?? null,
      totalSubmissions: problem.totalSubmissions,
      acceptanceRate: problem.acceptanceRate == null ? null : Number(problem.acceptanceRate),
      isBookmarked: Boolean(problem.isBookmarked),
      attemptStatus: problem.attemptStatus as ProblemDetail['attemptStatus'],
      userAttempts: Number(problem.userAttempts),
      testCases: visibleTestCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        description: tc.description ?? undefined,
        isHidden: tc.isHidden,
        timeoutMs: tc.timeoutMs ?? undefined,
        memoryMb: tc.memoryMb ?? undefined,
      })),
      createdAt: problem.createdAt.toISOString(),
      updatedAt: problem.updatedAt.toISOString(),
    };
  }

  async createProblem(userId: string, input: CreateProblemInput): Promise<ProblemDetail> {
    await this.assertAdmin(userId);

    const [existing] = await this.db
      .select({ id: problems.id })
      .from(problems)
      .where(and(eq(problems.title, input.title), isNull(problems.deletedAt)))
      .limit(1);

    if (existing) {
      throw new ConflictException({
        message: 'Problem title already exists',
        code: ERROR_CODES.PROBLEM_DUPLICATE_TITLE,
      });
    }

    const created = await this.db.transaction(async (tx) => {
      const [problem] = await tx
        .insert(problems)
        .values({
          title: input.title,
          description: input.description,
          difficulty: input.difficulty,
          isPublished: input.isPublished,
          company: input.company ?? null,
          constraints: input.constraints ?? null,
          examples: input.examples,
          starterCode: input.starterCode ?? null,
          timeLimit: input.timeLimit ?? null,
          memoryLimit: input.memoryLimit ?? null,
        })
        .returning({ id: problems.id });
      if (!problem) {
        throw new Error('Problem insert did not return a row');
      }

      await tx.insert(testCases).values(
        input.testCases.map((testCase, index) => ({
          problemId: problem.id,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          description: testCase.description ?? null,
          isHidden: testCase.isHidden,
          sortOrder: index,
          timeoutMs: testCase.timeoutMs ?? null,
          memoryMb: testCase.memoryMb ?? null,
        })),
      );

      return problem;
    });

    return this.findById(userId, created.id);
  }

  async listTags(): Promise<ProblemsTagsResponse> {
    const rows = await this.db
      .select({
        slug: tags.slug,
        name: tags.name,
        count: count(problemTags.problemId).as('count'),
      })
      .from(tags)
      .innerJoin(problemTags, eq(problemTags.tagId, tags.id))
      .innerJoin(problems, eq(problems.id, problemTags.problemId))
      .where(and(isNull(problems.deletedAt), eq(problems.isPublished, true)))
      .groupBy(tags.id, tags.slug, tags.name)
      .orderBy(desc(count(problemTags.problemId)), asc(tags.name));

    return {
      data: rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        count: Number(row.count),
      })),
    };
  }

  async addBookmark(userId: string, problemId: string): Promise<void> {
    const [problem] = await this.db
      .select({ id: problems.id })
      .from(problems)
      .where(
        and(eq(problems.id, problemId), isNull(problems.deletedAt), eq(problems.isPublished, true)),
      );

    if (!problem) {
      throw new NotFoundException({
        message: 'Problem not found',
        code: ERROR_CODES.PROBLEM_NOT_FOUND,
      });
    }

    await this.db.insert(bookmarks).values({ userId, problemId }).onConflictDoNothing();
  }

  async removeBookmark(userId: string, problemId: string): Promise<void> {
    await this.db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.problemId, problemId)));
  }

  async listBookmarks(
    userId: string,
    query: ListBookmarksQuery,
  ): Promise<PaginatedResult<ProblemSummary>> {
    const canViewDrafts = await this.isAdmin(userId);
    const result = await paginate<BookmarkRow>({
      cursor: query.cursor,
      limit: query.limit,
      getCursorValues: (row) => [row.bookmarkedAt.toISOString(), row.id],
      fetchPage: async (decoded, fetchLimit) => {
        const conditions = [eq(bookmarks.userId, userId), isNull(problems.deletedAt)];
        if (!canViewDrafts) {
          conditions.push(eq(problems.isPublished, true));
        }

        if (decoded?.length === 2 && decoded[0] && decoded[1]) {
          const cursorDate = new Date(decoded[0]);
          const cursorId = decoded[1];

          conditions.push(
            or(
              lt(bookmarks.createdAt, cursorDate),
              and(eq(bookmarks.createdAt, cursorDate), lt(problems.id, cursorId)),
            )!,
          );
        }

        const rows = await this.db
          .select({
            id: problems.id,
            title: problems.title,
            difficulty: problems.difficulty,
            isPublished: problems.isPublished,
            tagsAgg: this.tagsAggExpr(),
            company: problems.company,
            acceptanceRate: this.acceptanceRateExpr(),
            attemptStatus: this.attemptStatusExpr(userId),
            bookmarkedAt: bookmarks.createdAt,
          })
          .from(bookmarks)
          .innerJoin(problems, eq(problems.id, bookmarks.problemId))
          .where(and(...conditions))
          .orderBy(desc(bookmarks.createdAt), desc(problems.id))
          .limit(fetchLimit);

        return rows.map((row) => ({
          ...this.mapToSummary(row, true),
          bookmarkedAt: row.bookmarkedAt,
        }));
      },
    });

    return {
      data: result.data.map(({ bookmarkedAt: _, ...summary }) => summary),
      pagination: result.pagination,
    };
  }

  private mapToSummary(
    row: {
      id: string;
      title: string;
      difficulty: string;
      isPublished: boolean;
      tagsAgg: string | null;
      company: string | null;
      acceptanceRate: number | null;
      attemptStatus: string | null;
    },
    isBookmarked: boolean,
  ): ProblemSummary {
    return {
      id: row.id,
      title: row.title,
      difficulty: row.difficulty as ProblemSummary['difficulty'],
      isPublished: row.isPublished,
      tags: row.tagsAgg ? row.tagsAgg.split(',') : [],
      company: row.company ?? null,
      acceptanceRate: row.acceptanceRate == null ? null : Number(row.acceptanceRate),
      isBookmarked,
      attemptStatus: row.attemptStatus as ProblemSummary['attemptStatus'],
    };
  }

  private async assertAdmin(userId: string): Promise<void> {
    if (await this.isAdmin(userId)) {
      return;
    }

    throw new ForbiddenException({
      message: 'Admin access required',
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const [user] = await this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.role === 'admin';
  }

  private tagsAggExpr() {
    return sql<string>`(
      SELECT string_agg(t.slug, ',' ORDER BY t.name)
      FROM problem_tags pt
      JOIN tags t ON t.id = pt.tag_id
      WHERE pt.problem_id = "problems"."id"
    )`.as('tags_agg');
  }

  private isBookmarkedExpr(userId: string) {
    return sql<boolean>`EXISTS (
      SELECT 1 FROM bookmarks b
      WHERE b.problem_id = "problems"."id"
      AND b.user_id = ${userId}
    )`.as('is_bookmarked');
  }

  private buildAttemptStatusCondition(
    userId: string,
    statuses: ProblemsListQuery['status'],
  ): SQL | undefined {
    if (!statuses?.length) {
      return undefined;
    }

    const uniqueStatuses = new Set(statuses);
    const conditions: SQL[] = [];

    if (uniqueStatuses.has('solved')) {
      conditions.push(this.hasSolvedSubmissionExpr(userId));
    }

    if (uniqueStatuses.has('attempted')) {
      conditions.push(
        sql`(${this.hasAnySubmissionExpr(userId)} AND NOT (${this.hasSolvedSubmissionExpr(userId)}))`,
      );
    }

    if (uniqueStatuses.has('todo')) {
      conditions.push(sql`NOT (${this.hasAnySubmissionExpr(userId)})`);
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return conditions.length === 1 ? conditions[0] : or(...conditions);
  }

  private attemptStatusExpr(userId: string) {
    return sql<string | null>`(
      CASE
        WHEN ${this.hasSolvedSubmissionExpr(userId)} THEN 'solved'
        WHEN ${this.hasAnySubmissionExpr(userId)} THEN 'attempted'
        ELSE NULL
      END
    )`.as('attempt_status');
  }

  private hasSolvedSubmissionExpr(userId: string) {
    return sql<boolean>`EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.problem_id = "problems"."id"
      AND s.user_id = ${userId}
      AND s.status = 'completed'
      AND s.passed_test_cases = s.total_test_cases
    )`;
  }

  private hasAnySubmissionExpr(userId: string) {
    return sql<boolean>`EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.problem_id = "problems"."id"
      AND s.user_id = ${userId}
    )`;
  }

  private acceptanceRateExpr() {
    return sql<number | null>`(
      CASE
        WHEN "problems"."total_submissions" = 0 THEN NULL
        ELSE ROUND(
          ("problems"."accepted_submissions"::numeric / "problems"."total_submissions"::numeric) * 100,
          2
        )
      END
    )`.as('acceptance_rate');
  }

  private buildCursorCondition(
    sortField: ProblemSortBy,
    cursorSort: string,
    cursorId: string,
    compareOp: typeof gt,
  ) {
    if (sortField === 'title') {
      return or(
        compareOp(problems.title, cursorSort),
        and(eq(problems.title, cursorSort), compareOp(problems.id, cursorId)),
      );
    }
    if (sortField === 'difficulty') {
      const cursorDifficulty = cursorSort as 'easy' | 'medium' | 'hard';
      return or(
        compareOp(problems.difficulty, cursorDifficulty),
        and(eq(problems.difficulty, cursorDifficulty), compareOp(problems.id, cursorId)),
      );
    }
    if (sortField === 'totalSubmissions') {
      return or(
        compareOp(problems.totalSubmissions, Number(cursorSort)),
        and(eq(problems.totalSubmissions, Number(cursorSort)), compareOp(problems.id, cursorId)),
      );
    }
    if (sortField === 'popularity') {
      const popularityExpr = sql<number>`CASE
        WHEN "problems"."total_submissions" = 0 THEN 0
        ELSE "problems"."accepted_submissions"::float / "problems"."total_submissions"::float
      END`;
      return or(
        compareOp(popularityExpr, Number(cursorSort)),
        and(eq(popularityExpr, Number(cursorSort)), compareOp(problems.id, cursorId)),
      );
    }
    const cursorDate = new Date(cursorSort);
    if (Number.isNaN(cursorDate.getTime())) return undefined;
    return or(
      compareOp(problems.createdAt, cursorDate),
      and(eq(problems.createdAt, cursorDate), compareOp(problems.id, cursorId)),
    );
  }

  private getSortColumn(sortField: ProblemSortBy) {
    switch (sortField) {
      case 'title':
        return problems.title;
      case 'difficulty':
        return problems.difficulty;
      case 'totalSubmissions':
        return problems.totalSubmissions;
      case 'popularity':
        return sql`CASE
          WHEN "problems"."total_submissions" = 0 THEN 0
          ELSE "problems"."accepted_submissions"::float / "problems"."total_submissions"::float
        END`;
      default:
        return problems.createdAt;
    }
  }

  private computeSortValue(
    row: {
      title: string;
      difficulty: string;
      totalSubmissions: number;
      acceptedSubmissions: number;
      createdAt: Date;
    },
    sortField: ProblemSortBy,
  ): string {
    switch (sortField) {
      case 'title':
        return row.title;
      case 'difficulty':
        return row.difficulty;
      case 'totalSubmissions':
        return String(row.totalSubmissions);
      case 'popularity':
        return row.totalSubmissions === 0
          ? '0'
          : String(row.acceptedSubmissions / row.totalSubmissions);
      default:
        return row.createdAt.toISOString();
    }
  }
}
