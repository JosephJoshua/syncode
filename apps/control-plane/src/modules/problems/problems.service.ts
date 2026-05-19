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
  type PublishProblemStatusInput,
  type UpdateProblemInput,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  bookmarks,
  problems,
  problemTags,
  rooms,
  sessions,
  tags,
  testCases,
  users,
} from '@syncode/db';
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
import { AuditService } from '../admin/audit.service.js';

type ProblemSummaryRow = ProblemSummary & { sortValue: string };
type BookmarkRow = ProblemSummary & { bookmarkedAt: Date };
type ActiveProblemAuditSnapshot = {
  id: string;
  title: string;
  difficulty: ProblemSummary['difficulty'];
  isPublished: boolean;
};
type FindProblemOptions = {
  readonly includeHidden?: boolean;
};

@Injectable()
export class ProblemsService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async listProblems(
    userId: string,
    query: ProblemsListQuery,
  ): Promise<PaginatedResult<ProblemSummary>> {
    const sortField = query.sortBy ?? 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? asc : desc;
    const compareOp = query.sortOrder === 'asc' ? gt : lt;
    const canViewDrafts = query.includeDrafts === true && (await this.isAdmin(userId));

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
            testCaseCount: canViewDrafts ? this.testCaseCountExpr() : sql<null>`NULL`,
            hiddenTestCaseCount: canViewDrafts
              ? this.testCaseCountExpr({ hiddenOnly: true })
              : sql<null>`NULL`,
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

  async findById(
    userId: string,
    problemId: string,
    options: FindProblemOptions = {},
  ): Promise<ProblemDetail> {
    const canViewDrafts = await this.isAdmin(userId);
    const canViewHidden = options.includeHidden === true && canViewDrafts;
    if (options.includeHidden === true && !canViewDrafts) {
      throw new ForbiddenException({
        message: 'Admin access required',
        code: ERROR_CODES.FORBIDDEN,
      });
    }
    const userAttemptsExpr = sql<number>`(
      SELECT COUNT(*)::int FROM submissions s
      WHERE s.problem_id = "problems"."id"
      AND s.user_id = ${userId}
    )`.as('user_attempts');

    const [problemRows, problemTestCases] = await Promise.all([
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
        .where(
          and(
            ...[
              eq(testCases.problemId, problemId),
              canViewHidden ? undefined : eq(testCases.isHidden, false),
            ].filter((item): item is SQL => Boolean(item)),
          ),
        )
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
      testCases: problemTestCases.map((tc) => ({
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

  async createProblem(
    userId: string,
    input: CreateProblemInput,
    ipAddress?: string,
  ): Promise<ProblemDetail> {
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

      await this.auditService.logWithClient(tx, {
        actorId: userId,
        action: 'admin.problem.create',
        targetType: 'problem',
        targetId: problem.id,
        metadata: {
          title: input.title,
          difficulty: input.difficulty,
          isPublished: input.isPublished,
          testCaseCount: input.testCases.length,
          hiddenTestCaseCount: input.testCases.filter((testCase) => testCase.isHidden).length,
        },
        ipAddress,
      });

      return problem;
    });

    return this.findById(userId, created.id, { includeHidden: true });
  }

  async updateProblem(
    userId: string,
    problemId: string,
    input: UpdateProblemInput,
    ipAddress?: string,
  ): Promise<ProblemDetail> {
    await this.assertAdmin(userId);
    const existing = await this.assertActiveProblem(problemId);

    if (input.title) {
      await this.assertUniqueTitle(input.title, problemId);
    }

    await this.db.transaction(async (tx) => {
      const values: Partial<typeof problems.$inferInsert> = {};

      if (input.title !== undefined) values.title = input.title;
      if (input.description !== undefined) values.description = input.description;
      if (input.difficulty !== undefined) values.difficulty = input.difficulty;
      if (input.company !== undefined) values.company = input.company ?? null;
      if (input.constraints !== undefined) values.constraints = input.constraints ?? null;
      if (input.examples !== undefined) values.examples = input.examples;
      if (input.starterCode !== undefined) values.starterCode = input.starterCode ?? null;
      if (input.timeLimit !== undefined) values.timeLimit = input.timeLimit ?? null;
      if (input.memoryLimit !== undefined) values.memoryLimit = input.memoryLimit ?? null;

      if (Object.keys(values).length > 0) {
        await tx.update(problems).set(values).where(eq(problems.id, problemId));
      }

      if (input.testCases !== undefined) {
        await tx.delete(testCases).where(eq(testCases.problemId, problemId));
        await tx.insert(testCases).values(
          input.testCases.map((testCase, index) => ({
            problemId,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            description: testCase.description ?? null,
            isHidden: testCase.isHidden,
            sortOrder: index,
            timeoutMs: testCase.timeoutMs ?? null,
            memoryMb: testCase.memoryMb ?? null,
          })),
        );
      }

      await this.auditService.logWithClient(tx, {
        actorId: userId,
        action: 'admin.problem.update',
        targetType: 'problem',
        targetId: problemId,
        metadata: {
          title: existing.title,
          changedFields: this.getUpdatedProblemFields(input),
          ...(input.testCases
            ? {
                testCaseCount: input.testCases.length,
                hiddenTestCaseCount: input.testCases.filter((testCase) => testCase.isHidden).length,
              }
            : {}),
        },
        ipAddress,
      });
    });

    return this.findById(userId, problemId, { includeHidden: true });
  }

  async changePublishStatus(
    userId: string,
    problemId: string,
    input: PublishProblemStatusInput,
    ipAddress?: string,
  ): Promise<ProblemDetail> {
    await this.assertAdmin(userId);
    const existing = await this.assertActiveProblem(problemId);

    await this.db.transaction(async (tx) => {
      await tx
        .update(problems)
        .set({ isPublished: input.isPublished })
        .where(eq(problems.id, problemId));

      await this.auditService.logWithClient(tx, {
        actorId: userId,
        action: input.isPublished ? 'admin.problem.publish' : 'admin.problem.unpublish',
        targetType: 'problem',
        targetId: problemId,
        metadata: {
          title: existing.title,
          previousIsPublished: existing.isPublished,
          isPublished: input.isPublished,
        },
        ipAddress,
      });
    });

    return this.findById(userId, problemId, { includeHidden: true });
  }

  async deleteProblem(userId: string, problemId: string, ipAddress?: string): Promise<void> {
    await this.assertAdmin(userId);
    const existing = await this.assertActiveProblem(problemId);
    await this.assertProblemNotInUse(problemId);

    await this.db.transaction(async (tx) => {
      await tx.update(problems).set({ deletedAt: new Date() }).where(eq(problems.id, problemId));

      await this.auditService.logWithClient(tx, {
        actorId: userId,
        action: 'admin.problem.delete',
        targetType: 'problem',
        targetId: problemId,
        metadata: {
          title: existing.title,
          difficulty: existing.difficulty,
          wasPublished: existing.isPublished,
        },
        ipAddress,
      });
    });
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
      testCaseCount?: number | null;
      hiddenTestCaseCount?: number | null;
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
      ...(row.testCaseCount == null ? {} : { testCaseCount: Number(row.testCaseCount) }),
      ...(row.hiddenTestCaseCount == null
        ? {}
        : { hiddenTestCaseCount: Number(row.hiddenTestCaseCount) }),
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

  private async assertActiveProblem(problemId: string): Promise<ActiveProblemAuditSnapshot> {
    const [problem] = await this.db
      .select({
        id: problems.id,
        title: problems.title,
        difficulty: problems.difficulty,
        isPublished: problems.isPublished,
      })
      .from(problems)
      .where(and(eq(problems.id, problemId), isNull(problems.deletedAt)))
      .limit(1);

    if (problem) {
      return problem;
    }

    throw new NotFoundException({
      message: 'Problem not found',
      code: ERROR_CODES.PROBLEM_NOT_FOUND,
    });
  }

  private async assertProblemNotInUse(problemId: string): Promise<void> {
    const [roomRef, sessionRef] = await Promise.all([
      this.db.select({ id: rooms.id }).from(rooms).where(eq(rooms.problemId, problemId)).limit(1),
      this.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.problemId, problemId))
        .limit(1),
    ]);

    if (!roomRef[0] && !sessionRef[0]) {
      return;
    }

    throw new ConflictException({
      message: 'Problem is used by existing rooms or sessions',
      code: ERROR_CODES.PROBLEM_IN_USE,
    });
  }

  private getUpdatedProblemFields(input: UpdateProblemInput): string[] {
    return Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }

  private async assertUniqueTitle(title: string, problemId: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: problems.id })
      .from(problems)
      .where(
        and(
          eq(problems.title, title),
          isNull(problems.deletedAt),
          sql`${problems.id} <> ${problemId}`,
        ),
      )
      .limit(1);

    if (!existing) {
      return;
    }

    throw new ConflictException({
      message: 'Problem title already exists',
      code: ERROR_CODES.PROBLEM_DUPLICATE_TITLE,
    });
  }

  private tagsAggExpr() {
    return sql<string>`(
      SELECT string_agg(t.slug, ',' ORDER BY t.name)
      FROM problem_tags pt
      JOIN tags t ON t.id = pt.tag_id
      WHERE pt.problem_id = "problems"."id"
    )`.as('tags_agg');
  }

  private testCaseCountExpr({ hiddenOnly = false }: { hiddenOnly?: boolean } = {}): SQL<number> {
    return sql<number>`(
      SELECT COUNT(*)::int
      FROM test_cases tc
      WHERE tc.problem_id = "problems"."id"
      ${hiddenOnly ? sql`AND tc.is_hidden = true` : sql``}
    )`;
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
