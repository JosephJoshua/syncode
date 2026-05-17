import type { RoomRole, SupportedLanguage } from '@syncode/shared';
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
  roomId: string;
  participantId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentCode: string;
  problemDescription: string;
  language: SupportedLanguage;
  userMessage: string;
}

export interface InterviewResponseAudio {
  audioKey: string;
  mimeType: string;
  downloadUrl: string;
}

export interface InterviewResponseResult {
  message: string;
  followUpQuestion: string;
  codeAnnotations?: Array<{ line: number; comment: string }>;
  audio?: InterviewResponseAudio;
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
  finalTestCaseBreakdown: SessionReportTestCaseContext[];
  peerFeedback: SessionReportPeerFeedbackContext[];
  aiMessages: SessionReportAiMessageContext[];
  historicalContext: SessionReportHistoricalContext | null;
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
