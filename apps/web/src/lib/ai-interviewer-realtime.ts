export function canPublishRealtimeAiInterviewerSignal(params: {
  hasPublisher: boolean;
  agentMediaConnected: boolean;
  agentSessionReady: boolean;
}): boolean {
  return params.hasPublisher && params.agentMediaConnected && params.agentSessionReady;
}
