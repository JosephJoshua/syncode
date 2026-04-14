import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ERROR_CODES, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { submissions } from '@syncode/db';
import { CACHE_SERVICE } from '@syncode/shared/ports';
import { eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertProblem,
  insertRoom,
  insertTestCase,
  insertUser,
} from '@/test/integration-setup.js';
import { createMockExecutionClient } from '@/test/mock-factories.js';
import { ExecutionService } from './execution.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: ExecutionService;
let mockExecutionClient: ReturnType<typeof createMockExecutionClient>;

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  mockExecutionClient = createMockExecutionClient();

  const module = await Test.createTestingModule({
    providers: [
      ExecutionService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: mockExecutionClient },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
    ],
  }).compile();

  service = module.get(ExecutionService);
});

afterEach(async () => {
  await cleanup();
});

describe('runCode', () => {
  it('GIVEN valid input WHEN running code THEN returns jobId without creating DB record', async () => {
    const result = await service.runCode({ language: 'python', code: 'print("hello")' });

    expect(result.jobId).toBe('stub-job');

    const rows = await db.select().from(submissions);
    expect(rows).toHaveLength(0);
  });
});

describe('submitProblem', () => {
  it('GIVEN problem with test cases WHEN submitting THEN persists submission with roomId and enqueues per test case', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    await insertTestCase(db, problem.id);
    await insertTestCase(db, problem.id);
    const room = await insertRoom(db, user.id, { problemId: problem.id });

    const result = await service.submitProblem(user.id, {
      language: 'python',
      code: 'print(input())',
      problemId: problem.id,
      roomId: room.id,
    });

    expect(result.submissionId).toEqual(expect.any(String));

    const [row] = await db.select().from(submissions).where(eq(submissions.userId, user.id));
    expect(row).toBeDefined();
    expect(row.problemId).toBe(problem.id);
    expect(row.roomId).toBe(room.id);
    expect(row.totalTestCases).toBe(2);
    expect(row.status).toBe('pending');
  });

  it('GIVEN non-existent problem WHEN submitting THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);

    await expect(
      service.submitProblem(user.id, {
        language: 'python',
        code: 'print("hello")',
        problemId: '00000000-0000-0000-0000-000000000000',
        roomId: room.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('GIVEN soft-deleted problem WHEN submitting THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, { deletedAt: new Date() });
    await insertTestCase(db, problem.id);
    const room = await insertRoom(db, user.id, { problemId: problem.id });

    await expect(
      service.submitProblem(user.id, {
        language: 'python',
        code: 'print("hello")',
        problemId: problem.id,
        roomId: room.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('GIVEN problem with no test cases WHEN submitting THEN throws with PROBLEM_NO_TEST_CASES code', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, user.id, { problemId: problem.id });

    await expect(
      service.submitProblem(user.id, {
        language: 'python',
        code: 'print("hello")',
        problemId: problem.id,
        roomId: room.id,
      }),
    ).rejects.toMatchObject(
      new UnprocessableEntityException({
        message: 'Problem has no test cases',
        code: ERROR_CODES.PROBLEM_NO_TEST_CASES,
      }),
    );
  });

  it('GIVEN all jobs fail to enqueue WHEN submitting THEN marks submission as failed', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    await insertTestCase(db, problem.id);
    await insertTestCase(db, problem.id);
    const room = await insertRoom(db, user.id, { problemId: problem.id });
    mockExecutionClient.submit.mockRejectedValue(new Error('Queue unavailable'));

    const result = await service.submitProblem(user.id, {
      language: 'python',
      code: 'print(input())',
      problemId: problem.id,
      roomId: room.id,
    });

    expect(result.submissionId).toEqual(expect.any(String));

    const [row] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, result.submissionId));
    expect(row.status).toBe('failed');
    expect(row.completedAt).not.toBeNull();
  });
});
