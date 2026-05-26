import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ERROR_CODES, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { runs, staticAnalysisResults, submissions } from '@syncode/db';
import { CACHE_SERVICE } from '@syncode/shared/ports';
import { eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertParticipant,
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
  it('GIVEN room context WHEN running code THEN persists run and enqueues static analysis', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);

    const result = await service.runCode(
      { language: 'python', code: 'print("hello")' },
      { userId: user.id, roomId: room.id, sessionId: null },
    );

    expect(result.jobId).toBe('stub-job');
    expect(result.staticAnalysisJobId).toEqual(expect.any(String));

    const [run] = await db.select().from(runs).where(eq(runs.userId, user.id));
    expect(run).toMatchObject({
      roomId: room.id,
      jobId: 'stub-job',
      language: 'python',
      code: 'print("hello")',
      status: 'pending',
    });

    const [analysis] = await db
      .select()
      .from(staticAnalysisResults)
      .where(eq(staticAnalysisResults.runId, run.id));
    expect(analysis).toMatchObject({
      jobId: result.staticAnalysisJobId,
      userId: user.id,
      roomId: room.id,
      runId: run.id,
      submissionId: null,
      source: 'run',
      status: 'pending',
    });
    expect(mockExecutionClient.submitStaticAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        roomId: room.id,
        runId: run.id,
        source: 'run',
        code: 'print("hello")',
      }),
      { idempotencyKey: result.staticAnalysisJobId },
    );
  });

  it('GIVEN static analysis worker responds immediately WHEN running code THEN row exists before enqueue', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);

    mockExecutionClient.submitStaticAnalysis.mockImplementation(async (_request, options) => {
      const jobId = options?.idempotencyKey ?? 'static-analysis-job';
      const rows = await db
        .select()
        .from(staticAnalysisResults)
        .where(eq(staticAnalysisResults.jobId, jobId));
      expect(rows).toHaveLength(1);
      return { jobId };
    });

    const result = await service.runCode(
      { language: 'python', code: 'print("hello")' },
      { userId: user.id, roomId: room.id, sessionId: null },
    );

    expect(result.staticAnalysisJobId).toEqual(expect.any(String));
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
    expect(result.staticAnalysisJobId).toEqual(expect.any(String));

    const [row] = await db.select().from(submissions).where(eq(submissions.userId, user.id));
    expect(row).toBeDefined();
    expect(row.problemId).toBe(problem.id);
    expect(row.roomId).toBe(room.id);
    expect(row.totalTestCases).toBe(2);
    expect(row.status).toBe('pending');

    const analysisRows = await db
      .select()
      .from(staticAnalysisResults)
      .where(eq(staticAnalysisResults.submissionId, result.submissionId));
    expect(analysisRows).toHaveLength(1);
    expect(analysisRows[0]).toMatchObject({
      userId: user.id,
      roomId: room.id,
      submissionId: result.submissionId,
      runId: null,
      source: 'submission',
      status: 'pending',
    });
    expect(mockExecutionClient.submitStaticAnalysis).toHaveBeenCalledOnce();
    expect(mockExecutionClient.submit).toHaveBeenCalledTimes(2);
  });

  it('GIVEN problem default limits WHEN test cases omit limits THEN enqueues with defaults', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, { timeLimit: 1500, memoryLimit: 256 });
    await insertTestCase(db, problem.id, { timeoutMs: null, memoryMb: null });
    const room = await insertRoom(db, user.id, { problemId: problem.id });

    await service.submitProblem(user.id, {
      language: 'python',
      code: 'print(input())',
      problemId: problem.id,
      roomId: room.id,
    });

    expect(mockExecutionClient.submit).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 1500, memoryMb: 256 }),
    );
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

  it('GIVEN draft problem WHEN submitting THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, { isPublished: false });
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

describe('getStaticAnalysisResult', () => {
  it('GIVEN completed analysis for the current user WHEN loading by job ID THEN returns report evidence', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);

    const runResult = await service.runCode(
      { language: 'python', code: 'def solve():\\n    return 1' },
      { userId: user.id, roomId: room.id, sessionId: null },
    );

    await db
      .update(staticAnalysisResults)
      .set({
        status: 'completed',
        diagnosticCount: 1,
        errorCount: 0,
        warningCount: 1,
        maxCyclomaticComplexity: 8,
        highComplexityCount: 0,
        duplicationCount: 0,
        toolFailureCount: 1,
        report: {
          diagnostics: [
            {
              tool: 'ruff',
              rule: 'N802',
              severity: 'warning',
              message: 'Function name should be lowercase',
              file: 'solution.py',
              line: 1,
              column: 5,
            },
          ],
          complexity: [
            {
              tool: 'lizard',
              functionName: 'solve',
              file: 'solution.py',
              startLine: 1,
              endLine: 2,
              cyclomaticComplexity: 8,
            },
          ],
          duplications: [],
          toolResults: [
            {
              tool: 'ruff',
              status: 'completed',
              exitCode: 0,
              durationMs: 12,
              timedOut: false,
            },
            {
              tool: 'cpd',
              status: 'failed',
              exitCode: null,
              durationMs: 15000,
              timedOut: true,
              error: 'Timed out',
            },
          ],
        },
        completedAt: new Date('2026-05-19T10:00:00.000Z'),
      })
      .where(eq(staticAnalysisResults.jobId, runResult.staticAnalysisJobId ?? ''));

    const result = await service.getStaticAnalysisResult(
      runResult.staticAnalysisJobId ?? '',
      user.id,
    );

    expect(result).toMatchObject({
      status: 'completed',
      jobId: runResult.staticAnalysisJobId,
      source: 'run',
      language: 'python',
      summary: {
        diagnosticCount: 1,
        warningCount: 1,
        maxCyclomaticComplexity: 8,
        toolFailureCount: 1,
      },
    });
    expect(result.status).toBe('completed');
    expect(result.diagnostics[0]?.message).toBe('Function name should be lowercase');
    expect(result.complexity[0]?.functionName).toBe('solve');
    expect(result.toolResults.some((tool) => tool.status === 'failed')).toBe(true);
  });

  it('GIVEN another user owns the analysis WHEN loading by job ID THEN throws NotFoundException', async () => {
    const owner = await insertUser(db);
    const other = await insertUser(db);
    const room = await insertRoom(db, owner.id);

    await service.runCode(
      { language: 'python', code: 'print("private")' },
      { userId: owner.id, roomId: room.id, sessionId: null },
    );

    const ownerAnalysis = await db
      .select()
      .from(staticAnalysisResults)
      .where(eq(staticAnalysisResults.userId, owner.id));

    await expect(
      service.getStaticAnalysisResult(ownerAnalysis[0]?.jobId ?? '', other.id),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('execution job access control', () => {
  it('GIVEN run owner WHEN polling result and status THEN returns execution payload', async () => {
    const owner = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    const run = await service.runCode(
      { language: 'python', code: 'print("owner")' },
      { userId: owner.id, roomId: room.id, sessionId: null },
    );

    mockExecutionClient.getResult.mockResolvedValue({
      status: 'completed',
      stdout: 'owner\n',
      stderr: '',
      exitCode: 0,
      durationMs: 12,
      memoryUsageMb: 16,
      timedOut: false,
    });
    mockExecutionClient.getJobStatus.mockResolvedValue('running');

    await expect(service.getExecutionResult(run.jobId, owner.id)).resolves.toMatchObject({
      status: 'completed',
      stdout: 'owner\n',
    });
    await expect(service.getExecutionStatus(run.jobId, owner.id)).resolves.toEqual({
      status: 'running',
    });
  });

  it('GIVEN active room participant WHEN polling another user run THEN access is allowed', async () => {
    const owner = await insertUser(db);
    const participant = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    await insertParticipant(db, room.id, participant.id, 'observer');

    const run = await service.runCode(
      { language: 'python', code: 'print("shared")' },
      { userId: owner.id, roomId: room.id, sessionId: null },
    );

    mockExecutionClient.getResult.mockResolvedValue({
      status: 'completed',
      stdout: 'shared\n',
      stderr: '',
      exitCode: 0,
      durationMs: 10,
      memoryUsageMb: 12,
      timedOut: false,
    });

    await expect(service.getExecutionResult(run.jobId, participant.id)).resolves.toMatchObject({
      status: 'completed',
      stdout: 'shared\n',
    });
  });

  it('GIVEN non-participant user WHEN polling another user run THEN throws NotFoundException', async () => {
    const owner = await insertUser(db);
    const outsider = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    const run = await service.runCode(
      { language: 'python', code: 'print("private")' },
      { userId: owner.id, roomId: room.id, sessionId: null },
    );

    await expect(service.getExecutionResult(run.jobId, outsider.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockExecutionClient.getResult).not.toHaveBeenCalled();
    expect(mockExecutionClient.getJobStatus).not.toHaveBeenCalled();
  });

  it('GIVEN admin user WHEN polling another user run THEN access is allowed', async () => {
    const owner = await insertUser(db);
    const admin = await insertUser(db, { role: 'admin' });
    const room = await insertRoom(db, owner.id);
    const run = await service.runCode(
      { language: 'python', code: 'print("admin-visible")' },
      { userId: owner.id, roomId: room.id, sessionId: null },
    );

    mockExecutionClient.getResult.mockResolvedValue({
      status: 'completed',
      stdout: 'admin-visible\n',
      stderr: '',
      exitCode: 0,
      durationMs: 11,
      memoryUsageMb: 13,
      timedOut: false,
    });

    await expect(service.getExecutionResult(run.jobId, admin.id)).resolves.toMatchObject({
      status: 'completed',
      stdout: 'admin-visible\n',
    });
  });

  it('GIVEN unknown job id WHEN polling THEN throws NotFoundException with execution code', async () => {
    const user = await insertUser(db);

    await expect(service.getExecutionResult('missing-job', user.id)).rejects.toMatchObject(
      new NotFoundException({
        message: 'Execution job missing-job not found',
        code: ERROR_CODES.EXECUTION_JOB_NOT_FOUND,
      }),
    );
  });
});
