import { Test } from '@nestjs/testing';
import type { RunCodeResult } from '@syncode/contracts';
import { EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { executionResults, submissions } from '@syncode/db';
import { CACHE_SERVICE } from '@syncode/shared/ports';
import { eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertProblem,
  insertRoom,
  insertSubmission,
  insertTestCase,
  insertUser,
} from '@/test/integration-setup.js';
import { createMockExecutionClient } from '@/test/mock-factories.js';
import { EXEC_META_KEY_PREFIX } from './execution.types.js';
import { ExecutionResultProcessor } from './execution-result.processor.js';

let db: Database;
let cleanup: () => Promise<void>;
let processor: ExecutionResultProcessor;
let cacheService: InMemoryCacheService;

const makeResult = (overrides: Partial<RunCodeResult> = {}): RunCodeResult => ({
  status: 'completed',
  stdout: '',
  stderr: '',
  exitCode: 0,
  durationMs: 42,
  timedOut: false,
  ...overrides,
});

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  cacheService = new InMemoryCacheService();

  const module = await Test.createTestingModule({
    providers: [
      ExecutionResultProcessor,
      { provide: DB_CLIENT, useValue: db },
      { provide: CACHE_SERVICE, useValue: cacheService },
      { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
    ],
  }).compile();

  processor = module.get(ExecutionResultProcessor);
});

afterEach(async () => {
  await cleanup();
});

describe('handleResult', () => {
  it('GIVEN submission with 2 test cases WHEN both results arrive THEN submission status is completed with correct counts', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const tc1 = await insertTestCase(db, problem.id, { expectedOutput: 'expected1' });
    const tc2 = await insertTestCase(db, problem.id, { expectedOutput: 'expected2' });
    const room = await insertRoom(db, user.id, { problemId: problem.id });
    const submission = await insertSubmission(db, user.id, room.id, problem.id, {
      status: 'pending',
      totalTestCases: 2,
      passedTestCases: 0,
      failedTestCases: 0,
    });

    await cacheService.set(`${EXEC_META_KEY_PREFIX}job-1`, {
      submissionId: submission.id,
      testCaseIndex: 0,
      expectedOutput: tc1.expectedOutput,
    });
    await cacheService.set(`${EXEC_META_KEY_PREFIX}job-2`, {
      submissionId: submission.id,
      testCaseIndex: 1,
      expectedOutput: tc2.expectedOutput,
    });

    await processor.handleResult('job-1', makeResult({ stdout: `${tc1.expectedOutput}\n` }));
    await processor.handleResult('job-2', makeResult({ stdout: 'wrong\n' }));

    const results = await db
      .select()
      .from(executionResults)
      .where(eq(executionResults.submissionId, submission.id));
    expect(results).toHaveLength(2);

    const [sub] = await db.select().from(submissions).where(eq(submissions.id, submission.id));
    expect(sub.status).toBe('completed');
    expect(sub.passedTestCases).toBe(1);
    expect(sub.failedTestCases).toBe(1);
    expect(sub.completedAt).not.toBeNull();
  });

  it('GIVEN 1 of 2 results arrived WHEN checking submission THEN status is running', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const tc = await insertTestCase(db, problem.id, { expectedOutput: 'hello' });
    await insertTestCase(db, problem.id);
    const room = await insertRoom(db, user.id, { problemId: problem.id });
    const submission = await insertSubmission(db, user.id, room.id, problem.id, {
      status: 'pending',
      totalTestCases: 2,
      passedTestCases: 0,
      failedTestCases: 0,
    });

    await cacheService.set(`${EXEC_META_KEY_PREFIX}job-1`, {
      submissionId: submission.id,
      testCaseIndex: 0,
      expectedOutput: tc.expectedOutput,
    });

    await processor.handleResult('job-1', makeResult({ stdout: `${tc.expectedOutput}\n` }));

    const results = await db
      .select()
      .from(executionResults)
      .where(eq(executionResults.submissionId, submission.id));
    expect(results).toHaveLength(1);

    const [sub] = await db.select().from(submissions).where(eq(submissions.id, submission.id));
    expect(sub.status).toBe('running');
    expect(sub.completedAt).toBeNull();
  });

  it('GIVEN no metadata in cache WHEN result arrives THEN nothing is persisted', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    await insertTestCase(db, problem.id);
    const room = await insertRoom(db, user.id, { problemId: problem.id });
    await insertSubmission(db, user.id, room.id, problem.id, {
      status: 'pending',
      totalTestCases: 1,
      passedTestCases: 0,
    });

    await processor.handleResult('unknown-job', makeResult());

    const results = await db.select().from(executionResults);
    expect(results).toHaveLength(0);
  });

  it('GIVEN execution failed WHEN result arrives THEN passed is null and errorMessage is set', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const tc = await insertTestCase(db, problem.id, { expectedOutput: 'hello' });
    const room = await insertRoom(db, user.id, { problemId: problem.id });
    const submission = await insertSubmission(db, user.id, room.id, problem.id, {
      status: 'pending',
      totalTestCases: 1,
      passedTestCases: 0,
      failedTestCases: 0,
    });

    await cacheService.set(`${EXEC_META_KEY_PREFIX}job-err`, {
      submissionId: submission.id,
      testCaseIndex: 0,
      expectedOutput: tc.expectedOutput,
    });

    await processor.handleResult(
      'job-err',
      makeResult({ status: 'failed', error: 'timeout', stdout: '', stderr: '' }),
    );

    const results = await db
      .select()
      .from(executionResults)
      .where(eq(executionResults.submissionId, submission.id));
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBeNull();
    expect(results[0].errorMessage).toBe('timeout');

    const [sub] = await db.select().from(submissions).where(eq(submissions.id, submission.id));
    expect(sub.status).toBe('completed');
    expect(sub.errorTestCases).toBe(1);
  });
});
