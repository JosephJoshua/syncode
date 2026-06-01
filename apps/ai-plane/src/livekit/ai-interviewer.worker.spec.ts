import type {
  AiInterviewerContext,
  AiInterviewerContextResponse,
  AiInterviewerSignalPayload,
} from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wsMockState = vi.hoisted(() => ({
  outcomes: [] as Array<'open' | 'error' | 'close'>,
  connections: [] as Array<{
    url: string;
    headers: Record<string, string> | undefined;
  }>,
}));

// Mock heavy LiveKit/OpenAI plugin modules so importing the worker does not
// reach out to native bindings or require an OpenAI key at module load.
vi.mock('@livekit/agents', () => {
  class FakeAsyncQueue<T> implements AsyncIterableIterator<T> {
    private readonly items: T[] = [];
    private readonly waiters: Array<(result: IteratorResult<T>) => void> = [];
    closed = false;

    put(item: T): void {
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter({ value: item, done: false });
        return;
      }
      this.items.push(item);
    }

    close(): void {
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) {
        waiter({ value: undefined, done: true });
      }
    }

    next(): Promise<IteratorResult<T>> {
      const item = this.items.shift();
      if (item) {
        return Promise.resolve({ value: item, done: false });
      }
      if (this.closed) {
        return Promise.resolve({ value: undefined, done: true });
      }
      return new Promise((resolve) => this.waiters.push(resolve));
    }

    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      return this;
    }
  }

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
  class FakeTTS {
    emit = vi.fn();
    constructor(
      public sampleRate: number,
      public numChannels: number,
      public capabilities: unknown,
    ) {}
  }
  class FakeChunkedStream<TAudio = unknown> implements AsyncIterableIterator<TAudio> {
    protected queue = new FakeAsyncQueue<TAudio>();
    protected output = this.queue;
    protected abortController = new AbortController();

    constructor(
      public inputText: string,
      _tts: unknown,
      _connOptions?: unknown,
      abortSignal?: AbortSignal,
    ) {
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => this.abortController.abort(), { once: true });
      }
      queueMicrotask(async () => {
        try {
          if (typeof (this as { run?: () => Promise<void> }).run === 'function') {
            await (this as { run: () => Promise<void> }).run();
          }
        } finally {
          this.queue.close();
        }
      });
    }

    get abortSignal(): AbortSignal {
      return this.abortController.signal;
    }

    next(): Promise<IteratorResult<TAudio>> {
      return this.output.next();
    }

    close(): void {
      this.queue.close();
      this.abortController.abort();
    }

    [Symbol.asyncIterator](): AsyncIterableIterator<TAudio> {
      return this;
    }
  }
  class FakeAudioByteStream {
    constructor(
      private readonly sampleRate: number,
      private readonly numChannels: number,
    ) {}

    write(data: ArrayBufferLike | ArrayBufferView): unknown[] {
      const byteLength = ArrayBuffer.isView(data) ? data.byteLength : data.byteLength;
      if (byteLength === 0) {
        return [];
      }
      return [
        {
          sampleRate: this.sampleRate,
          numChannels: this.numChannels,
          samplesPerChannel: Math.max(1, Math.floor(byteLength / 2 / this.numChannels)),
        },
      ];
    }

    flush(): unknown[] {
      return [];
    }
  }
  return {
    AudioByteStream: FakeAudioByteStream,
    cli: { runApp: vi.fn() },
    defineAgent: (config: unknown) => ({ __config: config }),
    ServerOptions: class {
      constructor(public opts: unknown) {}
    },
    llm: {
      tool: (spec: unknown) => spec,
    },
    shortuuid: () => 'unit-test-request-id',
    stt: {
      STT: class {
        label = 'fake.stt';
        capabilities: unknown;
        constructor(capabilities: unknown) {
          this.capabilities = capabilities;
        }
      },
      StreamAdapter: class {
        kind = 'stream-adapter';
        constructor(
          public wrappedStt: unknown,
          public vad: unknown,
        ) {}
      },
      SpeechEventType: {
        FINAL_TRANSCRIPT: 2,
      },
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
    tts: {
      TTS: FakeTTS,
      ChunkedStream: FakeChunkedStream,
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

vi.mock('ws', () => {
  type Handler = (...args: unknown[]) => void;

  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    private readonly handlers = new Map<string, Handler[]>();

    constructor(url: string | URL, opts?: { headers?: Record<string, string> }) {
      wsMockState.connections.push({
        url: url.toString(),
        headers: opts?.headers,
      });
      const outcome = wsMockState.outcomes.shift() ?? 'open';
      queueMicrotask(() => {
        if (outcome === 'open') {
          this.readyState = MockWebSocket.OPEN;
          this.emit('open');
          return;
        }
        if (outcome === 'close') {
          this.readyState = MockWebSocket.CLOSED;
          this.emit('close', 1006, Buffer.from('closed before open'));
          return;
        }
        this.readyState = MockWebSocket.CLOSED;
        this.emit('error', new Error('WebSocket was closed before the connection was established'));
        this.emit('close', 1006, Buffer.alloc(0));
      });
    }

    once(event: string, handler: Handler): this {
      const wrapped: Handler = (...args) => {
        this.off(event, wrapped);
        handler(...args);
      };
      return this.on(event, wrapped);
    }

    on(event: string, handler: Handler): this {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
      return this;
    }

    off(event: string, handler: Handler): this {
      const handlers = this.handlers.get(event) ?? [];
      this.handlers.set(
        event,
        handlers.filter((candidate) => candidate !== handler),
      );
      return this;
    }

    close(): void {
      this.readyState = MockWebSocket.CLOSED;
      queueMicrotask(() => this.emit('close', 1000, Buffer.alloc(0)));
    }

    terminate(): void {
      this.readyState = MockWebSocket.CLOSED;
      queueMicrotask(() => this.emit('close', 1006, Buffer.alloc(0)));
    }

    private emit(event: string, ...args: unknown[]): void {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args);
      }
    }
  }

  return { WebSocket: MockWebSocket, default: MockWebSocket };
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
process.env.CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? 'http://control.test';
delete process.env.AI_TTS_MODEL;
delete process.env.MINIMAX_API_KEY;
delete process.env.MINIMAX_TTS_BASE_URL;
delete process.env.MINIMAX_TTS_MODEL;

// Import after env + mocks are in place so module-level side effects succeed.
const { __testing } = await import('./ai-interviewer.worker.js');

beforeEach(() => {
  wsMockState.outcomes = [];
  wsMockState.connections = [];
});

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

function createTestWavHex(): string {
  const sampleRate = 32_000;
  const channels = 1;
  const pcmData = Buffer.alloc(6_400);
  const header = Buffer.alloc(44);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.byteLength, 40);

  return Buffer.concat([header, pcmData]).toString('hex');
}

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

  it('GIVEN proxy env vars WHEN withoutProxyEnv runs THEN it temporarily clears and restores them', async () => {
    process.env.http_proxy = 'http://127.0.0.1:64265';
    process.env.HTTPS_PROXY = 'http://127.0.0.1:64265';

    await __testing.withoutProxyEnv(async () => {
      expect(process.env.http_proxy).toBeUndefined();
      expect(process.env.HTTPS_PROXY).toBeUndefined();
    });

    expect(process.env.http_proxy).toBe('http://127.0.0.1:64265');
    expect(process.env.HTTPS_PROXY).toBe('http://127.0.0.1:64265');
    delete process.env.http_proxy;
    delete process.env.HTTPS_PROXY;
  });

  it('GIVEN LiveKit assigns localhost WHEN resolving agent connect URL THEN it keeps the assigned URL', () => {
    expect(
      __testing.resolveLiveKitAgentConnectUrl({
        assignedUrl: 'ws://localhost:7880',
      }),
    ).toBe('ws://localhost:7880');
  });

  it('GIVEN remote LiveKit assignment WHEN resolving agent connect URL THEN it keeps the assigned URL', () => {
    expect(
      __testing.resolveLiveKitAgentConnectUrl({
        assignedUrl: 'wss://livekit.example.com',
      }),
    ).toBe('wss://livekit.example.com');
  });

  it('GIVEN explicit LiveKit agent connect URL WHEN resolving agent connect URL THEN it uses the override', () => {
    expect(
      __testing.resolveLiveKitAgentConnectUrl({
        assignedUrl: 'ws://127.0.0.1:7880',
        overrideUrl: 'ws://host.docker.internal:7880',
      }),
    ).toBe('ws://host.docker.internal:7880');
  });

  it('GIVEN non-loopback LiveKit assignment WHEN resolving agent connect URL THEN it keeps the assignment', () => {
    expect(
      __testing.resolveLiveKitAgentConnectUrl({
        assignedUrl: 'wss://project.livekit.cloud',
      }),
    ).toBe('wss://project.livekit.cloud');
  });

  it('GIVEN a slow operation WHEN withTimeout runs THEN it rejects with the timeout message', async () => {
    await expect(
      __testing.withTimeout(new Promise((resolve) => setTimeout(resolve, 50)), 1, 'too slow'),
    ).rejects.toThrow('too slow');
  });

  it('GIVEN realtime env WHEN createRealtimeSession runs THEN it configures semantic VAD and near-field noise reduction', async () => {
    const session = (await __testing.createRealtimeSession()) as {
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
    expect(wsMockState.connections.at(-1)?.url).toBe(
      'wss://api.openai.com/v1/realtime?model=gpt-realtime',
    );
  });

  it('GIVEN realtime WebSocket cannot connect WHEN createInterviewSession runs THEN it uses HTTP STT fallback without probing another WebSocket', async () => {
    wsMockState.outcomes.push('error', 'error');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    try {
      const session = (await __testing.createInterviewSession({} as never)) as {
        opts: { stt?: { kind: string }; llm: { opts: Record<string, unknown> } };
      };

      expect(wsMockState.connections).toHaveLength(1);
      expect(session.opts.stt).toMatchObject({ kind: 'stream-adapter' });
      expect(session.opts.llm.opts).toMatchObject({
        model: 'DeepSeek-V3.2-Instruct',
      });
      expect(session.opts).toMatchObject({
        ttsReadIdleTimeout: 60_000,
        forwardAudioIdleTimeout: 60_000,
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('GIVEN force fallback is enabled WHEN createInterviewSession runs THEN it skips realtime probing', async () => {
    wsMockState.outcomes.push('open');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    try {
      const session = (await __testing.createInterviewSession({} as never, {
        forceFallback: true,
      })) as {
        opts: { stt?: { kind: string }; llm: { opts: Record<string, unknown> } };
      };

      expect(wsMockState.connections).toHaveLength(0);
      expect(session.opts.stt).toMatchObject({ kind: 'stream-adapter' });
      expect(session.opts.llm.opts).toMatchObject({
        model: 'DeepSeek-V3.2-Instruct',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('GIVEN fallback env WHEN createFallbackSession runs THEN it configures HTTP STT and the text LLM', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    try {
      const session = (await __testing.createFallbackSession({} as never)) as {
        opts: {
          stt: { kind: string; wrappedStt: { model: string; provider: string } };
          llm: { opts: Record<string, unknown> };
        };
      };

      expect(session.opts.stt).toMatchObject({
        kind: 'stream-adapter',
        wrappedStt: {
          provider: 'syncode-ai-platform',
          model: 'GLM-ASR-2512',
        },
      });
      expect(session.opts.llm.opts).toMatchObject({
        model: 'DeepSeek-V3.2-Instruct',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('GIVEN no compatible configured TTS WHEN createFallbackSession runs THEN it uses OpenAI HTTP TTS', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    try {
      const session = (await __testing.createFallbackSession({} as never)) as {
        opts: {
          tts: { opts: Record<string, unknown> };
        };
      };

      expect(session.opts.tts.opts).toMatchObject({
        apiKey: 'unit-test-openai-key',
        baseURL: 'https://api.openai.com/v1',
        model: 'tts-1',
        voice: 'alloy',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('GIVEN no prewarmed VAD WHEN createFallbackSession runs THEN it still configures HTTP STT', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    try {
      const session = (await __testing.createFallbackSession(undefined)) as {
        opts: {
          stt: { model: string; provider: string };
          llm: { opts: Record<string, unknown> };
        };
      };

      expect(session.opts.stt).toMatchObject({
        provider: 'syncode-ai-platform',
        model: 'GLM-ASR-2512',
      });
      expect(session.opts.llm.opts).toMatchObject({
        model: 'DeepSeek-V3.2-Instruct',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('GIVEN AI platform chat is unavailable WHEN createFallbackSession runs THEN it uses proxy-aware OpenAI chat fallback', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'Arrearage',
            message: 'Access denied, please make sure your account is in good standing.',
          },
        }),
        { status: 400 },
      ),
    );

    try {
      const session = (await __testing.createFallbackSession(undefined)) as {
        opts: {
          llm: { opts: Record<string, unknown> };
        };
      };

      expect(session.opts.llm.opts).toMatchObject({
        model: 'gpt-4o-mini',
      });
      expect(session.opts.llm.opts.client).toBeDefined();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('GIVEN MiniMax TTS base URL WHEN resolving the endpoint THEN it appends t2a_v2 once', () => {
    expect(__testing.resolveMiniMaxTtsUrl('https://api.minimax.chat/v1')).toBe(
      'https://api.minimax.chat/v1/t2a_v2',
    );
    expect(__testing.resolveMiniMaxTtsUrl('https://api.minimax.chat/v1/t2a_v2')).toBe(
      'https://api.minimax.chat/v1/t2a_v2',
    );
  });

  it('GIVEN MiniMax official REST config WHEN createFallbackSession runs THEN it uses native MiniMax TTS', async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    const originalAiTtsModel = process.env.AI_TTS_MODEL;
    const originalMinimaxBaseUrl = process.env.MINIMAX_TTS_BASE_URL;
    const originalMinimaxModel = process.env.MINIMAX_TTS_MODEL;
    const originalMinimaxKey = process.env.MINIMAX_API_KEY;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_TTS_MODEL;
    process.env.MINIMAX_API_KEY = 'unit-test-minimax-key';
    process.env.MINIMAX_TTS_BASE_URL = 'https://api.minimax.chat/v1';
    process.env.MINIMAX_TTS_MODEL = 'speech-02-hd';

    try {
      const freshModule = await import('./ai-interviewer.worker.js');
      const session = (await freshModule.__testing.createFallbackSession({} as never)) as {
        opts: { tts: { label: string; model: string; provider: string } };
      };

      expect(session.opts.tts.label).toBe('minimax.TTS');
      expect(session.opts.tts.model).toBe('speech-02-hd');
      expect(session.opts.tts.provider).toBe('api.minimax.chat');
    } finally {
      fetchSpy.mockRestore();
      vi.resetModules();
      if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalOpenAiKey;
      if (originalAiTtsModel === undefined) delete process.env.AI_TTS_MODEL;
      else process.env.AI_TTS_MODEL = originalAiTtsModel;
      if (originalMinimaxBaseUrl === undefined) delete process.env.MINIMAX_TTS_BASE_URL;
      else process.env.MINIMAX_TTS_BASE_URL = originalMinimaxBaseUrl;
      if (originalMinimaxModel === undefined) delete process.env.MINIMAX_TTS_MODEL;
      else process.env.MINIMAX_TTS_MODEL = originalMinimaxModel;
      if (originalMinimaxKey === undefined) delete process.env.MINIMAX_API_KEY;
      else process.env.MINIMAX_API_KEY = originalMinimaxKey;
    }
  });

  it('GIVEN MiniMax TTS returns WAV hex WHEN synthesizing THEN it posts to the official t2a endpoint', async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    const originalAiTtsModel = process.env.AI_TTS_MODEL;
    const originalMinimaxBaseUrl = process.env.MINIMAX_TTS_BASE_URL;
    const originalMinimaxModel = process.env.MINIMAX_TTS_MODEL;
    const originalMinimaxKey = process.env.MINIMAX_API_KEY;
    const wavHex = createTestWavHex();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { audio: wavHex },
            base_resp: { status_code: 0, status_msg: '' },
          }),
          { status: 200 },
        ),
      );

    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_TTS_MODEL;
    process.env.MINIMAX_API_KEY = 'unit-test-minimax-key';
    process.env.MINIMAX_TTS_BASE_URL = 'https://api.minimax.chat/v1';
    process.env.MINIMAX_TTS_MODEL = 'speech-02-hd';

    try {
      const freshModule = await import('./ai-interviewer.worker.js');
      const session = (await freshModule.__testing.createFallbackSession(undefined)) as {
        opts: {
          tts: {
            synthesize: (text: string) => AsyncIterableIterator<{ final: boolean }>;
          };
        };
      };

      const frames: Array<{ final: boolean }> = [];
      for await (const frame of session.opts.tts.synthesize('Hello from SynCode.')) {
        frames.push(frame);
      }

      const [, request] = fetchSpy.mock.calls.at(-1) ?? [];
      const body = JSON.parse(String((request as RequestInit).body));

      expect(fetchSpy.mock.calls.at(-1)?.[0]).toBe('https://api.minimax.chat/v1/t2a_v2');
      expect((request as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer unit-test-minimax-key',
        'Content-Type': 'application/json',
      });
      expect(body).toMatchObject({
        model: 'speech-02-hd',
        text: 'Hello from SynCode.',
        stream: false,
        output_format: 'hex',
        voice_setting: { voice_id: 'female-shaonv' },
        audio_setting: {
          sample_rate: 32000,
          format: 'wav',
          channel: 1,
        },
      });
      expect(frames.at(-1)?.final).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      vi.resetModules();
      if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalOpenAiKey;
      if (originalAiTtsModel === undefined) delete process.env.AI_TTS_MODEL;
      else process.env.AI_TTS_MODEL = originalAiTtsModel;
      if (originalMinimaxBaseUrl === undefined) delete process.env.MINIMAX_TTS_BASE_URL;
      else process.env.MINIMAX_TTS_BASE_URL = originalMinimaxBaseUrl;
      if (originalMinimaxModel === undefined) delete process.env.MINIMAX_TTS_MODEL;
      else process.env.MINIMAX_TTS_MODEL = originalMinimaxModel;
      if (originalMinimaxKey === undefined) delete process.env.MINIMAX_API_KEY;
      else process.env.MINIMAX_API_KEY = originalMinimaxKey;
    }
  });

  it('GIVEN participant publishes an audio track after join WHEN subscribing THEN the worker subscribes to it', () => {
    const setSubscribed = vi.fn();

    __testing.subscribeRemoteTrackPublication(
      {
        kind: 'KIND_AUDIO',
        sid: 'track-1',
        subscribed: false,
        setSubscribed,
      },
      { identity: 'candidate-1' },
      'room-1',
      'published',
    );

    expect(setSubscribed).toHaveBeenCalledWith(true);
  });

  it('GIVEN participant publishes a non-audio track WHEN subscribing THEN the worker subscribes to it', () => {
    const setSubscribed = vi.fn();

    __testing.subscribeRemoteTrackPublication(
      {
        kind: 'KIND_VIDEO',
        sid: 'track-1',
        subscribed: false,
        setSubscribed,
      },
      { identity: 'candidate-1' },
      'room-1',
      'published',
    );

    expect(setSubscribed).toHaveBeenCalledWith(true);
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

  it('GIVEN a code_submitted system_signal WHEN buildSystemSignalInstructions runs THEN it includes the system event marker', () => {
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
    expect(out).toContain('[System event: code_submitted]');
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

  it('GIVEN a user_text signal WHEN buildUserTextInstructions runs THEN it formats the candidate message simply', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'how do I optimize this?',
      language: 'en',
    };
    const out = __testing.buildUserTextInstructions(signal, interviewContext);
    expect(out).toContain('Candidate: how do I optimize this?');
    expect(out).toContain('Language hint: en');
    expect(out).toContain('Two Sum');
  });

  it('GIVEN a user_text signal WITHOUT interview context WHEN buildUserTextInstructions runs THEN it does not embed context', () => {
    const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
      type: 'user_text',
      text: 'hello',
    };
    const out = __testing.buildUserTextInstructions(signal);
    expect(out).toContain('Candidate: hello');
    expect(out).not.toContain('Two Sum');
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
  });
});

describe('ai-interviewer.worker code context update builder', () => {
  it('GIVEN a system signal WHEN buildCodeContextUpdate runs THEN it includes background marker and room status', () => {
    const out = __testing.buildCodeContextUpdate({
      context: baseRuntimeContext,
      signal: { type: 'system_signal', reason: 'code_ran', summary: '3/5 tests passed' },
    });
    expect(out).toContain('[Background: code_ran]');
    expect(out).toContain('coding');
  });

  it('GIVEN no submission WHEN buildCodeContextUpdate runs THEN it shows none for submission', () => {
    const out = __testing.buildCodeContextUpdate({
      context: { ...baseRuntimeContext, latestSubmission: undefined },
      signal: { type: 'system_signal', reason: 'code_ran' },
    });
    expect(out).toContain('none');
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

  describe('ai-interviewer.worker text classifiers', () => {
    it('GIVEN empty or filler text WHEN isLikelyAccidentalCandidateMessage runs THEN it returns true', () => {
      expect(__testing.isLikelyAccidentalCandidateMessage('')).toBe(true);
      expect(__testing.isLikelyAccidentalCandidateMessage('uh')).toBe(true);
      expect(__testing.isLikelyAccidentalCandidateMessage('...')).toBe(true);
    });

    it('GIVEN substantive text WHEN isLikelyAccidentalCandidateMessage runs THEN it returns false', () => {
      expect(__testing.isLikelyAccidentalCandidateMessage('how do I solve this?')).toBe(false);
      expect(__testing.isLikelyAccidentalCandidateMessage('I think this is O(n)')).toBe(false);
    });

    it('GIVEN a Chinese language hint WHEN isChineseLanguageHint runs THEN it returns true', () => {
      expect(__testing.isChineseLanguageHint('zh-CN')).toBe(true);
      expect(__testing.isChineseLanguageHint('chinese')).toBe(true);
      expect(__testing.isChineseLanguageHint('en-US')).toBe(false);
    });

    it('GIVEN an interface language WHEN buildInterfaceLanguageInstruction runs THEN it returns the locale-appropriate copy', () => {
      const zh = __testing.buildInterfaceLanguageInstruction('zh-CN', 'opening');
      expect(zh).toContain('Chinese');
      const en = __testing.buildInterfaceLanguageInstruction('en-US', 'opening');
      expect(en).toContain('English');
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
    it('GIVEN a code_ran summary with a fully passing run WHEN buildReasonSpecificInstructions runs THEN it suggests staying quiet', () => {
      const out = __testing.buildReasonSpecificInstructions(
        'code_ran',
        'Latest run: 5 / 5 passed.',
      );
      expect(out).toContain('stay quiet');
    });

    it('GIVEN a code_ran summary with a partial run WHEN buildReasonSpecificInstructions runs THEN it asks for a targeted question', () => {
      const out = __testing.buildReasonSpecificInstructions(
        'code_ran',
        'Latest run: 2 / 5 passed.',
      );
      expect(out).toContain('failed');
    });

    it('GIVEN a problem description hinting guaranteed solutions WHEN buildConstraintGuidance runs THEN it returns the no-no-solution-drill copy', () => {
      const ctx = {
        ...baseRuntimeContext,
        problem: { title: 'Test', description: 'exactly one solution is guaranteed' },
      };
      const out = __testing.buildConstraintGuidance(ctx);
      expect(out).toContain('guaranteed');
    });

    it('GIVEN no special hints WHEN buildConstraintGuidance runs THEN it returns the conservative default', () => {
      const out = __testing.buildConstraintGuidance(baseRuntimeContext);
      expect(out).toContain('Constraint note');
    });

    it('GIVEN runtime signal states WHEN shouldIgnoreRuntimeSignal runs THEN waiting and finished rooms are filtered correctly', () => {
      const sig = { type: 'system_signal' as const, reason: 'code_ran' as const };
      expect(
        __testing.shouldIgnoreRuntimeSignal(sig, { ...baseRuntimeContext, roomStatus: 'waiting' }),
      ).toBe(true);
      expect(
        __testing.shouldIgnoreRuntimeSignal(sig, { ...baseRuntimeContext, roomStatus: 'finished' }),
      ).toBe(true);
      expect(
        __testing.shouldIgnoreRuntimeSignal(sig, { ...baseRuntimeContext, roomStatus: 'coding' }),
      ).toBe(false);
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

  describe('ai-interviewer.worker anti-spam and idle check-in backstops', () => {
    it('GIVEN a recent reply WHEN hasAntiSpamElapsed runs THEN it returns false within the backstop window', () => {
      const now = Date.now();
      expect(__testing.hasAntiSpamElapsed(now, now + 4_000)).toBe(false);
      expect(__testing.hasAntiSpamElapsed(now, now + 8_000)).toBe(true);
    });

    it('GIVEN no user turns WHEN isIdleCheckinOverdue runs THEN it returns false', () => {
      const now = Date.now();
      expect(__testing.isIdleCheckinOverdue(0, 0, now)).toBe(false);
    });

    it('GIVEN user idle beyond threshold WHEN isIdleCheckinOverdue runs THEN it returns true', () => {
      const now = Date.now();
      const longAgo = now - 6 * 60_000;
      expect(__testing.isIdleCheckinOverdue(longAgo, longAgo, now)).toBe(true);
    });

    it('GIVEN user idle but recent agent reply WHEN isIdleCheckinOverdue runs THEN it returns false', () => {
      const now = Date.now();
      const longAgo = now - 6 * 60_000;
      expect(__testing.isIdleCheckinOverdue(longAgo, now, now)).toBe(false);
    });
  });

  describe('ai-interviewer.worker createInterviewerInstructions', () => {
    it('GIVEN no parameters WHEN createInterviewerInstructions runs THEN it returns a principle-based interviewer prompt', () => {
      const out = __testing.createInterviewerInstructions();
      expect(out).toContain('technical interviewer');
      expect(out).toContain('Answer-Leak Prevention');
      expect(out).toContain('Conversational Rhythm');
      expect(out).toContain('Listen more than you speak');
    });
  });
});
