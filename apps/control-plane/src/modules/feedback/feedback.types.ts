export type SessionFeedbackStatus = 'submitted' | 'skipped';
export type SessionFeedbackProgressState = 'pending' | SessionFeedbackStatus;

export interface SessionFeedbackEntryResult {
  id: string;
  sessionId: string;
  roomId: string;
  status: 'submitted';
  reviewerId: string;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  candidateId: string;
  candidateName: string;
  candidateAvatarUrl: string | null;
  feedbackText: string;
  createdAt: Date;
}

export interface SessionFeedbackProgressTargetResult {
  candidateId: string;
  candidateName: string;
  candidateAvatarUrl: string | null;
  role: 'candidate' | 'interviewer';
  state: SessionFeedbackProgressState;
  createdAt: Date | null;
}

export interface SessionFeedbackResult {
  allSubmitted: boolean;
  data: SessionFeedbackEntryResult[];
}

export interface SessionFeedbackProgressResult {
  allSubmitted: boolean;
  targets: SessionFeedbackProgressTargetResult[];
}
