import { z } from 'zod';

export const AI_INTERVIEWER_SIGNAL_TOPIC = 'syncode.ai-interviewer.signal';
export const AI_INTERVIEWER_EVENT_TOPIC = 'syncode.ai-interviewer.event';

const aiInterviewerSignalReasonSchema = z.enum([
  'session_joined',
  'stage_changed',
  'user_idle',
  'hint_used',
  'code_ran',
  'code_submitted',
  'manual_nudge',
]);

export type AiInterviewerSignalReason = z.infer<typeof aiInterviewerSignalReasonSchema>;

const aiInterviewerContextSchema = z
  .object({
    problemTitle: z.string().min(1).max(200),
    difficulty: z.string().min(1).max(32).optional(),
    problemDescription: z.string().min(1).max(16_000),
    language: z.string().min(1).max(32),
    starterCode: z.string().min(1).max(12_000),
  })
  .strict()
  .readonly();

export type AiInterviewerContext = z.infer<typeof aiInterviewerContextSchema>;

export const aiInterviewerSignalPayloadSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('user_text'),
        text: z.string().min(1).max(2_000),
        language: z.string().min(2).max(24).optional(),
        latestSubmissionSummary: z
          .object({
            status: z.enum(['pending', 'running', 'completed', 'failed']),
            passedTestCases: z.number().int().min(0),
            totalTestCases: z.number().int().min(0),
            failedTestCases: z.number().int().min(0),
            errorTestCases: z.number().int().min(0),
            submittedAt: z.string().datetime(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('system_signal'),
        reason: aiInterviewerSignalReasonSchema,
        summary: z.string().min(1).max(1_200).optional(),
        language: z.string().min(2).max(24).optional(),
        interviewContext: aiInterviewerContextSchema.optional(),
        codeContext: z
          .object({
            file: z.string().min(1).max(120),
            language: z.string().min(1).max(32),
            codeSnippet: z.string().min(1).max(6_000),
            startLine: z.number().int().positive(),
            endLine: z.number().int().positive(),
          })
          .optional(),
      })
      .strict(),
  ])
  .readonly();

export type AiInterviewerSignalPayload = z.infer<typeof aiInterviewerSignalPayloadSchema>;

const aiInterviewerInlineCommentSchema = z
  .object({
    line: z.number().int().positive(),
    comment: z.string().min(1).max(1_000),
  })
  .strict()
  .readonly();

const aiInterviewerEventBaseSchema = z
  .object({
    occurredAt: z.number().int().positive(),
  })
  .strict();

export const aiInterviewerEventPayloadSchema = z
  .discriminatedUnion('type', [
    aiInterviewerEventBaseSchema.extend({
      type: z.literal('session_ready'),
    }),
    aiInterviewerEventBaseSchema.extend({
      type: z.literal('agent_state'),
      state: z.enum(['initializing', 'idle', 'listening', 'thinking', 'speaking']),
    }),
    aiInterviewerEventBaseSchema.extend({
      type: z.literal('user_state'),
      state: z.enum(['speaking', 'listening', 'away']),
    }),
    aiInterviewerEventBaseSchema.extend({
      type: z.literal('transcript_turn'),
      turnId: z.string().min(1).max(120),
      role: z.enum(['user', 'assistant']),
      participantId: z.string().min(1).max(120),
      content: z.string().min(1).max(8_000),
      followUpQuestion: z.string().min(1).max(1_000).optional(),
      codeAnnotations: z.array(aiInterviewerInlineCommentSchema).max(3).optional(),
    }),
    aiInterviewerEventBaseSchema.extend({
      type: z.literal('inline_comment_added'),
      comments: z.array(aiInterviewerInlineCommentSchema).min(1).max(3),
    }),
    aiInterviewerEventBaseSchema.extend({
      type: z.literal('overlapping_speech'),
      isInterruption: z.boolean(),
      probability: z.number().min(0).max(1).optional(),
    }),
    aiInterviewerEventBaseSchema.extend({
      type: z.literal('error'),
      message: z.string().min(1).max(2_000),
    }),
  ])
  .readonly();

export type AiInterviewerEventPayload = z.infer<typeof aiInterviewerEventPayloadSchema>;

function decodeJsonPayload(payload: Uint8Array): unknown {
  const decoder = new TextDecoder();
  const raw = decoder.decode(payload);
  return JSON.parse(raw) as unknown;
}

function encodeJsonPayload(payload: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(payload));
}

export function decodeAiInterviewerSignalPayload(
  payload: Uint8Array,
): AiInterviewerSignalPayload | null {
  try {
    const parsed = decodeJsonPayload(payload);
    return aiInterviewerSignalPayloadSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function encodeAiInterviewerSignalPayload(payload: AiInterviewerSignalPayload): Uint8Array {
  return encodeJsonPayload(payload);
}

export function decodeAiInterviewerEventPayload(
  payload: Uint8Array,
): AiInterviewerEventPayload | null {
  try {
    const parsed = decodeJsonPayload(payload);
    return aiInterviewerEventPayloadSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function encodeAiInterviewerEventPayload(payload: AiInterviewerEventPayload): Uint8Array {
  return encodeJsonPayload(payload);
}
