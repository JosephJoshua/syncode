import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AI_CLIENT, COLLAB_CLIENT, ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  aiMessages,
  executionResults,
  sessionReports,
  staticAnalysisResults,
  userWeaknesses,
  weaknessSessions,
} from '@syncode/db';
import { CACHE_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, asc, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertCodeSnapshot,
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
import {
  createMockAiClient,
  createMockCollabClient,
  createMockStorageService,
} from '@/test/mock-factories.js';
import { SessionReportRequestBuilderService } from './session-report-request-builder.service.js';
import { SessionReportsService } from './session-reports.service.js';
import { SessionsService } from './sessions.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: SessionReportsService;
let mockAiClient: ReturnType<typeof createMockAiClient>;
let mockCollabClient: ReturnType<typeof createMockCollabClient>;
let cacheService: InMemoryCacheService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  mockAiClient = createMockAiClient();
  mockCollabClient = createMockCollabClient();
  cacheService = new InMemoryCacheService();

  const module = await Test.createTestingModule({
    providers: [
      SessionsService,
      SessionReportRequestBuilderService,
      SessionReportsService,
      { provide: DB_CLIENT, useValue: db },
      { provide: AI_CLIENT, useValue: mockAiClient },
      { provide: COLLAB_CLIENT, useValue: mockCollabClient },
      { provide: CACHE_SERVICE, useValue: cacheService },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
    ],
  }).compile();

  service = module.get(SessionReportsService);
});

afterEach(async () => {
  await cleanup();
});

async function insertRequiredSessionEndSnapshot(
  sessionId: string,
  roomId: string,
  code = 'def solution(): return [0, 1]',
): Promise<void> {
  await insertCodeSnapshot(db, {
    sessionId,
    roomId,
    code,
    language: 'python',
    trigger: 'session_end',
    phase: 'finished',
    createdAt: new Date('2026-04-20T06:00:00.000Z'),
  });
}

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
    const hiddenTestCase = await insertTestCase(db, problem.id, {
      sortOrder: 1,
      input: 'secret hidden input',
      expectedOutput: 'secret expected output',
      description: 'Hidden edge case',
      isHidden: true,
    });
    const submission = await insertSubmission(db, candidate.id, room.id, problem.id, {
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      totalTestCases: 3,
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
    await db.insert(executionResults).values({
      submissionId: submission.id,
      testCaseIndex: hiddenTestCase.sortOrder,
      passed: false,
      expected: hiddenTestCase.expectedOutput,
      actual: 'secret actual output',
      stdout: 'secret hidden stdout\n',
      stderr: 'secret hidden stderr',
      exitCode: 1,
      durationMs: 18,
      memoryUsageMb: 8.2,
      timedOut: false,
      errorMessage: 'secret hidden error',
    });
    await db.insert(executionResults).values({
      submissionId: submission.id,
      testCaseIndex: 2,
      passed: false,
      expected: 'missing metadata expected output',
      actual: 'missing metadata actual output',
      stdout: 'missing metadata stdout\n',
      stderr: 'missing metadata stderr',
      exitCode: 1,
      durationMs: 18,
      memoryUsageMb: 8.2,
      timedOut: false,
      errorMessage: 'missing metadata error',
    });
    await insertRun(db, room.id, candidate.id, {
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      durationMs: 16,
      stdout: '[0,1]\n',
    });
    await db.insert(staticAnalysisResults).values({
      jobId: 'analysis-submission-1',
      userId: candidate.id,
      roomId: room.id,
      submissionId: submission.id,
      language: 'python',
      source: 'submission',
      status: 'completed',
      diagnosticCount: 1,
      errorCount: 0,
      warningCount: 1,
      maxCyclomaticComplexity: 14,
      highComplexityCount: 1,
      duplicationCount: 1,
      toolFailureCount: 0,
      report: {
        summary: {
          diagnosticCount: 1,
          maxCyclomaticComplexity: 14,
          duplicationCount: 1,
        },
        diagnostics: [
          {
            tool: 'ruff',
            rule: 'F841',
            severity: 'warning',
            message: 'Local variable is assigned but never used',
            line: 4,
          },
        ],
        complexity: [
          {
            tool: 'lizard',
            functionName: 'two_sum',
            file: 'Main.py',
            startLine: 1,
            cyclomaticComplexity: 14,
          },
        ],
        duplications: [
          {
            tool: 'pmd-cpd',
            lines: 8,
            occurrences: [
              { file: 'Main.py', startLine: 3, endLine: 10 },
              { file: 'Main.py', startLine: 14, endLine: 21 },
            ],
          },
        ],
      },
      completedAt: new Date('2026-04-20T01:03:00.000Z'),
    });
    await insertCodeSnapshot(db, {
      sessionId: session.id,
      roomId: room.id,
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      trigger: 'phase_change',
      phase: 'wrapup',
      createdAt: new Date('2026-04-20T01:01:00.000Z'),
    });
    await insertCodeSnapshot(db, {
      sessionId: session.id,
      roomId: room.id,
      code: 'def two_sum(nums, target): return [0, 1]',
      language: 'python',
      trigger: 'session_end',
      phase: 'finished',
      createdAt: new Date('2026-04-20T01:02:00.000Z'),
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
    mockCollabClient.getRoomChatHistory.mockResolvedValueOnce({
      messages: [
        {
          messageId: 'chat-1',
          roomId: room.id,
          userId: candidate.id,
          text: 'I think hashmap should work here.',
          replyToMessageId: null,
          mentions: [],
          attachments: [],
          reactions: [],
          createdAt: new Date('2026-04-20T01:00:40.000Z').getTime(),
          updatedAt: new Date('2026-04-20T01:00:40.000Z').getTime(),
        },
        {
          messageId: 'chat-2',
          roomId: room.id,
          userId: interviewer.id,
          text: '',
          replyToMessageId: null,
          mentions: [],
          attachments: [
            {
              kind: 'file',
              key: 'rooms/file-1',
              url: 'https://example.com/file-1',
              fileName: 'hint.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
            },
          ],
          reactions: [],
          createdAt: new Date('2026-04-20T01:00:55.000Z').getTime(),
          updatedAt: new Date('2026-04-20T01:00:55.000Z').getTime(),
        },
      ],
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
    const candidateRequest = mockAiClient.submitSessionReportRequest.mock.calls.find(
      ([request]) => request.participantId === candidate.id,
    )?.[0];
    expect(candidateRequest).toBeDefined();
    expect(candidateRequest?.sessionEvents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'stage_transition',
          metadata: expect.objectContaining({ trigger: 'session_end' }),
        }),
      ]),
    );
    expect(candidateRequest).toEqual(
      expect.objectContaining({
        sessionId: session.id,
        participantId: candidate.id,
        participantRole: 'candidate',
        language: 'python',
        sessionEvents: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'stage_transition',
          }),
          expect.objectContaining({
            eventType: 'submission',
            metadata: expect.objectContaining({
              passed: 1,
              total: 3,
            }),
          }),
        ]),
        finalCodeSnapshot: expect.objectContaining({
          trigger: 'session_end',
          language: 'python',
          phase: 'finished',
        }),
        staticAnalysis: [
          expect.objectContaining({
            source: 'submission',
            submissionId: submission.id,
            summary: expect.objectContaining({
              diagnosticCount: 1,
              maxCyclomaticComplexity: 14,
              duplicationCount: 1,
            }),
          }),
        ],
        participants: expect.arrayContaining([
          expect.objectContaining({ userId: interviewer.id, role: 'interviewer' }),
          expect.objectContaining({ userId: candidate.id, role: 'candidate' }),
        ]),
        roomChatMessages: [
          {
            role: 'user',
            content: 'User 2 (candidate): I think hashmap should work here.',
            createdAt: '2026-04-20T01:00:40.000Z',
          },
          {
            role: 'user',
            content: 'User 1 (interviewer): [attachments: hint.png]',
            createdAt: '2026-04-20T01:00:55.000Z',
          },
        ],
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
          expect.objectContaining({
            testCaseIndex: 1,
            input: null,
            description: null,
            passed: false,
            expectedOutput: null,
            actualOutput: null,
            stdout: null,
            stderr: null,
            errorMessage: 'Hidden test failed',
          }),
          expect.objectContaining({
            testCaseIndex: 2,
            input: null,
            description: null,
            isHidden: true,
            passed: false,
            expectedOutput: null,
            actualOutput: null,
            stdout: null,
            stderr: null,
            errorMessage: 'Hidden test failed',
          }),
        ],
      }),
    );
  });

  it('GIVEN no session_end snapshot WHEN enqueuing reports THEN fails closed before submitting AI jobs', async () => {
    const interviewer = await insertUser(db, { username: 'interviewer' });
    const candidate = await insertUser(db, { username: 'candidate' });
    const room = await insertRoom(db, interviewer.id, { language: 'python' });
    const session = await insertSession(db, room.id, {
      language: 'python',
      status: 'finished',
      durationMs: 120000,
    });
    await insertSessionParticipant(db, session.id, interviewer.id, 'interviewer');
    await insertSessionParticipant(db, session.id, candidate.id, 'candidate');
    await insertCodeSnapshot(db, {
      sessionId: session.id,
      roomId: room.id,
      code: 'def stale(): return None',
      language: 'python',
      trigger: 'phase_change',
      phase: 'wrapup',
      createdAt: new Date('2026-04-20T01:01:00.000Z'),
    });

    await expect(service.enqueueForFinishedSession(session.id)).rejects.toThrow(
      'Cannot build session report without a session_end code snapshot',
    );

    expect(mockAiClient.submitSessionReportRequest).not.toHaveBeenCalled();
    const reportRows = await db
      .select({ id: sessionReports.id })
      .from(sessionReports)
      .where(eq(sessionReports.sessionId, session.id));
    expect(reportRows).toHaveLength(0);
  });

  it('GIVEN collab chat history lookup fails WHEN enqueuing reports THEN still submits AI jobs with empty roomChatMessages', async () => {
    const user = await insertUser(db, { username: 'candidate-no-chat' });
    const room = await insertRoom(db, user.id, { language: 'python' });
    const session = await insertSession(db, room.id, {
      language: 'python',
      status: 'finished',
      durationMs: 90000,
    });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertRequiredSessionEndSnapshot(
      session.id,
      room.id,
      'def two_sum():\n    return [0, 1]',
    );

    mockCollabClient.getRoomChatHistory.mockRejectedValueOnce(new Error('collab unavailable'));

    await service.enqueueForFinishedSession(session.id);

    expect(mockAiClient.submitSessionReportRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        participantId: user.id,
        roomChatMessages: [],
      }),
    );
  });

  it('GIVEN session report result is already cached WHEN enqueuing report THEN persists it after metadata is stored', async () => {
    const user = await insertUser(db, { username: 'candidate-fast-report' });
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, {
      status: 'finished',
      durationMs: 90000,
    });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertRequiredSessionEndSnapshot(session.id, room.id);

    mockAiClient.submitSessionReportRequest.mockResolvedValueOnce({
      jobId: 'fast-report-job',
    });
    mockAiClient.getSessionReportResult.mockResolvedValueOnce({
      sessionId: session.id,
      generatedAt: '2026-04-20T06:00:00.000Z',
      overallScore: 92,
      dimensions: {
        communication: {
          score: 62,
          feedback: 'Explain trade-offs more clearly.',
          evidence: [],
        },
      },
      strengths: ['Reached a solution'],
      areasForImprovement: ['Explain trade-offs more clearly.'],
      detailedFeedback: 'Cached report result',
      comparisonToHistory: null,
      peerFeedbackSummary: null,
      testCaseBreakdown: [],
      model: 'qwen3.5-mini',
    });

    await service.enqueueForFinishedSession(session.id);

    const [row] = await db
      .select({
        status: sessionReports.status,
        overallScore: sessionReports.overallScore,
        generatedAt: sessionReports.generatedAt,
        report: sessionReports.report,
      })
      .from(sessionReports)
      .where(and(eq(sessionReports.sessionId, session.id), eq(sessionReports.userId, user.id)));
    const weaknessRows = await db
      .select({ category: userWeaknesses.category })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id));

    expect(row.status).toBe('completed');
    expect(row.overallScore).toBe(92);
    expect(row.generatedAt?.toISOString()).toBe('2026-04-20T06:00:00.000Z');
    expect(row.report).toMatchObject({ detailedFeedback: 'Cached report result' });
    expect(weaknessRows).toEqual([{ category: 'communication' }]);
    expect(await cacheService.get('session-report-meta:fast-report-job')).toBeNull();
  });
});

describe('handleResult', () => {
  it('GIVEN cached job metadata WHEN handling result THEN stores completed report for the participant row', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertRequiredSessionEndSnapshot(session.id, room.id);
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
    const requestedAt = new Date('2026-04-20T05:59:00.000Z');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'pending',
      requestedAt,
      report: null,
      overallScore: null,
      generatedAt: null,
    });

    await cacheService.set(
      'session-report-meta:job-123',
      { sessionId: session.id, userId: user.id, requestedAt: requestedAt.toISOString() },
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
    expect(mockAiClient.submitWeaknessAnalysisRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        participantId: user.id,
        participantRole: 'candidate',
        sessionReportGeneratedAt: '2026-04-20T06:00:00.000Z',
        sessionReportSummary: {
          overallScore: 91,
          feedback: 'Detailed feedback',
        },
        historicalWeaknesses: [],
      }),
    );
    expect(await cacheService.get('weakness-analysis-meta:ai-weakness-analysis-job')).toEqual({
      sessionId: session.id,
      userId: user.id,
      reportedAt: '2026-04-20T06:00:00.000Z',
    });

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

  it('GIVEN weakness result is already cached WHEN handling report result THEN persists AI weakness after heuristic fallback', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertRequiredSessionEndSnapshot(session.id, room.id);
    const requestedAt = new Date('2026-04-20T05:59:00.000Z');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'pending',
      requestedAt,
      report: null,
      overallScore: null,
      generatedAt: null,
    });
    await cacheService.set(
      'session-report-meta:job-fast-result',
      { sessionId: session.id, userId: user.id, requestedAt: requestedAt.toISOString() },
      60,
    );
    mockAiClient.submitWeaknessAnalysisRequest.mockResolvedValueOnce({
      jobId: 'fast-weakness-job',
    });
    mockAiClient.getWeaknessAnalysisResult.mockResolvedValueOnce({
      sessionId: session.id,
      participantId: user.id,
      reportedAt: '2026-04-20T06:00:00.000Z',
      summary: 'AI result was cached before metadata handling completed.',
      recurringPatterns: ['Communication needs clearer explanation.'],
      weaknesses: [
        {
          category: 'communication',
          description: 'Explain invariants out loud before coding.',
          evidence: 'AI evidence should replace the heuristic time-complexity fallback.',
          trend: 'stable',
        },
      ],
    });

    await service.handleResult('job-fast-result', {
      sessionId: session.id,
      generatedAt: '2026-04-20T06:00:00.000Z',
      overallScore: 91,
      dimensions: {
        efficiency: {
          score: 62,
          feedback: 'The solution uses quadratic time complexity.',
          evidence: [],
        },
      },
      strengths: [],
      areasForImprovement: ['Improve time complexity.'],
      detailedFeedback: 'Detailed feedback',
      comparisonToHistory: null,
      peerFeedbackSummary: null,
      testCaseBreakdown: [],
    });

    const weaknessRows = await db
      .select({
        category: userWeaknesses.category,
        description: userWeaknesses.description,
        trend: userWeaknesses.trend,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id));
    const weaknessLinks = await db.select().from(weaknessSessions);

    expect(weaknessRows).toEqual([
      {
        category: 'communication',
        description: 'Explain invariants out loud before coding.',
        trend: 'stable',
      },
    ]);
    expect(weaknessLinks).toEqual([
      expect.objectContaining({
        description: 'AI evidence should replace the heuristic time-complexity fallback.',
        reportedAt: new Date('2026-04-20T06:00:00.000Z'),
      }),
    ]);
    expect(await cacheService.get('weakness-analysis-meta:fast-weakness-job')).toBeNull();
  });

  it('GIVEN regenerated report WHEN weaknesses change THEN replaces stale weakness links', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertRequiredSessionEndSnapshot(session.id, room.id);
    const firstRequestedAt = new Date('2026-04-20T05:59:00.000Z');
    const secondRequestedAt = new Date('2026-04-20T06:59:00.000Z');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'pending',
      requestedAt: firstRequestedAt,
      report: null,
      overallScore: null,
      generatedAt: null,
    });
    await cacheService.set(
      'session-report-meta:first-job',
      { sessionId: session.id, userId: user.id, requestedAt: firstRequestedAt.toISOString() },
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

    await db
      .update(sessionReports)
      .set({
        status: 'pending',
        requestedAt: secondRequestedAt,
        generatedAt: null,
        overallScore: null,
        report: null,
        model: null,
        errorMessage: null,
      })
      .where(and(eq(sessionReports.sessionId, session.id), eq(sessionReports.userId, user.id)));

    await cacheService.set(
      'session-report-meta:second-job',
      { sessionId: session.id, userId: user.id, requestedAt: secondRequestedAt.toISOString() },
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

  it('GIVEN stale session report metadata WHEN handling result THEN keeps newer report and weakness links', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    const currentRequestedAt = new Date('2026-04-20T06:59:00.000Z');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'completed',
      requestedAt: currentRequestedAt,
      generatedAt: new Date('2026-04-20T07:00:00.000Z'),
      overallScore: 96,
      report: {
        sessionId: session.id,
        generatedAt: '2026-04-20T07:00:00.000Z',
        overallScore: 96,
        strengths: ['Current report'],
        areasForImprovement: [],
        detailedFeedback: 'Current report',
        comparisonToHistory: null,
        peerFeedbackSummary: null,
        testCaseBreakdown: [],
      },
    });
    const [currentWeakness] = await db
      .insert(userWeaknesses)
      .values({
        userId: user.id,
        category: 'communication',
        description: 'Current weakness from newer report',
        frequency: 1,
        trend: 'stable',
        lastSeenAt: new Date('2026-04-20T07:00:00.000Z'),
      })
      .returning({ id: userWeaknesses.id });
    await db.insert(weaknessSessions).values({
      weaknessId: currentWeakness!.id,
      sessionId: session.id,
      description: 'Current report evidence',
      trend: 'stable',
      score: null,
      reportedAt: new Date('2026-04-20T07:00:00.000Z'),
    });
    await cacheService.set(
      'session-report-meta:stale-report-job',
      {
        sessionId: session.id,
        userId: user.id,
        requestedAt: '2026-04-20T05:59:00.000Z',
      },
      60,
    );

    await service.handleResult('stale-report-job', {
      sessionId: session.id,
      generatedAt: '2026-04-20T06:00:00.000Z',
      overallScore: 70,
      dimensions: {
        efficiency: {
          score: 60,
          feedback: 'Stale time complexity critique.',
          evidence: [],
        },
      },
      strengths: [],
      areasForImprovement: ['Stale improvement'],
      detailedFeedback: 'Stale report',
      comparisonToHistory: null,
      peerFeedbackSummary: null,
      testCaseBreakdown: [],
    });

    const [reportRow] = await db
      .select({
        overallScore: sessionReports.overallScore,
        generatedAt: sessionReports.generatedAt,
        report: sessionReports.report,
      })
      .from(sessionReports)
      .where(and(eq(sessionReports.sessionId, session.id), eq(sessionReports.userId, user.id)));
    const weaknessRows = await db
      .select({
        category: userWeaknesses.category,
        description: userWeaknesses.description,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id));
    const weaknessLinks = await db.select().from(weaknessSessions);

    expect(reportRow.overallScore).toBe(96);
    expect(reportRow.generatedAt?.toISOString()).toBe('2026-04-20T07:00:00.000Z');
    expect(reportRow.report).toMatchObject({ detailedFeedback: 'Current report' });
    expect(weaknessRows).toEqual([
      {
        category: 'communication',
        description: 'Current weakness from newer report',
      },
    ]);
    expect(weaknessLinks).toEqual([
      expect.objectContaining({
        weaknessId: currentWeakness!.id,
        description: 'Current report evidence',
      }),
    ]);
    expect(await cacheService.get('session-report-meta:stale-report-job')).toBeNull();
  });

  it('GIVEN cached weakness analysis metadata WHEN handling weakness result THEN replaces session weakness links with AI evidence', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'completed',
      generatedAt: new Date('2026-04-20T06:05:00.000Z'),
    });
    const [staleWeakness] = await db
      .insert(userWeaknesses)
      .values({
        userId: user.id,
        category: 'time_complexity',
        description: 'Stale heuristic weakness',
        frequency: 1,
        trend: 'stable',
        lastSeenAt: new Date('2026-04-20T06:00:00.000Z'),
      })
      .returning({ id: userWeaknesses.id });
    await db.insert(weaknessSessions).values({
      weaknessId: staleWeakness!.id,
      sessionId: session.id,
      description: 'Stale link',
      trend: 'stable',
      score: 62,
      reportedAt: new Date('2026-04-20T06:00:00.000Z'),
    });
    await cacheService.set(
      'weakness-analysis-meta:weakness-job-1',
      {
        sessionId: session.id,
        userId: user.id,
        reportedAt: '2026-04-20T06:05:00.000Z',
      },
      60,
    );

    await service.handleWeaknessAnalysisResult('weakness-job-1', {
      sessionId: session.id,
      participantId: user.id,
      reportedAt: '2026-04-20T06:05:00.000Z',
      summary: 'Communication and edge-case patterns should be tracked.',
      recurringPatterns: ['Explanation of trade-offs remains inconsistent.'],
      weaknesses: [
        {
          category: 'communication',
          description: 'Explain trade-offs and invariants more explicitly.',
          evidence: 'Peer feedback highlighted unclear explanation during the session.',
          trend: 'worsening',
        },
        {
          category: 'edge_cases',
          description: 'Name boundary cases before final submission.',
          evidence: 'The session did not show explicit duplicate-input validation.',
          trend: 'stable',
        },
      ],
    });

    const weaknessRows = await db
      .select({
        id: userWeaknesses.id,
        category: userWeaknesses.category,
        description: userWeaknesses.description,
        frequency: userWeaknesses.frequency,
        trend: userWeaknesses.trend,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id))
      .orderBy(asc(userWeaknesses.category));
    const weaknessLinks = await db
      .select({
        weaknessId: weaknessSessions.weaknessId,
        description: weaknessSessions.description,
        score: weaknessSessions.score,
        trend: weaknessSessions.trend,
        reportedAt: weaknessSessions.reportedAt,
      })
      .from(weaknessSessions)
      .orderBy(asc(weaknessSessions.description));

    expect(weaknessRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'communication',
          description: 'Explain trade-offs and invariants more explicitly.',
          frequency: 1,
          trend: 'worsening',
        }),
        expect.objectContaining({
          category: 'edge_cases',
          description: 'Name boundary cases before final submission.',
          frequency: 1,
          trend: 'stable',
        }),
      ]),
    );
    expect(weaknessRows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'time_complexity' })]),
    );
    expect(weaknessLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: 'Peer feedback highlighted unclear explanation during the session.',
          score: null,
          trend: 'worsening',
          reportedAt: new Date('2026-04-20T06:05:00.000Z'),
        }),
        expect.objectContaining({
          description: 'The session did not show explicit duplicate-input validation.',
          score: null,
          trend: 'stable',
          reportedAt: new Date('2026-04-20T06:05:00.000Z'),
        }),
      ]),
    );
    expect(await cacheService.get('weakness-analysis-meta:weakness-job-1')).toBeNull();
  });

  it('GIVEN stale weakness analysis metadata WHEN handling result THEN keeps newer weakness links', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'completed',
      generatedAt: new Date('2026-04-20T06:10:00.000Z'),
    });
    const [currentWeakness] = await db
      .insert(userWeaknesses)
      .values({
        userId: user.id,
        category: 'communication',
        description: 'Current weakness from newer analysis',
        frequency: 1,
        trend: 'stable',
        lastSeenAt: new Date('2026-04-20T06:10:00.000Z'),
      })
      .returning({ id: userWeaknesses.id });
    await db.insert(weaknessSessions).values({
      weaknessId: currentWeakness!.id,
      sessionId: session.id,
      description: 'Current evidence',
      trend: 'stable',
      score: null,
      reportedAt: new Date('2026-04-20T06:10:00.000Z'),
    });
    await cacheService.set(
      'weakness-analysis-meta:stale-weakness-job',
      {
        sessionId: session.id,
        userId: user.id,
        reportedAt: '2026-04-20T06:05:00.000Z',
      },
      60,
    );

    await service.handleWeaknessAnalysisResult('stale-weakness-job', {
      sessionId: session.id,
      participantId: user.id,
      reportedAt: '2026-04-20T06:05:00.000Z',
      summary: 'Older analysis should not overwrite newer data.',
      recurringPatterns: ['Older edge-case finding.'],
      weaknesses: [
        {
          category: 'edge_cases',
          description: 'Old edge-case weakness',
          evidence: 'Old evidence',
          trend: 'worsening',
        },
      ],
    });

    const weaknessRows = await db
      .select({
        category: userWeaknesses.category,
        description: userWeaknesses.description,
        trend: userWeaknesses.trend,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id));
    const weaknessLinks = await db.select().from(weaknessSessions);

    expect(weaknessRows).toEqual([
      {
        category: 'communication',
        description: 'Current weakness from newer analysis',
        trend: 'stable',
      },
    ]);
    expect(weaknessLinks).toEqual([
      expect.objectContaining({
        weaknessId: currentWeakness!.id,
        description: 'Current evidence',
        reportedAt: new Date('2026-04-20T06:10:00.000Z'),
      }),
    ]);
    expect(await cacheService.get('weakness-analysis-meta:stale-weakness-job')).toBeNull();
  });

  it('GIVEN weakness analysis result has no metadata WHEN handling result THEN uses self-identifying result context', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'finished' });
    await insertSessionParticipant(db, session.id, user.id, 'candidate');
    await insertSessionReport(db, session.id, {
      userId: user.id,
      status: 'completed',
      generatedAt: new Date('2026-04-20T06:00:00.000Z'),
    });

    await service.handleWeaknessAnalysisResult('orphaned-but-self-identifying-job', {
      sessionId: session.id,
      participantId: user.id,
      reportedAt: '2026-04-20T06:00:00.000Z',
      summary: 'Result can persist without side-channel metadata.',
      recurringPatterns: ['Communication needs clearer explanation.'],
      weaknesses: [
        {
          category: 'communication',
          description: 'Explain invariants out loud before coding.',
          evidence: 'The result carried enough context to persist safely.',
          trend: 'stable',
        },
      ],
    });

    const weaknessRows = await db
      .select({
        category: userWeaknesses.category,
        description: userWeaknesses.description,
        trend: userWeaknesses.trend,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, user.id));
    const weaknessLinks = await db.select().from(weaknessSessions);

    expect(weaknessRows).toEqual([
      {
        category: 'communication',
        description: 'Explain invariants out loud before coding.',
        trend: 'stable',
      },
    ]);
    expect(weaknessLinks).toEqual([
      expect.objectContaining({
        description: 'The result carried enough context to persist safely.',
        reportedAt: new Date('2026-04-20T06:00:00.000Z'),
      }),
    ]);
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
