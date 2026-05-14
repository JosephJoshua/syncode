import { randomUUID } from 'node:crypto';
import type { JobId, JobStatus, SubmitResult } from '../queues.js';
import type { IAiClient } from './client.js';
import type {
  AnalyzeCodeRequest,
  AnalyzeCodeResult,
  GenerateHintRequest,
  GenerateHintResult,
  GenerateSessionReportRequest,
  GenerateSessionReportResult,
  GenerateWeaknessAnalysisRequest,
  GenerateWeaknessAnalysisResult,
  InterviewResponseRequest,
  InterviewResponseResult,
  ReviewCodeRequest,
  ReviewCodeResult,
} from './types.js';
import { toPublicSessionReportTestCaseBreakdown } from './types.js';

type AiJobType =
  | 'hint'
  | 'code-analysis'
  | 'weakness-analysis'
  | 'review'
  | 'interview'
  | 'session-report';

interface StubJob {
  status: JobStatus;
  type: AiJobType;
  hintResult?: GenerateHintResult;
  codeAnalysisResult?: AnalyzeCodeResult;
  weaknessAnalysisResult?: GenerateWeaknessAnalysisResult;
  reviewResult?: ReviewCodeResult;
  interviewResult?: InterviewResponseResult;
  sessionReportResult?: GenerateSessionReportResult;
}

interface StubAiClientOptions {
  /** Delay in ms before job completes (default: 800) */
  delayMs?: number;
}

const HINT_RESPONSES = {
  gentle: 'Consider what data structure would let you look up values efficiently.',
  moderate:
    'A hash map would give you O(1) lookups. Think about what you need to store as keys vs values.',
  direct:
    'Use a hash map to store each number and its index. For each element, check if the complement (target - current) exists in the map.',
} satisfies Record<string, string>;

export class StubAiClient implements IAiClient {
  private readonly jobs = new Map<string, StubJob>();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private readonly delayMs: number;
  private sessionReportResultCallback?: (
    jobId: string,
    result: GenerateSessionReportResult,
  ) => Promise<void>;

  constructor(options: StubAiClientOptions = {}) {
    this.delayMs = options.delayMs ?? 800;
  }

  /** Clear all pending timers. Call from OnModuleDestroy or test teardown. */
  shutdown(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
  }

  async submitHintRequest(request: GenerateHintRequest): Promise<SubmitResult<'ai:hint'>> {
    const jobId = randomUUID() as JobId<'ai:hint'>;
    this.jobs.set(jobId, { status: 'queued', type: 'hint' });

    this.scheduleHintCompletion(jobId, request);
    return { jobId };
  }

  async getHintResult(jobId: JobId<'ai:hint'>): Promise<GenerateHintResult | null> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'hint') return null;
    return job.hintResult ?? null;
  }

  async submitCodeAnalysisRequest(
    request: AnalyzeCodeRequest,
  ): Promise<SubmitResult<'ai:code-analysis'>> {
    const jobId = randomUUID() as JobId<'ai:code-analysis'>;
    this.jobs.set(jobId, { status: 'queued', type: 'code-analysis' });

    this.scheduleCodeAnalysisCompletion(jobId, request);
    return { jobId };
  }

  async getCodeAnalysisResult(jobId: JobId<'ai:code-analysis'>): Promise<AnalyzeCodeResult | null> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'code-analysis') return null;
    return job.codeAnalysisResult ?? null;
  }

  async submitWeaknessAnalysisRequest(
    request: GenerateWeaknessAnalysisRequest,
  ): Promise<SubmitResult<'ai:weakness-analysis'>> {
    const jobId = randomUUID() as JobId<'ai:weakness-analysis'>;
    this.jobs.set(jobId, { status: 'queued', type: 'weakness-analysis' });

    this.scheduleWeaknessAnalysisCompletion(jobId, request);
    return { jobId };
  }

  async getWeaknessAnalysisResult(
    jobId: JobId<'ai:weakness-analysis'>,
  ): Promise<GenerateWeaknessAnalysisResult | null> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'weakness-analysis') return null;
    return job.weaknessAnalysisResult ?? null;
  }

  async submitReviewRequest(_request: ReviewCodeRequest): Promise<SubmitResult<'ai:review'>> {
    const jobId = randomUUID() as JobId<'ai:review'>;
    this.jobs.set(jobId, { status: 'queued', type: 'review' });

    this.scheduleReviewCompletion(jobId);
    return { jobId };
  }

  async getReviewResult(jobId: JobId<'ai:review'>): Promise<ReviewCodeResult | null> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'review') return null;
    return job.reviewResult ?? null;
  }

  async submitInterviewResponse(
    _request: InterviewResponseRequest,
  ): Promise<SubmitResult<'ai:interview'>> {
    const jobId = randomUUID() as JobId<'ai:interview'>;
    this.jobs.set(jobId, { status: 'queued', type: 'interview' });

    this.scheduleInterviewCompletion(jobId);
    return { jobId };
  }

  async getInterviewResult(jobId: JobId<'ai:interview'>): Promise<InterviewResponseResult | null> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'interview') return null;
    return job.interviewResult ?? null;
  }

  async submitSessionReportRequest(
    request: GenerateSessionReportRequest,
  ): Promise<SubmitResult<'ai:session-report'>> {
    const jobId = randomUUID() as JobId<'ai:session-report'>;
    this.jobs.set(jobId, { status: 'queued', type: 'session-report' });

    this.scheduleSessionReportCompletion(jobId, request);
    return { jobId };
  }

  async getSessionReportResult(
    jobId: JobId<'ai:session-report'>,
  ): Promise<GenerateSessionReportResult | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'session-report') return null;
    return job.sessionReportResult ?? null;
  }

  async getHintJobStatus(jobId: JobId<'ai:hint'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'hint') return 'failed';
    return job.status;
  }

  async getCodeAnalysisJobStatus(jobId: JobId<'ai:code-analysis'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'code-analysis') return 'failed';
    return job.status;
  }

  async getWeaknessAnalysisJobStatus(jobId: JobId<'ai:weakness-analysis'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'weakness-analysis') return 'failed';
    return job.status;
  }

  async getReviewJobStatus(jobId: JobId<'ai:review'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'review') return 'failed';
    return job.status;
  }

  async getInterviewJobStatus(jobId: JobId<'ai:interview'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (job?.type !== 'interview') return 'failed';
    return job.status;
  }

  async getSessionReportJobStatus(jobId: JobId<'ai:session-report'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'session-report') return 'failed';
    return job.status;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  onSessionReportResult(
    callback: (jobId: string, result: GenerateSessionReportResult) => Promise<void>,
  ): void {
    this.sessionReportResultCallback = callback;
  }

  private scheduleHintCompletion(jobId: string, request: GenerateHintRequest): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const isFollowUp = request.hintStage === 'follow_up';
        const hintIteration = Math.max(request.hintIteration ?? 1, 1);
        const allTestsPassed = request.latestSubmissionSummary?.allTestsPassed === true;
        const reflection = request.reflectionResponse?.trim();
        const followUpHint = reflection
          ? `Good reasoning. Build on "${reflection.slice(0, 80)}" and validate that step with a small test case.`
          : 'No reflection was provided. Re-check your current approach against one failing edge case.';

        job.status = 'completed';
        job.hintResult = {
          hint: allTestsPassed
            ? 'Great work. Your latest submission passed all available tests, so focus now on readability and edge-case confidence.'
            : isFollowUp
              ? followUpHint
              : (HINT_RESPONSES[request.hintLevel] ?? HINT_RESPONSES.gentle),
          suggestedApproach: allTestsPassed
            ? 'Keep the current core logic; add one readability improvement and verify a couple of extra edge cases locally.'
            : isFollowUp
              ? 'Update one focused section, re-run tests, then re-check edge cases.'
              : hintIteration === 1
                ? 'Focus on what small piece of history should be preserved while scanning from left to right.'
                : 'Consider breaking the problem into smaller subproblems.',
          reflectionPrompt:
            allTestsPassed ||
            isFollowUp ||
            request.hintLevel === 'direct' ||
            hintIteration % 3 !== 0
              ? undefined
              : 'What invariant will stay true after each iteration of your loop?',
        };
      }, this.delayMs),
    );
  }

  private scheduleCodeAnalysisCompletion(jobId: string, request: AnalyzeCodeRequest): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const codeLower = request.code.toLowerCase();
        const usesNestedLoops =
          (codeLower.match(/\bfor\b/g)?.length ?? 0) >= 2 ||
          (codeLower.match(/\bwhile\b/g)?.length ?? 0) >= 2;
        const hasNullGuard = /\bnull\b|\bundefined\b|\breturn\s+\[\]|\breturn\s+null\b/.test(
          codeLower,
        );

        job.status = 'completed';
        job.codeAnalysisResult = {
          summary:
            'The solution has a workable core direction, but the next interview questions should probe complexity trade-offs, edge-case coverage, and how clearly the state is expressed.',
          focusAreas: {
            complexity: usesNestedLoops
              ? 'The implementation appears to revisit work in nested iteration, so the candidate should justify whether the time complexity is acceptable.'
              : 'The implementation looks close to a linear scan, so the candidate should explain why each operation stays efficient.',
            edgeCases: hasNullGuard
              ? 'Some guard logic is present, but it is still useful to ask which boundary inputs were considered explicitly.'
              : 'There is little visible defensive handling, so ask which empty, duplicate, or no-solution cases were considered.',
            readability:
              'Ask the candidate to explain what each piece of tracked state represents and which names or comments would make the intent easier to follow.',
          },
          followUpQuestions: [
            usesNestedLoops
              ? 'What is the time complexity of this approach, and where does the repeated work come from?'
              : 'Why does this approach avoid re-checking earlier work on each iteration?',
            hasNullGuard
              ? 'Which boundary case did you design this guard around, and what other edge cases would you still test?'
              : 'What happens for empty input, duplicates, or a case with no valid answer?',
            'If another engineer read this code quickly, which variable or step would you rename or explain first?',
          ],
        };
      }, this.delayMs),
    );
  }

  private scheduleWeaknessAnalysisCompletion(
    jobId: string,
    request: GenerateWeaknessAnalysisRequest,
  ): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const historicalCommunication = request.historicalWeaknesses.find(
          (item) => item.category === 'communication',
        );
        const peerCommunicationAverage =
          request.peerFeedback.length > 0
            ? request.peerFeedback.reduce((sum, item) => sum + item.communicationRating, 0) /
              request.peerFeedback.length
            : null;

        job.status = 'completed';
        job.weaknessAnalysisResult = {
          summary:
            'The session suggests a small set of recurring weaknesses that should be tracked across future interviews rather than treated as one-off mistakes.',
          recurringPatterns: [
            historicalCommunication
              ? 'Communication concerns have shown up across multiple sessions.'
              : 'Session evidence suggests incomplete explanation of decisions under pressure.',
            'Edge-case confidence still needs to be made more explicit during problem solving.',
          ],
          weaknesses: [
            {
              category: 'edge_cases',
              description:
                'The candidate should make boundary-case reasoning more explicit before final submission.',
              evidence:
                request.submissions.length > 0
                  ? `Observed ${request.submissions.length} submissions before finishing, suggesting additional edge-case clarification would help.`
                  : 'The session data shows limited explicit edge-case discussion.',
              trend: request.historicalWeaknesses.some((item) => item.category === 'edge_cases')
                ? 'worsening'
                : 'stable',
            },
            {
              category: 'communication',
              description:
                'The candidate can improve how they explain trade-offs, invariants, and next debugging steps out loud.',
              evidence:
                peerCommunicationAverage != null
                  ? `Peer communication rating averaged ${peerCommunicationAverage.toFixed(1)}/5 in this session.`
                  : 'Peer feedback is limited, so the signal is based on sparse discussion evidence.',
              trend: historicalCommunication?.trend === 'worsening' ? 'worsening' : 'stable',
            },
          ],
        };
      }, this.delayMs),
    );
  }

  private scheduleReviewCompletion(jobId: string): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.reviewResult = {
          overallScore: 7,
          categories: [
            {
              name: 'Correctness',
              score: 8,
              feedback: 'Solution handles main cases correctly.',
            },
            {
              name: 'Efficiency',
              score: 7,
              feedback: 'Time complexity is acceptable. Consider edge cases.',
            },
            {
              name: 'Code Quality',
              score: 6,
              feedback: 'Variable naming could be more descriptive.',
            },
          ],
          summary:
            'Solid solution with room for improvement in code clarity and edge case handling.',
        };
      }, this.delayMs),
    );
  }

  private scheduleInterviewCompletion(jobId: string): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.interviewResult = {
          message: "That's a good approach. Let me ask you about the time complexity.",
          followUpQuestion: 'What is the time and space complexity of your solution?',
          codeAnnotations: [
            {
              line: 1,
              comment: 'Consider adding input validation here.',
            },
          ],
          audio: {
            audioKey: `ai/interview/${jobId}.mp3`,
            mimeType: 'audio/mpeg',
            downloadUrl: `https://example.com/ai/interview/${jobId}.mp3`,
          },
        };
      }, this.delayMs),
    );
  }

  private scheduleSessionReportCompletion(
    jobId: string,
    request: GenerateSessionReportRequest,
  ): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
    );

    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const latestSubmission = request.submissions.at(-1);
        const correctnessScore = latestSubmission
          ? Math.round((latestSubmission.passed / Math.max(latestSubmission.total, 1)) * 100)
          : 70;
        const peerAverage =
          request.peerFeedback.length > 0
            ? request.peerFeedback.reduce((sum, item) => sum + item.overallRating, 0) /
              request.peerFeedback.length
            : null;
        const peerAveragePct =
          peerAverage == null ? null : Math.round((peerAverage / 5) * 100 * 10) / 10;
        const overallScore = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              [
                correctnessScore,
                request.runs.length > 0 ? 76 : 70,
                request.snapshots.length > 0 ? 78 : 70,
                peerAveragePct ?? 75,
                request.aiMessages.length > 0 ? 80 : 72,
              ].reduce((sum, score) => sum + score, 0) / 5,
            ),
          ),
        );

        job.status = 'completed';
        job.sessionReportResult = {
          sessionId: request.sessionId,
          generatedAt: new Date().toISOString(),
          overallScore,
          dimensions: {
            correctness: {
              score: correctnessScore,
              feedback: 'Final submission passes the observed portion of the test suite.',
              evidence: latestSubmission
                ? [
                    {
                      type: 'submission',
                      reference: latestSubmission.submissionId,
                      description: `Passed ${latestSubmission.passed}/${latestSubmission.total} test cases.`,
                    },
                  ]
                : [],
            },
            efficiency: {
              score: 76,
              feedback: 'Execution attempts show workable performance with room for optimization.',
              evidence: request.runs.slice(-1).map((run) => ({
                type: 'run',
                reference: run.jobId,
                description: `Completed run in ${run.durationMs ?? 0} ms.`,
              })),
            },
            codeQuality: {
              score: 78,
              feedback: 'Code snapshots show a solution that became more structured over time.',
              evidence: request.snapshots.slice(-1).map((snapshot) => ({
                type: 'snapshot',
                reference: snapshot.snapshotId,
                description: `Latest snapshot has ${snapshot.linesOfCode} lines of code.`,
              })),
            },
            communication: {
              score: peerAveragePct ?? 75,
              feedback:
                request.peerFeedback.length > 0
                  ? 'Peer feedback indicates clear collaboration overall.'
                  : 'No peer feedback was captured, so this score is inferred conservatively.',
              evidence: request.peerFeedback.slice(0, 1).map((feedback) => ({
                type: 'peer_feedback',
                reference: feedback.reviewerId,
                description: feedback.strengths,
              })),
            },
            problemSolving: {
              score: 80,
              feedback:
                'The participant iterated through runs and submissions toward a working solution.',
              evidence: [
                {
                  type: 'summary',
                  reference: request.sessionId,
                  description: `${request.runs.length} runs and ${request.submissions.length} submissions were captured.`,
                },
              ],
            },
          },
          strengths: [
            'Iterated actively with multiple code revisions.',
            'Reached a final solution with measurable correctness signals.',
          ],
          areasForImprovement: [
            'Explain tradeoffs and edge cases more explicitly during the session.',
            'Reduce unnecessary intermediate run attempts before final submission.',
          ],
          detailedFeedback:
            'The participant made steady progress through the session and converged on a workable solution. Future sessions should focus on surfacing complexity analysis and edge-case reasoning earlier.',
          comparisonToHistory:
            request.historicalContext && request.historicalContext.sessionsCompared > 0
              ? {
                  trend:
                    request.historicalContext.averageScore != null &&
                    overallScore > request.historicalContext.averageScore + 3
                      ? 'improving'
                      : request.historicalContext.averageScore != null &&
                          overallScore < request.historicalContext.averageScore - 3
                        ? 'declining'
                        : 'stable',
                  sessionsCompared: request.historicalContext.sessionsCompared,
                  averageScore: request.historicalContext.averageScore ?? overallScore,
                }
              : null,
          peerFeedbackSummary:
            request.peerFeedback.length > 0
              ? {
                  averageRating:
                    Math.round(
                      (request.peerFeedback.reduce((sum, item) => sum + item.overallRating, 0) /
                        request.peerFeedback.length) *
                        10,
                    ) / 10,
                  wouldPairAgain: Math.round(
                    (request.peerFeedback.filter((item) => item.wouldPairAgain).length /
                      request.peerFeedback.length) *
                      100,
                  ),
                  themes: request.peerFeedback
                    .flatMap((item) => [item.strengths, item.improvements])
                    .slice(0, 3),
                }
              : null,
          testCaseBreakdown: toPublicSessionReportTestCaseBreakdown(request.finalTestCaseBreakdown),
          model: 'stub-ai-client',
        };

        this.sessionReportResultCallback?.(jobId, job.sessionReportResult).catch(() => {});
      }, this.delayMs),
    );
  }
}
