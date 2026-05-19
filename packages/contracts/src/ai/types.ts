import type {
  RoomRole,
  RoomStatus,
  SupportedLanguage,
  WeaknessCategory,
  WeaknessTrend,
} from '@syncode/shared';
import type { CodeSnapshotTrigger, SessionReport } from '../control/sessions.js';

export interface HintSubmissionSummary {
  status: 'pending' | 'running' | 'completed' | 'failed';
  passedTestCases: number;
  totalTestCases: number;
  failedTestCases: number;
  errorTestCases: number;
  allTestsPassed: boolean;
  submittedAt: string;
}

export type InterviewQuestionType =
  | 'complexity'
  | 'bug_risk'
  | 'edge_case'
  | 'optimization'
  | 'data_structure_choice'
  | 'correctness'
  | 'readability'
  | 'other';

export interface InterviewCodeContext {
  language: SupportedLanguage;
  file: string;
  codeSnippet: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  cursorLine?: number;
  cursorColumn?: number;
  questionType?: InterviewQuestionType;
  reason?: string;
}

export interface InterviewCodeAnalysisContext {
  summary: string;
  focusAreas?: {
    complexity: string;
    edgeCases: string;
    readability: string;
  };
  followUpQuestions?: string[];
  staticAnalysis?: StaticAnalysisEvidenceContext;
}

export type InterviewResponseTrigger = 'user_message' | 'proactive';

export type InterviewProactiveReason =
  | 'session_joined'
  | 'stage_changed'
  | 'user_idle'
  | 'hint_used'
  | 'manual_nudge';

export interface InterviewInteractionSignals {
  reason: InterviewProactiveReason;
  roomStatus: RoomStatus;
  elapsedSeconds: number;
  secondsSinceLastUserMessage?: number;
  secondsSinceLastAssistantMessage?: number;
  secondsSinceLastEditorActivity?: number;
  recentEditorChanges?: number;
  hintCount?: number;
}

export interface GenerateHintRequest {
  roomId: string;
  participantId: string;
  problemDescription: string;
  currentCode: string;
  language: SupportedLanguage;
  hintLevel: 'gentle' | 'moderate' | 'direct';
  conversationHistory?: Array<{ role: string; content: string }>;
  latestSubmissionSummary?: HintSubmissionSummary | null;
  hintStage?: 'initial' | 'follow_up';
  hintIteration?: number;
  previousHint?: string;
  reflectionResponse?: string;
}

export interface GenerateHintResult {
  hint: string;
  suggestedApproach?: string;
  reflectionPrompt?: string;
}

export interface AnalyzeCodeRequest {
  roomId: string;
  participantId: string;
  problemDescription: string;
  code: string;
  language: SupportedLanguage;
}

export interface AnalyzeCodeResult {
  summary: string;
  focusAreas: {
    complexity: string;
    edgeCases: string;
    readability: string;
  };
  followUpQuestions: string[];
}

export interface HistoricalWeaknessContext {
  category: WeaknessCategory;
  description: string;
  frequency: number;
  trend: WeaknessTrend;
  lastSeenAt: string;
}

export interface StaticAnalysisEvidenceContext {
  source: 'run' | 'submission';
  runId: string | null;
  submissionId: string | null;
  language: SupportedLanguage;
  createdAt: string;
  completedAt: string | null;
  summary: {
    diagnosticCount: number;
    errorCount: number;
    warningCount: number;
    maxCyclomaticComplexity: number | null;
    highComplexityCount: number;
    duplicationCount: number;
    toolFailureCount: number;
  };
  diagnostics: Array<{
    tool: string;
    rule: string | null;
    severity: 'error' | 'warning' | 'info';
    message: string;
    file: string | null;
    line: number | null;
    column: number | null;
  }>;
  complexity: Array<{
    tool: string;
    functionName: string;
    file: string | null;
    startLine: number;
    endLine: number | null;
    cyclomaticComplexity: number;
  }>;
  duplications: Array<{
    tool: string;
    lines: number;
    tokens: number | null;
    occurrences: Array<{
      file: string | null;
      startLine: number;
      endLine: number | null;
    }>;
  }>;
}

export interface GenerateWeaknessAnalysisRequest {
  sessionId: string;
  roomId: string;
  participantId: string;
  participantRole: RoomRole;
  sessionReportGeneratedAt: string;
  problem: {
    id: string | null;
    title: string | null;
    description: string | null;
    difficulty: string | null;
  };
  language: SupportedLanguage | null;
  durationMs: number;
  snapshots: SessionReportSnapshotContext[];
  runs: SessionReportRunContext[];
  submissions: SessionReportSubmissionContext[];
  peerFeedback: SessionReportPeerFeedbackContext[];
  aiMessages: SessionReportAiMessageContext[];
  sessionReportSummary: {
    overallScore: number | null;
    feedback: string | null;
  } | null;
  historicalWeaknesses: HistoricalWeaknessContext[];
  staticAnalysis: StaticAnalysisEvidenceContext[];
}

export interface WeaknessAnalysisItem {
  category: WeaknessCategory;
  description: string;
  evidence: string;
  trend: WeaknessTrend;
}

export interface GenerateWeaknessAnalysisResult {
  sessionId: string;
  participantId: string;
  reportedAt: string;
  summary: string;
  recurringPatterns: string[];
  weaknesses: WeaknessAnalysisItem[];
}

export interface ReviewCodeRequest {
  roomId: string;
  participantId: string;
  problemDescription: string;
  code: string;
  language: SupportedLanguage;
  rubric?: string[];
}

export interface ReviewCodeResult {
  overallScore: number;
  categories: Array<{ name: string; score: number; feedback: string }>;
  summary: string;
}

export interface InterviewResponseRequest {
  idempotencyKey?: string;
  roomId: string;
  sessionId?: string | null;
  participantId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentCode: string;
  codeContext?: InterviewCodeContext;
  latestExecutionSummary?: HintSubmissionSummary | null;
  codeAnalysisContext?: InterviewCodeAnalysisContext;
  recentHints?: Array<{
    hint: string;
    createdAt: string;
  }>;
  trigger?: InterviewResponseTrigger;
  interactionSignals?: InterviewInteractionSignals;
  problemDescription: string;
  language: SupportedLanguage;
  responseLanguage?: 'en' | 'zh';
  userMessage?: string;
}

export interface InterviewResponseAudio {
  audioKey: string;
  mimeType: string;
  downloadUrl: string;
}

export interface InterviewResponseResult {
  shouldRespond: boolean;
  message?: string;
  followUpQuestion?: string;
  codeContext?: InterviewCodeContext;
  codeAnnotations?: Array<{ line: number; comment: string }>;
  audio?: InterviewResponseAudio;
}

export interface InterviewTranscriptionRequest {
  roomId: string;
  sessionId?: string | null;
  participantId: string;
  audioBase64: string;
  mimeType: string;
  language?: string;
}

export interface InterviewTranscriptionResult {
  text: string;
}

export interface SessionReportParticipantContext {
  userId: string;
  username: string;
  displayName: string | null;
  role: RoomRole;
}

export interface SessionReportSnapshotContext {
  snapshotId: string;
  timestamp: string;
  trigger: CodeSnapshotTrigger;
  language: SupportedLanguage;
  code: string;
  linesOfCode: number;
  phase?: RoomStatus | null;
}

export interface SessionReportEventContext {
  eventType: 'stage_transition' | 'submission';
  timestamp: string;
  details: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SessionReportRunContext {
  jobId: string;
  createdAt: string;
  status: 'completed' | 'failed';
  code: string;
  language: SupportedLanguage;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number | null;
  timedOut: boolean;
  error: string | null;
}

export interface SessionReportSubmissionContext {
  submissionId: string;
  createdAt: string;
  status: 'completed' | 'failed';
  code: string;
  language: SupportedLanguage;
  passed: number;
  total: number;
  totalDurationMs: number | null;
}

export interface SessionReportPeerFeedbackContext {
  reviewerId: string;
  reviewerUsername: string;
  overallRating: number;
  problemSolvingRating: number;
  communicationRating: number;
  codeQualityRating: number;
  debuggingRating: number;
  strengths: string;
  improvements: string;
  wouldPairAgain: boolean;
  createdAt: string;
}

export interface SessionReportAiMessageContext {
  role: string;
  content: string;
  createdAt: string;
}

export interface SessionReportRoomChatMessageContext {
  role: string;
  content: string;
  createdAt: string;
}

export interface SessionReportHistoricalContext {
  sessionsCompared: number;
  averageScore: number | null;
  priorScores: number[];
}

export interface SessionReportTestCaseContext {
  testCaseIndex: number;
  input: string | null;
  description: string | null;
  isHidden: boolean;
  passed: boolean | null;
  expectedOutput: string | null;
  actualOutput: string | null;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number | null;
  memoryUsageMb: number | null;
  timedOut: boolean;
  errorMessage: string | null;
}

export interface GenerateSessionReportRequest {
  sessionId: string;
  roomId: string;
  participantId: string;
  participantRole: RoomRole;
  participants: SessionReportParticipantContext[];
  problem: {
    id: string | null;
    title: string | null;
    description: string | null;
    difficulty: string | null;
    constraints: string | null;
  };
  language: SupportedLanguage | null;
  durationMs: number;
  startedAt: string;
  finishedAt: string | null;
  snapshots: SessionReportSnapshotContext[];
  runs: SessionReportRunContext[];
  submissions: SessionReportSubmissionContext[];
  finalCodeSnapshot: SessionReportSnapshotContext | null;
  sessionEvents: SessionReportEventContext[];
  finalTestCaseBreakdown: SessionReportTestCaseContext[];
  peerFeedback: SessionReportPeerFeedbackContext[];
  aiMessages: SessionReportAiMessageContext[];
  roomChatMessages?: SessionReportRoomChatMessageContext[];
  historicalContext: SessionReportHistoricalContext | null;
  staticAnalysis: StaticAnalysisEvidenceContext[];
}

export interface GenerateSessionReportResult extends SessionReport {
  model?: string;
}

export function toPublicSessionReportTestCaseBreakdown(
  breakdown: SessionReportTestCaseContext[],
): NonNullable<SessionReport['testCaseBreakdown']> {
  return breakdown.map((item) => ({
    testCaseIndex: item.testCaseIndex,
    passed: item.passed,
    timedOut: item.timedOut,
    errorMessage: item.timedOut ? (item.errorMessage ?? 'Time limit exceeded') : item.errorMessage,
  }));
}
