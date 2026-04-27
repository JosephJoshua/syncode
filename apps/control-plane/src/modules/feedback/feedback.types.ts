export interface SessionFeedbackEntryResult {
  id: string;
  sessionId: string;
  roomId: string;
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

export interface SessionFeedbackResult {
  allSubmitted: boolean;
  data: SessionFeedbackEntryResult[];
}
