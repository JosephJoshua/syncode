import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type APIConnectOptions,
  type AudioBuffer,
  AudioByteStream,
  AutoSubscribe,
  cli,
  defineAgent,
  type JobContext,
  type JobProcess,
  llm,
  mergeFrames,
  normalizeLanguage,
  ServerOptions,
  shortuuid,
  stt,
  tts,
  voice,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import * as aiCoustics from '@livekit/plugins-ai-coustics';
import {
  AI_INTERVIEWER_EVENT_TOPIC,
  AI_INTERVIEWER_SIGNAL_TOPIC,
  type AiInterviewerContext,
  type AiInterviewerContextRequest,
  type AiInterviewerContextResponse,
  type AiInterviewerEventPayload,
  type AiInterviewerPhaseTransitionRequest,
  type AiInterviewerPhaseTransitionResponse,
  type AiInterviewerSignalPayload,
  type AiInterviewerSignalReason,
  CONTROL_INTERNAL,
  decodeAiInterviewerSignalPayload,
  encodeAiInterviewerEventPayload,
} from '@syncode/contracts';
import { config as loadDotenv } from 'dotenv';
import { OpenAI } from 'openai';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { validateEnv } from '../config/env.config.js';
import { OpenAiCompatibleLlmProvider } from '../llm/openai-compatible-llm.provider.js';

interface DispatchMetadata {
  roomId?: string;
  participantUserId?: string;
  sessionId?: string | null;
}

interface TranscriptTurnPayload {
  turnId: string;
  participantId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ParsedSubmissionSignalSummary {
  passedTestCases: number;
  totalTestCases: number;
  submittedAt?: string;
}

interface RemoteTrackPublicationLike {
  kind?: unknown;
  sid?: string;
  subscribed?: boolean;
  setSubscribed?: (subscribed: boolean) => void;
}

interface RemoteParticipantLike {
  identity?: string;
  trackPublications?: Map<string, RemoteTrackPublicationLike>;
}

interface WorkerEnv {
  AI_INTERVIEWER_AGENT_IDENTITY: string;
  AI_INTERVIEWER_AGENT_NAME: string;
  AI_INTERVIEWER_FALLBACK_ENABLED: boolean;
  AI_INTERVIEWER_FORCE_FALLBACK: boolean;
  AI_INTERVIEWER_RECONNECT_GRACE_MS: number;
  AI_INTERVIEWER_WORKER_INITIALIZE_TIMEOUT_MS: number;
  AI_INTERVIEWER_WORKER_SHUTDOWN_TIMEOUT_MS: number;
  AI_PLATFORM_API_KEY: string;
  AI_PLATFORM_BASE_URL: string;
  AI_PLATFORM_MODEL: string;
  AI_REQUEST_TIMEOUT_MS: number;
  AI_STT_MODEL: string;
  AI_TTS_MODEL?: string;
  AI_TTS_VOICE: string;
  MINIMAX_API_KEY?: string;
  MINIMAX_TTS_BASE_URL?: string;
  MINIMAX_TTS_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_CHAT_FALLBACK_MODEL: string;
  OPENAI_TTS_BASE_URL: string;
  OPENAI_TTS_MODEL: string;
  OPENAI_REALTIME_BASE_URL: string;
  OPENAI_REALTIME_CONNECT_TIMEOUT_MS: number;
  OPENAI_REALTIME_MODEL: string;
  OPENAI_REALTIME_VOICE: string;
  CONTROL_PLANE_URL: string;
  INTERNAL_CALLBACK_SECRET: string;
  LIVEKIT_AGENT_CONNECT_URL?: string;
  LIVEKIT_URL?: string;
}

type LiveContextDetail = 'compact' | 'detailed';
type RoomPhaseStatus = 'warmup' | 'coding' | 'wrapup' | 'finished';

// Hard backstop: no more than one system-initiated reply per 8 seconds.
// Prevents audio glitches from overlapping generation and stops spam from
// rapid-fire signals. The model handles all other turn-taking naturally.
const ANTI_SPAM_MIN_INTERVAL_MS = 8_000;
// Safety net: if the candidate has been silent for 5 minutes AND the agent
// hasn't spoken in 5 minutes, force a check-in even if the model would
// otherwise stay quiet. Prevents the interview from going totally silent.
const IDLE_CHECKIN_MS = 5 * 60_000;
// Suppress user transcripts that land while the agent is speaking or within
// this window after it stops, since they are almost always echo of the
// agent's own audio captured by the candidate's microphone (e.g. when the
// candidate is not wearing headphones) rather than real candidate input.
const USER_INPUT_ECHO_GUARD_MS = 1_500;
const REALTIME_EVENT_PUBLISH_TIMEOUT_MS = 2_000;
// Batch rapid code_ran signals: only inject context at most once per this
// interval to avoid flooding the model's context window.
const CODE_RAN_CONTEXT_DEBOUNCE_MS = 30_000;
const NOISE_RUN_SUMMARY_PATTERN = /Latest run:\s*(\d+)\s*\/\s*(\d+)\s*passed\./i;
const REALTIME_CONTEXT_WARN_TOKENS = 35_000;
const REALTIME_CONTEXT_CRITICAL_TOKENS = 45_000;
const LIVE_CODE_CONTEXT_MESSAGE_ID = 'syncode_live_code_context';
const FNV_64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_64_PRIME = 0x100000001b3n;
const PROXY_ENV_KEYS = [
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
] as const;

const OPENAI_TTS_VOICES: ReadonlySet<openai.TTSVoices> = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
]);
const MINIMAX_TTS_SAMPLE_RATE = 32_000;
const MINIMAX_TTS_CHANNELS = 1;
const MINIMAX_TTS_BYTES_PER_SAMPLE = 2;
const MINIMAX_TTS_BITRATE = 128_000;
const MINIMAX_TTS_AUDIO_FORMAT = 'wav';

const minimaxTtsResponseSchema = z
  .object({
    data: z
      .object({
        audio: z.string().optional(),
      })
      .optional(),
    base_resp: z
      .object({
        status_code: z.number().optional(),
        status_msg: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

function createStableDigest(value: string): string {
  let hash = FNV_64_OFFSET_BASIS;
  for (const char of value) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * FNV_64_PRIME);
  }
  return hash.toString(16).padStart(16, '0');
}

function trimTrailingSlashes(value: string): string {
  let normalized = value.trim();
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function trimTrailingSubmissionPunctuation(value: string): string {
  let end = value.length;
  while (end > 0) {
    const char = value.at(end - 1);
    if (char !== ')' && char !== ',' && char !== '.' && char !== ';') {
      break;
    }
    end -= 1;
  }
  return value.slice(0, end);
}

async function withoutProxyEnv<T>(operation: () => Promise<T>): Promise<T> {
  const previous = new Map<(typeof PROXY_ENV_KEYS)[number], string | undefined>();
  for (const key of PROXY_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    return await operation();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function subscribeRemoteTrackPublication(
  publication: RemoteTrackPublicationLike,
  participant: RemoteParticipantLike | undefined,
  roomId: string,
  reason: 'connected' | 'published',
): void {
  if (!publication.setSubscribed) {
    return;
  }

  if (publication.subscribed) {
    return;
  }

  publication.setSubscribed(true);
  console.debug(
    `[ai-interviewer-worker] subscribed to participant track room=${roomId} participant=${
      participant?.identity ?? 'unknown'
    } track=${publication.sid ?? 'unknown'} kind=${String(publication.kind ?? 'unknown')} reason=${reason}`,
  );
}

function subscribeExistingRemoteTracks(ctx: JobContext, roomId: string): void {
  for (const participant of ctx.room.remoteParticipants.values() as Iterable<RemoteParticipantLike>) {
    for (const publication of participant.trackPublications?.values() ?? []) {
      subscribeRemoteTrackPublication(publication, participant, roomId, 'connected');
    }
  }
}

function registerFutureRemoteTrackSubscription(ctx: JobContext, roomId: string): () => void {
  const room = ctx.room as unknown as {
    on(
      event: 'trackPublished',
      handler: (
        publication: RemoteTrackPublicationLike,
        participant: RemoteParticipantLike,
      ) => void,
    ): void;
    off(
      event: 'trackPublished',
      handler: (
        publication: RemoteTrackPublicationLike,
        participant: RemoteParticipantLike,
      ) => void,
    ): void;
  };
  const subscribeOnPublish = (
    publication: RemoteTrackPublicationLike,
    participant: RemoteParticipantLike,
  ) => {
    subscribeRemoteTrackPublication(publication, participant, roomId, 'published');
  };

  room.on('trackPublished', subscribeOnPublish);
  return () => room.off('trackPublished', subscribeOnPublish);
}

loadWorkerEnvFiles();
const env = loadWorkerEnv();

function loadWorkerEnvFiles(): void {
  const start = process.cwd();
  const visited = new Set<string>();
  let cursor = start;
  let loaded = false;

  while (!visited.has(cursor)) {
    visited.add(cursor);
    const localPath = resolve(cursor, '.env.local');
    const envPath = resolve(cursor, '.env');
    if (existsSync(localPath)) {
      loadDotenv({ path: localPath, override: false });
      loaded = true;
    }
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false });
      loaded = true;
    }

    const parent = dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  if (!loaded) {
    loadDotenv();
  }
}

function loadWorkerEnv(): WorkerEnv {
  const parsed = validateEnv(process.env);
  if (!parsed.INTERNAL_CALLBACK_SECRET) {
    throw new Error('INTERNAL_CALLBACK_SECRET is required for AI interviewer worker');
  }

  return {
    AI_INTERVIEWER_AGENT_IDENTITY: parsed.AI_INTERVIEWER_AGENT_IDENTITY,
    AI_INTERVIEWER_AGENT_NAME: parsed.AI_INTERVIEWER_AGENT_NAME,
    AI_INTERVIEWER_FALLBACK_ENABLED: parsed.AI_INTERVIEWER_FALLBACK_ENABLED,
    AI_INTERVIEWER_FORCE_FALLBACK: parsed.AI_INTERVIEWER_FORCE_FALLBACK,
    AI_INTERVIEWER_RECONNECT_GRACE_MS: parsed.AI_INTERVIEWER_RECONNECT_GRACE_MS,
    AI_INTERVIEWER_WORKER_INITIALIZE_TIMEOUT_MS: parsed.AI_INTERVIEWER_WORKER_INITIALIZE_TIMEOUT_MS,
    AI_INTERVIEWER_WORKER_SHUTDOWN_TIMEOUT_MS: parsed.AI_INTERVIEWER_WORKER_SHUTDOWN_TIMEOUT_MS,
    AI_PLATFORM_API_KEY: parsed.AI_PLATFORM_API_KEY,
    AI_PLATFORM_BASE_URL: parsed.AI_PLATFORM_BASE_URL,
    AI_PLATFORM_MODEL: parsed.AI_PLATFORM_MODEL,
    AI_REQUEST_TIMEOUT_MS: parsed.AI_REQUEST_TIMEOUT_MS,
    AI_STT_MODEL: parsed.AI_STT_MODEL,
    AI_TTS_MODEL: parsed.AI_TTS_MODEL,
    AI_TTS_VOICE: parsed.AI_TTS_VOICE,
    MINIMAX_API_KEY: parsed.MINIMAX_API_KEY,
    MINIMAX_TTS_BASE_URL: parsed.MINIMAX_TTS_BASE_URL,
    MINIMAX_TTS_MODEL: parsed.MINIMAX_TTS_MODEL,
    OPENAI_API_KEY: parsed.OPENAI_API_KEY,
    OPENAI_CHAT_FALLBACK_MODEL: parsed.OPENAI_CHAT_FALLBACK_MODEL,
    OPENAI_TTS_BASE_URL: parsed.OPENAI_TTS_BASE_URL,
    OPENAI_TTS_MODEL: parsed.OPENAI_TTS_MODEL,
    OPENAI_REALTIME_BASE_URL: parsed.OPENAI_REALTIME_BASE_URL,
    OPENAI_REALTIME_CONNECT_TIMEOUT_MS: parsed.OPENAI_REALTIME_CONNECT_TIMEOUT_MS,
    OPENAI_REALTIME_MODEL: parsed.OPENAI_REALTIME_MODEL,
    OPENAI_REALTIME_VOICE: parsed.OPENAI_REALTIME_VOICE,
    CONTROL_PLANE_URL: parsed.CONTROL_PLANE_URL,
    INTERNAL_CALLBACK_SECRET: parsed.INTERNAL_CALLBACK_SECRET,
    LIVEKIT_AGENT_CONNECT_URL: parsed.LIVEKIT_AGENT_CONNECT_URL,
    LIVEKIT_URL: parsed.LIVEKIT_URL,
  };
}

function normalizeOpenAiSdkBaseUrl(baseUrl: string): string {
  const normalized = trimTrailingSlashes(baseUrl);
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

function resolveLiveKitAgentConnectUrl(params: {
  assignedUrl: string;
  overrideUrl?: string;
}): string {
  const overrideUrl = params.overrideUrl?.trim();
  if (overrideUrl) {
    return overrideUrl;
  }

  return params.assignedUrl;
}

function summarizeUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'invalid-url';
  }
}

function resolveUpstreamProxyUrl(): string | undefined {
  return (
    process.env.SYNCODE_UPSTREAM_PROXY_URL ||
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    process.env.all_proxy ||
    process.env.ALL_PROXY
  );
}

function createProxyFetch(proxyUrl: string): typeof fetch {
  const dispatcher = new ProxyAgent(proxyUrl);
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher,
    }) as unknown as Promise<Response>) as typeof fetch;
}

function summarizeProviderError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: string; type?: string; message?: string };
    };
    const code = parsed.error?.code ?? parsed.error?.type;
    const message = parsed.error?.message;
    return [status, code, message].filter(Boolean).join(' ');
  } catch {
    return `${status} ${body.slice(0, 180)}`.trim();
  }
}

async function probeAiPlatformChatCompletion(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(env.AI_REQUEST_TIMEOUT_MS, 8_000));

  try {
    const response = await fetch(
      `${normalizeOpenAiSdkBaseUrl(env.AI_PLATFORM_BASE_URL)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.AI_PLATFORM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.AI_PLATFORM_MODEL,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
          max_tokens: 8,
        }),
        signal: controller.signal,
      },
    );

    if (response.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      error: summarizeProviderError(response.status, await response.text()),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createFallbackLlm(): Promise<openai.LLM> {
  const aiPlatformLlm = new openai.LLM({
    apiKey: env.AI_PLATFORM_API_KEY,
    baseURL: normalizeOpenAiSdkBaseUrl(env.AI_PLATFORM_BASE_URL),
    model: env.AI_PLATFORM_MODEL,
    temperature: 0.35,
  });

  const platformProbe = await probeAiPlatformChatCompletion();
  if (platformProbe.ok || !env.OPENAI_API_KEY) {
    if (!platformProbe.ok) {
      console.warn(
        `[ai-interviewer-worker] configured AI platform chat probe failed and no OpenAI fallback key is configured: ${platformProbe.error}`,
      );
    }
    return aiPlatformLlm;
  }

  const proxyUrl = resolveUpstreamProxyUrl();
  console.warn(
    `[ai-interviewer-worker] configured AI platform chat unavailable (${platformProbe.error}); using OpenAI chat fallback model ${env.OPENAI_CHAT_FALLBACK_MODEL}${proxyUrl ? ' via proxy' : ''}`,
  );

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    fetch: proxyUrl ? createProxyFetch(proxyUrl) : undefined,
    maxRetries: 1,
    timeout: env.AI_REQUEST_TIMEOUT_MS,
  });

  return new openai.LLM({
    client,
    model: env.OPENAI_CHAT_FALLBACK_MODEL,
    temperature: 0.35,
  });
}

function createOpenAiFallbackClient(baseURL?: string): OpenAI {
  const proxyUrl = resolveUpstreamProxyUrl();
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL,
    fetch: proxyUrl ? createProxyFetch(proxyUrl) : undefined,
    maxRetries: 1,
    timeout: env.AI_REQUEST_TIMEOUT_MS,
  });
}

function resolveOpenAiRealtimeWebSocketUrl(baseUrl: string, model: string): string {
  const url = new URL([trimTrailingSlashes(baseUrl), 'realtime'].join('/'));
  if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  } else if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  }

  if (!url.pathname || ['', '/v1'].includes(url.pathname.replace(/\/$/, ''))) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/realtime`;
  } else {
    url.pathname = url.pathname.replace(/\/$/, '');
  }
  url.searchParams.set('model', model);
  return url.toString();
}

async function probeWebSocketConnection(params: {
  url: string;
  apiKey: string;
  timeoutMs: number;
  label: string;
}): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const ws = new WebSocket(params.url, {
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
      },
    });
    let settled = false;

    const settle = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (error) {
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.terminate();
        }
        rejectPromise(error);
        return;
      }
      ws.close(1000, 'preflight complete');
      resolvePromise();
    };

    const timeout = setTimeout(() => {
      settle(
        new Error(`${params.label} WebSocket connection timed out after ${params.timeoutMs}ms`),
      );
    }, params.timeoutMs);

    ws.once('open', () => settle());
    ws.once('error', (error) => {
      settle(
        new Error(
          `${params.label} WebSocket connection failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    });
    ws.once('close', (code, reason) => {
      settle(
        new Error(
          `${params.label} WebSocket closed before it was ready (code ${code}${
            reason.length > 0 ? `, reason: ${reason.toString()}` : ''
          })`,
        ),
      );
    });
  });
}

async function probeOpenAiRealtimeConnection(): Promise<void> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for realtime mode');
  }

  await probeWebSocketConnection({
    url: resolveOpenAiRealtimeWebSocketUrl(env.OPENAI_REALTIME_BASE_URL, env.OPENAI_REALTIME_MODEL),
    apiKey: env.OPENAI_API_KEY,
    timeoutMs: env.OPENAI_REALTIME_CONNECT_TIMEOUT_MS,
    label: 'OpenAI Realtime',
  });
}

function resolveOpenAiTtsVoice(voiceName: string): openai.TTSVoices {
  if (OPENAI_TTS_VOICES.has(voiceName as openai.TTSVoices)) {
    return voiceName as openai.TTSVoices;
  }
  return 'alloy';
}

// MiniMax voice names differ from OpenAI's. The REST API accepts MiniMax-native
// voice IDs, so map common aliases and fall back to a bilingual voice that
// handles both Chinese and English well.
const MINIMAX_TTS_VOICES: ReadonlySet<string> = new Set([
  'male-qn-qingse',
  'female-shaonv',
  'presenter_male',
  'presenter_female',
  'qingse',
  'cute_boy',
  'cute_girl',
  'deep_male',
  'pure_female',
]);
function resolveMiniMaxTtsVoice(voiceName: string): string {
  // If the user set a MiniMax-native voice, use it directly.
  if (MINIMAX_TTS_VOICES.has(voiceName)) {
    return voiceName;
  }
  // If the user configured Chelsie (the proxy TTS voice), map to a
  // bilingual MiniMax equivalent.
  if (voiceName === 'Chelsie') {
    return 'female-shaonv';
  }
  return 'male-qn-qingse';
}

interface MiniMaxHttpTtsOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
  voice: string;
}

interface ParsedWavPcm {
  pcm: Buffer;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

function resolveMiniMaxTtsUrl(baseUrl: string): string {
  const url = new URL(trimTrailingSlashes(baseUrl));
  const path = trimTrailingSlashes(url.pathname);
  if (path.endsWith('/t2a_v2')) {
    url.pathname = path;
    return url.toString();
  }
  url.pathname = `${path}/t2a_v2`.replace(/\/{2,}/g, '/');
  return url.toString();
}

function extractPcmFromWav(wavData: Buffer): ParsedWavPcm {
  if (
    wavData.byteLength < 44 ||
    wavData.toString('ascii', 0, 4) !== 'RIFF' ||
    wavData.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('MiniMax TTS response did not contain a RIFF/WAVE audio payload');
  }

  let audioFormat: number | undefined;
  let channels: number | undefined;
  let sampleRate: number | undefined;
  let bitsPerSample: number | undefined;
  let pcm: Buffer | undefined;
  let offset = 12;

  while (offset + 8 <= wavData.byteLength) {
    const chunkId = wavData.toString('ascii', offset, offset + 4);
    const chunkSize = wavData.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;

    if (chunkEnd > wavData.byteLength) {
      throw new Error(`MiniMax TTS returned malformed WAV chunk "${chunkId}"`);
    }

    if (chunkId === 'fmt ') {
      if (chunkSize < 16) {
        throw new Error('MiniMax TTS returned a WAV fmt chunk that is too short');
      }
      audioFormat = wavData.readUInt16LE(chunkStart);
      channels = wavData.readUInt16LE(chunkStart + 2);
      sampleRate = wavData.readUInt32LE(chunkStart + 4);
      bitsPerSample = wavData.readUInt16LE(chunkStart + 14);
    } else if (chunkId === 'data') {
      pcm = wavData.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (audioFormat !== 1) {
    throw new Error('MiniMax TTS returned non-PCM WAV audio');
  }
  if (bitsPerSample !== MINIMAX_TTS_BYTES_PER_SAMPLE * 8) {
    throw new Error(`MiniMax TTS returned ${bitsPerSample ?? 'unknown'}-bit audio`);
  }
  if (channels !== MINIMAX_TTS_CHANNELS || sampleRate !== MINIMAX_TTS_SAMPLE_RATE) {
    throw new Error(
      `MiniMax TTS returned ${sampleRate ?? 'unknown'}Hz/${channels ?? 'unknown'}ch audio, expected ${MINIMAX_TTS_SAMPLE_RATE}Hz/${MINIMAX_TTS_CHANNELS}ch`,
    );
  }
  if (!pcm) {
    throw new Error('MiniMax TTS response WAV audio did not include a data chunk');
  }

  return {
    pcm,
    sampleRate,
    channels,
    bitsPerSample,
  };
}

class MiniMaxHttpTts extends tts.TTS {
  label = 'minimax.TTS';
  private readonly endpointUrl: string;
  private readonly opts: MiniMaxHttpTtsOptions;
  private readonly abortController = new AbortController();

  constructor(opts: MiniMaxHttpTtsOptions) {
    super(MINIMAX_TTS_SAMPLE_RATE, MINIMAX_TTS_CHANNELS, { streaming: false });
    this.opts = {
      ...opts,
      voice: resolveMiniMaxTtsVoice(opts.voice),
    };
    this.endpointUrl = resolveMiniMaxTtsUrl(opts.baseUrl);
  }

  override get model(): string {
    return this.opts.model;
  }

  override get provider(): string {
    return new URL(this.endpointUrl).host;
  }

  override synthesize(
    text: string,
    connOptions?: APIConnectOptions,
    abortSignal?: AbortSignal,
  ): tts.ChunkedStream {
    const signal = abortSignal
      ? AbortSignal.any([abortSignal, this.abortController.signal])
      : this.abortController.signal;
    return new MiniMaxHttpTtsChunkedStream(
      this,
      text,
      this.opts,
      this.endpointUrl,
      connOptions,
      signal,
    );
  }

  override stream(): tts.SynthesizeStream {
    throw new Error('Streaming is not supported on MiniMax HTTP TTS');
  }

  override async close(): Promise<void> {
    this.abortController.abort();
  }
}

class MiniMaxHttpTtsChunkedStream extends tts.ChunkedStream {
  label = 'minimax.ChunkedStream';

  constructor(
    ttsInstance: MiniMaxHttpTts,
    text: string,
    private readonly opts: MiniMaxHttpTtsOptions,
    private readonly endpointUrl: string,
    connOptions?: APIConnectOptions,
    abortSignal?: AbortSignal,
  ) {
    super(text, ttsInstance, connOptions, abortSignal);
  }

  protected override async run(): Promise<void> {
    try {
      const signal = AbortSignal.any([
        this.abortSignal,
        AbortSignal.timeout(this.opts.requestTimeoutMs),
      ]);
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.opts.model,
          text: this.inputText,
          stream: false,
          output_format: 'hex',
          voice_setting: {
            voice_id: this.opts.voice,
            speed: 1,
            vol: 1,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: MINIMAX_TTS_SAMPLE_RATE,
            bitrate: MINIMAX_TTS_BITRATE,
            format: MINIMAX_TTS_AUDIO_FORMAT,
            channel: MINIMAX_TTS_CHANNELS,
          },
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(
          `MiniMax TTS failed: ${summarizeProviderError(response.status, await response.text())}`,
        );
      }

      const parsed = minimaxTtsResponseSchema.parse(await response.json());
      const statusCode = parsed.base_resp?.status_code ?? 0;
      if (statusCode !== 0) {
        throw new Error(
          `MiniMax TTS failed: ${statusCode} ${parsed.base_resp?.status_msg ?? 'unknown error'}`,
        );
      }

      const audioHex = parsed.data?.audio;
      if (!audioHex) {
        throw new Error('MiniMax TTS response did not include data.audio');
      }

      const wavAudio = Buffer.from(audioHex, 'hex');
      const { pcm } = extractPcmFromWav(wavAudio);
      const requestId = shortuuid();
      const audioByteStream = new AudioByteStream(MINIMAX_TTS_SAMPLE_RATE, MINIMAX_TTS_CHANNELS);
      const frames = audioByteStream.write(pcm);
      const bytesPerFrame =
        (MINIMAX_TTS_SAMPLE_RATE / 10) * MINIMAX_TTS_CHANNELS * MINIMAX_TTS_BYTES_PER_SAMPLE;
      if (pcm.byteLength % bytesPerFrame !== 0) {
        frames.push(...audioByteStream.flush());
      }

      if (frames.length === 0) {
        throw new Error('MiniMax TTS response contained no playable audio frames');
      }

      let lastFrame: (typeof frames)[number] | undefined;
      const sendLastFrame = (final: boolean) => {
        if (lastFrame) {
          this.queue.put({
            requestId,
            segmentId: requestId,
            frame: lastFrame,
            final,
          });
          lastFrame = undefined;
        }
      };

      for (const frame of frames) {
        sendLastFrame(false);
        lastFrame = frame;
      }
      sendLastFrame(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      throw error;
    } finally {
      this.queue.close();
    }
  }
}

function resolveTranscriptUrl(roomId: string): string {
  const route = CONTROL_INTERNAL.AI_INTERVIEW_TRANSCRIPT.route.replace(':roomId', roomId);
  const base = trimTrailingSlashes(env.CONTROL_PLANE_URL);
  return `${base}/${route}`;
}

function resolveAiInterviewerContextUrl(roomId: string): string {
  const route = CONTROL_INTERNAL.AI_INTERVIEWER_CONTEXT.route.replace(':roomId', roomId);
  const base = trimTrailingSlashes(env.CONTROL_PLANE_URL);
  return `${base}/${route}`;
}

function resolveAiInterviewerPhaseTransitionUrl(roomId: string): string {
  const route = CONTROL_INTERNAL.AI_INTERVIEWER_PHASE_TRANSITION.route.replace(':roomId', roomId);
  const base = trimTrailingSlashes(env.CONTROL_PLANE_URL);
  return `${base}/${route}`;
}

function parseDispatchMetadata(rawMetadata: string | undefined): DispatchMetadata {
  if (!rawMetadata) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawMetadata) as Record<string, unknown>;
    return {
      roomId: typeof parsed.roomId === 'string' ? parsed.roomId : undefined,
      participantUserId:
        typeof parsed.participantUserId === 'string' ? parsed.participantUserId : undefined,
      sessionId:
        typeof parsed.sessionId === 'string' || parsed.sessionId === null
          ? parsed.sessionId
          : undefined,
    };
  } catch {
    return {};
  }
}

function createTranscriptTurnId(
  role: 'user' | 'assistant',
  roomId: string,
  participantId: string,
  timestamp: number,
  content: string,
): string {
  const digest = createStableDigest(`${role}:${roomId}:${participantId}:${timestamp}:${content}`);
  return `lk-ai-turn-${timestamp}-${digest}`;
}

function createInterviewerInstructions(): string {
  return [
    'You are an experienced technical interviewer conducting a live coding interview on SynCode.',
    '',
    '## Core Identity',
    'You are an evaluator, not a tutor or coding copilot. Your job is to assess problem-solving,',
    'technical communication, and engineering judgment through natural conversation. You challenge',
    'reasoning, probe tradeoff understanding, and help the candidate stay unstuck — but you never',
    'do the thinking for them. Your default posture is interviewer, not assistant.',
    '',
    '## Conversational Rhythm',
    'Listen more than you speak. Silence while the candidate thinks or codes is not awkward —',
    "it's respectful. You are not a chatbot filling every pause.",
    '',
    'Speak when:',
    '- The candidate directly addresses you or asks a question',
    '- They appear stuck and silent for an extended period — start with "what are you thinking',
    '  about?" not "here is what to do"',
    '- They just had a visible breakthrough (tests passing, clever refactor) — a brief',
    '  acknowledgment is natural',
    "- They've submitted code — review the outcome concisely",
    "- They've run tests with new failures — a targeted question about what changed helps",
    '- The interview phase changes — orient them briefly',
    '- They are clearly frustrated or repeatedly demanding the answer — redirect with questions',
    '  about constraints, never comply',
    '',
    'Stay silent when:',
    '- The candidate is actively typing or running tests frequently',
    '- They just ran code and tests passed — do not narrate every green test',
    "- They're reading or thinking quietly",
    '- The input is noise, echo, or accidental ("um", "uh", single characters)',
    '',
    '## Answer-Leak Prevention — CRITICAL',
    'This is the single most important rule. Violating it ruins the interview. You must NEVER',
    'reveal the solution, the optimal algorithm, or the implementation approach for the active',
    'interview problem.',
    '',
    'Specifically, you must never say or hint at:',
    '- Any data structure the candidate has not already named: hash map, hash table, dict, set,',
    '  array, list, queue, stack, heap, tree, graph, trie, deque, etc.',
    '- Any algorithm or technique they have not named: two-pointer, sliding window, binary search,',
    '  hashing, memoization, dynamic programming, BFS, DFS, greedy, divide-and-conquer, etc.',
    '- What the solution should store, look up, check, iterate over, or compare',
    '- The complexity class of the optimal solution (e.g. "there is an O(n) solution")',
    '- Lead-in phrases that telegraph the answer: "one approach is", "you could use", "a common',
    '  way is", "consider using", "have you thought about using a..."',
    '',
    'When the candidate asks for the answer or says they are stuck:',
    '- Ask about constraints: "What operations need to be fast given the input size?"',
    '- Ask about the bottleneck: "Where is the repeated work in your current approach?"',
    '- Ask about the invariant: "What property must hold for your solution to be correct?"',
    '- NEVER respond by naming the algorithm or data structure they should use',
    '- If they genuinely cannot proceed after repeated guidance, steer toward wrapup for a',
    '  post-interview review discussion',
    '',
    'When the candidate names a broad approach (e.g. "hash map", "two pointers"):',
    '- Acknowledge the direction neutrally: "OK, tell me more about that"',
    '- Ask them to justify: "What would be the invariant? The complexity?"',
    '- Do NOT fill in the missing details — they must complete their own idea',
    '- "Yes, and you would store the complements in the map" ← THIS IS THE LEAK. Never do this.',
    '',
    'When reviewing code, you may describe what their code DOES:',
    '- "This loop rescans values you have already checked" — OK (describes existing behavior)',
    '- "You could use a set to track seen values" — NOT OK (names an unstated data structure)',
    '',
    'Do not embed answers inside questions. Ask about the KIND of information needed, not the',
    'concrete container or exact operation. Instead of "could a hash map help here?" ask "what',
    'information would you need to remember while scanning to avoid rechecking?"',
    '',
    '## Phase Awareness',
    '**Warmup**: Greet briefly. Introduce the problem — state what it asks, never how to solve it.',
    'Ask exactly one focused question about their planned approach. Keep warmup short — at most',
    '2 questions, then announce coding is starting. If the candidate wants to start coding',
    'immediately, let them.',
    '',
    '**Coding**: Default to observing. Challenge reasoning when the candidate explains their',
    'approach. If stuck, guide with questions about constraints and bottlenecks — not solutions.',
    'If making good progress, stay quiet. After code submission, review the outcome. When the',
    'solution is passing and reviewed, steer toward wrapup.',
    '',
    '**Wrapup**: Summarize — acknowledge what went well, note areas for growth, but do not reveal',
    'the optimal solution. Invite the candidate to reflect or ask questions. End only when they',
    'explicitly sign off.',
    '',
    '**Finished**: The interview is over. Do not continue questioning.',
    '',
    '## Tone',
    '- Professional but warm. You are evaluating, not interrogating.',
    '- Concise. Most responses should be 1-3 sentences. Save longer explanations for wrapup review.',
    '- Bilingual. Match the language the candidate most recently used (Chinese or English). If they',
    '  have not spoken yet, use the UI language hint provided. Keep code terms in English.',
    '- Do not mix Chinese and English in the opening greeting — pick one.',
    '- Honest. If the solution is good, say so. If it has issues, say so constructively.',
    '- Never use passive helper clichés: "let me know if you need help", "we can implement this',
    '  together", "I can help you code this".',
    '- Treat starter code as platform scaffold, not candidate-authored mistakes.',
    '- Accept alternative correct solutions. Evaluate correctness and tradeoffs, not adherence to',
    '  your preferred implementation pattern.',
    '',
    '## Tools',
    '- `get_room_context`: Fetch latest code, submission results, and room status. Use before',
    '  reviewing code or when context seems stale. If context is unavailable, ask one high-level',
    '  reasoning question instead of pretending to inspect code.',
    '- `add_inline_comment`: Attach a specific, actionable comment to one line of code. Use',
    '  sparingly — only for high-value, concrete feedback.',
    '- `transition_room_phase`: Queue a phase transition after your current spoken turn. Always',
    '  speak the transition preamble before calling this tool. Use only when interview progress',
    '  justifies it. Never transition to finished without explicit candidate sign-off.',
  ].join('\n');
}

function buildPromptCachePrefix(params: {
  systemInstructions: string;
  context?: AiInterviewerContext;
}): string {
  const sections = [
    'Stable cached prefix for OpenAI prompt caching. Keep this prefix unchanged unless interview context truly changes.',
    'System interviewer policy:',
    params.systemInstructions,
  ];

  if (params.context) {
    sections.push(
      'Canonical interview context (stable across the session):',
      buildInterviewContextInstructions(params.context, 'detailed'),
    );
  } else {
    sections.push(
      'Canonical interview context unavailable yet. Retry get_room_context when needed.',
    );
  }

  return sections.join('\n\n');
}

class AiPlatformHttpStt extends stt.STT {
  label = 'syncode.AiPlatformHttpStt';
  private readonly llmProvider: OpenAiCompatibleLlmProvider;

  constructor() {
    super({ streaming: false, interimResults: false });
    this.llmProvider = new OpenAiCompatibleLlmProvider({
      baseUrl: env.AI_PLATFORM_BASE_URL,
      apiKey: env.AI_PLATFORM_API_KEY,
      model: env.AI_PLATFORM_MODEL,
      sttModel: env.AI_STT_MODEL,
      ttsModel: env.AI_TTS_MODEL,
      ttsVoice: env.AI_TTS_VOICE,
      timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    });
  }

  override get model(): string {
    return env.AI_STT_MODEL;
  }

  override get provider(): string {
    return 'syncode-ai-platform';
  }

  protected override async _recognize(
    frameBuffer: AudioBuffer,
    _abortSignal?: AbortSignal,
  ): Promise<stt.SpeechEvent> {
    const frame = mergeFrames(frameBuffer);
    const result = await this.llmProvider.generateTranscription({
      audio: encodeAudioFrameAsWav(frame),
      mimeType: 'audio/wav',
      fileName: 'livekit-turn.wav',
    });
    const text = result.text.trim();

    return {
      type: stt.SpeechEventType.FINAL_TRANSCRIPT,
      alternatives: [
        {
          text,
          language: normalizeLanguage(''),
          startTime: 0,
          endTime: frame.samplesPerChannel / frame.sampleRate,
          confidence: text ? 1 : 0,
        },
      ],
    };
  }

  override stream(): stt.SpeechStream {
    throw new Error('AiPlatformHttpStt requires stt.StreamAdapter with a VAD for streaming use');
  }
}

function encodeAudioFrameAsWav(frame: ReturnType<typeof mergeFrames>): Buffer {
  const pcmData = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
  const header = Buffer.alloc(44);
  const bytesPerSample = 2;
  const blockAlign = frame.channels * bytesPerSample;
  const byteRate = frame.sampleRate * blockAlign;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(frame.channels, 22);
  header.writeUInt32LE(frame.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.byteLength, 40);

  return Buffer.concat([header, pcmData]);
}

async function createRealtimeSession(): Promise<voice.AgentSession> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for realtime mode');
  }
  await probeOpenAiRealtimeConnection();
  return new voice.AgentSession({
    llm: new openai.realtime.RealtimeModel({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_REALTIME_BASE_URL,
      model: env.OPENAI_REALTIME_MODEL,
      voice: env.OPENAI_REALTIME_VOICE,
      inputAudioNoiseReduction: { type: 'near_field' },
      turnDetection: {
        type: 'semantic_vad',
        eagerness: 'low',
        create_response: false,
        interrupt_response: true,
      },
    }),
  });
}

async function createFallbackSession(vad?: silero.VAD): Promise<voice.AgentSession> {
  if (!env.AI_INTERVIEWER_FALLBACK_ENABLED) {
    throw new Error('Realtime mode unavailable and fallback mode is disabled');
  }

  const httpStt = new AiPlatformHttpStt();
  const sttInstance = vad ? new stt.StreamAdapter(httpStt, vad) : httpStt;
  const llmInstance = await createFallbackLlm();

  const sessionOpts: voice.AgentSessionOptions = {
    stt: sttInstance,
    llm: llmInstance,
    // Realtime path has built-in turn detection via semantic_vad on the model.
    // For the fallback STT→LLM→TTS pipeline we supply an explicit VAD for
    // speech-boundary detection and use VAD-based turn handling.
    ...(vad ? { vad } : {}),
    turnDetection: 'vad',
    ttsReadIdleTimeout: env.AI_REQUEST_TIMEOUT_MS,
    forwardAudioIdleTimeout: env.AI_REQUEST_TIMEOUT_MS,
  };

  if (env.MINIMAX_API_KEY && env.MINIMAX_TTS_BASE_URL && env.MINIMAX_TTS_MODEL) {
    const minimaxTts = new MiniMaxHttpTts({
      apiKey: env.MINIMAX_API_KEY,
      baseUrl: env.MINIMAX_TTS_BASE_URL,
      model: env.MINIMAX_TTS_MODEL,
      requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      voice: env.AI_TTS_VOICE,
    });
    return new voice.AgentSession({ ...sessionOpts, tts: minimaxTts });
  }

  // Proxy-based TTS (e.g. CosyVoice through Tsinghua AI platform).
  if (env.AI_TTS_MODEL) {
    const tts = new openai.TTS({
      apiKey: env.AI_PLATFORM_API_KEY,
      baseURL: normalizeOpenAiSdkBaseUrl(env.AI_PLATFORM_BASE_URL),
      model: env.AI_TTS_MODEL,
      voice: resolveOpenAiTtsVoice(env.AI_TTS_VOICE),
    });
    return new voice.AgentSession({ ...sessionOpts, tts });
  }

  // Last-resort HTTP TTS for fallback mode. This keeps fallback usable when
  // Realtime WebSocket is unavailable but regular OpenAI HTTPS endpoints work.
  if (env.OPENAI_API_KEY) {
    const baseURL = normalizeOpenAiSdkBaseUrl(env.OPENAI_TTS_BASE_URL);
    const client = createOpenAiFallbackClient(baseURL);
    const tts = new openai.TTS({
      apiKey: env.OPENAI_API_KEY,
      baseURL,
      client,
      model: env.OPENAI_TTS_MODEL,
      voice: resolveOpenAiTtsVoice(env.AI_TTS_VOICE),
    });
    return new voice.AgentSession({ ...sessionOpts, tts });
  }

  throw new Error(
    'Fallback voice mode requires a compatible TTS provider. Set MINIMAX_API_KEY + MINIMAX_TTS_BASE_URL + MINIMAX_TTS_MODEL for MiniMax TTS, AI_TTS_MODEL for an OpenAI-compatible AI platform TTS model, or OPENAI_API_KEY for OpenAI HTTP TTS.',
  );
}

async function createInterviewSession(
  vad?: silero.VAD,
  opts: { forceFallback?: boolean } = {},
): Promise<voice.AgentSession> {
  if (opts.forceFallback ?? env.AI_INTERVIEWER_FORCE_FALLBACK) {
    console.warn(
      '[ai-interviewer-worker] Realtime session disabled by AI_INTERVIEWER_FORCE_FALLBACK, using STT+LLM+TTS pipeline',
    );
    return await createFallbackSession(vad);
  }

  try {
    return await createRealtimeSession();
  } catch (error) {
    console.warn(
      `[ai-interviewer-worker] Realtime session unavailable, falling back to STT+LLM+TTS pipeline: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return await createFallbackSession(vad);
  }
}

// All internal-callback fetches use this timeout so a hung control-plane
// cannot park the realtime worker indefinitely (refreshRoomContext is
// already wrapped in a retry loop, multiplying any stall).
const INTERNAL_CALLBACK_TIMEOUT_MS = 5_000;

async function postTranscriptTurn(roomId: string, turn: TranscriptTurnPayload): Promise<void> {
  const response = await fetch(resolveTranscriptUrl(roomId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': env.INTERNAL_CALLBACK_SECRET,
    },
    body: JSON.stringify({
      turns: [turn],
    }),
    signal: AbortSignal.timeout(INTERNAL_CALLBACK_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transcript callback failed with ${response.status}: ${body}`);
  }
}

async function fetchAiInterviewerRoomContext(
  roomId: string,
  participantId: string,
): Promise<AiInterviewerContextResponse> {
  const requestPayload: AiInterviewerContextRequest = {
    participantId,
  };
  const response = await fetch(resolveAiInterviewerContextUrl(roomId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': env.INTERNAL_CALLBACK_SECRET,
    },
    body: JSON.stringify(requestPayload),
    signal: AbortSignal.timeout(INTERNAL_CALLBACK_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI interviewer context callback failed with ${response.status}: ${body}`);
  }
  return (await response.json()) as AiInterviewerContextResponse;
}

async function requestAiInterviewerPhaseTransition(params: {
  roomId: string;
  participantId: string;
  targetStatus: 'warmup' | 'coding' | 'wrapup' | 'finished';
  reason?: string;
}): Promise<AiInterviewerPhaseTransitionResponse> {
  const requestPayload: AiInterviewerPhaseTransitionRequest = {
    participantId: params.participantId,
    targetStatus: params.targetStatus,
    reason: params.reason,
  };
  const response = await fetch(resolveAiInterviewerPhaseTransitionUrl(params.roomId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': env.INTERNAL_CALLBACK_SECRET,
    },
    body: JSON.stringify(requestPayload),
    signal: AbortSignal.timeout(INTERNAL_CALLBACK_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI phase transition callback failed with ${response.status}: ${body}`);
  }
  return (await response.json()) as AiInterviewerPhaseTransitionResponse;
}

function buildSystemSignalInstructions(
  signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }>,
  rememberedContext?: AiInterviewerContext,
  runtimeContext?: AiInterviewerContextResponse,
): string {
  const parts: string[] = [`[System event: ${signal.reason}]`];

  if (signal.summary) {
    parts.push(`Details: ${signal.summary}`);
  }
  if (signal.language) {
    parts.push(buildInterfaceLanguageInstruction(signal.language, 'system'));
  }

  const context = signal.interviewContext ?? rememberedContext;
  if (context) {
    parts.push(buildInterviewContextInstructions(context));
  }
  if (runtimeContext) {
    parts.push(
      buildLiveRoomContextInstructions(
        runtimeContext,
        signal.reason === 'code_submitted' ? 'detailed' : 'compact',
      ),
    );
  }

  if (signal.codeContext) {
    parts.push(
      'Code context (with line range):',
      `${signal.codeContext.file} L${signal.codeContext.startLine}-${signal.codeContext.endLine}`,
      signal.codeContext.codeSnippet,
      'If a focused correction would help, use add_inline_comment with the precise line.',
    );
  }

  const reasonGuidance = buildReasonSpecificInstructions(signal.reason, signal.summary);
  if (reasonGuidance) {
    parts.push(reasonGuidance);
  }

  return parts.join('\n');
}

function buildUserTextInstructions(
  signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }>,
  context?: AiInterviewerContext,
  runtimeContext?: AiInterviewerContextResponse,
): string {
  const parts = [`Candidate: ${signal.text}`];

  if (signal.language) {
    parts.push(`Language hint: ${signal.language}`);
  }
  if (context) {
    parts.push(buildCompactInterviewContextReminder(context));
  }
  if (runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(runtimeContext, 'compact'));
  }
  if (signal.latestSubmissionSummary) {
    parts.push(
      [
        'Latest submission (authoritative):',
        `status=${signal.latestSubmissionSummary.status}, passed=${signal.latestSubmissionSummary.passedTestCases}/${signal.latestSubmissionSummary.totalTestCases}`,
      ].join('\n'),
    );
  }

  return parts.join('\n');
}

function buildInterviewContextInstructions(
  context: AiInterviewerContext,
  detail: LiveContextDetail = 'compact',
): string {
  const difficultySegment = context.difficulty ? ` (${context.difficulty})` : '';
  const descriptionLimit = detail === 'detailed' ? 2_800 : 900;
  const starterCodeLimit = detail === 'detailed' ? 2_200 : 700;
  return [
    'Interview context (authoritative):',
    `Problem: ${context.problemTitle}${difficultySegment}`,
    `Language: ${context.language}`,
    `Problem description:\n${clampInstructionContent(context.problemDescription, descriptionLimit)}`,
    'Starter code (platform scaffold, not candidate-authored by default):',
    clampInstructionContent(context.starterCode, starterCodeLimit),
    'Reference this context when evaluating candidate progress and framing questions.',
  ].join('\n');
}

function buildCompactInterviewContextReminder(context: AiInterviewerContext): string {
  const difficultySegment = context.difficulty ? ` (${context.difficulty})` : '';
  return [
    `Current interview problem: ${context.problemTitle}${difficultySegment} in ${context.language}.`,
    'The existing starter code is scaffold code for this platform.',
  ].join('\n');
}

function buildLiveRoomContextInstructions(
  context: AiInterviewerContextResponse,
  detail: LiveContextDetail = 'compact',
): string {
  const latestSubmissionSummary = context.latestSubmission
    ? `${context.latestSubmission.passedTestCases}/${context.latestSubmission.totalTestCases} passed, failed=${context.latestSubmission.failedTestCases}, errors=${context.latestSubmission.errorTestCases}, status=${context.latestSubmission.status}, language=${context.latestSubmission.language}, at=${context.latestSubmission.submittedAt}`
    : 'none';
  const codeLines = context.currentCode.code.split(/\r?\n/).length;
  const codeBlock =
    detail === 'detailed'
      ? buildNumberedCodeBlock(context.currentCode.code, 220, 9_000)
      : buildNumberedCodeBlock(context.currentCode.code, 40, 1_800);

  const sections = [
    'Live room context (fresh from control-plane):',
    `Room status: ${context.roomStatus}`,
    `Current code source: ${context.currentCode.source}`,
    `Current code language: ${context.currentCode.language}`,
    `Current code lines: ${codeLines}`,
    `Latest submission summary: ${latestSubmissionSummary}`,
    'Treat these numbers as canonical unless a newer get_room_context call returns fresher data.',
    buildConstraintGuidance(context),
    'Current code (live editor state):',
    codeBlock.length > 0 ? codeBlock : '(empty)',
    `Phase behavior guidance: ${buildPhaseBehaviorGuidance(context.roomStatus)}`,
  ];

  if (detail === 'detailed' && context.latestSubmission) {
    sections.push(
      'Submitted code under evaluation (this is the exact code the candidate submitted that produced the submission result above — base your review on this code together with the submission summary; do not claim the code is missing, incomplete, or unsubmitted):',
      buildNumberedCodeBlock(context.latestSubmission.code, 220, 9_000) || '(empty)',
    );
  }

  if (detail === 'compact') {
    sections.splice(
      7,
      0,
      'Code excerpt only (compact mode). Use get_room_context for full review.',
    );
  }

  return sections.join('\n');
}

function buildCodeContextUpdate(params: {
  context: AiInterviewerContextResponse;
  signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }>;
}): string {
  const latestSubmissionSummary = params.context.latestSubmission
    ? `${params.context.latestSubmission.passedTestCases}/${params.context.latestSubmission.totalTestCases} passed, status=${params.context.latestSubmission.status}`
    : 'none';

  return [
    `[Background: ${params.signal.reason}]`,
    params.signal.summary ? `Summary: ${params.signal.summary}` : undefined,
    `Room: ${params.context.roomStatus}, Language: ${params.context.language}`,
    `Latest submission: ${latestSubmissionSummary}`,
    params.context.latestSubmission
      ? `Submitted code:\n${buildNumberedCodeBlock(params.context.latestSubmission.code, 160, 7_000) || '(empty)'}`
      : undefined,
    'Current code:',
    buildNumberedCodeBlock(params.context.currentCode.code, 160, 7_000) || '(empty)',
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n');
}

function isChineseLanguageHint(language: string | undefined): boolean {
  const normalized = language?.trim().toLowerCase() ?? '';
  return normalized.startsWith('zh') || normalized.includes('chinese');
}

function buildInterfaceLanguageInstruction(
  language: string | undefined,
  turnType: 'opening' | 'system',
): string {
  if (isChineseLanguageHint(language)) {
    return turnType === 'opening'
      ? 'Candidate UI language is Chinese. The opening greeting must be in Simplified Chinese; keep only problem names and code terms in English when necessary.'
      : 'Candidate UI language is Chinese. Prefer Simplified Chinese unless the candidate most recently used another language.';
  }
  return turnType === 'opening'
    ? 'Candidate UI language is English or unknown. The opening greeting must be in English only; do not include Chinese.'
    : 'Candidate UI language is English or unknown. Prefer English unless the candidate most recently used another language.';
}

function buildConstraintGuidance(context: AiInterviewerContextResponse): string {
  const description = context.problem?.description ?? '';
  const normalized = description.toLowerCase();
  const hasGuaranteedSolution =
    normalized.includes('exactly one solution') ||
    normalized.includes('guaranteed') ||
    normalized.includes('one valid answer') ||
    description.includes('保证有解') ||
    description.includes('唯一解') ||
    description.includes('恰好一个解');
  if (hasGuaranteedSolution) {
    return 'Constraint note: problem statement indicates a guaranteed valid solution; avoid no-solution edge-case drills unless user asks.';
  }
  return 'Constraint note: only reason about constraints explicitly present in the provided statement; do not invent extra assumptions.';
}

function buildPhaseBehaviorGuidance(
  roomStatus: AiInterviewerContextResponse['roomStatus'],
): string {
  switch (roomStatus) {
    case 'waiting':
      return 'Do not start interview conversation yet; wait until warmup/coding/wrapup.';
    case 'warmup':
      return 'Ask no more than 2 warmup questions total, then state that coding is starting and move to coding.';
    case 'coding':
      return 'Prioritize evaluation, keep quiet during focused coding, and move to wrapup once the solution review is complete.';
    case 'wrapup':
      return 'Summarize performance and ask reflective final questions. End only on explicit user intent.';
    case 'finished':
      return 'Interview has ended. Do not continue active questioning.';
    default:
      return 'Keep responses phase-appropriate and concise.';
  }
}

function buildNumberedCodeBlock(code: string, maxLines: number, maxChars: number): string {
  if (!code.trim()) {
    return '';
  }

  const lines = code.split(/\r?\n/);
  const numbered: string[] = [];
  const limit = Math.min(lines.length, maxLines);
  for (let index = 0; index < limit; index += 1) {
    const lineNumber = String(index + 1).padStart(3, ' ');
    numbered.push(`${lineNumber} | ${lines[index]}`);
  }
  if (lines.length > maxLines) {
    numbered.push(`... (${lines.length - maxLines} more lines)`);
  }
  return clampInstructionContent(numbered.join('\n'), maxChars);
}

function clampInstructionContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.slice(0, maxLength - 1).trimEnd()}…`;
}

function estimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  // Rough cross-language estimate for telemetry; not model-accurate billing tokens.
  return Math.max(1, Math.ceil(trimmed.length / 3.8));
}

function isLikelyAccidentalCandidateMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (/^(#|[.,!?;:，。！？；：]+|uh+|um+|ah+|er+|hmm+)$/i.test(normalized)) {
    return true;
  }

  const meaningfulCharacters = Array.from(normalized).filter((char) => /[\p{L}\p{N}]/u.test(char));
  const containsCjk = /[\u3400-\u9fff]/u.test(normalized);
  return !containsCjk && meaningfulCharacters.length <= 1;
}

function parseSubmissionSignalSummary(
  summary: string | undefined,
): ParsedSubmissionSignalSummary | null {
  if (!summary) {
    return null;
  }
  const match =
    /submission completed with\s+(\d+)\s*\/\s*(\d+)\s+test cases passed(?:\s+at\s+(\S+))?/i.exec(
      summary,
    );
  if (!match) {
    return null;
  }
  const passedTestCases = Number(match[1]);
  const totalTestCases = Number(match[2]);
  if (
    !Number.isFinite(passedTestCases) ||
    !Number.isFinite(totalTestCases) ||
    totalTestCases <= 0 ||
    passedTestCases < 0
  ) {
    return null;
  }
  const submittedAt = normalizeSubmissionSignalTimestamp(match[3]);
  return {
    passedTestCases,
    totalTestCases,
    ...(submittedAt ? { submittedAt } : {}),
  };
}

function normalizeSubmissionSignalTimestamp(timestamp: string | undefined): string | undefined {
  const normalized = timestamp ? trimTrailingSubmissionPunctuation(timestamp.trim()) : undefined;
  if (!normalized) {
    return undefined;
  }
  return Number.isFinite(Date.parse(normalized)) ? normalized : undefined;
}

function resolveInlineCommentLine(
  requestedLine: number,
  lineText: string | undefined,
  code: string,
): number {
  const lines = code.split(/\r?\n/);
  if (lines.length === 0) {
    return 1;
  }

  const bounded = Math.min(Math.max(1, Math.floor(requestedLine)), lines.length);
  const needle = lineText?.trim();
  if (!needle) {
    return bounded;
  }

  const normalizedNeedle = needle.replace(/\s+/g, ' ').trim();
  const current = lines[bounded - 1]?.replace(/\s+/g, ' ').trim() ?? '';
  if (current.includes(normalizedNeedle) || normalizedNeedle.includes(current)) {
    return bounded;
  }

  const directMatch = lines.findIndex((line) => {
    const normalized = line.replace(/\s+/g, ' ').trim();
    return normalized.includes(normalizedNeedle) || normalizedNeedle.includes(normalized);
  });
  if (directMatch >= 0) {
    return directMatch + 1;
  }

  return bounded;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function buildReasonSpecificInstructions(
  reason: AiInterviewerSignalReason,
  summary: string | undefined,
): string {
  switch (reason) {
    case 'session_joined':
      return 'The candidate just joined. Greet them naturally and introduce the interview problem.';
    case 'stage_changed':
      return 'The interview phase changed. Orient the candidate briefly to the new phase expectations.';
    case 'user_idle':
      return 'The candidate has been quiet for a while. Only speak if a brief, warm check-in would help — otherwise stay silent. Do not call transition_room_phase because silence alone is not interview progress.';
    case 'hint_used':
      return 'The candidate used a hint. A brief acknowledgment or follow-up question is natural.';
    case 'code_ran': {
      const run = parseRunSummary(summary);
      if (run != null && run.passed === run.total) {
        return 'The candidate ran their code and all tests passed. Usually stay quiet — a brief acknowledgment is fine but do not narrate every green test.';
      }
      return 'The candidate ran their code and some tests failed. If you have useful guidance, ask one targeted question about what might have changed.';
    }
    case 'code_submitted':
      return 'The candidate submitted their code. Review the outcome. If passing, acknowledge and steer toward wrapup. If failing, ask one targeted debugging question.';
    case 'manual_nudge':
      return 'The candidate explicitly asked for your input. Respond directly and helpfully.';
    default:
      return '';
  }
}

function resolveErrorEventMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'AI interviewer error';
}

function parseRunSummary(summary: string | undefined): { passed: number; total: number } | null {
  if (!summary) {
    return null;
  }
  const match = NOISE_RUN_SUMMARY_PATTERN.exec(summary);
  if (!match) {
    return null;
  }
  const passed = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(passed) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return { passed, total };
}

function isNonPassingSubmission(context: AiInterviewerContextResponse | undefined): boolean {
  const latest = context?.latestSubmission;
  if (latest?.status !== 'completed' || latest.totalTestCases <= 0) {
    return false;
  }
  return latest.passedTestCases < latest.totalTestCases;
}

function isPassingSubmission(context: AiInterviewerContextResponse | undefined): boolean {
  const latest = context?.latestSubmission;
  if (latest?.status !== 'completed' || latest.totalTestCases <= 0) {
    return false;
  }
  return latest.passedTestCases === latest.totalTestCases;
}

function matchesExpectedSubmission(
  latest: AiInterviewerContextResponse['latestSubmission'],
  expected: ParsedSubmissionSignalSummary,
): boolean {
  if (
    latest?.totalTestCases !== expected.totalTestCases ||
    latest.passedTestCases !== expected.passedTestCases
  ) {
    return false;
  }

  if (!expected.submittedAt) {
    return true;
  }

  const latestTime = Date.parse(latest.submittedAt);
  const expectedTime = Date.parse(expected.submittedAt);
  if (!Number.isFinite(latestTime) || !Number.isFinite(expectedTime)) {
    return false;
  }
  return latestTime >= expectedTime;
}

type SystemSignalPayload = Extract<AiInterviewerSignalPayload, { type: 'system_signal' }>;

function isExpectedSubmissionContext(
  context: AiInterviewerContextResponse,
  expected: ParsedSubmissionSignalSummary | undefined,
): boolean {
  return !expected || matchesExpectedSubmission(context.latestSubmission, expected);
}

function shouldReturnFetchedRoomContext(params: {
  context: AiInterviewerContextResponse;
  expected: ParsedSubmissionSignalSummary | undefined;
  attempt: number;
  maxAttempts: number;
}): boolean {
  return (
    isExpectedSubmissionContext(params.context, params.expected) ||
    params.attempt >= params.maxAttempts
  );
}

function shouldIgnoreRuntimeSignal(
  signal: SystemSignalPayload,
  runtimeContext: AiInterviewerContextResponse | undefined,
): boolean {
  if (runtimeContext?.roomStatus === 'waiting' && signal.reason !== 'manual_nudge') {
    return true;
  }
  return runtimeContext?.roomStatus === 'finished';
}

function toRealtimeInterviewContext(
  roomContext: AiInterviewerContextResponse,
): AiInterviewerContext | undefined {
  if (!roomContext.problem) {
    return undefined;
  }
  return {
    problemTitle: roomContext.problem.title,
    difficulty: roomContext.problem.difficulty ?? undefined,
    problemDescription: roomContext.problem.description,
    language: roomContext.language,
    starterCode:
      roomContext.problem.starterCode ??
      'No official starter code is provided for this language in this problem.',
  };
}

function hasAntiSpamElapsed(lastReplyAt: number, now: number): boolean {
  return now - lastReplyAt >= ANTI_SPAM_MIN_INTERVAL_MS;
}

function isIdleCheckinOverdue(lastUserTurnAt: number, lastReplyAt: number, now: number): boolean {
  if (lastUserTurnAt <= 0) {
    return false;
  }
  return now - lastUserTurnAt >= IDLE_CHECKIN_MS && now - lastReplyAt >= IDLE_CHECKIN_MS;
}

function shouldRequestUserAwayDecision(params: {
  userState: string;
  agentState: string;
  lastReplyAt: number;
  now: number;
}): boolean {
  return (
    params.userState === 'away' &&
    params.agentState !== 'speaking' &&
    hasAntiSpamElapsed(params.lastReplyAt, params.now)
  );
}

function isIdleDrivenReplyReason(reason: string | null | undefined): boolean {
  return reason === 'user_away_timeout' || reason === 'system_user_idle';
}

// The LiveKit Agent entrypoint below wires SDK callbacks, room events, and
// provider side effects. Unit tests cover the extracted prompt/context/decision
// helpers above; the callback itself is exercised by LiveKit runtime tests.
/* v8 ignore start */
const agent = defineAgent({
  // Prewarm eagerly loads the Silero VAD model so the fallback STT→LLM→TTS
  // pipeline can detect speech boundaries without a cold-start delay on first
  // use. The realtime path ignores VAD (it uses built-in semantic_vad).
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const metadata = parseDispatchMetadata(ctx.job.metadata);
    const roomId = metadata.roomId ?? ctx.room.name ?? ctx.job.room?.name;
    if (!roomId) {
      throw new Error('Missing room id in AI interviewer dispatch metadata and context');
    }

    const participantUserId = metadata.participantUserId;
    if (!participantUserId) {
      console.warn(
        `[ai-interviewer-worker] missing participantUserId in dispatch metadata for room ${roomId}; transcript persistence is disabled`,
      );
    }

    const removeFutureTrackSubscription = registerFutureRemoteTrackSubscription(ctx, roomId);
    ctx.addShutdownCallback(async () => {
      removeFutureTrackSubscription();
    });

    const connectUrl = resolveLiveKitAgentConnectUrl({
      assignedUrl: ctx.info.url,
      overrideUrl: env.LIVEKIT_AGENT_CONNECT_URL,
    });
    if (connectUrl !== ctx.info.url) {
      console.debug(
        `[ai-interviewer-worker] using LiveKit agent connect URL room=${roomId} assigned=${summarizeUrlForLog(
          ctx.info.url,
        )} connect=${summarizeUrlForLog(connectUrl)}`,
      );
      ctx.info.url = connectUrl;
    }

    // Keep the initial room handshake fast; broad subscription happens immediately after connect.
    const connectStartedAt = Date.now();
    console.debug(
      `[ai-interviewer-worker] connecting LiveKit room=${roomId} url=${summarizeUrlForLog(
        ctx.info.url,
      )}`,
    );
    await withoutProxyEnv(() => ctx.connect(undefined, AutoSubscribe.SUBSCRIBE_NONE));
    console.debug(
      `[ai-interviewer-worker] connected LiveKit room=${roomId} elapsedMs=${
        Date.now() - connectStartedAt
      }`,
    );
    subscribeExistingRemoteTracks(ctx, roomId);

    const publishRealtimeEvent = async (event: AiInterviewerEventPayload) => {
      if (!ctx.agent) {
        console.warn(
          `[ai-interviewer-worker] cannot publish realtime event before agent is connected room=${roomId} type=${event.type}`,
        );
        return;
      }

      await withTimeout(
        ctx.agent.publishData(encodeAiInterviewerEventPayload(event), {
          reliable: true,
          topic: AI_INTERVIEWER_EVENT_TOPIC,
          destination_identities: participantUserId ? [participantUserId] : undefined,
        }),
        REALTIME_EVENT_PUBLISH_TIMEOUT_MS,
        `timed out publishing realtime event ${event.type}`,
      ).catch((error) => {
        console.warn(
          `[ai-interviewer-worker] failed to publish realtime event room=${roomId} type=${event.type}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    };

    const publishSessionReady = async () => {
      await publishRealtimeEvent({
        type: 'session_ready',
        occurredAt: Date.now(),
      });
    };

    let session: voice.AgentSession;
    try {
      session = await createInterviewSession(ctx.proc.userData.vad as silero.VAD | undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ai-interviewer-worker] voice interviewer unavailable for room ${roomId}: ${message}`,
      );
      await publishRealtimeEvent({
        type: 'error',
        message,
        occurredAt: Date.now(),
      });
      return;
    }

    const systemInstructions = createInterviewerInstructions();
    const seenTurnIds = new Set<string>();
    const pendingInlineComments: Array<{ line: number; comment: string }> = [];
    let lastUserSpeakerId: string | null = participantUserId ?? null;
    let latestInterviewContext: AiInterviewerContext | undefined;
    let latestRuntimeRoomContext: AiInterviewerContextResponse | undefined;
    let queuedPhaseTransitionAfterAssistant: {
      targetStatus: RoomPhaseStatus;
      reason?: string;
    } | null = null;
    let queuedPhaseTransitionInFlight = false;
    let lastUserTurnAt = 0;
    let lastSystemReplyAt = 0;
    let suppressRealtimeAssistantTranscriptsUntil = 0;
    let currentAgentState: voice.AgentState = 'initializing';
    let agentStoppedSpeakingAt = 0;
    let userAwayDecisionInFlight = false;
    let activeReplyReason: string | null = null;
    let approxPromptInputTokensTotal = 0;
    let approxOutputTokensTotal = 0;
    let approxConversationTokensTotal = 0;
    let lastContextBudgetLogAt = 0;
    let promptCachePrefix = buildPromptCachePrefix({
      systemInstructions,
      context: latestInterviewContext,
    });
    let promptCacheSignature = 'no-context';

    const computePromptCacheSignature = (context?: AiInterviewerContext): string => {
      if (!context) {
        return 'no-context';
      }
      return createStableDigest(
        [
          context.problemTitle,
          context.difficulty ?? '',
          context.language,
          context.problemDescription,
          context.starterCode,
        ].join('||'),
      );
    };

    const refreshPromptCachePrefix = () => {
      const nextSignature = computePromptCacheSignature(latestInterviewContext);
      if (nextSignature === promptCacheSignature && promptCachePrefix.length > 0) {
        return;
      }
      promptCacheSignature = nextSignature;
      promptCachePrefix = buildPromptCachePrefix({
        systemInstructions,
        context: latestInterviewContext,
      });
      console.debug(
        `[ai-interviewer-worker] prompt-cache-prefix updated room=${roomId} signature=${promptCacheSignature} approxTokens=${estimateTokenCount(promptCachePrefix)}`,
      );
    };

    const maybeLogContextBudgetRisk = () => {
      const now = Date.now();
      if (now - lastContextBudgetLogAt < 10_000) {
        return;
      }
      if (approxConversationTokensTotal >= REALTIME_CONTEXT_CRITICAL_TOKENS) {
        lastContextBudgetLogAt = now;
        console.warn(
          `[ai-interviewer-worker] room ${roomId} realtime context risk HIGH: conversationTokens≈${approxConversationTokensTotal}, promptInputTokens≈${approxPromptInputTokensTotal}, outputTokens≈${approxOutputTokensTotal}`,
        );
        return;
      }
      if (approxConversationTokensTotal >= REALTIME_CONTEXT_WARN_TOKENS) {
        lastContextBudgetLogAt = now;
        console.warn(
          `[ai-interviewer-worker] room ${roomId} realtime context risk MEDIUM: conversationTokens≈${approxConversationTokensTotal}, promptInputTokens≈${approxPromptInputTokensTotal}, outputTokens≈${approxOutputTokensTotal}`,
        );
      }
    };

    const generateReplyWithTelemetry = async (params: {
      instructions: string;
      reason: string;
      inputModality?: 'text' | 'audio';
      userInput?: string;
      toolChoice?: llm.ToolChoice;
    }) => {
      const answerLeakGuardInstructions = [
        'Global answer-leak guard for this turn:',
        'During warmup/coding, do not introduce a new concrete algorithm, data structure, storage plan, loop condition, or exact implementation mechanic that the candidate has not already stated or written.',
        'If the candidate asks for the missing strategy, asks what to use, or says they cannot think of it, ask about constraints, repeated work, or complexity instead of naming the answer.',
        'If the candidate repeatedly cannot proceed, steer to wrapup rather than revealing the implementation.',
      ].join('\n');
      const contextPressureInstructions =
        approxConversationTokensTotal >= REALTIME_CONTEXT_WARN_TOKENS
          ? [
              'Context budget guard:',
              'Keep response concise (prefer <= 2 short sentences unless user explicitly asks for detail).',
              'If live code/submission details are needed, call get_room_context instead of relying on older memory.',
            ].join('\n')
          : '';
      const finalInstructions = [
        params.instructions,
        answerLeakGuardInstructions,
        contextPressureInstructions,
      ]
        .filter((part) => part.length > 0)
        .join('\n');
      const promptPayload = `${promptCachePrefix}\n\n${finalInstructions}`;
      const inputTokens = estimateTokenCount(promptPayload);
      approxPromptInputTokensTotal += inputTokens;
      console.debug(
        `[ai-interviewer-worker] reply-prompt room=${roomId} reason=${params.reason} inputTokens≈${inputTokens} promptInputTotal≈${approxPromptInputTokensTotal} conversationTokens≈${approxConversationTokensTotal}`,
      );
      const previousActiveReplyReason = activeReplyReason;
      activeReplyReason = params.reason;
      try {
        await session.generateReply({
          userInput: params.userInput,
          instructions: promptPayload,
          toolChoice: params.toolChoice,
          inputModality: params.inputModality ?? 'text',
        });
      } catch (error) {
        const message = resolveErrorEventMessage(error);
        console.warn(
          `[ai-interviewer-worker] failed to generate reply room=${roomId} reason=${params.reason}: ${message}`,
        );
        await publishRealtimeEvent({
          type: 'error',
          message: 'AI interviewer service is temporarily unavailable.',
          occurredAt: Date.now(),
        });
      } finally {
        activeReplyReason = previousActiveReplyReason;
      }
      maybeLogContextBudgetRisk();
    };

    const suppressRealtimeAssistantTranscripts = (durationMs: number) => {
      suppressRealtimeAssistantTranscriptsUntil = Math.max(
        suppressRealtimeAssistantTranscriptsUntil,
        Date.now() + durationMs,
      );
    };

    const interruptRealtimeSpeech = async (reason: string) => {
      try {
        await session.interrupt({ force: true }).await;
      } catch (error) {
        console.warn(
          `[ai-interviewer-worker] failed to interrupt realtime speech for room ${roomId} (${reason}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };

    const recordTurn = async (turn: TranscriptTurnPayload) => {
      if (seenTurnIds.has(turn.turnId)) {
        return;
      }
      seenTurnIds.add(turn.turnId);
      try {
        await postTranscriptTurn(roomId, turn);
      } catch (error) {
        console.warn(
          `[ai-interviewer-worker] failed to persist transcript turn ${turn.turnId} for room ${roomId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };

    // Resets phase-flow flags so they reflect the freshly fetched room status.
    // Extracted from refreshRoomContext to keep cognitive complexity low.

    // Resets the non-passing-submission guidance counters whenever the latest
    // submission is passing. Extracted from refreshRoomContext.

    // Performs the side effects of a successful context fetch: caches the
    // latest runtime/interview context, updates phase-flow flags, refreshes
    // the prompt cache prefix, and resets guidance counters if appropriate.
    const applyFetchedRoomContext = (context: AiInterviewerContextResponse) => {
      latestRuntimeRoomContext = context;
      const interviewContext = toRealtimeInterviewContext(context);
      if (interviewContext) {
        latestInterviewContext = interviewContext;
        refreshPromptCachePrefix();
      }
    };

    const refreshRoomContext = async (options?: {
      expectedSubmission?: ParsedSubmissionSignalSummary;
      forceAttempts?: number;
    }) => {
      if (!participantUserId) {
        return undefined;
      }
      const maxAttempts = options?.forceAttempts ?? (options?.expectedSubmission ? 4 : 3);
      const expected = options?.expectedSubmission;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const context = await fetchAiInterviewerRoomContext(roomId, participantUserId);
          applyFetchedRoomContext(context);

          if (shouldReturnFetchedRoomContext({ context, expected, attempt, maxAttempts })) {
            return context;
          }
          await sleep(300);
        } catch (error) {
          if (attempt >= maxAttempts) {
            console.warn(
              `[ai-interviewer-worker] failed to refresh room context for room ${roomId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return undefined;
          }
          await sleep(250);
        }
      }
      return undefined;
    };

    const queuePhaseTransitionAfterAssistant = (
      targetStatus: RoomPhaseStatus,
      reason?: string,
    ): boolean => {
      if (queuedPhaseTransitionAfterAssistant || queuedPhaseTransitionInFlight) {
        return false;
      }
      queuedPhaseTransitionAfterAssistant = { targetStatus, reason };
      return true;
    };

    const transitionQueuedPhaseAfterAssistant = () => {
      if (!queuedPhaseTransitionAfterAssistant || queuedPhaseTransitionInFlight) {
        return;
      }
      if (!participantUserId) {
        queuedPhaseTransitionAfterAssistant = null;
        return;
      }

      const queued = queuedPhaseTransitionAfterAssistant;
      queuedPhaseTransitionAfterAssistant = null;
      queuedPhaseTransitionInFlight = true;
      void (async () => {
        try {
          const runtimeContext = (await refreshRoomContext()) ?? latestRuntimeRoomContext;
          if (runtimeContext?.roomStatus === queued.targetStatus) {
            return;
          }
          await requestAiInterviewerPhaseTransition({
            roomId,
            participantId: participantUserId,
            targetStatus: queued.targetStatus,
            reason: queued.reason,
          });
          await refreshRoomContext();
        } catch (error) {
          console.warn(
            `[ai-interviewer-worker] queued phase transition to ${queued.targetStatus} failed for room ${roomId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        } finally {
          queuedPhaseTransitionInFlight = false;
        }
      })();
    };

    const emitTurn = async (params: {
      turnId: string;
      role: 'user' | 'assistant';
      participantId: string;
      content: string;
      occurredAt: number;
      followUpQuestion?: string;
      codeAnnotations?: Array<{ line: number; comment: string }>;
    }) => {
      const transcriptTurn: TranscriptTurnPayload = {
        turnId: params.turnId,
        participantId: params.participantId,
        role: params.role,
        content: params.content,
        timestamp: params.occurredAt,
      };

      await recordTurn(transcriptTurn);
      await publishRealtimeEvent({
        type: 'transcript_turn',
        occurredAt: params.occurredAt,
        turnId: params.turnId,
        role: params.role,
        participantId: params.participantId,
        content: params.content,
        followUpQuestion: params.followUpQuestion,
        codeAnnotations: params.codeAnnotations,
      });
    };

    // Returns true when the answer-pressure guard handled the turn.

    // Returns true when the passing-submission optimization guard handled the turn.

    // Updates the non-passing-guidance counters in place for the current turn.

    // Returns true when a non-passing-submission boundary turn was emitted.

    // Returns true when the warmup-phase candidate-text flow handled the turn.

    // Returns true when a context-refresh candidate request was handled.

    const handleCandidateText = async (params: {
      content: string;
      language?: string;
      latestSubmissionSummary?: Extract<
        AiInterviewerSignalPayload,
        { type: 'user_text' }
      >['latestSubmissionSummary'];
    }) => {
      const content = params.content.trim();
      if (!content || isLikelyAccidentalCandidateMessage(content)) {
        return;
      }

      const runtimeContext = (await refreshRoomContext()) ?? latestRuntimeRoomContext;

      const instructions = buildUserTextInstructions(
        {
          type: 'user_text',
          text: content,
          ...(params.language ? { language: params.language } : {}),
          ...(params.latestSubmissionSummary
            ? { latestSubmissionSummary: params.latestSubmissionSummary }
            : {}),
        },
        latestInterviewContext,
        runtimeContext,
      );
      await generateReplyWithTelemetry({
        reason: `user_text_${params.language ?? 'voice'}`,
        instructions,
        inputModality: 'text',
      });
    };

    const inlineCommentTool = llm.tool({
      description:
        'Attach a focused inline code comment for the candidate. Use only for specific, actionable suggestions tied to a line number.',
      parameters: z.object({
        line: z
          .number()
          .int()
          .positive()
          .describe('1-based line number in the latest provided code context'),
        comment: z
          .string()
          .min(1)
          .max(800)
          .describe('Short inline feedback, ideally with a concrete fix or question'),
        lineText: z
          .string()
          .min(1)
          .max(300)
          .optional()
          .describe('Exact or near-exact text from the target line to help line alignment'),
      }),
      execute: async ({ line, comment, lineText }) => {
        const cleanedComment = comment.trim();
        if (!cleanedComment) {
          return { applied: false };
        }

        const runtimeContext = await refreshRoomContext();
        const liveCode =
          runtimeContext?.currentCode.code ?? latestRuntimeRoomContext?.currentCode.code ?? '';
        const resolvedLine = resolveInlineCommentLine(line, lineText, liveCode);
        const normalized = { line: resolvedLine, comment: cleanedComment };
        pendingInlineComments.push(normalized);

        await publishRealtimeEvent({
          type: 'inline_comment_added',
          occurredAt: Date.now(),
          comments: [normalized],
        });

        return { applied: true };
      },
    });

    const getRoomContextTool = llm.tool({
      description:
        'Fetch the latest room context (current code, language, and latest submission summary). Use whenever current code, problem, stage, or test outcomes would improve the answer. Never expose tool or backend failures to the candidate.',
      parameters: z.object({
        purpose: z.string().optional().describe('Brief reason for requesting fresh room context'),
      }),
      execute: async () => {
        const cachedContext = latestRuntimeRoomContext;
        const context = (await refreshRoomContext({ forceAttempts: 4 })) ?? cachedContext;
        if (!context) {
          return {
            available: false,
            contextQuality: 'unavailable',
            interviewerInstruction:
              'Do not mention backend, tools, context fetching, or retrieval failure. Continue with one high-level interview question based on the known problem, or ask the candidate to run or submit when ready.',
            problem: latestInterviewContext
              ? {
                  title: latestInterviewContext.problemTitle,
                  difficulty: latestInterviewContext.difficulty,
                  language: latestInterviewContext.language,
                }
              : null,
          };
        }
        return {
          available: true,
          contextQuality: context === cachedContext ? 'cached' : 'fresh',
          interviewerInstruction:
            'Use this data directly. Do not mention that it came from an internal tool.',
          roomStatus: context.roomStatus,
          language: context.language,
          problem: context.problem,
          currentCodeSource: context.currentCode.source,
          currentCodeLanguage: context.currentCode.language,
          currentCode: context.currentCode.code,
          currentCodeNumbered: buildNumberedCodeBlock(context.currentCode.code, 220, 9_000),
          latestSubmission: context.latestSubmission,
          latestSubmittedCodeNumbered: context.latestSubmission
            ? buildNumberedCodeBlock(context.latestSubmission.code, 220, 9_000)
            : null,
        };
      },
    });

    const transitionRoomPhaseTool = llm.tool({
      description:
        'Queue a room phase transition after your current spoken turn. First speak a clear transition preamble to the candidate, then call this tool. Never call it silently.',
      parameters: z.object({
        targetStatus: z.enum(['warmup', 'coding', 'wrapup', 'finished']),
        reason: z
          .string()
          .min(1)
          .max(240)
          .optional()
          .describe('Short interview rationale for this phase transition'),
        spokenPreamble: z
          .string()
          .min(1)
          .max(240)
          .optional()
          .describe('The transition sentence you spoke or are about to speak to the candidate'),
      }),
      execute: async ({ targetStatus, reason, spokenPreamble }) => {
        if (!participantUserId) {
          return {
            transitioned: false,
            error: 'missing-participant',
          };
        }

        const runtimeContext = (await refreshRoomContext()) ?? latestRuntimeRoomContext;
        const fromStatus = runtimeContext?.roomStatus;
        if (isIdleDrivenReplyReason(activeReplyReason)) {
          return {
            transitioned: false,
            reason: 'idle-checkin-cannot-transition-phase',
            fromStatus,
            targetStatus,
            interviewerInstruction:
              'Do not transition phases during idle or away check-ins. Stay in the current phase; ask at most one brief check-in question, or stay silent.',
          };
        }

        if (fromStatus === targetStatus) {
          return {
            transitioned: false,
            reason: 'already-in-target-status',
            fromStatus,
            targetStatus,
          };
        }

        const queued = queuePhaseTransitionAfterAssistant(targetStatus, reason);
        if (!queued) {
          return {
            transitioned: false,
            fromStatus: runtimeContext?.roomStatus,
            targetStatus,
            reason: 'transition-already-queued',
          };
        }
        return {
          transitioned: false,
          queued: true,
          fromStatus: runtimeContext?.roomStatus,
          targetStatus,
          spokenPreamble: spokenPreamble?.trim() || null,
          interviewerInstruction:
            'The transition is queued and will run after this spoken turn. Finish the preamble naturally and do not repeat it.',
        };
      },
    });

    const interviewAgent = new voice.Agent({
      instructions: systemInstructions,
      tools: {
        add_inline_comment: inlineCommentTool,
        get_room_context: getRoomContextTool,
        transition_room_phase: transitionRoomPhaseTool,
      },
    });

    const syncLiveContextUpdate = async (
      runtimeContext: AiInterviewerContextResponse,
      signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }>,
    ) => {
      try {
        const nextChatContext = session.chatCtx.copy({
          excludeEmptyMessage: true,
          excludeHandoff: true,
          excludeConfigUpdate: true,
        });
        nextChatContext.items = nextChatContext.items.filter(
          (item) => item.id !== LIVE_CODE_CONTEXT_MESSAGE_ID,
        );
        nextChatContext.addMessage({
          id: LIVE_CODE_CONTEXT_MESSAGE_ID,
          role: 'system',
          content: buildCodeContextUpdate({
            context: runtimeContext,
            signal,
          }),
          createdAt: Date.now(),
        });
        await interviewAgent.updateChatCtx(nextChatContext);
        console.debug(
          `[ai-interviewer-worker] live context updated room=${roomId} reason=${signal.reason}`,
        );
      } catch (error) {
        console.warn(
          `[ai-interviewer-worker] failed to sync live context for room ${roomId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };

    session.on(
      voice.AgentSessionEventTypes.AgentStateChanged,
      (event: voice.AgentStateChangedEvent) => {
        const previousState = currentAgentState;
        currentAgentState = event.newState;
        if (previousState === 'speaking' && event.newState !== 'speaking') {
          agentStoppedSpeakingAt = Date.now();
        }
        void publishRealtimeEvent({
          type: 'agent_state',
          state: event.newState,
          occurredAt: event.createdAt,
        });
      },
    );

    const handleUserAwayState = async (event: voice.UserStateChangedEvent) => {
      const initialNow = Date.now();
      if (
        userAwayDecisionInFlight ||
        !shouldRequestUserAwayDecision({
          userState: event.newState,
          agentState: currentAgentState,
          lastReplyAt: lastSystemReplyAt,
          now: initialNow,
        })
      ) {
        return;
      }

      userAwayDecisionInFlight = true;
      try {
        const runtimeContext = (await refreshRoomContext()) ?? latestRuntimeRoomContext;
        const now = Date.now();
        if (
          !shouldRequestUserAwayDecision({
            userState: event.newState,
            agentState: currentAgentState,
            lastReplyAt: lastSystemReplyAt,
            now,
          })
        ) {
          return;
        }

        const signal: SystemSignalPayload = {
          type: 'system_signal',
          reason: 'user_idle',
          summary: 'LiveKit user away timeout triggered.',
        };
        if (shouldIgnoreRuntimeSignal(signal, runtimeContext)) {
          return;
        }
        lastSystemReplyAt = now;
        const instructions = buildSystemSignalInstructions(
          signal,
          latestInterviewContext,
          runtimeContext,
        );
        await generateReplyWithTelemetry({
          reason: 'user_away_timeout',
          instructions,
        });
      } finally {
        userAwayDecisionInFlight = false;
      }
    };

    session.on(
      voice.AgentSessionEventTypes.UserStateChanged,
      (event: voice.UserStateChangedEvent) => {
        void publishRealtimeEvent({
          type: 'user_state',
          state: event.newState,
          occurredAt: event.createdAt,
        });
        void handleUserAwayState(event);
      },
    );

    session.on(voice.AgentSessionEventTypes.OverlappingSpeech, (event) => {
      void publishRealtimeEvent({
        type: 'overlapping_speech',
        occurredAt: event.detectedAt,
        isInterruption: event.isInterruption,
        probability: event.probability,
      });
    });

    session.on(voice.AgentSessionEventTypes.Error, (event: voice.ErrorEvent) => {
      const message = resolveErrorEventMessage(event.error);
      void publishRealtimeEvent({
        type: 'error',
        message,
        occurredAt: event.createdAt,
      });
    });

    session.on(
      voice.AgentSessionEventTypes.UserInputTranscribed,
      (event: voice.UserInputTranscribedEvent) => {
        if (!event.isFinal) {
          return;
        }

        const content = event.transcript.trim();
        if (!content) {
          return;
        }
        if (isLikelyAccidentalCandidateMessage(content)) {
          return;
        }
        if (
          currentAgentState === 'speaking' ||
          Date.now() - agentStoppedSpeakingAt < USER_INPUT_ECHO_GUARD_MS
        ) {
          console.debug(
            `[ai-interviewer-worker] suppressed likely-echo user transcript room=${roomId} agentState=${currentAgentState} content="${content.slice(0, 80)}"`,
          );
          return;
        }
        const userTokens = estimateTokenCount(content);
        approxConversationTokensTotal += userTokens;
        maybeLogContextBudgetRisk();

        const participantId = event.speakerId ?? participantUserId ?? null;
        if (!participantId) {
          return;
        }

        lastUserSpeakerId = participantId;
        lastUserTurnAt = event.createdAt;
        const turnId = createTranscriptTurnId(
          'user',
          roomId,
          participantId,
          event.createdAt,
          content,
        );

        void emitTurn({
          turnId,
          role: 'user',
          participantId,
          content,
          occurredAt: event.createdAt,
        });
        void handleCandidateText({ content });
      },
    );

    session.on(
      voice.AgentSessionEventTypes.ConversationItemAdded,
      (event: voice.ConversationItemAddedEvent) => {
        if (event.item.type !== 'message' || event.item.role !== 'assistant') {
          return;
        }

        const content = event.item.textContent?.trim();
        if (!content) {
          return;
        }
        if (Date.now() <= suppressRealtimeAssistantTranscriptsUntil) {
          console.debug(
            `[ai-interviewer-worker] suppressed interrupted realtime assistant transcript room=${roomId}`,
          );
          return;
        }
        if (suppressRealtimeAssistantTranscriptsUntil > 0) {
          suppressRealtimeAssistantTranscriptsUntil = 0;
        }
        const assistantTokens = estimateTokenCount(content);
        approxOutputTokensTotal += assistantTokens;
        approxConversationTokensTotal += assistantTokens;
        console.debug(
          `[ai-interviewer-worker] assistant-turn room=${roomId} outputTokens≈${assistantTokens} outputTotal≈${approxOutputTokensTotal} conversationTokens≈${approxConversationTokensTotal}`,
        );
        maybeLogContextBudgetRisk();

        const participantId = lastUserSpeakerId ?? participantUserId ?? null;
        if (!participantId) {
          return;
        }

        const codeAnnotations = pendingInlineComments.splice(0, pendingInlineComments.length);

        void emitTurn({
          turnId: event.item.id,
          role: 'assistant',
          participantId,
          content,
          occurredAt: event.item.createdAt,
          codeAnnotations: codeAnnotations.length > 0 ? codeAnnotations : undefined,
        });

        void (async () => {
          if (queuedPhaseTransitionAfterAssistant) {
            transitionQueuedPhaseAfterAssistant();
          }
        })();
      },
    );

    // QUAIL_L background-noise suppression — free tier, cleans up keyboard
    // clicks, fan hum, and ambient room noise. Degrades silently to a no-op
    // when aiCoustics credentials are unavailable (self-hosted LiveKit without
    // a license key) or the native module cannot be loaded.
    let noiseCancellation: ReturnType<typeof aiCoustics.audioEnhancement> | undefined;
    try {
      noiseCancellation = aiCoustics.audioEnhancement({ model: 'quailL' });
    } catch {
      // Native module unavailable — audio passes through unchanged.
    }

    await session.start({
      agent: interviewAgent,
      room: ctx.room,
      inputOptions: {
        ...(noiseCancellation ? { noiseCancellation } : {}),
        participantIdentity: participantUserId,
        closeOnDisconnect: false,
      },
    });

    void refreshRoomContext();

    let reconnectShutdownTimer: ReturnType<typeof setTimeout> | undefined;
    const clearReconnectShutdownTimer = () => {
      if (!reconnectShutdownTimer) {
        return;
      }
      clearTimeout(reconnectShutdownTimer);
      reconnectShutdownTimer = undefined;
    };

    const onParticipantConnected = (participant: { identity?: string }) => {
      if (!participantUserId || participant.identity !== participantUserId) {
        return;
      }

      const hadReconnectTimer = reconnectShutdownTimer !== undefined;
      clearReconnectShutdownTimer();
      subscribeExistingRemoteTracks(ctx, roomId);
      console.debug(
        `[ai-interviewer-worker] participant reconnected room=${roomId} participant=${
          participant.identity
        }${hadReconnectTimer ? ' graceTimer=cleared' : ''}`,
      );

      void (async () => {
        await sleep(250);
        await publishSessionReady();
      })();
    };

    const onParticipantDisconnected = (participant: { identity?: string }) => {
      if (!participantUserId || participant.identity !== participantUserId) {
        return;
      }
      clearReconnectShutdownTimer();
      console.debug(
        `[ai-interviewer-worker] participant disconnected room=${roomId} participant=${participant.identity}; waiting ${env.AI_INTERVIEWER_RECONNECT_GRACE_MS}ms before shutdown`,
      );
      reconnectShutdownTimer = setTimeout(() => {
        reconnectShutdownTimer = undefined;
        console.debug(
          `[ai-interviewer-worker] participant reconnect grace expired room=${roomId}; shutting down`,
        );
        ctx.shutdown('participant-disconnected');
      }, env.AI_INTERVIEWER_RECONNECT_GRACE_MS);
    };
    ctx.room.on('participantConnected', onParticipantConnected);
    ctx.room.on('participantDisconnected', onParticipantDisconnected);
    ctx.addShutdownCallback(async () => {
      clearReconnectShutdownTimer();
      ctx.room.off('participantConnected', onParticipantConnected);
      ctx.room.off('participantDisconnected', onParticipantDisconnected);
    });

    // Handles a decoded user_text signal coming over the LiveKit data channel.
    const handleUserTextSignal = (
      signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }>,
      participant: { identity?: string } | undefined,
    ) => {
      const content = signal.text.trim();
      if (!content || isLikelyAccidentalCandidateMessage(content)) {
        return;
      }
      const userTokens = estimateTokenCount(content);
      approxConversationTokensTotal += userTokens;
      maybeLogContextBudgetRisk();

      const participantId = participantUserId ?? participant?.identity;
      if (participantId) {
        lastUserSpeakerId = participantId;
        lastUserTurnAt = Date.now();
        const turnId = createTranscriptTurnId('user', roomId, participantId, Date.now(), content);
        void emitTurn({
          turnId,
          role: 'user',
          participantId,
          content,
          occurredAt: Date.now(),
        });
      }
      void handleCandidateText({
        content,
        language: signal.language,
        latestSubmissionSummary: signal.latestSubmissionSummary,
      });
    };

    type SystemSignal = Extract<AiInterviewerSignalPayload, { type: 'system_signal' }>;

    // Repeatedly refreshes runtime context for join/stage signals received
    // while the room is still in `waiting`, until it advances or attempts are
    // exhausted. Returns the most up-to-date context.
    const waitOutWaitingStatus = async (
      signal: SystemSignal,
      initial: AiInterviewerContextResponse | undefined,
    ): Promise<AiInterviewerContextResponse | undefined> => {
      if (
        initial?.roomStatus !== 'waiting' ||
        (signal.reason !== 'session_joined' && signal.reason !== 'stage_changed')
      ) {
        return initial;
      }
      let current = initial;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await sleep(250);
        current = (await refreshRoomContext()) ?? current;
        if (current?.roomStatus !== 'waiting') {
          break;
        }
      }
      return current;
    };

    // Bumps non-passing-submission guidance state on a code_submitted signal,
    // emitting the boundary-response turn when the guidance threshold is hit.
    // Returns true when the boundary turn was emitted so the caller can stop.

    // Handles a code_submitted system signal when the room is in coding phase.

    // Handles scripted phase-kickoff signals (warmup/coding/wrapup). Returns
    // true when the signal matched and was handled.

    // Routes a decoded system_signal through the appropriate handler chain.
    let lastCodeRanContextAt = 0;

    const handleSystemSignal = async (signal: SystemSignal) => {
      // Interrupt current speech on submission for low-latency review.
      if (signal.reason === 'code_submitted') {
        suppressRealtimeAssistantTranscripts(350);
        await interruptRealtimeSpeech('code_submitted');
      }
      if (signal.interviewContext) {
        latestInterviewContext = signal.interviewContext;
        refreshPromptCachePrefix();
      }

      let runtimeContextForSignal = latestRuntimeRoomContext;
      if (signal.reason === 'code_ran' || signal.reason === 'code_submitted') {
        const expectedSubmission =
          signal.reason === 'code_submitted'
            ? (parseSubmissionSignalSummary(signal.summary) ?? undefined)
            : undefined;
        runtimeContextForSignal =
          (await refreshRoomContext({ expectedSubmission })) ?? runtimeContextForSignal;
      }
      runtimeContextForSignal = await waitOutWaitingStatus(signal, runtimeContextForSignal);

      if (shouldIgnoreRuntimeSignal(signal, runtimeContextForSignal)) {
        return;
      }

      // code_ran: inject context silently so the model stays informed, but
      // do not speak on every test run. Debounce to avoid context flooding.
      if (signal.reason === 'code_ran') {
        const now = Date.now();
        if (runtimeContextForSignal && now - lastCodeRanContextAt >= CODE_RAN_CONTEXT_DEBOUNCE_MS) {
          lastCodeRanContextAt = now;
          await syncLiveContextUpdate(runtimeContextForSignal, signal);
        }
        return;
      }

      // All other signals: check backstops, then let the model decide.
      const now = Date.now();
      const isNudge = signal.reason === 'manual_nudge';
      const isSubmission = signal.reason === 'code_submitted';
      const isJoin = signal.reason === 'session_joined';

      // Manual nudges and submissions always get through (subject to anti-spam).
      // Other signals need either anti-spam clearance or idle check-in.
      const allowedByBackstop =
        isNudge || isSubmission || isJoin
          ? hasAntiSpamElapsed(lastSystemReplyAt, now)
          : hasAntiSpamElapsed(lastSystemReplyAt, now) ||
            isIdleCheckinOverdue(lastUserTurnAt, lastSystemReplyAt, now);

      if (!allowedByBackstop) {
        return;
      }

      // Don't generate a reply while the agent is speaking — wait for the
      // voice agent's natural turn boundary to avoid audio glitches.
      if (currentAgentState === 'speaking') {
        return;
      }

      lastSystemReplyAt = now;

      const instructions = buildSystemSignalInstructions(
        signal,
        latestInterviewContext,
        runtimeContextForSignal,
      );
      await generateReplyWithTelemetry({
        reason: `system_${signal.reason}`,
        instructions,
      });
    };

    ctx.room.on('dataReceived', (payload, participant, _kind, topic) => {
      if (topic !== AI_INTERVIEWER_SIGNAL_TOPIC) {
        return;
      }
      if (participantUserId && participant?.identity !== participantUserId) {
        return;
      }

      const signal = decodeAiInterviewerSignalPayload(payload);
      if (!signal) {
        return;
      }

      if (signal.type === 'user_text') {
        handleUserTextSignal(signal, participant);
        return;
      }
      if (signal.type !== 'system_signal') {
        return;
      }
      void handleSystemSignal(signal);
    });

    await publishSessionReady();
  },
});
/* v8 ignore stop */

export default agent;

// Exposed for unit tests only — keeps test surface explicit and avoids
// leaking module-private helpers via top-level exports used by production
// callers.
export const __testing = {
  createRealtimeSession,
  createFallbackSession,
  createInterviewSession,
  resolveMiniMaxTtsUrl,
  extractPcmFromWav,
  resolveOpenAiRealtimeWebSocketUrl,
  resolveLiveKitAgentConnectUrl,
  resolveOpenAiTtsVoice,
  normalizeOpenAiSdkBaseUrl,
  withoutProxyEnv,
  resolveTranscriptUrl,
  resolveAiInterviewerContextUrl,
  resolveAiInterviewerPhaseTransitionUrl,
  parseDispatchMetadata,
  createTranscriptTurnId,
  postTranscriptTurn,
  fetchAiInterviewerRoomContext,
  requestAiInterviewerPhaseTransition,
  buildSystemSignalInstructions,
  buildUserTextInstructions,
  buildInterviewContextInstructions,
  buildCompactInterviewContextReminder,
  buildLiveRoomContextInstructions,
  buildCodeContextUpdate,
  buildConstraintGuidance,
  buildPhaseBehaviorGuidance,
  buildPromptCachePrefix,
  buildNumberedCodeBlock,
  clampInstructionContent,
  estimateTokenCount,
  isLikelyAccidentalCandidateMessage,
  parseSubmissionSignalSummary,
  normalizeSubmissionSignalTimestamp,
  resolveInlineCommentLine,
  buildReasonSpecificInstructions,
  resolveErrorEventMessage,
  withTimeout,
  parseRunSummary,
  isNonPassingSubmission,
  isPassingSubmission,
  matchesExpectedSubmission,
  isExpectedSubmissionContext,
  shouldReturnFetchedRoomContext,
  shouldIgnoreRuntimeSignal,
  toRealtimeInterviewContext,
  hasAntiSpamElapsed,
  isIdleCheckinOverdue,
  shouldRequestUserAwayDecision,
  isIdleDrivenReplyReason,
  subscribeRemoteTrackPublication,
  isChineseLanguageHint,
  buildInterfaceLanguageInstruction,
  createInterviewerInstructions,
};

const currentFilePath = fileURLToPath(import.meta.url);
export function runAiInterviewerWorker(agentFilePath = currentFilePath): void {
  cli.runApp(
    new ServerOptions({
      agent: agentFilePath,
      agentName: env.AI_INTERVIEWER_AGENT_NAME,
      initializeProcessTimeout: env.AI_INTERVIEWER_WORKER_INITIALIZE_TIMEOUT_MS,
      shutdownProcessTimeout: env.AI_INTERVIEWER_WORKER_SHUTDOWN_TIMEOUT_MS,
      requestFunc: async (job) => {
        await job.accept(
          'AI Interviewer',
          env.AI_INTERVIEWER_AGENT_IDENTITY,
          job.job.metadata || undefined,
        );
      },
    }),
  );
}

if (process.argv[1] === currentFilePath) {
  runAiInterviewerWorker();
}
