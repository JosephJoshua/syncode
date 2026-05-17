import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AI_CLIENT, ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  aiMessages,
  executionResults,
  sessionReports,
  userWeaknesses,
  weaknessSessions,
} from '@syncode/db';
import { CACHE_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, asc, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertPeerFeedbackRow,
  insertProblem,
  insertRoom,
  insertRun,
  insertSession,
  insertSessionParticipant,
  insertSessionReport,
  insertSubmission,
  insertTestCase,
  insertUser,
} from '@/test/integration-setup.js';
import { createMockAiClient, createMockStorageService } from '@/test/mock-factories.js';
import { SessionReportRequestBuilderService } from './session-report-request-builder.service.js';
import { SessionReportsService } from './session-reports.service.js';
import { SessionsService } from './sessions.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: SessionReportsService;
let mockAiClient: ReturnType<typeof createMockAiClient>;
let cacheService: InMemoryCacheService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  mockAiClient = createMockAiClient();
  cacheService = new InMemoryCacheService();

  const module = await Test.createTestingModule({
    providers: [
      SessionsService,
      SessionReportRequestBuilderService,
      SessionReportsService,
      { provide: DB_CLIENT, useValue: db },
      { provide: AI_CLIENT, useValue: mockAiClient },
      { provide: CACHE_SERVICE, useValue: cacheService },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
    ],
  }).compile();

  service = module.get(SessionReportsService);
});

afterEach(async () => {
  await cleanup();
});

describe('enqueueForFinishedSession', () => {
  it('GIVEN finished session data WHEN enqueuing reports THEN creates pending rows and submits participant-scoped evidence to AI', async () => {
    const interviewer = await insertUser(db, { username: 'interviewer' });
    const candidate = await insertUser(db, { username: 'candidate' });
    const problem = await insertProblem(db, {
      title: 'Two Sum',
      description: 'Return indices of two numbers.',
      constraints: '2 <= nums.length <= 10^4',
    });

    const room = await insertRoom(db, interviewer.id, {
      problemId: problem.id,
      language: 'python',
    });
    const session = await insertSession(db, room.id, {
      problemId: problem.id,
      language: 'python',
      status: 'finished',
      durationMs: 120000,
    });
    await insertSessionParticipant(db, session.id, interviewer.id, 'interviewer');
    await insertSessionParticipant(db, session.id, candidate.id, 'candidate');

    const testCase = await insertTestCase(db, problem.id, {
      sortOrder: 0,
      input: 'nums = [2,7,11,15], target = 9',
      expectedOutput: '[0,1]',
      description: 'Basic happy path',
      isHidden: false,
    });
    const submission = await insertSubmission(db, candidate.id, room.id, problem.id, {
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      totalTestCases: 1,
      passedTestCases: 1,
      totalDurationMs: 18,
    });
    await db.insert(executionResults).values({
      submissionId: submission.id,
      testCaseIndex: testCase.sortOrder,
      passed: true,
      expected: testCase.expectedOutput,
      actual: '[0,1]',
      stdout: '[0,1]\n',
      stderr: '',
      exitCode: 0,
      durationMs: 18,
      memoryUsageMb: 8.2,
      timedOut: false,
      errorMessage: null,
    });
    await insertRun(db, room.id, candidate.id, {
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      durationMs: 16,
      stdout: '[0,1]\n',
    });
    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: interviewer.id,
      candidateId: candidate.id,
    });
    await db.insert(aiMessages).values({
      roomId: room.id,
      sessionId: session.id,
      userId: candidate.id,
      role: 'assistant',
      content: 'Talk through your complexity reasoning.',
    });

    const previousRoom = await insertRoom(db, candidate.id);
    const previousSession = await insertSession(db, previousRoom.id, { status: 'finished' });
    await insertSessionParticipant(db, previousSession.id, candidate.id, 'candidate');
    await insertSessionReport(db, previousSession.id, {
      userId: candidate.id,
      overallScore: 72,
      status: 'completed',
    });

    mockAiClient.submitSessionReportRequest
      .mockResolvedValueOnce({ jobId: 'report-job-1' })
      .mockResolvedValueOnce({ jobId: 'report-job-2' });

    await service.enqueueForFinishedSession(session.id);

    const reportRows = await db
      .select({
        userId: sessionReports.userId,
        status: sessionReports.status,
      })
      .from(sessionReports)
      .where(eq(sessionReports.sessionId, session.id))
      .orderBy(asc(sessionReports.userId));

    expect(reportRows).toHaveLength(2);
    expect(reportRows).toEqual(
      expect.arrayContaining([
        { userId: candidate.id, status: 'pending' },
        { userId: interviewer.id, status: 'pending' },
      ]),
    );

    expect(mockAiClient.submitSessionReportRequest).toHaveBeenCalledTimes(2);
    expect(mockAiClient.submitSessionReportRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        participantId: candidate.id,
        participantRole: 'candidate',
        language: 'python',
        participants: expect.arrayContaining([
          expect.objectContaining({ userId: interviewer.id, role: 'interviewer' }),
          expect.objectContaining({ userId: candidate.id, role: 'candidate' }),
        ]),
        historicalContext: {
          sessionsCompared: 1,
          averageScore: 72,
          priorScores: [72],
        },
        finalTestCaseBreakdown: [
          expect.objectContaining({
            testCaseIndex: 0,
            input: null,
            passed: true,
            expectedOutput: null,
            actualOutput: null,
          }),
        ],
      }),
    );
  });
});

describe('handleResult', () => {
  it('GIVEN cached job metadata WHEN handling result THEN stores completed report for the participant row', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    const previousRoom = await insertRoom(db, user.id);
    const previousSession = await insertSession(db, previousRoom.id, { status: 'finished' });
    await insertSessionParticipant(db, previousSession.id, user.id, 'candidate');
    await insertSessionReport(db, previousSession.id, {
      userId: user.id,
      status: 'completed',
      overallScore: 82,
      report: {
        sessionId: previousSession.id,
        generatedAt: '2026-04-19T07:00:00.000Z',
        overallScore: 82,
        dimensions: {
          efficiency: {
            score: 88,
            feedback: 'Efficient solution.',
            evidence: [],
          },
        },
        strengths: [],
        areasForImprovement: [],
        detailedFeedback: 'Prior report',
        comparisonToHistory: null,
        peerFeedbackSummary: null,
        testCaseBreakdown: [],
      },
    });
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'pending',
      report: null,
      overallScore: null,
      generatedAt: null,
    });

    await cacheService.set(
      'session-report-meta:job-123',
      { sessionId: session.id, userId: user.id },
      60,
    );

    await service.handleResult('job-123', {
      sessionId: session.id,
      generatedAt: '2026-04-20T06:00:00.000Z',
      overallScore: 91,
      dimensions: {
        efficiency: {
          score: 62,
          feedback: 'The solution uses quadratic time complexity.',
          evidence: [],
        },
        correctness: {
          score: 78,
          feedback: 'Misses edge cases around duplicate values.',
          evidence: [],
        },
      },
      strengths: ['Clear reasoning'],
      areasForImprovement: ['Improve time complexity and cover edge cases.'],
      detailedFeedback: 'Detailed feedback',
      comparisonToHistory: null,
      peerFeedbackSummary: null,
      testCaseBreakdown: [],
      model: 'qwen3.5-mini',
    });

    const [row] = await db
      .select({
        status: sessionReports.status,
        overallScore: sessionReports.overallScore,
        model: sessionReports.model,
        generatedAt: sessionReports.generatedAt,
        report: sessionReports.report,
      })
      .from(sessionReports)
      .where(and(eq(sessionReports.sessionId, session.id), eq(sessionReports.userId, user.id)));

    expect(row.status).toBe('completed');
    expect(row.overallScore).toBe(91);
    expect(row.model).toBe('qwen3.5-mini');
    expect(row.generatedAt?.toISOString()).toBe('2026-04-20T06:00:00.000Z');
    expect(row.report).toMatchObject({
      sessionId: session.id,
      overallScore: 91,
      strengths: ['Clear reasoning'],
    });
    expect(await cacheService.get('session-report-meta:job-123')).toBeNull();

    const weaknessRows = await db
      .select({
        id: userWeaknesses.id,
        category: userWeaknesses.category,
        frequency: userWeaknesses.frequency,
        trend: userWeaknesses.trend,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id))
      .orderBy(asc(userWeaknesses.category));
    const weaknessLinks = await db
      .select({
        weaknessId: weaknessSessions.weaknessId,
        sessionId: weaknessSessions.sessionId,
      })
      .from(weaknessSessions);

    expect(weaknessRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'edge_cases',
          frequency: 1,
        }),
        expect.objectContaining({
          category: 'time_complexity',
          frequency: 1,
          trend: 'worsening',
        }),
      ]),
    );
    expect(weaknessLinks).toEqual(
      expect.arrayContaining(
        weaknessRows.map((weakness) => ({
          weaknessId: weakness.id,
          sessionId: session.id,
        })),
      ),
    );
  });

  it('GIVEN regenerated report WHEN weaknesses change THEN replaces stale weakness links', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'pending',
      report: null,
      overallScore: null,
      generatedAt: null,
    });
    await cacheService.set(
      'session-report-meta:first-job',
      { sessionId: session.id, userId: user.id },
      60,
    );

    await service.handleResult('first-job', {
      sessionId: session.id,
      generatedAt: '2026-04-20T06:00:00.000Z',
      overallScore: 70,
      dimensions: {
        efficiency: {
          score: 60,
          feedback: 'Use an index map to optimize lookup.',
          evidence: [],
        },
      },
      strengths: [],
      areasForImprovement: [],
      detailedFeedback: 'Initial report',
      comparisonToHistory: null,
      peerFeedbackSummary: null,
      testCaseBreakdown: [],
    });

    const initialWeaknessRows = await db
      .select({ category: userWeaknesses.category })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id));

    expect(initialWeaknessRows).toEqual([{ category: 'time_complexity' }]);

    await cacheService.set(
      'session-report-meta:second-job',
      { sessionId: session.id, userId: user.id },
      60,
    );

    await service.handleResult('second-job', {
      sessionId: session.id,
      generatedAt: '2026-04-20T07:00:00.000Z',
      overallScore: 96,
      dimensions: {
        efficiency: {
          score: 96,
          feedback: 'The solution now uses efficient lookup.',
          evidence: [],
        },
      },
      strengths: ['Improved lookup strategy'],
      areasForImprovement: [],
      detailedFeedback: 'Clean regenerated report',
      comparisonToHistory: null,
      peerFeedbackSummary: null,
      testCaseBreakdown: [],
    });

    const regeneratedWeaknessRows = await db
      .select({ id: userWeaknesses.id })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id));
    const regeneratedWeaknessLinks = await db.select().from(weaknessSessions);

    expect(regeneratedWeaknessRows).toEqual([]);
    expect(regeneratedWeaknessLinks).toEqual([]);
  });
});

describe('getReport', () => {
  it('GIVEN completed participant report WHEN getting THEN returns the stored report', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);
    await insertSessionReport(db, session.id, {
      userId: user.id,
      report: {
        sessionId: session.id,
        generatedAt: '2026-04-20T07:00:00.000Z',
        overallScore: 84,
        strengths: ['Persistent debugging'],
        areasForImprovement: ['State assumptions earlier'],
        detailedFeedback: 'Detailed feedback',
        comparisonToHistory: null,
        peerFeedbackSummary: null,
        testCaseBreakdown: [],
      },
    });

    const result = await service.getReport(session.id, user.id, false);

    expect(result).toMatchObject({
      sessionId: session.id,
      overallScore: 84,
      strengths: ['Persistent debugging'],
    });
  });

  it('GIVEN pending report row WHEN getting THEN throws not-ready 404', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'pending',
      report: null,
      overallScore: null,
      generatedAt: null,
    });

    await expect(service.getReport(session.id, user.id, false)).rejects.toMatchObject<
      Partial<NotFoundException>
    >({
      response: expect.objectContaining({ code: ERROR_CODES.SESSION_REPORT_NOT_READY }),
    });
  });
});
