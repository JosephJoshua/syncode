import { describe, expect, it } from 'vitest';
import { canPublishRealtimeAiInterviewerSignal } from './ai-interviewer-realtime.js';

describe('canPublishRealtimeAiInterviewerSignal', () => {
  it('GIVEN only the agent media participant is connected WHEN checking readiness THEN it is not ready for one-shot signals', () => {
    expect(
      canPublishRealtimeAiInterviewerSignal({
        hasPublisher: true,
        agentMediaConnected: true,
        agentSessionReady: false,
      }),
    ).toBe(false);
  });

  it('GIVEN publisher, media participant, and session_ready event WHEN checking readiness THEN signals can be sent', () => {
    expect(
      canPublishRealtimeAiInterviewerSignal({
        hasPublisher: true,
        agentMediaConnected: true,
        agentSessionReady: true,
      }),
    ).toBe(true);
  });
});
