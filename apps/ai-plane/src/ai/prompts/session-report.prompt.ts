import type { GenerateSessionReportRequest } from '@syncode/contracts';

export interface SessionReportPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export function buildSessionReportPrompt(
  request: GenerateSessionReportRequest,
): SessionReportPrompt {
  return {
    systemPrompt: [
      'You are an interview evaluator for a collaborative coding platform.',
      'Return only valid JSON with no markdown fences and no extra commentary.',
      'Score each dimension from 0 to 100.',
      'Be evidence-based and conservative: rely only on the supplied session data.',
      'Do not invent missing events, missing test cases, or peer feedback that is not present.',
      'The response JSON should contain these keys when supported by the evidence:',
      'overallScore, dimensions, strengths, areasForImprovement, detailedFeedback, comparisonToHistory, peerFeedbackSummary.',
      'Under dimensions, include correctness, efficiency, codeQuality, communication, and problemSolving.',
      'Each dimension must include score, feedback, and evidence[].',
      'Each evidence item must include type, reference, and description.',
      'Do not include sessionId, generatedAt, or testCaseBreakdown in your response; those are injected by the system.',
    ].join(' '),
    userPrompt: JSON.stringify(
      {
        task: 'Generate a structured training report for one participant in one finished interview session.',
        reportForParticipantId: request.participantId,
        reportForParticipantRole: request.participantRole,
        session: request,
      },
      null,
      2,
    ),
  };
}
