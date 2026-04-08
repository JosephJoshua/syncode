import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Database } from '@syncode/db';
import { bookmarks, problemTags, rooms, submissions, tags } from '@syncode/db';
import { and, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { createTestDb, insertProblem, insertUser } from '@/test/integration-setup.js';
import { ProblemsService } from './problems.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: ProblemsService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    providers: [ProblemsService, { provide: DB_CLIENT, useValue: db }],
  }).compile();

  service = module.get(ProblemsService);
});

afterEach(async () => {
  await cleanup();
});

describe('addBookmark', () => {
  it('GIVEN existing problem WHEN adding bookmark THEN persists row in bookmarks table', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);

    await service.addBookmark(user.id, problem.id);

    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.problemId, problem.id)));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
  });

  it('GIVEN already bookmarked problem WHEN adding again THEN is idempotent (no duplicate)', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);

    await service.addBookmark(user.id, problem.id);
    await service.addBookmark(user.id, problem.id);

    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.problemId, problem.id)));

    expect(rows).toHaveLength(1);
  });

  it('GIVEN non-existent problem id WHEN adding bookmark THEN throws NotFoundException', async () => {
    const user = await insertUser(db);

    await expect(
      service.addBookmark(user.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);
  });

  it('GIVEN soft-deleted problem WHEN adding bookmark THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, { deletedAt: new Date() });

    await expect(service.addBookmark(user.id, problem.id)).rejects.toThrow(NotFoundException);
  });
});

describe('removeBookmark', () => {
  it('GIVEN existing bookmark WHEN removing THEN deletes row from bookmarks table', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    await db.insert(bookmarks).values({ userId: user.id, problemId: problem.id });

    await service.removeBookmark(user.id, problem.id);

    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.problemId, problem.id)));

    expect(rows).toHaveLength(0);
  });

  it('GIVEN no existing bookmark WHEN removing THEN is idempotent (no error)', async () => {
    const user = await insertUser(db);

    await expect(
      service.removeBookmark(user.id, '00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeUndefined();
  });
});

describe('listBookmarks', () => {
  it('GIVEN no bookmarks WHEN listing THEN returns empty data', async () => {
    const user = await insertUser(db);

    const result = await service.listBookmarks(user.id, { limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('GIVEN bookmarked problem with tags WHEN listing THEN returns problem summary with aggregated tags', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, { company: 'Google' });

    const [tag1] = await db.insert(tags).values({ name: 'Array', slug: 'array' }).returning();
    const [tag2] = await db
      .insert(tags)
      .values({ name: 'Hash Table', slug: 'hash-table' })
      .returning();
    await db.insert(problemTags).values([
      { problemId: problem.id, tagId: tag1!.id },
      { problemId: problem.id, tagId: tag2!.id },
    ]);

    await db.insert(bookmarks).values({ userId: user.id, problemId: problem.id });

    const result = await service.listBookmarks(user.id, { limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      company: 'Google',
      isBookmarked: true,
    });
    // tagsAggExpr uses string_agg with slug ordering by name
    expect(result.data[0]!.tags).toEqual(expect.arrayContaining(['array', 'hash-table']));
  });

  it('GIVEN bookmarked problem with all-passing submission WHEN listing THEN attempt status is solved', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const [room] = await db
      .insert(rooms)
      .values({ hostId: user.id, mode: 'peer', inviteCode: 'BKM001' })
      .returning();

    await db.insert(submissions).values([
      {
        userId: user.id,
        roomId: room!.id,
        problemId: problem.id,
        code: 'print(1)',
        language: 'python',
        totalTestCases: 2,
        passedTestCases: 2,
        status: 'completed',
      },
      {
        userId: user.id,
        roomId: room!.id,
        problemId: problem.id,
        code: 'print(2)',
        language: 'python',
        totalTestCases: 2,
        status: 'failed',
      },
    ]);

    await db.insert(bookmarks).values({ userId: user.id, problemId: problem.id });

    const result = await service.listBookmarks(user.id, { limit: 20 });

    expect(result.data[0]!.attemptStatus).toBe('solved');
  });

  it('GIVEN only non-completed submissions WHEN listing THEN attempt status is attempted', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const [room] = await db
      .insert(rooms)
      .values({ hostId: user.id, mode: 'peer', inviteCode: 'BKM002' })
      .returning();

    await db.insert(submissions).values({
      userId: user.id,
      roomId: room!.id,
      problemId: problem.id,
      code: 'print(1)',
      language: 'python',
      totalTestCases: 1,
      status: 'failed',
    });

    await db.insert(bookmarks).values({ userId: user.id, problemId: problem.id });

    const result = await service.listBookmarks(user.id, { limit: 20 });

    expect(result.data[0]!.attemptStatus).toBe('attempted');
  });

  it('GIVEN bookmarked problem with acceptance stats WHEN listing THEN computes correct acceptance rate', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, {
      totalSubmissions: 200,
      acceptedSubmissions: 150,
    });
    await db.insert(bookmarks).values({ userId: user.id, problemId: problem.id });

    const result = await service.listBookmarks(user.id, { limit: 20 });

    expect(result.data[0]!.acceptanceRate).toBe(75);
  });

  it('GIVEN soft-deleted bookmarked problem WHEN listing THEN excludes it', async () => {
    const user = await insertUser(db);
    const activeProblem = await insertProblem(db);
    const deletedProblem = await insertProblem(db, { deletedAt: new Date() });

    await db.insert(bookmarks).values([
      { userId: user.id, problemId: activeProblem.id },
      { userId: user.id, problemId: deletedProblem.id },
    ]);

    const result = await service.listBookmarks(user.id, { limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe(activeProblem.id);
  });

  it('GIVEN bookmarks from different users WHEN listing THEN returns only current user bookmarks', async () => {
    const user1 = await insertUser(db);
    const user2 = await insertUser(db);
    const problem1 = await insertProblem(db);
    const problem2 = await insertProblem(db);

    await db.insert(bookmarks).values([
      { userId: user1.id, problemId: problem1.id },
      { userId: user2.id, problemId: problem2.id },
    ]);

    const result = await service.listBookmarks(user1.id, { limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe(problem1.id);
  });

  it('GIVEN 5 bookmarks WHEN paginating with limit=2 THEN traverses all pages without gaps or duplicates', async () => {
    const user = await insertUser(db);
    const problemIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      const problem = await insertProblem(db);
      await db.insert(bookmarks).values({
        userId: user.id,
        problemId: problem.id,
        createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      });
      problemIds.push(problem.id);
    }

    const query = { limit: 2 };

    const page1 = await service.listBookmarks(user.id, query);
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);

    const page2 = await service.listBookmarks(user.id, {
      ...query,
      cursor: page1.pagination.nextCursor!,
    });
    expect(page2.data).toHaveLength(2);
    expect(page2.pagination.hasMore).toBe(true);

    const page3 = await service.listBookmarks(user.id, {
      ...query,
      cursor: page2.pagination.nextCursor!,
    });
    expect(page3.data).toHaveLength(1);
    expect(page3.pagination.hasMore).toBe(false);
    expect(page3.pagination.nextCursor).toBeNull();

    const allIds = [...page1.data, ...page2.data, ...page3.data].map((r) => r.id);
    expect(new Set(allIds).size).toBe(5);
  });
});
