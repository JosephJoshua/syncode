import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, defineAgent, type JobContext, llm, ServerOptions, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
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
import { z } from 'zod';
import { validateEnv } from '../config/env.config.js';

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

interface WorkerEnv {
  AI_INTERVIEWER_AGENT_IDENTITY: string;
  AI_INTERVIEWER_AGENT_NAME: string;
  AI_INTERVIEWER_CONTROL_PLANE_URL: string;
  AI_INTERVIEWER_FALLBACK_ENABLED: boolean;
  AI_PLATFORM_API_KEY: string;
  AI_PLATFORM_BASE_URL: string;
  AI_PLATFORM_MODEL: string;
  AI_STT_MODEL: string;
  AI_TTS_MODEL?: string;
  AI_TTS_VOICE: string;
  OPENAI_API_KEY?: string;
  OPENAI_REALTIME_BASE_URL: string;
  OPENAI_REALTIME_MODEL: string;
  OPENAI_REALTIME_VOICE: string;
  INTERNAL_CALLBACK_SECRET: string;
}

type WarmupFlowState = 'not_started' | 'kickoff_sent' | 'followup_sent' | 'completed';
type LiveContextDetail = 'compact' | 'detailed';
type RoomPhaseStatus = 'warmup' | 'coding' | 'wrapup' | 'finished';

const SIGNAL_REASON_MIN_INTERVAL_MS: Record<AiInterviewerSignalReason, number> = {
  session_joined: 10 * 60_000,
  stage_changed: 90_000,
  user_idle: 6 * 60_000,
  hint_used: 2 * 60_000,
  code_ran: 2 * 60_000,
  code_submitted: 10_000,
  manual_nudge: 10_000,
};

const SYSTEM_SIGNAL_GLOBAL_MIN_INTERVAL_MS = 60_000;
// Suppress user transcripts that land while the agent is speaking or within
// this window after it stops, since they are almost always echo of the
// agent's own audio captured by the candidate's microphone (e.g. when the
// candidate is not wearing headphones) rather than real candidate input.
const USER_INPUT_ECHO_GUARD_MS = 1_500;
const NOISE_RUN_SUMMARY_PATTERN = /Latest run:\s*(\d+)\s*\/\s*(\d+)\s*passed\./i;
const REALTIME_CONTEXT_WARN_TOKENS = 35_000;
const REALTIME_CONTEXT_CRITICAL_TOKENS = 45_000;
const LIVE_CODE_CONTEXT_MESSAGE_ID = 'syncode_live_code_context';

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
  const parsed = validateEnv(process.env as Record<string, unknown>);
  if (!parsed.INTERNAL_CALLBACK_SECRET) {
    throw new Error('INTERNAL_CALLBACK_SECRET is required for AI interviewer worker');
  }

  return {
    AI_INTERVIEWER_AGENT_IDENTITY: parsed.AI_INTERVIEWER_AGENT_IDENTITY,
    AI_INTERVIEWER_AGENT_NAME: parsed.AI_INTERVIEWER_AGENT_NAME,
    AI_INTERVIEWER_CONTROL_PLANE_URL: parsed.AI_INTERVIEWER_CONTROL_PLANE_URL,
    AI_INTERVIEWER_FALLBACK_ENABLED: parsed.AI_INTERVIEWER_FALLBACK_ENABLED,
    AI_PLATFORM_API_KEY: parsed.AI_PLATFORM_API_KEY,
    AI_PLATFORM_BASE_URL: parsed.AI_PLATFORM_BASE_URL,
    AI_PLATFORM_MODEL: parsed.AI_PLATFORM_MODEL,
    AI_STT_MODEL: parsed.AI_STT_MODEL,
    AI_TTS_MODEL: parsed.AI_TTS_MODEL,
    AI_TTS_VOICE: parsed.AI_TTS_VOICE,
    OPENAI_API_KEY: parsed.OPENAI_API_KEY,
    OPENAI_REALTIME_BASE_URL: parsed.OPENAI_REALTIME_BASE_URL,
    OPENAI_REALTIME_MODEL: parsed.OPENAI_REALTIME_MODEL,
    OPENAI_REALTIME_VOICE: parsed.OPENAI_REALTIME_VOICE,
    INTERNAL_CALLBACK_SECRET: parsed.INTERNAL_CALLBACK_SECRET,
  };
}

function normalizeOpenAiSdkBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

function resolveOpenAiTtsVoice(voiceName: string): openai.TTSVoices {
  if (OPENAI_TTS_VOICES.has(voiceName as openai.TTSVoices)) {
    return voiceName as openai.TTSVoices;
  }
  return 'alloy';
}

function resolveTranscriptUrl(roomId: string): string {
  const route = CONTROL_INTERNAL.AI_INTERVIEW_TRANSCRIPT.route.replace(':roomId', roomId);
  const base = env.AI_INTERVIEWER_CONTROL_PLANE_URL.replace(/\/+$/, '');
  return `${base}/${route}`;
}

function resolveAiInterviewerContextUrl(roomId: string): string {
  const route = CONTROL_INTERNAL.AI_INTERVIEWER_CONTEXT.route.replace(':roomId', roomId);
  const base = env.AI_INTERVIEWER_CONTROL_PLANE_URL.replace(/\/+$/, '');
  return `${base}/${route}`;
}

function resolveAiInterviewerPhaseTransitionUrl(roomId: string): string {
  const route = CONTROL_INTERNAL.AI_INTERVIEWER_PHASE_TRANSITION.route.replace(':roomId', roomId);
  const base = env.AI_INTERVIEWER_CONTROL_PLANE_URL.replace(/\/+$/, '');
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
  const digest = createHash('sha256')
    .update(`${role}:${roomId}:${participantId}:${timestamp}:${content}`)
    .digest('hex')
    .slice(0, 16);
  return `lk-ai-turn-${timestamp}-${digest}`;
}

function createInterviewerInstructions(): string {
  return [
    'You are SynCode Interviewer, a strict but fair technical interviewer for live coding sessions.',
    'You are not a coding copilot. You evaluate reasoning, communication, correctness, and tradeoff thinking.',
    'Your behavior rules:',
    '1) Start with one concise greeting and kickoff once per active interview session.',
    '2) Ask focused questions about reasoning, tradeoffs, edge cases, debugging, and complexity.',
    '3) Avoid repetitive loops. Do not repeat the same prompt pattern.',
    '4) Do not ask a follow-up every turn; choose naturally based on context and stay silent for accidental/no-content input.',
    '5) If candidate is stuck, use interviewer-safe prompts about constraints, tradeoffs, and bottlenecks. Do not explain the target implementation during coding.',
    '6) Keep responses concise and interviewer-like, not pair-programming-like.',
    "7) Never use passive helper phrases like 'let me know if you need help', 'we can implement this together', or 'I can help you code this'.",
    '8) Treat provided starter code as platform scaffold, not candidate-authored mistakes by default.',
    '9) Be bilingual and adaptive: reply in the language the candidate most recently used (Chinese or English), with natural mixed-language handling.',
    '9a) Before the candidate has spoken, use the candidate UI language if it is provided. Do not mix Chinese and English in the opening greeting.',
    '10) During quiet coding periods, speak less. Silence is acceptable; do not fill every pause.',
    '11) Use add_inline_comment only for high-value, specific code feedback tied to one line.',
    '12) Do not reveal final algorithms or exact implementation steps when asked or when the candidate only names a broad idea.',
    '13) If candidate asks for the answer, refuses to reason, or says they cannot think of the strategy, do not answer the request. Ask about constraints, repeated work, or correctness at a high level.',
    '14) Do not provide direct implementation explanation during warmup or coding. If the candidate repeatedly cannot continue, steer to wrapup instead.',
    '14a) Until the candidate explicitly gives up or asks for post-submission review, never volunteer exact implementation tactics for the active problem.',
    '14b) Before wrapup/review, forbidden answer leakage includes naming the canonical optimization, naming the concrete data structure, spelling out what to store, spelling out what to check, or describing the loop mechanics.',
    '14c) If the candidate names a broad strategy, acknowledge the direction only and ask them to justify the invariant and complexity. Do not complete those details for them.',
    '14d) If the candidate code already contains a technique, you may describe what their code does during review, but do not phrase it as new implementation advice.',
    '14e) Do not embed answers inside questions. Ask about the kind of information needed, not the concrete container or exact operation.',
    '14f) Never name a new concrete data structure, loop shape, variable layout, or exact condition as a hint unless the candidate already wrote it in code or explicitly gives up.',
    '14g) If the candidate says they do not know which algorithm to use, ask them to reason from constraints, required lookup, or brute-force bottleneck. Do not name the algorithm or data structure.',
    '15) Keep interview integrity: challenge reasoning before revealing solution details.',
    '15a) Your default posture is evaluator/interviewer, not assistant. Prefer prompts like "explain your invariant" over "here is how to implement it".',
    '16) Evaluate candidate solutions by correctness and tradeoffs, not by matching your preferred implementation pattern.',
    '17) Accept alternative correct solutions and focus feedback on constraints, complexity, readability, and edge cases.',
    '18) Before reviewing code or test outcomes, fetch fresh context using get_room_context and reference that data, unless a system-triggered instruction explicitly says the worker already computed the response from fresh context.',
    '19) If context is stale or unavailable, ask one high-level reasoning question instead of pretending to inspect code.',
    '20) For stage flow, use transition_room_phase only when justified by interview progress:',
    '20a) warmup -> coding after the candidate answers the final warmup question; first say in the spoken answer that warmup is complete and coding is starting, then the system transitions after your turn.',
    '20b) coding -> wrapup when implementation discussion is effectively complete, especially after a successful submission review; first summarize your assessment, then the system transitions after your turn.',
    '20c) wrapup -> finished only when the candidate explicitly ends/signs off.',
    '21) Never transition to finished without clear user intent to end the interview.',
    '22) Warmup must stay short: at most 2 focused questions total, then move to coding without asking another warmup question.',
    '23) In coding phase, avoid babysitting or pair-programming language; challenge and evaluate.',
    '24) After reviewing a complete or passing solution, give a concise assessment and steer toward wrapup instead of asking endless questions.',
    '25) Never drift to unrelated problems unless candidate explicitly asks for comparison.',
    '26) If the candidate says a broad approach, do not fill in the exact problem-specific implementation. Ask them to articulate the invariant and complexity themselves.',
    '27) Never call a phase transition tool before speaking the transition preamble in the same answer.',
    '28) After a passing submission, do not recommend a specific alternative algorithm or data structure. Discuss only outcome, complexity tradeoffs, and readiness to wrap up unless the candidate is already in wrapup.',
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
    sections.push('Canonical interview context (stable across the session):');
    sections.push(buildInterviewContextInstructions(params.context, 'detailed'));
  } else {
    sections.push(
      'Canonical interview context unavailable yet. Retry get_room_context when needed.',
    );
  }

  return sections.join('\n\n');
}

function createRealtimeSession(): voice.AgentSession {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for realtime mode');
  }
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

function createFallbackSession(): voice.AgentSession {
  if (!env.AI_INTERVIEWER_FALLBACK_ENABLED) {
    throw new Error('Realtime mode unavailable and fallback mode is disabled');
  }

  const baseURL = normalizeOpenAiSdkBaseUrl(env.AI_PLATFORM_BASE_URL);
  const stt = new openai.STT({
    apiKey: env.AI_PLATFORM_API_KEY,
    baseURL,
    model: env.AI_STT_MODEL,
    language: 'multi',
    detectLanguage: true,
  });
  const llmInstance = new openai.LLM({
    apiKey: env.AI_PLATFORM_API_KEY,
    baseURL,
    model: env.AI_PLATFORM_MODEL,
  });

  if (env.AI_TTS_MODEL) {
    const tts = new openai.TTS({
      apiKey: env.AI_PLATFORM_API_KEY,
      baseURL,
      model: env.AI_TTS_MODEL,
      voice: resolveOpenAiTtsVoice(env.AI_TTS_VOICE),
    });
    return new voice.AgentSession({ stt, llm: llmInstance, tts });
  }

  return new voice.AgentSession({ stt, llm: llmInstance });
}

function createInterviewSession(): voice.AgentSession {
  try {
    return createRealtimeSession();
  } catch (error) {
    console.warn(
      `[ai-interviewer-worker] Realtime session unavailable, falling back to STT+LLM+TTS pipeline: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return createFallbackSession();
  }
}

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
