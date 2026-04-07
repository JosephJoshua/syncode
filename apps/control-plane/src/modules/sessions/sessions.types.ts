import type { RoomMode, RoomRole, SupportedLanguage } from '@syncode/shared';

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
    difficulty: string;
  } | null;
  language: SupportedLanguage | null;
  duration: number;
  participants: SessionDetailParticipantResult[];
  runs: SessionRunResult[];
  submissions: SessionSubmissionResult[];
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
