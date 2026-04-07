import type { Database } from '@syncode/db';
import {
  createTestDb,
  insertBookmark,
  insertProblem,
  insertProblemTag,
  insertRoom,
  insertSubmission,
  insertTag,
  insertTestCase,
  insertUser,
} from '@/test/integration-setup';
import { ProblemsService } from './problems.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: ProblemsService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  service = new ProblemsService(db);
});

afterEach(async () => {
  await cleanup();
});

describe('listProblems', () => {
  it('GIVEN multiple problems WHEN listing without filters THEN returns all non-deleted', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { difficulty: 'easy' });
    await insertProblem(db, { difficulty: 'hard' });
    await insertProblem(db, { deletedAt: new Date() }); // soft-deleted

    const result = await service.listProblems(user.id, { limit: 20, sortOrder: 'desc' });

    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('GIVEN difficulty filter WHEN listing THEN returns only matching difficulty', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { difficulty: 'easy' });
    await insertProblem(db, { difficulty: 'hard' });

    const result = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      difficulty: 'easy',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].difficulty).toBe('easy');
  });

  it('GIVEN search query WHEN listing THEN matches against title and description', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { title: 'Two Sum', description: 'Find two numbers' });
    await insertProblem(db, { title: 'Binary Search', description: 'Search sorted array' });

    // Match in title
    const byTitle = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      search: 'Two',
    });
    expect(byTitle.data).toHaveLength(1);
    expect(byTitle.data[0].title).toBe('Two Sum');

    // Match in description
    const byDesc = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      search: 'sorted array',
    });
    expect(byDesc.data).toHaveLength(1);
    expect(byDesc.data[0].title).toBe('Binary Search');
  });

  it('GIVEN tag filter WHEN listing THEN returns only problems with matching tags', async () => {
    const user = await insertUser(db);
    const p1 = await insertProblem(db);
    const p2 = await insertProblem(db);
    const tagArrays = await insertTag(db, { name: 'Arrays', slug: 'arrays' });
    const tagDp = await insertTag(db, { name: 'DP', slug: 'dp' });
    await insertProblemTag(db, p1.id, tagArrays.id);
    await insertProblemTag(db, p2.id, tagDp.id);

    const result = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      tags: 'arrays',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(p1.id);
  });

  it('GIVEN company filter WHEN listing THEN returns only problems from that company', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { company: 'google' });
    await insertProblem(db, { company: 'meta' });

    const result = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      company: 'google',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].company).toBe('google');
  });

  it('GIVEN problems with tags WHEN listing THEN returns tag slugs as array', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db);
    const t1 = await insertTag(db, { name: 'Arrays', slug: 'arrays' });
    const t2 = await insertTag(db, { name: 'Hash Map', slug: 'hash-map' });
    await insertProblemTag(db, p.id, t1.id);
    await insertProblemTag(db, p.id, t2.id);

    const result = await service.listProblems(user.id, { limit: 20, sortOrder: 'desc' });

    expect(result.data[0].tags).toHaveLength(2);
    expect(result.data[0].tags).toContain('arrays');
    expect(result.data[0].tags).toContain('hash-map');
  });

  it('GIVEN bookmarked problem WHEN listing THEN returns isBookmarked true for that user', async () => {
    const user = await insertUser(db);
    const otherUser = await insertUser(db);
    const p = await insertProblem(db);
    await insertBookmark(db, user.id, p.id);

    const forUser = await service.listProblems(user.id, { limit: 20, sortOrder: 'desc' });
    expect(forUser.data[0].isBookmarked).toBe(true);

    const forOther = await service.listProblems(otherUser.id, { limit: 20, sortOrder: 'desc' });
    expect(forOther.data[0].isBookmarked).toBe(false);
  });

  it('GIVEN user with accepted submission WHEN listing THEN returns attemptStatus solved', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db);
    const room = await insertRoom(db, user.id);
    await insertSubmission(db, user.id, room.id, p.id, {
      status: 'completed',
      totalTestCases: 3,
      passedTestCases: 3,
    });

    const result = await service.listProblems(user.id, { limit: 20, sortOrder: 'desc' });
    expect(result.data[0].attemptStatus).toBe('solved');
  });

  it('GIVEN user with failed submission WHEN listing THEN returns attemptStatus attempted', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db);
    const room = await insertRoom(db, user.id);
    await insertSubmission(db, user.id, room.id, p.id, {
      status: 'completed',
      totalTestCases: 3,
      passedTestCases: 1,
    });

    const result = await service.listProblems(user.id, { limit: 20, sortOrder: 'desc' });
    expect(result.data[0].attemptStatus).toBe('attempted');
  });

  it('GIVEN problem with submissions WHEN listing THEN computes acceptance rate', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { totalSubmissions: 200, acceptedSubmissions: 150 });

    const result = await service.listProblems(user.id, { limit: 20, sortOrder: 'desc' });
    expect(result.data[0].acceptanceRate).toBe(75);
  });

  it('GIVEN problem with zero submissions WHEN listing THEN acceptanceRate is null', async () => {
    const user = await insertUser(db);
    await insertProblem(db);

    const result = await service.listProblems(user.id, { limit: 20, sortOrder: 'desc' });
    expect(result.data[0].acceptanceRate).toBeNull();
  });

  it('GIVEN more problems than limit WHEN paginating THEN cursor allows fetching next page without duplicates', async () => {
    const user = await insertUser(db);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = await insertProblem(db);
      ids.push(p.id);
    }

    const page1 = await service.listProblems(user.id, { limit: 2, sortOrder: 'desc' });
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);
    expect(page1.pagination.nextCursor).toBeTruthy();

    const page2 = await service.listProblems(user.id, {
      limit: 2,
      sortOrder: 'desc',
      cursor: page1.pagination.nextCursor!,
    });
    expect(page2.data).toHaveLength(2);
    expect(page2.pagination.hasMore).toBe(true);

    const page3 = await service.listProblems(user.id, {
      limit: 2,
      sortOrder: 'desc',
      cursor: page2.pagination.nextCursor!,
    });
    expect(page3.data).toHaveLength(1);
    expect(page3.pagination.hasMore).toBe(false);

    // No duplicates across all pages
    const allIds = [...page1.data, ...page2.data, ...page3.data].map((p) => p.id);
    expect(new Set(allIds).size).toBe(5);
  });

  it('GIVEN sortBy title WHEN listing THEN returns problems sorted alphabetically', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { title: 'Zebra' });
    await insertProblem(db, { title: 'Apple' });
    await insertProblem(db, { title: 'Mango' });

    const asc = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'asc',
      sortBy: 'title',
    });
    expect(asc.data.map((p) => p.title)).toEqual(['Apple', 'Mango', 'Zebra']);

    const descResult = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      sortBy: 'title',
    });
    expect(descResult.data.map((p) => p.title)).toEqual(['Zebra', 'Mango', 'Apple']);
  });

  it('GIVEN sortBy difficulty WHEN listing THEN sorts by difficulty enum value', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { title: 'Easy', difficulty: 'easy' });
    await insertProblem(db, { title: 'Hard', difficulty: 'hard' });
    await insertProblem(db, { title: 'Medium', difficulty: 'medium' });

    const result = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'asc',
      sortBy: 'difficulty',
    });
    expect(result.data.map((p) => p.difficulty)).toEqual(['easy', 'medium', 'hard']);
  });

  it('GIVEN sortBy totalSubmissions WHEN listing THEN sorts by submission count', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { title: 'Low', totalSubmissions: 10 });
    await insertProblem(db, { title: 'High', totalSubmissions: 1000 });
    await insertProblem(db, { title: 'Mid', totalSubmissions: 100 });

    const result = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      sortBy: 'totalSubmissions',
    });
    expect(result.data.map((p) => p.title)).toEqual(['High', 'Mid', 'Low']);
  });

  it('GIVEN empty tags filter WHEN listing THEN ignores tag filter', async () => {
    const user = await insertUser(db);
    await insertProblem(db);

    const result = await service.listProblems(user.id, {
      limit: 20,
      sortOrder: 'desc',
      tags: ',,,',
    });
    expect(result.data).toHaveLength(1);
  });

  it('GIVEN sortBy title with pagination WHEN fetching page 2 THEN cursor works correctly', async () => {
    const user = await insertUser(db);
    await insertProblem(db, { title: 'Alpha' });
    await insertProblem(db, { title: 'Beta' });
    await insertProblem(db, { title: 'Gamma' });

    const page1 = await service.listProblems(user.id, {
      limit: 2,
      sortOrder: 'asc',
      sortBy: 'title',
    });
    expect(page1.data.map((p) => p.title)).toEqual(['Alpha', 'Beta']);

    const page2 = await service.listProblems(user.id, {
      limit: 2,
      sortOrder: 'asc',
      sortBy: 'title',
      cursor: page1.pagination.nextCursor!,
    });
    expect(page2.data.map((p) => p.title)).toEqual(['Gamma']);
    expect(page2.pagination.hasMore).toBe(false);
  });
});

describe('findById', () => {
  it('GIVEN existing problem WHEN finding by ID THEN returns complete detail', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db, {
      description: '# Two Sum\nFind pairs.',
      constraints: '1 <= n <= 10^4',
      examples: [{ input: '[2,7]', output: '9', explanation: 'Sum them' }],
      starterCode: { python: 'def solve():\n  pass', javascript: 'function solve() {}' },
      totalSubmissions: 200,
      acceptedSubmissions: 150,
    });

    const result = await service.findById(user.id, p.id);

    expect(result.id).toBe(p.id);
    expect(result.description).toBe('# Two Sum\nFind pairs.');
    expect(result.constraints).toBe('1 <= n <= 10^4');
    expect(result.examples).toEqual([{ input: '[2,7]', output: '9', explanation: 'Sum them' }]);
    expect(result.starterCode).toEqual({
      python: 'def solve():\n  pass',
      javascript: 'function solve() {}',
    });
    expect(result.acceptanceRate).toBe(75);
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GIVEN problem with test cases WHEN finding THEN returns only visible test cases ordered by sortOrder', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db);
    await insertTestCase(db, p.id, {
      input: 'visible-2',
      expectedOutput: 'out-2',
      isHidden: false,
      sortOrder: 2,
    });
    await insertTestCase(db, p.id, {
      input: 'hidden',
      expectedOutput: 'out-hidden',
      isHidden: true,
      sortOrder: 0,
    });
    await insertTestCase(db, p.id, {
      input: 'visible-1',
      expectedOutput: 'out-1',
      isHidden: false,
      sortOrder: 1,
    });

    const result = await service.findById(user.id, p.id);

    expect(result.testCases).toHaveLength(2);
    expect(result.testCases[0].input).toBe('visible-1');
    expect(result.testCases[1].input).toBe('visible-2');
    expect(result.testCases.every((tc) => !tc.isHidden)).toBe(true);
  });

  it('GIVEN non-existent ID WHEN finding THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    await expect(service.findById(user.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'Problem not found',
    );
  });

  it('GIVEN soft-deleted problem WHEN finding THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db, { deletedAt: new Date() });

    await expect(service.findById(user.id, p.id)).rejects.toThrow('Problem not found');
  });

  it('GIVEN user with submissions WHEN finding THEN returns correct userAttempts and attemptStatus', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db);
    const room = await insertRoom(db, user.id);

    // Failed submission
    await insertSubmission(db, user.id, room.id, p.id, {
      status: 'completed',
      totalTestCases: 3,
      passedTestCases: 1,
    });

    const attempted = await service.findById(user.id, p.id);
    expect(attempted.attemptStatus).toBe('attempted');
    expect(attempted.userAttempts).toBe(1);

    // Add solved submission
    await insertSubmission(db, user.id, room.id, p.id, {
      status: 'completed',
      totalTestCases: 3,
      passedTestCases: 3,
    });

    const solved = await service.findById(user.id, p.id);
    expect(solved.attemptStatus).toBe('solved');
    expect(solved.userAttempts).toBe(2);
  });

  it('GIVEN problem with null optional fields WHEN finding THEN returns nulls correctly', async () => {
    const user = await insertUser(db);
    const p = await insertProblem(db, {
      company: null,
      constraints: null,
      examples: null,
      starterCode: null,
    });

    const result = await service.findById(user.id, p.id);

    expect(result.company).toBeNull();
    expect(result.constraints).toBeNull();
    expect(result.examples).toEqual([]);
    expect(result.starterCode).toBeNull();
  });
});

describe('listTags', () => {
  it('GIVEN tags with problems WHEN listing THEN returns correct counts', async () => {
    const t1 = await insertTag(db, { name: 'Arrays', slug: 'arrays' });
    const t2 = await insertTag(db, { name: 'DP', slug: 'dp' });
    const p1 = await insertProblem(db);
    const p2 = await insertProblem(db);
    const p3 = await insertProblem(db);
    await insertProblemTag(db, p1.id, t1.id);
    await insertProblemTag(db, p2.id, t1.id);
    await insertProblemTag(db, p3.id, t1.id);
    await insertProblemTag(db, p1.id, t2.id);

    const result = await service.listTags();

    expect(result.data).toHaveLength(2);
    // Ordered by count desc
    expect(result.data[0]).toEqual({ slug: 'arrays', name: 'Arrays', count: 3 });
    expect(result.data[1]).toEqual({ slug: 'dp', name: 'DP', count: 1 });
  });

  it('GIVEN tag linked only to soft-deleted problems WHEN listing THEN tag is excluded', async () => {
    const tag = await insertTag(db, { name: 'Trees', slug: 'trees' });
    const p = await insertProblem(db, { deletedAt: new Date() });
    await insertProblemTag(db, p.id, tag.id);

    const result = await service.listTags();

    // Tag with 0 active problems should not appear (INNER JOIN excludes it)
    expect(result.data).toHaveLength(0);
  });

  it('GIVEN tags with same count WHEN listing THEN secondary sort is by name ascending', async () => {
    const t1 = await insertTag(db, { name: 'Zebra', slug: 'zebra' });
    const t2 = await insertTag(db, { name: 'Apple', slug: 'apple' });
    const p1 = await insertProblem(db);
    const p2 = await insertProblem(db);
    await insertProblemTag(db, p1.id, t1.id);
    await insertProblemTag(db, p2.id, t2.id);

    const result = await service.listTags();

    expect(result.data[0].name).toBe('Apple');
    expect(result.data[1].name).toBe('Zebra');
  });

  it('GIVEN no tags WHEN listing THEN returns empty array', async () => {
    const result = await service.listTags();
    expect(result.data).toEqual([]);
  });
});
