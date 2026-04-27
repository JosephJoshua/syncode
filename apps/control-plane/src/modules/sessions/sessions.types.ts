import type { CodeSnapshotTrigger } from '@syncode/contracts';
import type { ProblemDifficulty, RoomMode, RoomRole, SupportedLanguage } from '@syncode/shared';

export interface SessionSummaryResult {
  sessionId: string;
  roomId: string;
  mode: RoomMode;
  problemTitle: string | null;
  difficulty: string | null;
  language: SupportedLanguage | null;
  duration: number;
  /** Raw milliseconds used internally for lossless cursor encoding. */
  durationMs: number;
  participants: SessionHistoryParticipantResult[];
  overallScore: number | null;
  hasReport: boolean;
  hasFeedback: boolean;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface SessionHistoryParticipantResult {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomRole;
}

export interface SessionDetailResult {
  sessionId: string;
  roomId: string;
  mode: RoomMode;
  problem: {
    id: string;
    title: string;
    difficulty: ProblemDifficulty;
  } | null;
  language: SupportedLanguage | null;
  duration: number;
  participants: SessionDetailParticipantResult[];
  runs: SessionRunResult[];
  submissions: SessionSubmissionResult[];
  report: SessionReportResult | null;
  latestCodeSnapshot: SessionLatestCodeSnapshotResult | null;
  peerFeedback: SessionPeerFeedbackResult[];
  hasReport: boolean;
  hasFeedback: boolean;
  hasRecording: boolean;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface SessionDetailParticipantResult {
  userId: string;
  username: string;
  displayName: string | null;
  role: RoomRole;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface SessionRunResult {
  jobId: string;
  status: 'completed' | 'failed';
  createdAt: Date;
}

export interface SessionSubmissionResult {
  submissionId: string;
  status: 'completed' | 'failed';
  passed: number;
  total: number;
  createdAt: Date;
}

export interface SessionCodeSnapshotResult {
  snapshotId: string;
  timestamp: Date;
  trigger: CodeSnapshotTrigger;
  language: SupportedLanguage;
  code: string;
  linesOfCode: number;
}

export interface SessionReportResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  strengths: string[];
  areasForImprovement: string[];
  feedback: string | null;
  generatedAt: Date;
}

export interface SessionLatestCodeSnapshotResult {
  id: string;
  code: string;
  language: SupportedLanguage;
  trigger: string;
  linesOfCode: number | null;
  createdAt: Date;
}

export interface SessionPeerFeedbackResult {
  id: string;
  reviewerId: string;
  reviewerName: string;
  candidateId: string;
  candidateName: string;
  problemSolvingRating: number;
  communicationRating: number;
  codeQualityRating: number;
  debuggingRating: number;
  overallRating: number;
  strengths: string;
  improvements: string;
  wouldPairAgain: boolean;
  createdAt: Date;
}
