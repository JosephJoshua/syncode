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
  const parts: string[] = [
    'A non-verbal interview signal was received from the coding workspace.',
    `Signal reason: ${signal.reason}.`,
  ];

  if (signal.summary) {
    parts.push(`Signal summary: ${signal.summary}`);
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
    parts.push('Code context (with line range):');
    parts.push(
      `${signal.codeContext.file} L${signal.codeContext.startLine}-${signal.codeContext.endLine}`,
    );
    parts.push(signal.codeContext.codeSnippet);
    parts.push(
      'If a focused correction would help, call add_inline_comment with a precise line and concise feedback.',
    );
  }

  parts.push(buildReasonSpecificInstructions(signal.reason, signal.summary));
  if (signal.reason === 'code_submitted') {
    parts.push(
      'Do not ignore this signal. Give a concise interviewer evaluation of the submission outcome.',
    );
  } else {
    parts.push(
      'Decide naturally whether to speak now. If this is quiet work time, keep the response brief or skip asking a follow-up.',
    );
  }

  return parts.join('\n');
}

function buildUserTextInstructions(
  signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }>,
  context?: AiInterviewerContext,
  runtimeContext?: AiInterviewerContextResponse,
): string {
  const parts = [
    'Candidate sent a typed text message.',
    `Candidate message: ${signal.text}`,
    'Respond naturally as the interviewer and keep continuity with prior conversation context.',
  ];

  if (signal.language) {
    parts.push(`Candidate language hint: ${signal.language}`);
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
        'Candidate-visible latest submission summary (authoritative from UI):',
        `status=${signal.latestSubmissionSummary.status}, passed=${signal.latestSubmissionSummary.passedTestCases}/${signal.latestSubmissionSummary.totalTestCases}, failed=${signal.latestSubmissionSummary.failedTestCases}, errors=${signal.latestSubmissionSummary.errorTestCases}, at=${signal.latestSubmissionSummary.submittedAt}`,
      ].join('\n'),
    );
  }
  if (isDirectAnswerRequest(signal.text) && !isExplicitGiveUp(signal.text)) {
    parts.push(
      [
        'Policy reminder: candidate is requesting direct solution help.',
        'Do not reveal full solution, concrete algorithm steps, or complete data-structure choice yet.',
        'Avoid naming the final canonical approach directly at this stage.',
        'Reply with exactly one probing question and at most one constrained hint sentence.',
        'The probing question must not contain the answer, data structure, loop condition, or exact implementation mechanic.',
      ].join('\n'),
    );
  }
  if (mentionsBroadApproach(signal.text) && !isExplicitGiveUp(signal.text)) {
    parts.push(
      [
        'Candidate named a broad approach or data structure.',
        'Do not complete the algorithm for them.',
        'Do not mention exact storage, matching, or lookup mechanics unless their current code already does so and this is a review.',
        'Acknowledge briefly, then ask them to explain the invariant, correctness condition, or complexity in their own words.',
        'The question must not smuggle in implementation details they have not said.',
      ].join('\n'),
    );
  }
  if (isExplicitGiveUp(signal.text)) {
    parts.push(
      'Candidate explicitly gave up or says they are stuck. During coding, do not dump the solution; give brief professional encouragement and ask whether they want one final attempt or prefer to wrap up. Save direct solution explanation for wrapup/post-session review.',
    );
  }
  if (isCodeOrSubmissionReviewRequest(signal.text)) {
    parts.push(
      [
        'Mandatory behavior for this turn:',
        '1) Call get_room_context before answering.',
        '2) Base review on the returned code + latestSubmission.',
        '3) If they differ from earlier memory, trust the latest tool result only.',
        '4) If latestSubmission is passing or the review is complete, give a concise assessment and steer to wrapup instead of asking more coding questions.',
      ].join('\n'),
    );
  }
  if (isReadyToCodeIntent(signal.text)) {
    parts.push(
      [
        'Candidate indicated readiness to implement.',
        'If room is in warmup and transition is appropriate, first say coding is starting in the same turn. The worker will transition after your spoken turn.',
      ].join('\n'),
    );
  }
  if (isEndInterviewIntent(signal.text)) {
    parts.push(
      [
        'Candidate may be signaling interview end.',
        'If room is in coding, first summarize and guide toward wrapup before requesting a phase transition.',
        'If room is in wrapup and intent is explicit goodbye/end, acknowledge the sign-off before requesting finish.',
      ].join('\n'),
    );
  }
  if (isLikelyAccidentalCandidateMessage(signal.text)) {
    parts.push(
      [
        'The candidate message looks accidental or has no interview content.',
        'Do not ask a new technical question.',
        'If a response is necessary, keep it to one short clarification.',
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
    );
    sections.push(buildNumberedCodeBlock(context.latestSubmission.code, 220, 9_000) || '(empty)');
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

function buildSilentLiveContextUpdateInstructions(params: {
  context: AiInterviewerContextResponse;
  signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }>;
}): string {
  const latestSubmissionSummary = params.context.latestSubmission
    ? `${params.context.latestSubmission.passedTestCases}/${params.context.latestSubmission.totalTestCases} passed, failed=${params.context.latestSubmission.failedTestCases}, errors=${params.context.latestSubmission.errorTestCases}, status=${params.context.latestSubmission.status}, language=${params.context.latestSubmission.language}, at=${params.context.latestSubmission.submittedAt}`
    : 'none';

  return [
    'Silent live coding context update from the workspace.',
    'Do not respond because of this message alone.',
    'Use this as background context only. For candidate-requested reviews, call get_room_context before speaking. For system-triggered submission_review instructions, trust the fresh response text computed by the worker.',
    `Signal reason: ${params.signal.reason}.`,
    params.signal.summary ? `Signal summary: ${params.signal.summary}` : undefined,
    `Room status: ${params.context.roomStatus}`,
    `Problem: ${params.context.problem?.title ?? 'unknown'}`,
    `Language: ${params.context.language}`,
    `Latest submission/run summary: ${latestSubmissionSummary}`,
    params.context.latestSubmission
      ? 'Latest submitted code that produced the submission result:'
      : undefined,
    params.context.latestSubmission
      ? buildNumberedCodeBlock(params.context.latestSubmission.code, 160, 7_000) || '(empty)'
      : undefined,
    'Current code snapshot:',
    buildNumberedCodeBlock(params.context.currentCode.code, 160, 7_000) || '(empty)',
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n');
}

function buildWarmupKickoffInstructions(params: {
  rememberedContext?: AiInterviewerContext;
  runtimeContext?: AiInterviewerContextResponse;
  interfaceLanguage?: string;
}): string {
  const parts = [
    'Warmup scripted turn 1 (follow strictly):',
    buildInterfaceLanguageInstruction(params.interfaceLanguage, 'opening'),
    '1) Briefly welcome the candidate.',
    '2) Explicitly introduce the current interview problem and language from provided context. State only what the problem is asking for — do NOT hint at how to solve it.',
    '3) Ask exactly one plan question (single question only in this turn).',
    '4) Keep total output to at most 3 short sentences.',
    '5) Use at most 1 question mark in this turn.',
    '6) Do not mention unrelated problems (for example linked list) unless candidate asks to compare.',
    'HARD ANTI-LEAKAGE RULES FOR THIS TURN (these override any tendency to be helpful):',
    "- Do NOT name any data structure or container (hash map, hash table, dict/dictionary, set, array, list, queue, stack, heap, tree, graph, trie, deque, etc.) — not as advice, not as a hint, not as 'one common approach', not even as an example.",
    '- Do NOT name any algorithm or technique (two-pointer, sliding window, binary search, brute force, hashing, memoization, dynamic programming, BFS, DFS, greedy, divide-and-conquer, recursion, sorting first, etc.).',
    "- Do NOT describe what to store, what to look up, what to check, what to iterate over, or what to compare. Phrases like 'store seen values', 'check if the complement exists', 'iterate and look up' are forbidden.",
    "- Do NOT use lead-ins like 'one approach is…', 'you could use…', 'a common way is…', 'consider using…'. These leak the answer.",
    '- Your plan question must ask the candidate how THEY would approach the problem — not propose an approach for them to confirm.',
    'STOP IMMEDIATELY after asking your single plan question. Do not continue with explanations, examples, or hints. Wait silently for the candidate to respond.',
  ];
  if (params.rememberedContext) {
    parts.push(buildInterviewContextInstructions(params.rememberedContext, 'detailed'));
  }
  if (params.runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(params.runtimeContext, 'compact'));
  }
  return parts.join('\n');
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

function buildWarmupFollowupInstructions(params: {
  candidateMessage: string;
  rememberedContext?: AiInterviewerContext;
  runtimeContext?: AiInterviewerContextResponse;
}): string {
  const parts = [
    'Warmup scripted turn 2 (follow strictly):',
    `Candidate message: ${params.candidateMessage}`,
    'Ask exactly one focused reasoning question about this exact problem only (single question only).',
    'If the candidate named a broad approach, do not explain the concrete implementation; ask them to state the invariant or correctness condition.',
    'Keep this turn to at most 2 short sentences and avoid any extra mini-questions.',
    'HARD ANTI-LEAKAGE RULES FOR THIS TURN (override any tendency to be helpful):',
    "- Do NOT name any data structure or container (hash map, hash table, dict, set, array, list, queue, stack, heap, tree, graph, trie, deque) — not as advice, hint, 'one approach', or example.",
    '- Do NOT name any algorithm or technique (two-pointer, sliding window, binary search, brute force, hashing, memoization, DP, BFS, DFS, greedy, sorting first).',
    "- Do NOT describe what the solution should store, look up, check, iterate over, or compare. Phrases like 'store seen values', 'check the complement', 'use a lookup' are forbidden.",
    "- Do NOT use lead-ins like 'one approach is', 'you could use', 'a common way is', 'consider using'. These leak the answer.",
    "- Your question must probe the candidate's OWN reasoning (e.g. about complexity, invariant, tradeoff, brute-force bottleneck). It must not propose any answer for them to confirm.",
    'STOP IMMEDIATELY after asking your single reasoning question. Do not continue with explanations, examples, or hints. Wait silently for the candidate to respond.',
  ];
  if (params.rememberedContext) {
    parts.push(buildCompactInterviewContextReminder(params.rememberedContext));
  }
  if (params.runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(params.runtimeContext, 'compact'));
  }
  return parts.join('\n');
}

function buildWarmupTransitionAnnouncementInstructions(params: {
  candidateMessage: string;
  rememberedContext?: AiInterviewerContext;
  runtimeContext?: AiInterviewerContextResponse;
}): string {
  const parts = [
    'Warmup final turn (follow strictly):',
    `Candidate message: ${params.candidateMessage}`,
    'Acknowledge the candidate answer briefly.',
    'Clearly say that warmup is complete and the coding phase is starting now.',
    'Use this as the transition preamble before the system changes the phase.',
    'Do not ask another warmup question.',
    'Keep this to at most 2 short sentences.',
  ];
  if (params.rememberedContext) {
    parts.push(buildCompactInterviewContextReminder(params.rememberedContext));
  }
  if (params.runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(params.runtimeContext, 'compact'));
  }
  return parts.join('\n');
}

function buildRepeatedNonPassingGuidanceInstructions(params: {
  candidateMessage?: string;
  guidanceTurns: number;
  runtimeContext?: AiInterviewerContextResponse;
}): string {
  const parts = [
    'Repeated non-passing guidance boundary:',
    `You have already tried ${params.guidanceTurns} guidance/review turns while the latest submission is still not passing.`,
    'Do not keep asking another debugging question.',
    'Do not reveal the full answer or exact implementation.',
    'Ask the candidate to choose: one final attempt, or wrap up and review what went wrong.',
    'Keep it to at most 2 short sentences.',
  ];

  if (params.candidateMessage) {
    parts.push(`Candidate message: ${params.candidateMessage}`);
  }
  if (params.runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(params.runtimeContext, 'compact'));
  }

  return parts.join('\n');
}

function buildWrapupAfterRepeatedStuckInstructions(params: {
  candidateMessage: string;
  discouragedTurns: number;
  runtimeContext?: AiInterviewerContextResponse;
}): string {
  const parts = [
    'Candidate appears unable or unwilling to continue after repeated guidance.',
    `Discouraged/give-up turns observed: ${params.discouragedTurns}.`,
    `Candidate message: ${params.candidateMessage}`,
    'Acknowledge calmly and professionally.',
    'Say that you will wrap up the interview here and review the learning points.',
    'Do not give the full implementation answer.',
    'Keep it to at most 2 short sentences.',
  ];

  if (params.runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(params.runtimeContext, 'compact'));
  }

  return parts.join('\n');
}

function buildSafeAnswerPressureResponse(params: {
  candidateMessage: string;
  pressureTurns: number;
  shouldWrapUp: boolean;
  willMoveToWrapup: boolean;
}): string {
  const useChinese = /[\u3400-\u9fff]/u.test(params.candidateMessage);
  if (params.willMoveToWrapup) {
    return useChinese
      ? '我们先到这里，不再继续追问最优实现了。接下来进入总结阶段，回顾你目前方案的复杂度和可以改进的方向。'
      : "We'll stop pushing the optimized implementation here. Let's move to wrapup and review the complexity and improvement direction from your current approach.";
  }
  if (params.shouldWrapUp) {
    return useChinese
      ? '我们先不继续逼出最优做法了。你可以最后再试一次，或者我们现在进入总结，回顾目前思路的优缺点。'
      : "Let's not force the optimized approach further right now. You can take one final attempt, or we can move to wrapup and review the tradeoffs from your current approach.";
  }
  if (params.pressureTurns >= 2) {
    return useChinese
      ? '我不会直接给出算法或实现细节。先用你已经能说明白的做法写出来，然后告诉我它最耗时的重复工作在哪里。'
      : "I won't give you the algorithm or implementation details directly. Start with the approach you can explain, then tell me where the repeated work happens.";
  }
  return useChinese
    ? '先不要急着要答案。你从暴力做法出发，告诉我哪一步重复检查最多，以及如果想减少重复，需要记住哪类信息。'
    : "Don't jump straight to the answer. Starting from brute force, tell me which check is repeated most often and what kind of information would reduce that repetition.";
}

function buildPassingOptimizationGuardResponse(candidateMessage: string): string {
  const useChinese = /[\u3400-\u9fff]/u.test(candidateMessage);
  return useChinese
    ? '你已经有一个通过测试的方案了。作为面试官，我不会直接给出优化实现；请你先指出当前重复遍历中最浪费的一步，以及如果想少做重复检查，需要在遍历过程中记住哪类信息。'
    : "You already have a passing solution. As the interviewer, I won't prescribe the optimized implementation; first identify the most wasteful repeated check in your current loops, and what kind of information you would need to remember while scanning.";
}

function hasRepeatedLoopStructure(code: string): boolean {
  return (code.match(/\b(for|while)\b/gi)?.length ?? 0) >= 2;
}

function buildSubmissionReviewKey(context: AiInterviewerContextResponse): string | null {
  const latest = context.latestSubmission;
  if (!latest) {
    return null;
  }
  return [
    latest.submittedAt,
    latest.status,
    latest.passedTestCases,
    latest.totalTestCases,
    latest.failedTestCases,
    latest.errorTestCases,
  ].join(':');
}

function buildSubmissionReviewResponse(params: {
  context: AiInterviewerContextResponse;
  interfaceLanguage?: string;
}): string {
  const latest = params.context.latestSubmission;
  const useChinese = isChineseLanguageHint(params.interfaceLanguage);
  if (!latest) {
    return useChinese
      ? '我看到你刚提交了代码，但还没有拿到完整结果。我们先基于当前代码继续讨论复杂度和边界情况。'
      : "I see that you submitted, but I don't have a complete result yet. Let's continue from the current code and discuss complexity and edge cases.";
  }

  if (latest.status !== 'completed') {
    return useChinese
      ? `我看到你的提交状态是 ${latest.status}。等结果完成后，我会基于通过情况和当前代码继续追问。`
      : `I see your submission is ${latest.status}. Once the result completes, I will review the outcome and current code.`;
  }

  const passedAll = latest.totalTestCases > 0 && latest.passedTestCases === latest.totalTestCases;
  const reviewedCode = latest.code || params.context.currentCode.code;
  if (passedAll) {
    if (hasRepeatedLoopStructure(reviewedCode)) {
      return useChinese
        ? `我看到这次提交通过了全部 ${latest.totalTestCases} 个测试。你提交的代码是重复遍历型方案，正确性在这些用例上没有问题；请你简短说明它的时间复杂度，以及在题目约束下这个取舍是否可以接受，然后我们准备进入总结。`
        : `I see your submitted code passed all ${latest.totalTestCases} test cases. The code you submitted is a repeated-iteration solution, and it is correct for these tests; briefly state its time complexity and whether that tradeoff is acceptable for the constraints, then we can move toward wrapup.`;
    }
    return useChinese
      ? `我看到这次提交通过了全部 ${latest.totalTestCases} 个测试。请你简短说明最终复杂度和核心正确性理由，然后我们准备进入总结。`
      : `I see your submission passed all ${latest.totalTestCases} test cases. Briefly explain the final complexity and the core correctness argument, then we can move toward wrapup.`;
  }

  return useChinese
    ? `我看到这次提交通过了 ${latest.passedTestCases}/${latest.totalTestCases} 个测试。先不要换到全新的实现，回到当前代码：哪个假设最可能导致剩余用例失败？`
    : `I see your submission passed ${latest.passedTestCases}/${latest.totalTestCases} test cases. Do not jump to a new implementation yet; in your current code, which assumption is most likely causing the remaining case to fail?`;
}

function buildRepeatedNonPassingSubmissionBoundaryResponse(params: {
  context: AiInterviewerContextResponse;
  guidanceTurns: number;
  interfaceLanguage?: string;
}): string {
  const useChinese = isChineseLanguageHint(params.interfaceLanguage);
  const latest = params.context.latestSubmission;
  const resultSegment = latest
    ? `${latest.passedTestCases}/${latest.totalTestCases}`
    : 'not fully passing';
  if (useChinese) {
    return `我们已经做了 ${params.guidanceTurns} 轮调试引导，最新提交仍然是 ${resultSegment}。你可以最后再尝试一次，或者我们现在进入总结，回顾当前方案的问题。`;
  }
  return `We have already done ${params.guidanceTurns} debugging passes, and the latest submission is still ${resultSegment}. You can take one final attempt, or we can move to wrapup and review the issue in your current approach.`;
}

function buildCodingPhaseKickoffInstructions(params: {
  candidateMessage?: string;
  rememberedContext?: AiInterviewerContext;
  runtimeContext?: AiInterviewerContextResponse;
}): string {
  const parts = [
    'Coding phase kickoff turn (follow strictly):',
    '1) Say warmup is complete and that coding phase is starting now.',
    "2) Use wording similar to: 'Sounds good, let's start the coding phase now. You can begin implementing.'",
    '3) State that you will challenge reasoning and not provide direct final answers.',
    '4) Keep this concise and interviewer-like.',
    'HARD ANTI-LEAKAGE RULES FOR THIS TURN:',
    '- Do NOT name any data structure, algorithm, or technique for the active problem.',
    '- Do NOT describe what the solution should store, look up, check, or iterate over.',
    "- Do NOT use lead-ins like 'one approach is', 'you could use', 'a common way is', 'consider using'.",
    'STOP IMMEDIATELY after the brief kickoff. Do not continue with hints or strategy.',
  ];
  if (params.candidateMessage) {
    parts.push(`Recent candidate message: ${params.candidateMessage}`);
  }
  if (params.rememberedContext) {
    parts.push(buildCompactInterviewContextReminder(params.rememberedContext));
  }
  if (params.runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(params.runtimeContext, 'compact'));
  }
  return parts.join('\n');
}

function buildWrapupPhaseKickoffInstructions(params: {
  rememberedContext?: AiInterviewerContext;
  runtimeContext?: AiInterviewerContextResponse;
}): string {
  const latest = params.runtimeContext?.latestSubmission;
  const passingAll =
    latest &&
    latest.status === 'completed' &&
    latest.totalTestCases > 0 &&
    latest.passedTestCases === latest.totalTestCases;
  const outcomeGuidance = latest
    ? passingAll
      ? `Latest submission passed all ${latest.totalTestCases} tests — open with sincere positive acknowledgement (e.g. "great work").`
      : `Latest submission passed ${latest.passedTestCases}/${latest.totalTestCases} tests — open with measured, respectful acknowledgement (e.g. "good effort", "nice work pushing through this"); do NOT overpraise as if everything passed.`
    : 'No completed submission on record — acknowledge the effort honestly without claiming the solution was finished.';

  const parts = [
    'Wrapup phase kickoff turn (follow strictly):',
    '1) Open by acknowledging that the interview is moving into the wrapup phase.',
    `2) ${outcomeGuidance}`,
    '3) Give a brief overall assessment of the candidate (1-2 sentences) grounded in the submitted code and submission stats: cover correctness and approach. Avoid revealing optimized algorithms or implementation details the candidate did not already state or write.',
    '4) Explicitly invite the candidate to share any final reflections, questions, or anything they would like to discuss before ending.',
    '5) Keep the whole turn to roughly 3-5 sentences. Interviewer tone, warm but professional.',
    '6) Do not request another phase transition in this turn — wrapup ends only when the candidate explicitly signs off.',
  ];
  if (params.rememberedContext) {
    parts.push(buildCompactInterviewContextReminder(params.rememberedContext));
  }
  if (params.runtimeContext) {
    parts.push(buildLiveRoomContextInstructions(params.runtimeContext, 'detailed'));
  }
  return parts.join('\n');
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

function isDirectAnswerRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('give me the answer') ||
    normalized.includes('just tell me the answer') ||
    normalized.includes('tell me exactly') ||
    normalized.includes('tell me how exactly') ||
    normalized.includes('exactly how') ||
    normalized.includes('show me step by step') ||
    normalized.includes('walk me through the solution') ||
    normalized.includes('guide me through making it better') ||
    normalized.includes('guide me through the better solution') ||
    normalized.includes('what should we use') ||
    normalized.includes('what should i use') ||
    normalized.includes('tell me how to solve') ||
    normalized.includes('how should i solve') ||
    normalized.includes('what approach should i use') ||
    normalized.includes('which algorithm') ||
    normalized.includes('what algorithm') ||
    normalized.includes('which data structure') ||
    normalized.includes('what data structure') ||
    normalized.includes('which data type') ||
    normalized.includes('what data type') ||
    normalized.includes('solve it for me') ||
    normalized.includes('write the code for me') ||
    normalized.includes('不知道用什么算法') ||
    normalized.includes('用什么算法') ||
    normalized.includes('用什么数据结构') ||
    normalized.includes('直接告诉') ||
    normalized.includes('给我答案') ||
    normalized.includes('告诉我怎么做') ||
    normalized.includes('一步一步教我') ||
    normalized.includes('直接给代码')
  );
}

function isOptimizationRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('make it better') ||
    normalized.includes('make this better') ||
    normalized.includes('refine the solution') ||
    normalized.includes('refine this solution') ||
    normalized.includes('improve the solution') ||
    normalized.includes('optimize') ||
    normalized.includes('more efficient') ||
    normalized.includes('better complexity') ||
    normalized.includes('更优') ||
    normalized.includes('优化') ||
    normalized.includes('提高效率')
  );
}

function isCandidateUnableToFindStrategy(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("couldn't think") ||
    normalized.includes('could not think') ||
    normalized.includes("can't think") ||
    normalized.includes('cannot think') ||
    normalized.includes("couldn't come up") ||
    normalized.includes('could not come up') ||
    normalized.includes("don't know another strategy") ||
    normalized.includes('do not know another strategy') ||
    normalized.includes("don't know the strategy") ||
    normalized.includes('do not know the strategy') ||
    normalized.includes("don't know the algorithm") ||
    normalized.includes('do not know the algorithm') ||
    normalized.includes('no idea what to use') ||
    normalized.includes('想不出来') ||
    normalized.includes('不知道其他方法') ||
    normalized.includes('不知道策略') ||
    normalized.includes('不知道算法')
  );
}

function mentionsBroadApproach(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('hash map') ||
    normalized.includes('hashmap') ||
    normalized.includes('dictionary') ||
    normalized.includes('dict') ||
    normalized.includes('map structure') ||
    normalized.includes('two pointer') ||
    normalized.includes('two-pointer') ||
    normalized.includes('binary search') ||
    normalized.includes('哈希') ||
    normalized.includes('字典') ||
    normalized.includes('双指针') ||
    normalized.includes('二分')
  );
}

function isExplicitGiveUp(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('i give up') ||
    normalized.includes("i don't know anymore") ||
    normalized.includes('i am stuck') ||
    normalized.includes("i can't do it") ||
    normalized.includes('i cannot do it') ||
    normalized.includes("i don't think i can do it") ||
    normalized.includes('i have no idea') ||
    normalized.includes("i don't know what to do") ||
    normalized.includes('放弃') ||
    normalized.includes('我不会了') ||
    normalized.includes('我做不出来') ||
    normalized.includes('我不知道怎么做') ||
    normalized.includes('告诉我答案吧')
  );
}

function isDiscouragedCandidateMessage(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    isExplicitGiveUp(text) ||
    normalized.includes('this is too hard') ||
    normalized.includes("i don't think this works") ||
    normalized.includes("i'm lost") ||
    normalized.includes('i am lost') ||
    normalized.includes('算了') ||
    normalized.includes('太难了') ||
    normalized.includes('没思路') ||
    normalized.includes('没有思路')
  );
}

function isContinueAttemptIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('one more') ||
    normalized.includes('try again') ||
    normalized.includes('continue') ||
    normalized.includes('keep going') ||
    normalized.includes('再试') ||
    normalized.includes('继续') ||
    normalized.includes('再来一次')
  );
}

function isCodeOrSubmissionReviewRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('review my code') ||
    normalized.includes('check my code') ||
    normalized.includes('review the submission') ||
    normalized.includes('check submission') ||
    normalized.includes('look at my code') ||
    normalized.includes('看我的代码') ||
    normalized.includes('检查我的代码') ||
    normalized.includes('看一下提交') ||
    normalized.includes('检查提交结果')
  );
}

function isContextRefreshRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('retrieve the code context') ||
    normalized.includes('get the code context') ||
    normalized.includes('fetch the code context') ||
    normalized.includes('check the latest code context') ||
    normalized.includes('refresh context') ||
    normalized.includes('获取代码上下文') ||
    normalized.includes('重新获取上下文') ||
    normalized.includes('再获取一次上下文')
  );
}

function isReadyToCodeIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('start coding') ||
    normalized.includes('let me code') ||
    normalized.includes('i will code now') ||
    normalized.includes('开始写代码') ||
    normalized.includes('我来写代码') ||
    normalized.includes('进入编码')
  );
}

function isEndInterviewIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('end session') ||
    normalized.includes('end the interview') ||
    normalized.includes('stop the interview') ||
    normalized.includes('thank you for the interview') ||
    normalized.includes('goodbye') ||
    normalized.includes('结束面试') ||
    normalized.includes('结束会话') ||
    normalized.includes('谢谢面试') ||
    normalized.includes('再见')
  );
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
  const normalized = timestamp?.trim().replace(/[),.;]+$/u, '');
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

function buildReasonSpecificInstructions(
  reason: AiInterviewerSignalReason,
  summary: string | undefined,
): string {
  switch (reason) {
    case 'session_joined':
      return [
        'Kick off naturally: greet briefly, introduce the problem context, then ask one opening interview question.',
        'Do not ask company HR-style questions unless the candidate explicitly asks for that format.',
      ].join('\n');
    case 'stage_changed':
      return [
        'Adjust tone for the new stage and keep interview progression coherent.',
        'Do not repeat the previous phase. Make the new phase expectations clear once.',
        'If stage changed to coding, announce that the candidate can start coding now and keep strict interviewer behavior.',
      ].join('\n');
    case 'user_idle':
      return [
        'User appears quiet/idle.',
        'Only speak if a short nudge adds clear value. Otherwise stay silent.',
        'Never interrupt focused coding just to fill silence.',
      ].join('\n');
    case 'hint_used':
      return 'A hint was used. Prefer one concise check-in question instead of a long explanation.';
    case 'code_ran': {
      const run = parseRunSummary(summary);
      if (run && run.passed === run.total) {
        return 'Visible run passed fully. Usually remain quiet unless a brief optimization prompt is warranted.';
      }
      return 'A run finished with non-passing tests. Ask one targeted debugging question, not a full solution.';
    }
    case 'code_submitted':
      return [
        'Submission finished. This is a strong cue to speak as the interviewer.',
        'Start by saying you see that the candidate submitted a run.',
        'Fetch fresh context if needed and evaluate the actual outcome.',
        'If the solution is passing or the review is complete, summarize the assessment and steer toward wrapup instead of asking more coding questions.',
        'If it is failing, ask at most one targeted debugging question or give one concise next step without giving away the full fix.',
        'The debugging question must not name a new exact data structure, loop shape, or implementation condition for the candidate.',
      ].join('\n');
    case 'manual_nudge':
      return 'User explicitly asked for interviewer input. Respond clearly and directly.';
    default:
      return 'Respond naturally and stay concise.';
  }
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
  if (!latest || latest.status !== 'completed' || latest.totalTestCases <= 0) {
    return false;
  }
  return latest.passedTestCases < latest.totalTestCases;
}

function isPassingSubmission(context: AiInterviewerContextResponse | undefined): boolean {
  const latest = context?.latestSubmission;
  if (!latest || latest.status !== 'completed' || latest.totalTestCases <= 0) {
    return false;
  }
  return latest.passedTestCases === latest.totalTestCases;
}

function matchesExpectedSubmission(
  latest: AiInterviewerContextResponse['latestSubmission'],
  expected: ParsedSubmissionSignalSummary,
): boolean {
  if (
    !latest ||
    latest.totalTestCases !== expected.totalTestCases ||
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

function shouldRespondToSystemSignal(params: {
  signal: Extract<AiInterviewerSignalPayload, { type: 'system_signal' }>;
  now: number;
  signalLastSentAt: Map<AiInterviewerSignalReason, number>;
  lastSystemReplyAt: number;
  hasInterviewStarted: boolean;
  lastUserTurnAt: number;
  lastAssistantTurnAt: number;
}): boolean {
  const {
    signal,
    now,
    signalLastSentAt,
    lastSystemReplyAt,
    hasInterviewStarted,
    lastUserTurnAt,
    lastAssistantTurnAt,
  } = params;

  if (signal.reason === 'manual_nudge') {
    return true;
  }

  if (signal.reason === 'session_joined') {
    return !hasInterviewStarted;
  }

  const previousForReason = signalLastSentAt.get(signal.reason) ?? 0;
  const minInterval = SIGNAL_REASON_MIN_INTERVAL_MS[signal.reason];
  if (now - previousForReason < minInterval) {
    return false;
  }
  if (
    signal.reason !== 'code_submitted' &&
    now - lastSystemReplyAt < SYSTEM_SIGNAL_GLOBAL_MIN_INTERVAL_MS
  ) {
    return false;
  }

  switch (signal.reason) {
    case 'user_idle':
      if (lastUserTurnAt <= 0) {
        return false;
      }
      if (now - lastUserTurnAt < 3 * 60_000) {
        return false;
      }
      return now - lastAssistantTurnAt >= 4 * 60_000;
    case 'code_ran': {
      if (now - lastAssistantTurnAt < 2 * 60_000) {
        return false;
      }
      const run = parseRunSummary(signal.summary);
      if (!run) {
        return true;
      }
      return run.passed < run.total;
    }
    case 'hint_used':
      return now - lastAssistantTurnAt >= 90_000;
    case 'stage_changed':
      return now - lastAssistantTurnAt >= 45_000;
    case 'code_submitted':
      return now - lastAssistantTurnAt >= 5_000;
    default:
      return true;
  }
}

const agent = defineAgent({
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

    const session = createInterviewSession();
    const systemInstructions = createInterviewerInstructions();
    const seenTurnIds = new Set<string>();
    const signalLastSentAt = new Map<AiInterviewerSignalReason, number>();
    const pendingInlineComments: Array<{ line: number; comment: string }> = [];
    let lastUserSpeakerId: string | null = participantUserId ?? null;
    let latestInterviewContext: AiInterviewerContext | undefined;
    let latestRuntimeRoomContext: AiInterviewerContextResponse | undefined;
    let preferredInterfaceLanguage: string | undefined;
    let warmupFlowState: WarmupFlowState = 'not_started';
    let warmupAssistantTurnCount = 0;
    let warmupKickoffInFlight = false;
    let warmupAwaitingCandidateAnswerForTransition = false;
    let warmupAutoTransitionInFlight = false;
    let warmupTransitionPendingAfterAssistant = false;
    let warmupTransitionReason = 'Warmup question cap reached';
    let queuedPhaseTransitionAfterAssistant: {
      targetStatus: RoomPhaseStatus;
      reason?: string;
    } | null = null;
    let queuedPhaseTransitionInFlight = false;
    let codingKickoffAnnounced = false;
    let wrapupKickoffAnnounced = false;
    let hasInterviewStarted = false;
    let lastUserTurnAt = 0;
    let lastAssistantTurnAt = 0;
    let lastSystemReplyAt = 0;
    let nonPassingGuidanceTurnCount = 0;
    let discouragedTurnCount = 0;
    let lastNonPassingSubmissionKey: string | null = null;
    let lastReviewedSubmissionKey: string | null = null;
    let suppressRealtimeAssistantTranscriptsUntil = 0;
    let currentAgentState: voice.AgentState = 'initializing';
    let agentStoppedSpeakingAt = 0;
    let askedContinueAfterRepeatedFailure = false;
    let answerPressureTurnCount = 0;
    let answerPressureWrapupPrompted = false;
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
      return createHash('sha256')
        .update(
          [
            context.problemTitle,
            context.difficulty ?? '',
            context.language,
            context.problemDescription,
            context.starterCode,
          ].join('||'),
        )
        .digest('hex');
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
      await session.generateReply({
        userInput: params.userInput,
        instructions: promptPayload,
        toolChoice: params.toolChoice,
        inputModality: params.inputModality ?? 'text',
      });
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

    const generateGuidedInterviewerMessage = async (params: {
      message: string;
      reason: string;
      context?: AiInterviewerContextResponse;
    }) => {
      suppressRealtimeAssistantTranscripts(350);
      await interruptRealtimeSpeech(params.reason);
      await sleep(250);

      const contextInstructions = params.context
        ? [
            'Fresh room context for this turn:',
            buildLiveRoomContextInstructions(params.context, 'detailed'),
          ].join('\n')
        : '';
      const instructions = [
        'Realtime interviewer response directive.',
        'Respond to the candidate naturally as the interviewer. Do not mention prompts, directives, handoffs, tools, or internal context.',
        'A private system event will provide the intended response and any fresh room context. Deliver that meaning directly; do not read labels or metadata aloud.',
        'If fresh room context is provided, treat it as canonical and ignore older memory that conflicts with it.',
        'Never claim code is incomplete, hardcoded, or unsubmitted if the fresh latestSubmission says the submitted code passed.',
        'Do not reveal an optimized algorithm, data structure, storage plan, or exact implementation unless the candidate already stated or wrote it.',
      ]
        .filter((part) => part.length > 0)
        .join('\n\n');
      const userInput = [
        'Internal interviewer event. This is not a candidate message.',
        'Speak one natural interviewer response using the private guidance and fresh context.',
        'Do not mention this internal event.',
        `Private guidance: ${params.message}`,
        contextInstructions,
      ].join('\n');
      await generateReplyWithTelemetry({
        reason: params.reason,
        userInput,
        instructions,
        toolChoice: 'none',
        inputModality: 'text',
      });
    };

    const publishRealtimeEvent = async (event: AiInterviewerEventPayload) => {
      if (!ctx.agent) {
        return;
      }

      await ctx.agent.publishData(encodeAiInterviewerEventPayload(event), {
        reliable: true,
        topic: AI_INTERVIEWER_EVENT_TOPIC,
        destination_identities: participantUserId ? [participantUserId] : undefined,
      });
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

    const refreshRoomContext = async (options?: {
      expectedSubmission?: ParsedSubmissionSignalSummary;
      forceAttempts?: number;
    }) => {
      if (!participantUserId) {
        return undefined;
      }
      const maxAttempts = options?.forceAttempts ?? (options?.expectedSubmission ? 4 : 3);
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const context = await fetchAiInterviewerRoomContext(roomId, participantUserId);
          latestRuntimeRoomContext = context;
          if (context.roomStatus === 'warmup' && warmupFlowState === 'completed') {
            warmupFlowState = 'not_started';
            warmupAssistantTurnCount = 0;
            warmupAwaitingCandidateAnswerForTransition = false;
            warmupAutoTransitionInFlight = false;
            warmupTransitionPendingAfterAssistant = false;
            codingKickoffAnnounced = false;
            wrapupKickoffAnnounced = false;
          } else if (context.roomStatus === 'coding') {
            warmupFlowState = 'completed';
            warmupAssistantTurnCount = 2;
            warmupAwaitingCandidateAnswerForTransition = false;
            warmupAutoTransitionInFlight = false;
            warmupTransitionPendingAfterAssistant = false;
            wrapupKickoffAnnounced = false;
          } else if (context.roomStatus === 'wrapup' || context.roomStatus === 'finished') {
            warmupFlowState = 'completed';
            warmupAssistantTurnCount = 2;
            warmupAwaitingCandidateAnswerForTransition = false;
            warmupAutoTransitionInFlight = false;
            warmupTransitionPendingAfterAssistant = false;
            codingKickoffAnnounced = true;
            if (context.roomStatus === 'finished') {
              wrapupKickoffAnnounced = true;
            }
          }
          const interviewContext = toRealtimeInterviewContext(context);
          if (interviewContext) {
            latestInterviewContext = interviewContext;
            refreshPromptCachePrefix();
          }

          const expected = options?.expectedSubmission;
          if (isPassingSubmission(context)) {
            nonPassingGuidanceTurnCount = 0;
            discouragedTurnCount = 0;
            lastNonPassingSubmissionKey = null;
            askedContinueAfterRepeatedFailure = false;
            answerPressureTurnCount = 0;
            answerPressureWrapupPrompted = false;
          }
          if (!expected) {
            return context;
          }
          if (matchesExpectedSubmission(context.latestSubmission, expected)) {
            return context;
          }

          if (attempt < maxAttempts) {
            await sleep(300);
            continue;
          }
          return context;
        } catch (error) {
          if (attempt === maxAttempts) {
            console.warn(
              `[ai-interviewer-worker] failed to refresh room context for room ${roomId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
          if (attempt < maxAttempts) {
            await sleep(250);
            continue;
          }
          return undefined;
        }
      }
      return undefined;
    };

    const markPhaseTransitionState = (targetStatus: RoomPhaseStatus) => {
      if (targetStatus === 'coding') {
        warmupFlowState = 'completed';
        warmupAssistantTurnCount = 2;
        warmupAwaitingCandidateAnswerForTransition = false;
        warmupTransitionPendingAfterAssistant = false;
        codingKickoffAnnounced = true;
      }
      if (targetStatus === 'wrapup' || targetStatus === 'finished') {
        codingKickoffAnnounced = true;
      }
      if (targetStatus === 'finished') {
        wrapupKickoffAnnounced = true;
      }
    };

    const transitionWarmupToCoding = async (reason: string): Promise<boolean> => {
      if (!participantUserId) {
        return false;
      }
      const runtimeContext = (await refreshRoomContext()) ?? latestRuntimeRoomContext;
      if (!runtimeContext || runtimeContext.roomStatus !== 'warmup') {
        return runtimeContext?.roomStatus === 'coding';
      }
      try {
        await requestAiInterviewerPhaseTransition({
          roomId,
          participantId: participantUserId,
          targetStatus: 'coding',
          reason,
        });
        await refreshRoomContext();
        markPhaseTransitionState('coding');
        return true;
      } catch (error) {
        console.warn(
          `[ai-interviewer-worker] warmup->coding transition failed for room ${roomId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return false;
      }
    };

    const queueWarmupTransitionAfterAssistant = (reason: string): boolean => {
      if (
        warmupAutoTransitionInFlight ||
        warmupTransitionPendingAfterAssistant ||
        codingKickoffAnnounced
      ) {
        return false;
      }
      warmupTransitionReason = reason;
      warmupTransitionPendingAfterAssistant = true;
      warmupAwaitingCandidateAnswerForTransition = false;
      return true;
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
            markPhaseTransitionState(queued.targetStatus);
            return;
          }
          await requestAiInterviewerPhaseTransition({
            roomId,
            participantId: participantUserId,
            targetStatus: queued.targetStatus,
            reason: queued.reason,
          });
          await refreshRoomContext();
          markPhaseTransitionState(queued.targetStatus);
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

    const transitionQueuedWarmupAfterAssistant = () => {
      if (
        !warmupTransitionPendingAfterAssistant ||
        warmupAutoTransitionInFlight ||
        codingKickoffAnnounced
      ) {
        return;
      }
      warmupAutoTransitionInFlight = true;
      void (async () => {
        try {
          const transitioned = await transitionWarmupToCoding(warmupTransitionReason);
          if (!transitioned) {
            warmupTransitionPendingAfterAssistant = false;
            return;
          }
          warmupFlowState = 'completed';
          warmupAssistantTurnCount = 2;
          warmupAwaitingCandidateAnswerForTransition = false;
          warmupTransitionPendingAfterAssistant = false;
          codingKickoffAnnounced = true;
        } finally {
          warmupAutoTransitionInFlight = false;
        }
      })();
    };

    const startWarmupKickoffIfNeeded = async (reason: string) => {
      if (warmupKickoffInFlight || warmupFlowState !== 'not_started' || hasInterviewStarted) {
        return;
      }

      warmupKickoffInFlight = true;
      try {
        const runtimeContext =
          (await refreshRoomContext({ forceAttempts: 4 })) ?? latestRuntimeRoomContext;
        if (
          runtimeContext?.roomStatus !== 'warmup' ||
          warmupFlowState !== 'not_started' ||
          hasInterviewStarted
        ) {
          return;
        }

        const scriptedNow = Date.now();
        lastSystemReplyAt = scriptedNow;
        signalLastSentAt.set('session_joined', scriptedNow);
        warmupFlowState = 'kickoff_sent';
        await generateReplyWithTelemetry({
          reason,
          instructions: buildWarmupKickoffInstructions({
            rememberedContext: latestInterviewContext,
            runtimeContext,
            interfaceLanguage: preferredInterfaceLanguage,
          }),
        });
      } finally {
        warmupKickoffInFlight = false;
      }
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

      const signal: Extract<AiInterviewerSignalPayload, { type: 'user_text' }> = {
        type: 'user_text',
        text: content,
        ...(params.language ? { language: params.language } : {}),
        ...(params.latestSubmissionSummary
          ? { latestSubmissionSummary: params.latestSubmissionSummary }
          : {}),
      };

      const runtimeContext =
        (await refreshRoomContext({
          forceAttempts: isContextRefreshRequest(content) ? 5 : 3,
        })) ?? latestRuntimeRoomContext;

      const isPreWrapupAnswerPressure =
        runtimeContext?.roomStatus !== 'wrapup' &&
        runtimeContext?.roomStatus !== 'finished' &&
        (isDirectAnswerRequest(content) || isCandidateUnableToFindStrategy(content));
      if (isPreWrapupAnswerPressure) {
        answerPressureTurnCount += 1;
        const shouldWrapUp = answerPressureTurnCount >= 3;
        const willMoveToWrapup = answerPressureWrapupPrompted && answerPressureTurnCount >= 4;
        if (willMoveToWrapup && runtimeContext?.roomStatus === 'coding') {
          queuePhaseTransitionAfterAssistant(
            'wrapup',
            'Candidate repeatedly requested answer or could not identify strategy',
          );
        }
        if (shouldWrapUp) {
          answerPressureWrapupPrompted = true;
        }
        await generateGuidedInterviewerMessage({
          reason: 'answer_pressure_guard',
          message: buildSafeAnswerPressureResponse({
            candidateMessage: content,
            pressureTurns: answerPressureTurnCount,
            shouldWrapUp,
            willMoveToWrapup,
          }),
        });
        return;
      }

      if (
        runtimeContext?.roomStatus === 'coding' &&
        isPassingSubmission(runtimeContext) &&
        (isOptimizationRequest(content) || isDirectAnswerRequest(content))
      ) {
        answerPressureTurnCount += 1;
        await generateGuidedInterviewerMessage({
          reason: 'passing_solution_optimization_guard',
          message: buildPassingOptimizationGuardResponse(content),
          context: runtimeContext,
        });
        return;
      }

      const hasNonPassingCodingSubmission =
        runtimeContext?.roomStatus === 'coding' && isNonPassingSubmission(runtimeContext);
      if (hasNonPassingCodingSubmission && isContinueAttemptIntent(content)) {
        askedContinueAfterRepeatedFailure = false;
        discouragedTurnCount = 0;
        nonPassingGuidanceTurnCount = Math.min(nonPassingGuidanceTurnCount, 4);
      }
      if (hasNonPassingCodingSubmission && isDiscouragedCandidateMessage(content)) {
        discouragedTurnCount += 1;
      }
      if (
        hasNonPassingCodingSubmission &&
        (isDirectAnswerRequest(content) ||
          mentionsBroadApproach(content) ||
          isCodeOrSubmissionReviewRequest(content) ||
          isContextRefreshRequest(content) ||
          isDiscouragedCandidateMessage(content))
      ) {
        nonPassingGuidanceTurnCount += 1;
      }

      if (
        hasNonPassingCodingSubmission &&
        discouragedTurnCount >= 3 &&
        !queuedPhaseTransitionAfterAssistant
      ) {
        queuePhaseTransitionAfterAssistant(
          'wrapup',
          'Candidate remained stuck after repeated guidance',
        );
        await generateReplyWithTelemetry({
          reason: 'wrapup_after_repeated_stuck',
          instructions: buildWrapupAfterRepeatedStuckInstructions({
            candidateMessage: content,
            discouragedTurns: discouragedTurnCount,
            runtimeContext,
          }),
        });
        return;
      }

      if (
        hasNonPassingCodingSubmission &&
        nonPassingGuidanceTurnCount >= 5 &&
        !askedContinueAfterRepeatedFailure
      ) {
        askedContinueAfterRepeatedFailure = true;
        await generateReplyWithTelemetry({
          reason: 'repeated_nonpassing_guidance_boundary',
          instructions: buildRepeatedNonPassingGuidanceInstructions({
            candidateMessage: content,
            guidanceTurns: nonPassingGuidanceTurnCount,
            runtimeContext,
          }),
        });
        return;
      }

      if (runtimeContext?.roomStatus === 'warmup') {
        if (isReadyToCodeIntent(content)) {
          const queued = queueWarmupTransitionAfterAssistant(
            'Candidate explicitly requested to start coding',
          );
          if (queued) {
            await generateReplyWithTelemetry({
              reason: 'warmup_explicit_ready_to_code',
              instructions: buildCodingPhaseKickoffInstructions({
                candidateMessage: content,
                rememberedContext: latestInterviewContext,
                runtimeContext,
              }),
            });
            return;
          }
        }

        if (warmupFlowState === 'not_started') {
          warmupFlowState = 'kickoff_sent';
          await generateReplyWithTelemetry({
            reason: 'warmup_turn_1',
            instructions: buildWarmupKickoffInstructions({
              rememberedContext: latestInterviewContext,
              runtimeContext,
              interfaceLanguage: params.language ?? preferredInterfaceLanguage,
            }),
          });
          return;
        }

        if (warmupFlowState === 'kickoff_sent') {
          warmupFlowState = 'followup_sent';
          warmupAwaitingCandidateAnswerForTransition = true;
          await generateReplyWithTelemetry({
            reason: 'warmup_turn_2',
            instructions: buildWarmupFollowupInstructions({
              candidateMessage: content,
              rememberedContext: latestInterviewContext,
              runtimeContext,
            }),
          });
          return;
        }

        if (
          warmupFlowState === 'followup_sent' &&
          warmupAwaitingCandidateAnswerForTransition &&
          !warmupAutoTransitionInFlight
        ) {
          const queued = queueWarmupTransitionAfterAssistant(
            'Warmup follow-up answered by candidate',
          );
          if (queued) {
            await generateReplyWithTelemetry({
              reason: 'warmup_transition_after_final_answer',
              instructions: buildWarmupTransitionAnnouncementInstructions({
                candidateMessage: content,
                rememberedContext: latestInterviewContext,
                runtimeContext,
              }),
            });
          }
          return;
        }
      }

      if (
        isContextRefreshRequest(content) &&
        (runtimeContext?.roomStatus === 'coding' || runtimeContext?.roomStatus === 'wrapup')
      ) {
        if (runtimeContext) {
          await generateReplyWithTelemetry({
            reason: 'context_refresh_with_runtime_context',
            instructions: [
              'Candidate asked you to refresh/review live code context.',
              `Candidate message: ${content}`,
              'You now have the latest room context below. Review using this context directly.',
              'Do not ask the candidate to summarize code unless context is empty.',
              buildLiveRoomContextInstructions(runtimeContext, 'detailed'),
            ].join('\n'),
          });
          return;
        }

        await generateReplyWithTelemetry({
          reason: 'context_refresh_unavailable',
          instructions: [
            'Candidate asked to review live code, but fresh code data is unavailable to you this turn.',
            'Do not mention backend, tool, context retrieval, or implementation details.',
            'Respond as the interviewer with one high-level reasoning question about their intended invariant or latest test outcome.',
          ].join('\n'),
        });
        return;
      }

      const instructions = buildUserTextInstructions(
        signal,
        latestInterviewContext,
        runtimeContext,
      );
      await generateReplyWithTelemetry({
        reason: `user_text_${signal.language ?? 'voice'}`,
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

    const syncSilentLiveContextUpdate = async (
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
          content: buildSilentLiveContextUpdateInstructions({
            context: runtimeContext,
            signal,
          }),
          createdAt: Date.now(),
        });
        await interviewAgent.updateChatCtx(nextChatContext);
        console.debug(
          `[ai-interviewer-worker] silent live context updated room=${roomId} reason=${signal.reason}`,
        );
      } catch (error) {
        console.warn(
          `[ai-interviewer-worker] failed to sync silent live context for room ${roomId}: ${
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

    session.on(voice.AgentSessionEventTypes.UserStateChanged, (event) => {
      void publishRealtimeEvent({
        type: 'user_state',
        state: event.newState,
        occurredAt: event.createdAt,
      });
    });

    session.on(voice.AgentSessionEventTypes.OverlappingSpeech, (event) => {
      void publishRealtimeEvent({
        type: 'overlapping_speech',
        occurredAt: event.detectedAt,
        isInterruption: event.isInterruption,
        probability: event.probability,
      });
    });

    session.on(voice.AgentSessionEventTypes.Error, (event: voice.ErrorEvent) => {
      const message =
        event.error instanceof Error
          ? event.error.message
          : typeof event.error === 'string'
            ? event.error
            : 'AI interviewer error';
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
        lastAssistantTurnAt = event.item.createdAt;
        hasInterviewStarted = true;

        void emitTurn({
          turnId: event.item.id,
          role: 'assistant',
          participantId,
          content,
          occurredAt: event.item.createdAt,
          codeAnnotations: codeAnnotations.length > 0 ? codeAnnotations : undefined,
        });

        void (async () => {
          const runtimeContext = (await refreshRoomContext()) ?? latestRuntimeRoomContext;
          if (queuedPhaseTransitionAfterAssistant) {
            transitionQueuedPhaseAfterAssistant();
            return;
          }
          if (warmupTransitionPendingAfterAssistant && runtimeContext?.roomStatus === 'warmup') {
            transitionQueuedWarmupAfterAssistant();
            return;
          }
          if (runtimeContext?.roomStatus !== 'warmup') {
            return;
          }
          warmupAssistantTurnCount += 1;
          if (warmupAssistantTurnCount >= 2 && warmupFlowState !== 'completed') {
            warmupFlowState = 'followup_sent';
            warmupAwaitingCandidateAnswerForTransition = true;
          }
        })();
      },
    );

    await session.start({
      agent: interviewAgent,
      room: ctx.room,
      inputOptions: {
        participantIdentity: participantUserId,
        closeOnDisconnect: true,
      },
    });

    void refreshRoomContext();

    const onParticipantDisconnected = (participant: { identity?: string }) => {
      if (!participantUserId) {
        return;
      }
      if (participant.identity !== participantUserId) {
        return;
      }
      ctx.shutdown('participant-disconnected');
    };
    ctx.room.on('participantDisconnected', onParticipantDisconnected);
    ctx.addShutdownCallback(async () => {
      ctx.room.off('participantDisconnected', onParticipantDisconnected);
    });

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
        const content = signal.text.trim();
        if (!content) {
          return;
        }
        if (isLikelyAccidentalCandidateMessage(content)) {
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
        if (signal.language) {
          preferredInterfaceLanguage = signal.language;
        }
        void handleCandidateText({
          content,
          language: signal.language,
          latestSubmissionSummary: signal.latestSubmissionSummary,
        });
        return;
      }

      if (signal.type !== 'system_signal') {
        return;
      }
      void (async () => {
        if (signal.reason === 'code_submitted') {
          suppressRealtimeAssistantTranscripts(350);
          await interruptRealtimeSpeech('code_submitted');
        }
        if (signal.language) {
          preferredInterfaceLanguage = signal.language;
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

        if (
          runtimeContextForSignal?.roomStatus === 'waiting' &&
          (signal.reason === 'session_joined' || signal.reason === 'stage_changed')
        ) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            await sleep(250);
            runtimeContextForSignal = (await refreshRoomContext()) ?? runtimeContextForSignal;
            if (runtimeContextForSignal?.roomStatus !== 'waiting') {
              break;
            }
          }
        }

        if (runtimeContextForSignal?.roomStatus === 'waiting' && signal.reason !== 'manual_nudge') {
          return;
        }
        if (runtimeContextForSignal?.roomStatus === 'finished') {
          return;
        }

        if (signal.reason === 'code_ran') {
          if (runtimeContextForSignal) {
            await syncSilentLiveContextUpdate(runtimeContextForSignal, signal);
          }
          return;
        }

        if (
          signal.reason === 'code_submitted' &&
          runtimeContextForSignal?.roomStatus === 'coding'
        ) {
          console.debug(
            `[ai-interviewer-worker] submission context room=${roomId} codeSource=${runtimeContextForSignal.currentCode.source} codeUpdatedAt=${runtimeContextForSignal.currentCode.updatedAt ?? 'none'} latestSubmission=${
              runtimeContextForSignal.latestSubmission
                ? `${runtimeContextForSignal.latestSubmission.passedTestCases}/${runtimeContextForSignal.latestSubmission.totalTestCases}@${runtimeContextForSignal.latestSubmission.submittedAt}`
                : 'none'
            }`,
          );
          const submissionReviewKey = buildSubmissionReviewKey(runtimeContextForSignal);
          if (submissionReviewKey && submissionReviewKey === lastReviewedSubmissionKey) {
            return;
          }
          lastReviewedSubmissionKey = submissionReviewKey;

          if (isPassingSubmission(runtimeContextForSignal)) {
            nonPassingGuidanceTurnCount = 0;
            discouragedTurnCount = 0;
            lastNonPassingSubmissionKey = null;
            askedContinueAfterRepeatedFailure = false;
          } else if (isNonPassingSubmission(runtimeContextForSignal)) {
            const latest = runtimeContextForSignal.latestSubmission;
            const submissionKey = latest
              ? `${latest.submittedAt}:${latest.passedTestCases}/${latest.totalTestCases}`
              : null;
            if (submissionKey && submissionKey !== lastNonPassingSubmissionKey) {
              lastNonPassingSubmissionKey = submissionKey;
              nonPassingGuidanceTurnCount += 1;
            }
            if (nonPassingGuidanceTurnCount >= 5 && !askedContinueAfterRepeatedFailure) {
              askedContinueAfterRepeatedFailure = true;
              const boundaryNow = Date.now();
              lastSystemReplyAt = boundaryNow;
              signalLastSentAt.set(signal.reason, boundaryNow);
              await generateGuidedInterviewerMessage({
                reason: 'repeated_nonpassing_submission_boundary',
                message: buildRepeatedNonPassingSubmissionBoundaryResponse({
                  context: runtimeContextForSignal,
                  guidanceTurns: nonPassingGuidanceTurnCount,
                  interfaceLanguage: preferredInterfaceLanguage,
                }),
                context: runtimeContextForSignal,
              });
              return;
            }
          }

          const reviewNow = Date.now();
          lastSystemReplyAt = reviewNow;
          signalLastSentAt.set(signal.reason, reviewNow);
          await generateGuidedInterviewerMessage({
            reason: 'submission_review',
            message: buildSubmissionReviewResponse({
              context: runtimeContextForSignal,
              interfaceLanguage: preferredInterfaceLanguage,
            }),
            context: runtimeContextForSignal,
          });
          return;
        }

        if (
          runtimeContextForSignal?.roomStatus === 'warmup' &&
          warmupFlowState === 'not_started' &&
          (signal.reason === 'session_joined' || signal.reason === 'stage_changed')
        ) {
          await startWarmupKickoffIfNeeded(`system_${signal.reason}_warmup_kickoff`);
          return;
        }

        if (
          runtimeContextForSignal?.roomStatus === 'coding' &&
          signal.reason === 'stage_changed' &&
          !codingKickoffAnnounced
        ) {
          const scriptedNow = Date.now();
          lastSystemReplyAt = scriptedNow;
          signalLastSentAt.set(signal.reason, scriptedNow);
          codingKickoffAnnounced = true;
          await generateReplyWithTelemetry({
            reason: `system_${signal.reason}_coding_kickoff`,
            instructions: buildCodingPhaseKickoffInstructions({
              rememberedContext: latestInterviewContext,
              runtimeContext: runtimeContextForSignal,
            }),
          });
          return;
        }

        if (
          runtimeContextForSignal?.roomStatus === 'wrapup' &&
          (signal.reason === 'stage_changed' || signal.reason === 'session_joined') &&
          !wrapupKickoffAnnounced
        ) {
          const scriptedNow = Date.now();
          lastSystemReplyAt = scriptedNow;
          signalLastSentAt.set(signal.reason, scriptedNow);
          wrapupKickoffAnnounced = true;
          await generateReplyWithTelemetry({
            reason: `system_${signal.reason}_wrapup_kickoff`,
            instructions: buildWrapupPhaseKickoffInstructions({
              rememberedContext: latestInterviewContext,
              runtimeContext: runtimeContextForSignal,
            }),
          });
          return;
        }

        const now = Date.now();
        if (
          !shouldRespondToSystemSignal({
            signal,
            now,
            signalLastSentAt,
            lastSystemReplyAt,
            hasInterviewStarted,
            lastUserTurnAt,
            lastAssistantTurnAt,
          })
        ) {
          return;
        }

        lastSystemReplyAt = now;
        signalLastSentAt.set(signal.reason, now);

        const instructions = buildSystemSignalInstructions(
          signal,
          latestInterviewContext,
          runtimeContextForSignal,
        );
        await generateReplyWithTelemetry({
          reason: `system_${signal.reason}`,
          instructions,
        });
      })();
    });

    await publishRealtimeEvent({
      type: 'session_ready',
      occurredAt: Date.now(),
    });
    void (async () => {
      await sleep(500);
      await startWarmupKickoffIfNeeded('system_worker_session_ready_warmup_kickoff');
    })();
  },
});

export default agent;

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFilePath) {
  cli.runApp(
    new ServerOptions({
      agent: currentFilePath,
      agentName: env.AI_INTERVIEWER_AGENT_NAME,
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
