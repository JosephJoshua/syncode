import type {
  AiInterviewerContext,
  AiInterviewerContextResponse,
  AiInterviewerSignalPayload,
  AiInterviewerSignalReason,
} from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock heavy LiveKit/OpenAI plugin modules so importing the worker does not
// reach out to native bindings or require an OpenAI key at module load.
vi.mock('@livekit/agents', () => {
  class FakeAgent {
    instructions: string;
    tools: unknown;
    constructor(opts: { instructions: string; tools: unknown }) {
      this.instructions = opts.instructions;
      this.tools = opts.tools;
    }
    updateChatCtx = vi.fn();
  }
  class FakeAgentSession {
    chatCtx = {
      copy: vi.fn(() => ({
        items: [] as Array<{ id: string }>,
        addMessage: vi.fn(),
      })),
    };
    on = vi.fn();
    start = vi.fn();
    generateReply = vi.fn();
    interrupt = vi.fn(() => ({ await: Promise.resolve() }));
  }
  return {
    cli: { runApp: vi.fn() },
    defineAgent: (config: unknown) => ({ __config: config }),
    ServerOptions: class {
      constructor(public opts: unknown) {}
    },
    llm: {
      tool: (spec: unknown) => spec,
    },
    voice: {
      Agent: FakeAgent,
      AgentSession: FakeAgentSession,
      AgentSessionEventTypes: {
        AgentStateChanged: 'agent_state_changed',
        UserStateChanged: 'user_state_changed',
        OverlappingSpeech: 'overlapping_speech',
        Error: 'error',
        UserInputTranscribed: 'user_input_transcribed',
        ConversationItemAdded: 'conversation_item_added',
      },
    },
  };
});

vi.mock('@livekit/agents-plugin-openai', () => {
  class Stub {
    constructor(public opts: unknown) {}
  }
  return {
    LLM: Stub,
    STT: Stub,
    TTS: Stub,
    realtime: { RealtimeModel: Stub },
  };
});

// dotenv: avoid actually scanning the filesystem when the worker module is
// imported. The worker's loadWorkerEnvFiles runs at import time.
vi.mock('dotenv', () => ({ config: vi.fn() }));

// Provide the minimum env validateEnv requires BEFORE the worker module is
// imported. validateEnv runs at module-load time inside loadWorkerEnv, which
// is hit by the top-level `await import(...)` below. `beforeAll` does not
// run early enough — Vitest only fires beforeAll once the describe block
// starts executing, but top-level await happens during module evaluation.
process.env.INTERNAL_CALLBACK_SECRET =
  process.env.INTERNAL_CALLBACK_SECRET ?? 'unit-test-internal-callback-secret-12345678';
process.env.AI_PLATFORM_API_KEY = process.env.AI_PLATFORM_API_KEY ?? 'unit-test-platform-key';
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
process.env.S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? 'unit-test-access';
process.env.S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? 'unit-test-secret';
process.env.S3_BUCKET = process.env.S3_BUCKET ?? 'unit-test-bucket';
process.env.AI_INTERVIEWER_CONTROL_PLANE_URL =
  process.env.AI_INTERVIEWER_CONTROL_PLANE_URL ?? 'http://control.test';

// Import after env + mocks are in place so module-level side effects succeed.
const { __testing } = await import('./ai-interviewer.worker.js');

const baseRuntimeContext: AiInterviewerContextResponse = {
  roomId: 'room-1',
  participantId: 'participant-1',
  roomStatus: 'coding',
  language: 'python',
  problem: {
    title: 'Two Sum',
    description: 'Given an array of integers, return indices of the two numbers that add up.',
    difficulty: 'easy',
    starterCode: 'def two_sum(nums, target):\n    pass',
  },
  currentCode: {
    code: 'def two_sum(nums, target):\n    return []',
    language: 'python',
    source: 'snapshot',
    updatedAt: '2026-05-27T10:00:00.000Z',
  },
  latestSubmission: null,
};

const interviewContext: AiInterviewerContext = {
  problemTitle: 'Two Sum',
  difficulty: 'easy',
  problemDescription: 'Find indices of two numbers that add up to target.',
  language: 'python',
  starterCode: 'def two_sum(nums, target):\n    pass',
};

describe('ai-interviewer.worker URL resolvers and parsers', () => {
  it('GIVEN a roomId WHEN resolveTranscriptUrl is called THEN it returns the control-plane transcript URL', () => {
    const url = __testing.resolveTranscriptUrl('room-42');
    expect(url).toBe('http://control.test/internal/rooms/room-42/ai-transcript');
  });

  it('GIVEN a roomId WHEN resolveAiInterviewerContextUrl is called THEN it returns the context URL', () => {
    const url = __testing.resolveAiInterviewerContextUrl('room-42');
    expect(url).toBe('http://control.test/internal/rooms/room-42/ai-context');
  });

  it('GIVEN a roomId WHEN resolveAiInterviewerPhaseTransitionUrl is called THEN it returns the phase URL', () => {
    const url = __testing.resolveAiInterviewerPhaseTransitionUrl('room-42');
    expect(url).toBe('http://control.test/internal/rooms/room-42/ai-phase-transition');
  });

  it('GIVEN a base URL with no /v1 WHEN normalizeOpenAiSdkBaseUrl runs THEN /v1 is appended', () => {
    expect(__testing.normalizeOpenAiSdkBaseUrl('https://api.example.com/')).toBe(
      'https://api.example.com/v1',
    );
    expect(__testing.normalizeOpenAiSdkBaseUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1',
    );
  });

  it('GIVEN an unknown voice WHEN resolveOpenAiTtsVoice runs THEN it falls back to alloy', () => {
    expect(__testing.resolveOpenAiTtsVoice('Chelsie')).toBe('alloy');
    expect(__testing.resolveOpenAiTtsVoice('shimmer')).toBe('shimmer');
  });

  it('GIVEN JSON metadata WHEN parseDispatchMetadata parses THEN it returns trimmed fields', () => {
    expect(
      __testing.parseDispatchMetadata(
        JSON.stringify({ roomId: 'r-1', participantUserId: 'p-1', sessionId: null }),
      ),
    ).toEqual({ roomId: 'r-1', participantUserId: 'p-1', sessionId: null });
  });

  it('GIVEN malformed metadata WHEN parseDispatchMetadata parses THEN it returns empty object', () => {
    expect(__testing.parseDispatchMetadata('not-json')).toEqual({});
    expect(__testing.parseDispatchMetadata(undefined)).toEqual({});
  });

  it('GIVEN identical inputs WHEN createTranscriptTurnId is called THEN it produces a stable digest id', () => {
    const a = __testing.createTranscriptTurnId('user', 'r-1', 'p-1', 1000, 'hi');
    const b = __testing.createTranscriptTurnId('user', 'r-1', 'p-1', 1000, 'hi');
    const c = __testing.createTranscriptTurnId('user', 'r-1', 'p-1', 1000, 'bye');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^lk-ai-turn-1000-[a-f0-9]{16}$/);
  });
});

describe('ai-interviewer.worker HTTP callbacks', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('GIVEN a 200 response WHEN postTranscriptTurn runs THEN it resolves without throwing', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 200 }));
    await expect(
      __testing.postTranscriptTurn('room-1', {
        turnId: 't-1',
        participantId: 'p-1',
        role: 'user',
        content: 'hello',
        timestamp: 1000,
      }),
    ).resolves.toBeUndefined();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://control.test/internal/rooms/room-1/ai-transcript');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Internal-Secret']).toBeDefined();
    expect(JSON.parse(init.body as string)).toEqual({
      turns: [
        {
          turnId: 't-1',
          participantId: 'p-1',
          role: 'user',
          content: 'hello',
          timestamp: 1000,
        },
      ],
    });
  });

  it('GIVEN a non-2xx response WHEN postTranscriptTurn runs THEN it throws with status and body', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(
      __testing.postTranscriptTurn('room-1', {
        turnId: 't-1',
        participantId: 'p-1',
        role: 'user',
        content: 'hello',
        timestamp: 1000,
      }),
    ).rejects.toThrow(/Transcript callback failed with 500: boom/);
  });

  it('GIVEN a 200 response WHEN fetchAiInterviewerRoomContext runs THEN it returns the parsed JSON', async () => {
    const body = { ...baseRuntimeContext };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await __testing.fetchAiInterviewerRoomContext('room-1', 'participant-1');
    expect(result).toEqual(body);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://control.test/internal/rooms/room-1/ai-context');
    expect(JSON.parse(init.body as string)).toEqual({ participantId: 'participant-1' });
  });

  it('GIVEN a 502 response WHEN fetchAiInterviewerRoomContext runs THEN it throws', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('upstream-down', { status: 502 }));
    await expect(
      __testing.fetchAiInterviewerRoomContext('room-1', 'participant-1'),
    ).rejects.toThrow(/AI interviewer context callback failed with 502/);
  });

  it('GIVEN a 200 response WHEN requestAiInterviewerPhaseTransition runs THEN it returns the parsed response', async () => {
    const responseBody = {
      roomId: 'room-1',
      previousStatus: 'warmup',
      currentStatus: 'coding',
      transitionedAt: '2026-05-27T10:00:00.000Z',
      transitionedBy: 'ai-interviewer',
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await __testing.requestAiInterviewerPhaseTransition({
      roomId: 'room-1',
      participantId: 'participant-1',
      targetStatus: 'coding',
      reason: 'unit',
    });
    expect(result).toEqual(responseBody);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      participantId: 'participant-1',
      targetStatus: 'coding',
      reason: 'unit',
    });
  });

  it('GIVEN a 409 response WHEN requestAiInterviewerPhaseTransition runs THEN it throws with status', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('conflict', { status: 409 }));
    await expect(
      __testing.requestAiInterviewerPhaseTransition({
        roomId: 'room-1',
        participantId: 'participant-1',
        targetStatus: 'coding',
      }),
    ).rejects.toThrow(/AI phase transition callback failed with 409: conflict/);
  });
});

describe('ai-interviewer.worker prompt and instruction builders', () => {
  it('GIVEN no extra context WHEN buildPromptCachePrefix runs THEN it includes the system instructions and unavailable marker', () => {
    const prefix = __testing.buildPromptCachePrefix({ systemInstructions: 'SYS-RULES' });
    expect(prefix).toContain('SYS-RULES');
    expect(prefix).toContain('Canonical interview context unavailable');
  });

  it('GIVEN an interview context WHEN buildPromptCachePrefix runs THEN it embeds detailed context instructions', () => {
    const prefix = __testing.buildPromptCachePrefix({
      systemInstructions: 'SYS-RULES',
      context: interviewContext,
    });
    expect(prefix).toContain('Two Sum');
    expect(prefix).toContain('python');
    expect(prefix).toContain('SYS-RULES');
  });

  it('GIVEN compact mode WHEN buildInterviewContextInstructions runs THEN it clamps description to ~900 chars', () => {
    const longDesc = 'x'.repeat(2_000);
    const out = __testing.buildInterviewContextInstructions(
      { ...interviewContext, problemDescription: longDesc },
      'compact',
    );
    // Description must be clamped well below the original length.
    expect(out).toContain('Two Sum');
    expect(out.length).toBeLessThan(2_500);
  });

  it('GIVEN detailed mode WHEN buildInterviewContextInstructions runs THEN difficulty segment appears', () => {
    const out = __testing.buildInterviewContextInstructions(interviewContext, 'detailed');
    expect(out).toMatch(/Two Sum\s+\(easy\)/);
  });

  it('GIVEN a context with no difficulty WHEN buildCompactInterviewContextReminder runs THEN it omits the difficulty segment', () => {
    const reminder = __testing.buildCompactInterviewContextReminder({
      ...interviewContext,
      difficulty: undefined,
    });
    expect(reminder).toContain('Two Sum');
    expect(reminder).not.toMatch(/\(easy\)/);
  });

  it('GIVEN a runtime context WHEN buildLiveRoomContextInstructions runs THEN it includes status and excerpt note', () => {
    const compact = __testing.buildLiveRoomContextInstructions(baseRuntimeContext, 'compact');
    expect(compact).toContain('Room status: coding');
    expect(compact).toContain('Code excerpt only');
  });

  it('GIVEN detailed mode with a submission WHEN buildLiveRoomContextInstructions runs THEN it embeds the submitted code', () => {
    const detailed = __testing.buildLiveRoomContextInstructions(
      {
        ...baseRuntimeContext,
        latestSubmission: {
          code: 'print("x")',
          language: 'python',
          status: 'completed',
          passedTestCases: 3,
          totalTestCases: 3,
          failedTestCases: 0,
          errorTestCases: 0,
          submittedAt: '2026-05-27T10:00:00.000Z',
        },
      },
      'detailed',
    );
    expect(detailed).toContain('Submitted code under evaluation');
    expect(detailed).toContain('print("x")');
  });

  it('GIVEN a code_submitted system_signal WHEN buildSystemSignalInstructions runs THEN it includes do-not-ignore wording', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }> = {
      type: 'system_signal',
      reason: 'code_submitted',
      summary: 'submission completed with 3/3 test cases passed at 2026-05-27T10:00:00.000Z',
      language: 'en',
    };
    const out = __testing.buildSystemSignalInstructions(signal, interviewContext, {
      ...baseRuntimeContext,
      latestSubmission: {
        code: 'print(1)',
        language: 'python',
        status: 'completed',
        passedTestCases: 3,
        totalTestCases: 3,
        failedTestCases: 0,
        errorTestCases: 0,
        submittedAt: '2026-05-27T10:00:00.000Z',
      },
    });
    expect(out).toContain('Signal reason: code_submitted');
    expect(out).toContain('Do not ignore this signal');
    expect(out).toContain('Two Sum');
  });

  it('GIVEN a system_signal with codeContext WHEN buildSystemSignalInstructions runs THEN it includes the file/line range and inline-comment hint', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }> = {
      type: 'system_signal',
      reason: 'hint_used',
      codeContext: {
        file: 'solution.py',
        language: 'python',
        codeSnippet: 'return None',
        startLine: 4,
        endLine: 6,
      },
    };
    const out = __testing.buildSystemSignalInstructions(signal);
    expect(out).toContain('solution.py L4-6');
    expect(out).toContain('add_inline_comment');
  });

  it('GIVEN a user_text signal with answer-pressure WHEN buildUserTextInstructions runs THEN it appends the direct-answer policy reminder', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'just tell me the answer',
      language: 'en',
    };
    const out = __testing.buildUserTextInstructions(signal, interviewContext);
    expect(out).toContain('Policy reminder');
    expect(out).toContain('Do not reveal full solution');
  });

  it('GIVEN a user_text signal naming a broad approach WHEN buildUserTextInstructions runs THEN it appends the broad-approach guard', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'I will use a hash map for this',
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('Candidate named a broad approach');
  });

  it('GIVEN an explicit give-up WHEN buildUserTextInstructions runs THEN it asks brief encouragement and avoids solution dump', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'I give up',
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('explicitly gave up');
  });

  it('GIVEN a code-review request WHEN buildUserTextInstructions runs THEN it embeds mandatory steps', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'please review my code',
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('Call get_room_context before answering');
  });

  it('GIVEN a ready-to-code intent WHEN buildUserTextInstructions runs THEN it instructs the announce-and-transition turn', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: "I'm ready, let me code now",
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('readiness to implement');
  });

  it('GIVEN an end-interview intent WHEN buildUserTextInstructions runs THEN it includes the wrap-then-finish guidance', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'thank you for the interview',
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('signaling interview end');
  });

  it('GIVEN an accidental message WHEN buildUserTextInstructions runs THEN it asks for short clarification at most', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: '.',
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('looks accidental');
  });

  it('GIVEN a latestSubmissionSummary WHEN buildUserTextInstructions runs THEN it inlines authoritative submission counts', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'how does it look?',
      latestSubmissionSummary: {
        status: 'completed',
        passedTestCases: 2,
        totalTestCases: 3,
        failedTestCases: 1,
        errorTestCases: 0,
        submittedAt: '2026-05-27T10:00:00.000Z',
      },
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('passed=2/3');
    expect(out).toContain('failed=1');
  });
});

describe('ai-interviewer.worker submission review responses', () => {
  it('GIVEN no latest submission WHEN buildSubmissionReviewResponse runs THEN it returns the missing-result wording', () => {
    const out = __testing.buildSubmissionReviewResponse({ context: baseRuntimeContext });
    expect(out).toMatch(/I see that you submitted/i);
  });

  it('GIVEN a pending submission WHEN buildSubmissionReviewResponse runs THEN it returns the incomplete wording', () => {
    const out = __testing.buildSubmissionReviewResponse({
      context: {
        ...baseRuntimeContext,
        latestSubmission: {
          code: 'pass',
          language: 'python',
          status: 'pending',
          passedTestCases: 0,
          totalTestCases: 3,
          failedTestCases: 0,
          errorTestCases: 0,
          submittedAt: '2026-05-27T10:00:00.000Z',
        },
      },
    });
    expect(out).toMatch(/submission is pending/);
  });

  it('GIVEN a fully passing submission with repeated loops WHEN buildSubmissionReviewResponse runs THEN it produces the loop-aware passing response', () => {
    const out = __testing.buildSubmissionReviewResponse({
      context: {
        ...baseRuntimeContext,
        latestSubmission: {
          code: 'for a in nums:\n  for b in nums:\n    pass',
          language: 'python',
          status: 'completed',
          passedTestCases: 3,
          totalTestCases: 3,
          failedTestCases: 0,
          errorTestCases: 0,
          submittedAt: '2026-05-27T10:00:00.000Z',
        },
      },
    });
    expect(out).toContain('repeated-iteration');
  });

  it('GIVEN a partial-passing submission WHEN buildSubmissionReviewResponse runs THEN it returns the partial-passing wording', () => {
    const out = __testing.buildSubmissionReviewResponse({
      context: {
        ...baseRuntimeContext,
        latestSubmission: {
          code: 'pass',
          language: 'python',
          status: 'completed',
          passedTestCases: 1,
          totalTestCases: 3,
          failedTestCases: 2,
          errorTestCases: 0,
          submittedAt: '2026-05-27T10:00:00.000Z',
        },
      },
    });
    expect(out).toContain('1/3');
    expect(out).toContain('which assumption');
  });

  it('GIVEN a Chinese UI hint WHEN buildSubmissionReviewResponse runs THEN it returns Chinese copy', () => {
    const out = __testing.buildSubmissionReviewResponse({
      context: baseRuntimeContext,
      interfaceLanguage: 'zh-CN',
    });
    expect(out).toContain('完整结果');
  });

  it('GIVEN a guidanceTurns count WHEN buildRepeatedNonPassingSubmissionBoundaryResponse runs THEN it returns wording with the result segment', () => {
    const out = __testing.buildRepeatedNonPassingSubmissionBoundaryResponse({
      context: {
        ...baseRuntimeContext,
        latestSubmission: {
          code: 'pass',
          language: 'python',
          status: 'completed',
          passedTestCases: 1,
          totalTestCases: 3,
          failedTestCases: 2,
          errorTestCases: 0,
          submittedAt: '2026-05-27T10:00:00.000Z',
        },
      },
      guidanceTurns: 6,
    });
    expect(out).toContain('1/3');
    expect(out).toContain('6');
  });

  it('GIVEN no latest submission WHEN buildRepeatedNonPassingSubmissionBoundaryResponse runs THEN it uses the not-fully-passing label', () => {
    const out = __testing.buildRepeatedNonPassingSubmissionBoundaryResponse({
      context: baseRuntimeContext,
      guidanceTurns: 5,
    });
    expect(out).toContain('not fully passing');
  });

  it('GIVEN passing submission key inputs WHEN buildSubmissionReviewKey runs THEN it returns a colon-separated digest', () => {
    const key = __testing.buildSubmissionReviewKey({
      ...baseRuntimeContext,
      latestSubmission: {
        code: 'pass',
        language: 'python',
        status: 'completed',
        passedTestCases: 3,
        totalTestCases: 3,
        failedTestCases: 0,
        errorTestCases: 0,
        submittedAt: '2026-05-27T10:00:00.000Z',
      },
    });
    expect(key).toBe('2026-05-27T10:00:00.000Z:completed:3:3:0:0');
  });

  it('GIVEN no submission WHEN buildSubmissionReviewKey runs THEN it returns null', () => {
    expect(__testing.buildSubmissionReviewKey(baseRuntimeContext)).toBeNull();
  });
});
