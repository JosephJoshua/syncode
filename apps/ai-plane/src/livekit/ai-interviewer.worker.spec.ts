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
    constructor(public opts?: unknown) {}

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
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'unit-test-openai-key';
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

  it('GIVEN realtime env WHEN createRealtimeSession runs THEN it configures semantic VAD and near-field noise reduction', () => {
    const session = __testing.createRealtimeSession() as {
      opts: { llm: { opts: Record<string, unknown> } };
    };

    expect(session.opts.llm.opts).toMatchObject({
      apiKey: 'unit-test-openai-key',
      model: 'gpt-realtime',
      voice: 'alloy',
      inputAudioNoiseReduction: { type: 'near_field' },
      turnDetection: {
        type: 'semantic_vad',
        eagerness: 'low',
        create_response: false,
        interrupt_response: true,
      },
    });
  });

  it('GIVEN fallback env WHEN createFallbackSession runs THEN it configures multilingual STT and the text LLM', () => {
    const session = __testing.createFallbackSession() as {
      opts: { stt: { opts: Record<string, unknown> }; llm: { opts: Record<string, unknown> } };
    };

    expect(session.opts.stt.opts).toMatchObject({
      model: 'GLM-ASR-2512',
      language: 'multi',
      detectLanguage: true,
    });
    expect(session.opts.llm.opts).toMatchObject({
      model: 'DeepSeek-V3.2-Instruct',
    });
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

describe('ai-interviewer.worker answer-pressure and optimization guard responses', () => {
  it('GIVEN willMoveToWrapup=true WHEN buildSafeAnswerPressureResponse runs THEN it emits the wrapup wording in English', () => {
    const out = __testing.buildSafeAnswerPressureResponse({
      candidateMessage: 'give me the answer',
      pressureTurns: 4,
      shouldWrapUp: true,
      willMoveToWrapup: true,
    });
    expect(out).toMatch(/move to wrapup/i);
  });

  it('GIVEN willMoveToWrapup=true on a Chinese message WHEN buildSafeAnswerPressureResponse runs THEN Chinese wording is used', () => {
    const out = __testing.buildSafeAnswerPressureResponse({
      candidateMessage: '直接告诉我答案',
      pressureTurns: 4,
      shouldWrapUp: true,
      willMoveToWrapup: true,
    });
    expect(out).toContain('总结');
  });

  it('GIVEN shouldWrapUp=true without willMoveToWrapup WHEN buildSafeAnswerPressureResponse runs THEN it offers the final-attempt choice', () => {
    const out = __testing.buildSafeAnswerPressureResponse({
      candidateMessage: 'give me the answer',
      pressureTurns: 3,
      shouldWrapUp: true,
      willMoveToWrapup: false,
    });
    expect(out).toMatch(/one final attempt/i);
  });

  it('GIVEN pressureTurns>=2 WHEN buildSafeAnswerPressureResponse runs THEN it asks where the repeated work happens', () => {
    const out = __testing.buildSafeAnswerPressureResponse({
      candidateMessage: 'give me the answer',
      pressureTurns: 2,
      shouldWrapUp: false,
      willMoveToWrapup: false,
    });
    expect(out).toMatch(/repeated work/i);
  });

  it('GIVEN no pressure escalation WHEN buildSafeAnswerPressureResponse runs THEN it asks about brute-force bottlenecks', () => {
    const out = __testing.buildSafeAnswerPressureResponse({
      candidateMessage: 'give me the answer',
      pressureTurns: 1,
      shouldWrapUp: false,
      willMoveToWrapup: false,
    });
    expect(out).toMatch(/brute force/i);
  });

  it('GIVEN an English message WHEN buildPassingOptimizationGuardResponse runs THEN it returns the English guard copy', () => {
    const out = __testing.buildPassingOptimizationGuardResponse('please optimize this');
    expect(out).toContain('passing solution');
  });

  it('GIVEN a Chinese message WHEN buildPassingOptimizationGuardResponse runs THEN it returns the Chinese guard copy', () => {
    const out = __testing.buildPassingOptimizationGuardResponse('帮我优化一下');
    expect(out).toContain('通过测试');
  });
});

describe('ai-interviewer.worker phase kickoff and wrapup builders', () => {
  it('GIVEN an interface language WHEN buildWarmupKickoffInstructions runs with Chinese hint THEN it constrains the opening to Chinese', () => {
    const out = __testing.buildWarmupKickoffInstructions({
      interfaceLanguage: 'zh-CN',
      rememberedContext: interviewContext,
      runtimeContext: baseRuntimeContext,
    });
    expect(out).toContain('Simplified Chinese');
  });

  it('GIVEN an English-only candidate WHEN buildWarmupKickoffInstructions runs THEN it forbids Chinese in opening', () => {
    const out = __testing.buildWarmupKickoffInstructions({
      interfaceLanguage: 'en-US',
    });
    expect(out).toContain('English only');
  });

  it('GIVEN warmup follow-up params WHEN buildWarmupFollowupInstructions runs THEN it embeds the candidate message and turn-2 rules', () => {
    const out = __testing.buildWarmupFollowupInstructions({
      candidateMessage: 'I will iterate the array',
      rememberedContext: interviewContext,
      runtimeContext: baseRuntimeContext,
    });
    expect(out).toContain('Warmup scripted turn 2');
    expect(out).toContain('I will iterate the array');
  });

  it('GIVEN warmup transition params WHEN buildWarmupTransitionAnnouncementInstructions runs THEN it instructs the preamble for the phase change', () => {
    const out = __testing.buildWarmupTransitionAnnouncementInstructions({
      candidateMessage: 'sounds good',
      rememberedContext: interviewContext,
      runtimeContext: baseRuntimeContext,
    });
    expect(out).toContain('warmup is complete');
  });

  it('GIVEN repeated non-passing guidance turns WHEN buildRepeatedNonPassingGuidanceInstructions runs THEN it surfaces the turn count', () => {
    const out = __testing.buildRepeatedNonPassingGuidanceInstructions({
      guidanceTurns: 5,
      candidateMessage: 'stuck',
    });
    expect(out).toContain('5');
    expect(out).toContain('Repeated non-passing');
  });

  it('GIVEN repeated stuck turns WHEN buildWrapupAfterRepeatedStuckInstructions runs THEN it asks for calm professional acknowledgement', () => {
    const out = __testing.buildWrapupAfterRepeatedStuckInstructions({
      candidateMessage: 'I am lost',
      discouragedTurns: 3,
    });
    expect(out).toContain('wrap up');
  });

  it('GIVEN coding kickoff params WHEN buildCodingPhaseKickoffInstructions runs THEN it embeds anti-leakage rules', () => {
    const out = __testing.buildCodingPhaseKickoffInstructions({
      candidateMessage: 'okay',
      rememberedContext: interviewContext,
      runtimeContext: baseRuntimeContext,
    });
    expect(out).toContain('HARD ANTI-LEAKAGE');
  });

  it('GIVEN no submission WHEN buildWrapupPhaseKickoffInstructions runs THEN it acknowledges effort honestly', () => {
    const out = __testing.buildWrapupPhaseKickoffInstructions({
      rememberedContext: interviewContext,
      runtimeContext: baseRuntimeContext,
    });
    expect(out).toContain('No completed submission');
  });

  it('GIVEN a passing submission WHEN buildWrapupPhaseKickoffInstructions runs THEN it opens with positive acknowledgement', () => {
    const out = __testing.buildWrapupPhaseKickoffInstructions({
      rememberedContext: interviewContext,
      runtimeContext: {
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
      },
    });
    expect(out).toContain('passed all 3');
    expect(out).toContain('great work');
  });

  it('GIVEN a partial submission WHEN buildWrapupPhaseKickoffInstructions runs THEN it asks for measured acknowledgement and forbids overpraise', () => {
    const out = __testing.buildWrapupPhaseKickoffInstructions({
      rememberedContext: interviewContext,
      runtimeContext: {
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
    expect(out).toMatch(/do NOT overpraise/);
  });
});

describe('ai-interviewer.worker silent-context update builder', () => {
  it('GIVEN a system signal with submission WHEN buildSilentLiveContextUpdateInstructions runs THEN it includes submitted code header', () => {
    const out = __testing.buildSilentLiveContextUpdateInstructions({
      signal: {
        type: 'system_signal',
        reason: 'code_ran',
        summary: 'run summary',
      },
      context: {
        ...baseRuntimeContext,
        latestSubmission: {
          code: 'print(1)',
          language: 'python',
          status: 'completed',
          passedTestCases: 1,
          totalTestCases: 1,
          failedTestCases: 0,
          errorTestCases: 0,
          submittedAt: '2026-05-27T10:00:00.000Z',
        },
      },
    });
    expect(out).toContain('Silent live coding context update');
    expect(out).toContain('Latest submitted code that produced the submission');
    expect(out).toContain('print(1)');
  });

  it('GIVEN no submission WHEN buildSilentLiveContextUpdateInstructions runs THEN submitted-code header is absent', () => {
    const out = __testing.buildSilentLiveContextUpdateInstructions({
      signal: { type: 'system_signal', reason: 'code_ran' },
      context: baseRuntimeContext,
    });
    expect(out).not.toContain('Latest submitted code that produced');
  });
});

describe('ai-interviewer.worker numbered code block and clamp helpers', () => {
  it('GIVEN code shorter than maxLines WHEN buildNumberedCodeBlock runs THEN it numbers every line and omits trailing summary', () => {
    const out = __testing.buildNumberedCodeBlock('a\nb\nc', 10, 1_000);
    expect(out).toMatch(/^\s+1 \| a\n\s+2 \| b\n\s+3 \| c$/);
  });

  it('GIVEN code with more lines than maxLines WHEN buildNumberedCodeBlock runs THEN trailing "more lines" summary is appended', () => {
    const code = Array.from({ length: 12 }, (_, i) => `line${i}`).join('\n');
    const out = __testing.buildNumberedCodeBlock(code, 5, 1_000);
    expect(out).toContain('... (7 more lines)');
    expect(out.split('\n').length).toBe(6);
  });

  it('GIVEN empty/whitespace code WHEN buildNumberedCodeBlock runs THEN it returns empty string', () => {
    expect(__testing.buildNumberedCodeBlock('', 10, 1_000)).toBe('');
    expect(__testing.buildNumberedCodeBlock('   \n  ', 10, 1_000)).toBe('');
  });

  it('GIVEN content longer than maxLength WHEN clampInstructionContent runs THEN result ends with the ellipsis character', () => {
    const out = __testing.clampInstructionContent('a'.repeat(50), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
  });

  it('GIVEN content within maxLength WHEN clampInstructionContent runs THEN result is unchanged', () => {
    const out = __testing.clampInstructionContent('hello', 10);
    expect(out).toBe('hello');
  });

  it('GIVEN text WHEN estimateTokenCount runs THEN it returns at least 1 token for non-empty input', () => {
    expect(__testing.estimateTokenCount('')).toBe(0);
    expect(__testing.estimateTokenCount('   ')).toBe(0);
    expect(__testing.estimateTokenCount('hello')).toBeGreaterThanOrEqual(1);
    const big = __testing.estimateTokenCount('a'.repeat(380));
    expect(big).toBeGreaterThanOrEqual(99);
    expect(big).toBeLessThanOrEqual(101);
  });

  it('GIVEN code with two loops WHEN hasRepeatedLoopStructure runs THEN it returns true', () => {
    expect(__testing.hasRepeatedLoopStructure('for a in nums:\n  for b in nums:\n    pass')).toBe(
      true,
    );
  });

  it('GIVEN a single loop WHEN hasRepeatedLoopStructure runs THEN it returns false', () => {
    expect(__testing.hasRepeatedLoopStructure('for a in nums:\n  return a')).toBe(false);
  });
});

describe('ai-interviewer.worker text classifiers', () => {
  const TRUE_CASES: Array<[keyof typeof __testing, string]> = [
    ['isDirectAnswerRequest', 'just tell me the answer'],
    ['isDirectAnswerRequest', '直接告诉我答案'],
    ['isOptimizationRequest', 'make this better please'],
    ['isOptimizationRequest', '请优化一下'],
    ['isCandidateUnableToFindStrategy', "I can't think of any strategy"],
    ['isCandidateUnableToFindStrategy', '想不出来了'],
    ['mentionsBroadApproach', 'maybe a hash map?'],
    ['mentionsBroadApproach', '用哈希表'],
    ['isExplicitGiveUp', 'I give up'],
    ['isExplicitGiveUp', '我做不出来'],
    ['isDiscouragedCandidateMessage', 'this is too hard'],
    ['isDiscouragedCandidateMessage', '太难了'],
    ['isContinueAttemptIntent', 'one more try'],
    ['isContinueAttemptIntent', '再试一次'],
    ['isCodeOrSubmissionReviewRequest', 'please review my code'],
    ['isCodeOrSubmissionReviewRequest', '检查我的代码'],
    ['isContextRefreshRequest', 'please fetch the code context'],
    ['isContextRefreshRequest', '获取代码上下文'],
    ['isReadyToCodeIntent', 'let me code now'],
    ['isReadyToCodeIntent', '开始写代码'],
    ['isEndInterviewIntent', 'goodbye'],
    ['isEndInterviewIntent', '结束面试'],
  ];

  it.each(TRUE_CASES)('GIVEN matching text "%s" WHEN %s runs THEN it returns true', (fn, text) => {
    const helper = __testing[fn] as (s: string) => boolean;
    expect(helper(text)).toBe(true);
  });

  it('GIVEN benign text WHEN classifiers run THEN they return false', () => {
    const benign = 'I am working on the problem now.';
    expect(__testing.isDirectAnswerRequest(benign)).toBe(false);
    expect(__testing.isExplicitGiveUp(benign)).toBe(false);
    expect(__testing.isCodeOrSubmissionReviewRequest(benign)).toBe(false);
    expect(__testing.isContextRefreshRequest(benign)).toBe(false);
    expect(__testing.isReadyToCodeIntent(benign)).toBe(false);
    expect(__testing.isEndInterviewIntent(benign)).toBe(false);
    expect(__testing.mentionsBroadApproach(benign)).toBe(false);
  });

  it('GIVEN empty or filler text WHEN isLikelyAccidentalCandidateMessage runs THEN it returns true', () => {
    expect(__testing.isLikelyAccidentalCandidateMessage('')).toBe(true);
    expect(__testing.isLikelyAccidentalCandidateMessage('  ')).toBe(true);
    expect(__testing.isLikelyAccidentalCandidateMessage('uhh')).toBe(true);
    expect(__testing.isLikelyAccidentalCandidateMessage('!!')).toBe(true);
    expect(__testing.isLikelyAccidentalCandidateMessage('a')).toBe(true);
  });

  it('GIVEN substantive text WHEN isLikelyAccidentalCandidateMessage runs THEN it returns false', () => {
    expect(__testing.isLikelyAccidentalCandidateMessage('hello there')).toBe(false);
    expect(__testing.isLikelyAccidentalCandidateMessage('你好啊')).toBe(false);
  });

  it('GIVEN a Chinese language hint WHEN isChineseLanguageHint runs THEN it returns true', () => {
    expect(__testing.isChineseLanguageHint('zh-CN')).toBe(true);
    expect(__testing.isChineseLanguageHint('Chinese')).toBe(true);
    expect(__testing.isChineseLanguageHint('en')).toBe(false);
    expect(__testing.isChineseLanguageHint(undefined)).toBe(false);
  });

  it('GIVEN an interface language WHEN buildInterfaceLanguageInstruction runs THEN it returns the locale-appropriate copy', () => {
    expect(__testing.buildInterfaceLanguageInstruction('zh', 'opening')).toContain(
      'Simplified Chinese',
    );
    expect(__testing.buildInterfaceLanguageInstruction('en', 'opening')).toContain('English only');
    expect(__testing.buildInterfaceLanguageInstruction('zh', 'system')).toContain(
      'Prefer Simplified Chinese',
    );
    expect(__testing.buildInterfaceLanguageInstruction(undefined, 'system')).toContain(
      'Prefer English',
    );
  });
});

describe('ai-interviewer.worker submission parsers and predicates', () => {
  it('GIVEN a well-formed submission summary WHEN parseSubmissionSignalSummary runs THEN it parses counts and timestamp', () => {
    expect(
      __testing.parseSubmissionSignalSummary(
        'submission completed with 3/5 test cases passed at 2026-05-27T10:00:00.000Z',
      ),
    ).toEqual({
      passedTestCases: 3,
      totalTestCases: 5,
      submittedAt: '2026-05-27T10:00:00.000Z',
    });
  });

  it('GIVEN a summary with trailing punctuation WHEN parseSubmissionSignalSummary runs THEN timestamp is normalized', () => {
    expect(
      __testing.parseSubmissionSignalSummary(
        'submission completed with 3/5 test cases passed at 2026-05-27T10:00:00.000Z.',
      )?.submittedAt,
    ).toBe('2026-05-27T10:00:00.000Z');
  });

  it('GIVEN a malformed summary WHEN parseSubmissionSignalSummary runs THEN it returns null', () => {
    expect(__testing.parseSubmissionSignalSummary('not a submission')).toBeNull();
    expect(__testing.parseSubmissionSignalSummary(undefined)).toBeNull();
    expect(
      __testing.parseSubmissionSignalSummary('submission completed with 0/0 test cases passed'),
    ).toBeNull();
  });

  it('GIVEN a non-parseable timestamp WHEN normalizeSubmissionSignalTimestamp runs THEN it returns undefined', () => {
    expect(__testing.normalizeSubmissionSignalTimestamp('not-a-time')).toBeUndefined();
    expect(__testing.normalizeSubmissionSignalTimestamp(undefined)).toBeUndefined();
  });

  it('GIVEN a parseable timestamp WHEN normalizeSubmissionSignalTimestamp runs THEN it returns normalized value', () => {
    expect(__testing.normalizeSubmissionSignalTimestamp('2026-05-27T10:00:00.000Z')).toBe(
      '2026-05-27T10:00:00.000Z',
    );
  });

  it('GIVEN a well-formed run summary WHEN parseRunSummary runs THEN it parses passed/total', () => {
    expect(__testing.parseRunSummary('Latest run: 2/3 passed.')).toEqual({ passed: 2, total: 3 });
  });

  it('GIVEN garbage input WHEN parseRunSummary runs THEN it returns null', () => {
    expect(__testing.parseRunSummary(undefined)).toBeNull();
    expect(__testing.parseRunSummary('nothing')).toBeNull();
    expect(__testing.parseRunSummary('Latest run: 0/0 passed.')).toBeNull();
  });

  it('GIVEN a passing submission WHEN isPassingSubmission runs THEN it returns true', () => {
    expect(
      __testing.isPassingSubmission({
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
      }),
    ).toBe(true);
  });

  it('GIVEN a non-passing submission WHEN isNonPassingSubmission runs THEN it returns true', () => {
    expect(
      __testing.isNonPassingSubmission({
        ...baseRuntimeContext,
        latestSubmission: {
          code: 'pass',
          language: 'python',
          status: 'completed',
          passedTestCases: 2,
          totalTestCases: 3,
          failedTestCases: 1,
          errorTestCases: 0,
          submittedAt: '2026-05-27T10:00:00.000Z',
        },
      }),
    ).toBe(true);
  });

  it('GIVEN no submission WHEN isPassingSubmission/isNonPassingSubmission run THEN they return false', () => {
    expect(__testing.isPassingSubmission(baseRuntimeContext)).toBe(false);
    expect(__testing.isNonPassingSubmission(baseRuntimeContext)).toBe(false);
    expect(__testing.isPassingSubmission(undefined)).toBe(false);
    expect(__testing.isNonPassingSubmission(undefined)).toBe(false);
  });

  it('GIVEN a matching latest submission WHEN matchesExpectedSubmission runs THEN it returns true', () => {
    const latest = {
      code: 'pass',
      language: 'python' as const,
      status: 'completed' as const,
      passedTestCases: 2,
      totalTestCases: 3,
      failedTestCases: 1,
      errorTestCases: 0,
      submittedAt: '2026-05-27T10:00:00.000Z',
    };
    expect(
      __testing.matchesExpectedSubmission(latest, {
        passedTestCases: 2,
        totalTestCases: 3,
        submittedAt: '2026-05-27T09:59:00.000Z',
      }),
    ).toBe(true);
  });

  it('GIVEN matching counts without timestamp WHEN matchesExpectedSubmission runs THEN it accepts the latest submission', () => {
    const latest = {
      code: 'pass',
      language: 'python' as const,
      status: 'completed' as const,
      passedTestCases: 2,
      totalTestCases: 3,
      failedTestCases: 1,
      errorTestCases: 0,
      submittedAt: '2026-05-27T10:00:00.000Z',
    };

    expect(
      __testing.matchesExpectedSubmission(latest, {
        passedTestCases: 2,
        totalTestCases: 3,
      }),
    ).toBe(true);
  });

  it('GIVEN a mismatched submission WHEN matchesExpectedSubmission runs THEN it returns false', () => {
    const latest = {
      code: 'pass',
      language: 'python' as const,
      status: 'completed' as const,
      passedTestCases: 1,
      totalTestCases: 3,
      failedTestCases: 2,
      errorTestCases: 0,
      submittedAt: '2026-05-27T10:00:00.000Z',
    };
    expect(
      __testing.matchesExpectedSubmission(latest, {
        passedTestCases: 2,
        totalTestCases: 3,
      }),
    ).toBe(false);
    expect(
      __testing.matchesExpectedSubmission(null, { passedTestCases: 1, totalTestCases: 3 }),
    ).toBe(false);
    expect(
      __testing.matchesExpectedSubmission(latest, {
        passedTestCases: 1,
        totalTestCases: 3,
        submittedAt: 'not-a-date',
      }),
    ).toBe(false);
  });

  it('GIVEN expected submission context checks WHEN helper predicates run THEN they wait until counts match or attempts are exhausted', () => {
    const context = {
      ...baseRuntimeContext,
      latestSubmission: {
        code: 'pass',
        language: 'python' as const,
        status: 'completed' as const,
        passedTestCases: 2,
        totalTestCases: 3,
        failedTestCases: 1,
        errorTestCases: 0,
        submittedAt: '2026-05-27T10:00:00.000Z',
      },
    };
    const expected = { passedTestCases: 3, totalTestCases: 3 };

    expect(__testing.isExpectedSubmissionContext(context, undefined)).toBe(true);
    expect(__testing.isExpectedSubmissionContext(context, expected)).toBe(false);
    expect(
      __testing.shouldReturnFetchedRoomContext({
        context,
        expected,
        attempt: 1,
        maxAttempts: 4,
      }),
    ).toBe(false);
    expect(
      __testing.shouldReturnFetchedRoomContext({
        context,
        expected,
        attempt: 4,
        maxAttempts: 4,
      }),
    ).toBe(true);
  });

  it('GIVEN a runtime context with a problem WHEN toRealtimeInterviewContext runs THEN it returns the mapped context', () => {
    const out = __testing.toRealtimeInterviewContext(baseRuntimeContext);
    expect(out).toMatchObject({
      problemTitle: 'Two Sum',
      problemDescription: baseRuntimeContext.problem?.description,
    });
  });

  it('GIVEN a runtime context without a problem WHEN toRealtimeInterviewContext runs THEN it returns undefined', () => {
    expect(
      __testing.toRealtimeInterviewContext({ ...baseRuntimeContext, problem: null }),
    ).toBeUndefined();
  });

  it('GIVEN starter code missing WHEN toRealtimeInterviewContext runs THEN it falls back to placeholder text', () => {
    const out = __testing.toRealtimeInterviewContext({
      ...baseRuntimeContext,
      problem: {
        title: 'Two Sum',
        description: 'desc',
        difficulty: null,
        starterCode: null,
      },
    });
    expect(out?.starterCode).toMatch(/No official starter code/);
  });
});

describe('ai-interviewer.worker resolveInlineCommentLine', () => {
  const sample = ['def f(x):', '  return x', '  # placeholder', '  return None'].join('\n');

  it('GIVEN a matching lineText WHEN resolveInlineCommentLine runs THEN it returns the matched line', () => {
    expect(__testing.resolveInlineCommentLine(1, 'return x', sample)).toBe(2);
  });

  it('GIVEN an out-of-bounds requested line WHEN resolveInlineCommentLine runs THEN it clamps within bounds', () => {
    expect(__testing.resolveInlineCommentLine(99, undefined, sample)).toBe(4);
    expect(__testing.resolveInlineCommentLine(0, undefined, sample)).toBe(1);
  });

  it('GIVEN no matching needle WHEN resolveInlineCommentLine runs THEN it falls back to the bounded line', () => {
    expect(__testing.resolveInlineCommentLine(2, 'not in code', sample)).toBe(2);
  });

  it('GIVEN empty code WHEN resolveInlineCommentLine runs THEN it returns 1', () => {
    // split('\n') of empty returns [''] which yields lines.length === 1, so result is bounded at 1.
    expect(__testing.resolveInlineCommentLine(1, undefined, '')).toBe(1);
  });
});

describe('ai-interviewer.worker reason-specific and constraint guidance', () => {
  const reasons: AiInterviewerSignalReason[] = [
    'session_joined',
    'stage_changed',
    'user_idle',
    'hint_used',
    'code_ran',
    'code_submitted',
    'manual_nudge',
  ];

  it.each(
    reasons,
  )('GIVEN reason %s WHEN buildReasonSpecificInstructions runs THEN it returns reason-tailored text', (reason) => {
    const out = __testing.buildReasonSpecificInstructions(reason, undefined);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('GIVEN a code_ran summary with a fully passing run WHEN buildReasonSpecificInstructions runs THEN it asks to stay quiet', () => {
    const out = __testing.buildReasonSpecificInstructions('code_ran', 'Latest run: 3/3 passed.');
    expect(out).toContain('Visible run passed fully');
  });

  it('GIVEN a code_ran summary with a partial run WHEN buildReasonSpecificInstructions runs THEN it asks for a targeted debug question', () => {
    const out = __testing.buildReasonSpecificInstructions('code_ran', 'Latest run: 1/3 passed.');
    expect(out).toContain('non-passing tests');
  });

  it('GIVEN a problem description hinting guaranteed solutions WHEN buildConstraintGuidance runs THEN it returns the no-no-solution-drill copy', () => {
    const out = __testing.buildConstraintGuidance({
      ...baseRuntimeContext,
      problem: {
        title: 'p',
        description: 'You are guaranteed a valid solution exists.',
        difficulty: null,
        starterCode: null,
      },
    });
    expect(out).toContain('guaranteed valid solution');
  });

  it('GIVEN no special hints WHEN buildConstraintGuidance runs THEN it returns the conservative default', () => {
    const out = __testing.buildConstraintGuidance(baseRuntimeContext);
    expect(out).toContain('do not invent extra assumptions');
  });

  it.each([
    'waiting',
    'warmup',
    'coding',
    'wrapup',
    'finished',
  ] as const)('GIVEN room status %s WHEN buildPhaseBehaviorGuidance runs THEN it returns a phase-specific tip', (status) => {
    const out = __testing.buildPhaseBehaviorGuidance(status);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('GIVEN runtime signal states WHEN shouldIgnoreRuntimeSignal runs THEN waiting and finished rooms are filtered correctly', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }> = {
      type: 'system_signal',
      reason: 'stage_changed',
    };

    expect(
      __testing.shouldIgnoreRuntimeSignal(signal, {
        ...baseRuntimeContext,
        roomStatus: 'waiting',
      }),
    ).toBe(true);
    expect(
      __testing.shouldIgnoreRuntimeSignal(
        { ...signal, reason: 'manual_nudge' },
        { ...baseRuntimeContext, roomStatus: 'waiting' },
      ),
    ).toBe(false);
    expect(
      __testing.shouldIgnoreRuntimeSignal(signal, {
        ...baseRuntimeContext,
        roomStatus: 'finished',
      }),
    ).toBe(true);
  });

  it('GIVEN phase kickoff signals WHEN predicate helpers run THEN only eligible phase transitions match', () => {
    const stageChanged: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }> = {
      type: 'system_signal',
      reason: 'stage_changed',
    };
    const joined: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }> = {
      type: 'system_signal',
      reason: 'session_joined',
    };

    expect(
      __testing.isWarmupKickoffSignal(
        joined,
        { ...baseRuntimeContext, roomStatus: 'warmup' },
        'not_started',
      ),
    ).toBe(true);
    expect(
      __testing.isWarmupKickoffSignal(
        stageChanged,
        { ...baseRuntimeContext, roomStatus: 'warmup' },
        'completed',
      ),
    ).toBe(false);
    expect(
      __testing.isCodingKickoffSignal(
        stageChanged,
        { ...baseRuntimeContext, roomStatus: 'coding' },
        false,
      ),
    ).toBe(true);
    expect(
      __testing.isCodingKickoffSignal(
        stageChanged,
        { ...baseRuntimeContext, roomStatus: 'coding' },
        true,
      ),
    ).toBe(false);
    expect(
      __testing.isWrapupKickoffSignal(
        stageChanged,
        { ...baseRuntimeContext, roomStatus: 'wrapup' },
        false,
      ),
    ).toBe(true);
  });
});

describe('ai-interviewer.worker error message resolver', () => {
  it('GIVEN an Error WHEN resolveErrorEventMessage runs THEN it returns the error message', () => {
    expect(__testing.resolveErrorEventMessage(new Error('boom'))).toBe('boom');
  });

  it('GIVEN a string WHEN resolveErrorEventMessage runs THEN it returns the string', () => {
    expect(__testing.resolveErrorEventMessage('plain')).toBe('plain');
  });

  it('GIVEN an unknown value WHEN resolveErrorEventMessage runs THEN it returns a generic fallback', () => {
    expect(__testing.resolveErrorEventMessage({})).toBe('AI interviewer error');
    expect(__testing.resolveErrorEventMessage(null)).toBe('AI interviewer error');
  });
});

describe('ai-interviewer.worker shouldRespondToSystemSignal', () => {
  const baseParams = {
    now: 1_000_000,
    signalLastSentAt: new Map<AiInterviewerSignalReason, number>(),
    lastSystemReplyAt: 0,
    hasInterviewStarted: true,
    lastUserTurnAt: 0,
    lastAssistantTurnAt: 0,
  };

  it('GIVEN reason manual_nudge WHEN shouldRespondToSystemSignal runs THEN it always returns true', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        signal: { type: 'system_signal', reason: 'manual_nudge' },
      }),
    ).toBe(true);
  });

  it('GIVEN session_joined while interview already started WHEN shouldRespondToSystemSignal runs THEN it returns false', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        signal: { type: 'system_signal', reason: 'session_joined' },
      }),
    ).toBe(false);
  });

  it('GIVEN session_joined while interview not yet started WHEN shouldRespondToSystemSignal runs THEN it returns true', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        hasInterviewStarted: false,
        signal: { type: 'system_signal', reason: 'session_joined' },
      }),
    ).toBe(true);
  });

  it('GIVEN a recent same-reason signal WHEN shouldRespondToSystemSignal runs THEN it returns false due to min interval', () => {
    const map = new Map<AiInterviewerSignalReason, number>([['code_ran', 1_000_000 - 5_000]]);
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        signalLastSentAt: map,
        signal: { type: 'system_signal', reason: 'code_ran' },
      }),
    ).toBe(false);
  });

  it('GIVEN a recent global system reply (non-submission) WHEN shouldRespondToSystemSignal runs THEN it returns false', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastSystemReplyAt: 1_000_000 - 10_000, // < SYSTEM_SIGNAL_GLOBAL_MIN_INTERVAL_MS (60s)
        signal: { type: 'system_signal', reason: 'hint_used' },
      }),
    ).toBe(false);
  });

  it('GIVEN user_idle but recent user activity WHEN shouldRespondToSystemSignal runs THEN it returns false', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastUserTurnAt: 1_000_000 - 60_000, // 1m < 3m gate
        signal: { type: 'system_signal', reason: 'user_idle' },
      }),
    ).toBe(false);
  });

  it('GIVEN user_idle with no prior user turn WHEN shouldRespondToSystemSignal runs THEN it returns false', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastUserTurnAt: 0,
        signal: { type: 'system_signal', reason: 'user_idle' },
      }),
    ).toBe(false);
  });

  it('GIVEN user_idle with old user/assistant turns WHEN shouldRespondToSystemSignal runs THEN it returns true', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastUserTurnAt: 1_000_000 - 5 * 60_000,
        lastAssistantTurnAt: 1_000_000 - 5 * 60_000,
        signal: { type: 'system_signal', reason: 'user_idle' },
      }),
    ).toBe(true);
  });

  it('GIVEN code_ran with a recent assistant turn WHEN shouldRespondToSystemSignal runs THEN it returns false', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastAssistantTurnAt: 1_000_000 - 30_000,
        signal: { type: 'system_signal', reason: 'code_ran', summary: 'Latest run: 1/3 passed.' },
      }),
    ).toBe(false);
  });

  it('GIVEN code_ran with a passing run summary and an old assistant turn WHEN shouldRespondToSystemSignal runs THEN it returns false', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastAssistantTurnAt: 1_000_000 - 10 * 60_000,
        signal: { type: 'system_signal', reason: 'code_ran', summary: 'Latest run: 3/3 passed.' },
      }),
    ).toBe(false);
  });

  it('GIVEN code_submitted with a sufficient gap WHEN shouldRespondToSystemSignal runs THEN it returns true', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastAssistantTurnAt: 1_000_000 - 10_000,
        signal: { type: 'system_signal', reason: 'code_submitted' },
      }),
    ).toBe(true);
  });

  it('GIVEN stage_changed shortly after assistant turn WHEN shouldRespondToSystemSignal runs THEN it returns false', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastAssistantTurnAt: 1_000_000 - 10_000,
        signal: { type: 'system_signal', reason: 'stage_changed' },
      }),
    ).toBe(false);
  });

  it('GIVEN hint_used long after the last assistant turn WHEN shouldRespondToSystemSignal runs THEN it returns true', () => {
    expect(
      __testing.shouldRespondToSystemSignal({
        ...baseParams,
        lastAssistantTurnAt: 1_000_000 - 5 * 60_000,
        lastSystemReplyAt: 1_000_000 - 5 * 60_000,
        signal: { type: 'system_signal', reason: 'hint_used' },
      }),
    ).toBe(true);
  });
});

describe('ai-interviewer.worker createInterviewerInstructions', () => {
  it('GIVEN no parameters WHEN createInterviewerInstructions runs THEN it returns a string containing the interviewer policy header', () => {
    const out = __testing.createInterviewerInstructions();
    expect(out).toContain('SynCode Interviewer');
    expect(out).toContain('interviewer-safe prompts');
  });
});
