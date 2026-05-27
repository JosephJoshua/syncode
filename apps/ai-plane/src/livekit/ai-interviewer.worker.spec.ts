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
