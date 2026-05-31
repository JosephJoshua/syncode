import { ROOM_STATUSES, SUPPORTED_LANGUAGES } from '@syncode/shared';
import { z } from 'zod';
import { defineRoute } from '../route-utils.js';

// Collab-plane -> control-plane
export const snapshotReadyPayloadSchema = z
  .object({
    roomId: z.uuid().describe('Room identifier'),
    snapshot: z.array(z.number()).describe('Binary snapshot as JSON array of bytes'),
    code: z.string().describe('Decoded document text content for the active language'),
    language: z
      .enum(SUPPORTED_LANGUAGES)
      .describe('Active programming language at the moment of the snapshot'),
    timestamp: z.number().int().positive().describe('Epoch timestamp (ms)'),
    trigger: z
      .enum(['periodic', 'phase_change', 'submission', 'session_end'])
      .describe('What triggered the snapshot'),
    phase: z
      .enum(ROOM_STATUSES)
      .nullable()
      .describe('Active room phase at the moment of the snapshot. Useful for phase_change events.'),
  })
  .strict();

export type SnapshotReadyPayload = z.infer<typeof snapshotReadyPayloadSchema>;
export type SnapshotTrigger = SnapshotReadyPayload['trigger'];

export interface SnapshotReadyResponse {
  success: boolean;
}

export const userDisconnectedPayloadSchema = z
  .object({
    roomId: z.uuid().describe('Room identifier'),
    userId: z.uuid().describe('User identifier'),
    timestamp: z.number().int().positive().describe('Epoch timestamp (ms)'),
  })
  .strict();

export type UserDisconnectedPayload = z.infer<typeof userDisconnectedPayloadSchema>;

export const authorizeJoinRequestSchema = z
  .object({
    userId: z.uuid().describe('User identifier requesting to join the room'),
  })
  .strict();

export type AuthorizeJoinRequest = z.infer<typeof authorizeJoinRequestSchema>;

export type AuthorizeJoinDenialReason =
  | 'participant-removed'
  | 'not-participant'
  | 'room-finished'
  | 'room-not-found';

export interface AuthorizeJoinResponse {
  authorized: boolean;
  reason?: AuthorizeJoinDenialReason;
}

export const participantHeartbeatRequestSchema = z
  .object({
    participants: z
      .array(
        z
          .object({
            roomId: z.uuid().describe('Room identifier'),
            userId: z.uuid().describe('User identifier'),
          })
          .strict(),
      )
      .describe('Authenticated, alive (roomId, userId) pairs currently connected to collab-plane'),
  })
  .strict();

export type ParticipantHeartbeatRequest = z.infer<typeof participantHeartbeatRequestSchema>;

export interface ParticipantHeartbeatResponse {
  updated: number;
}

// Room identifier is carried in the path parameter; the body only needs the state.
export const persistDocSnapshotPayloadSchema = z
  .object({
    state: z.array(z.number()).describe('Binary Y.Doc state as JSON array of bytes'),
  })
  .strict();

export type PersistDocSnapshotPayload = z.infer<typeof persistDocSnapshotPayloadSchema>;

export interface PersistDocSnapshotResponse {
  success: boolean;
}

export const aiInterviewTranscriptTurnSchema = z
  .object({
    turnId: z
      .string()
      .min(1)
      .max(120)
      .optional()
      .describe('Optional idempotency key for this transcript turn'),
    participantId: z.uuid().describe('Participant user ID associated with this AI session'),
    role: z.enum(['user', 'assistant']).describe('Transcript speaker role'),
    content: z.string().min(1).max(8_000).describe('Transcript text content'),
    audioKey: z
      .string()
      .min(1)
      .max(500)
      .optional()
      .describe('Optional storage key for assistant audio output'),
    timestamp: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional epoch timestamp (ms) for when the turn occurred'),
  })
  .strict();

export const aiInterviewTranscriptPayloadSchema = z
  .object({
    turns: z
      .array(aiInterviewTranscriptTurnSchema)
      .min(1)
      .max(40)
      .describe('One or more transcript turns to persist'),
  })
  .strict();

export type AiInterviewTranscriptPayload = z.infer<typeof aiInterviewTranscriptPayloadSchema>;

export interface AiInterviewTranscriptResponse {
  success: boolean;
  persisted: number;
}

export const aiInterviewerContextRequestSchema = z
  .object({
    participantId: z.uuid().describe('Participant user ID linked to the AI interview session'),
  })
  .strict();

export type AiInterviewerContextRequest = z.infer<typeof aiInterviewerContextRequestSchema>;

export interface AiInterviewerContextResponse {
  roomId: string;
  participantId: string;
  roomStatus: (typeof ROOM_STATUSES)[number];
  language: (typeof SUPPORTED_LANGUAGES)[number];
  problem: {
    title: string;
    description: string;
    difficulty: string | null;
    starterCode: string | null;
  } | null;
  currentCode: {
    code: string;
    language: (typeof SUPPORTED_LANGUAGES)[number];
    source: 'snapshot' | 'submission' | 'starter' | 'unknown';
    updatedAt: string | null;
  };
  latestSubmission: {
    code: string;
    language: (typeof SUPPORTED_LANGUAGES)[number];
    status: 'pending' | 'running' | 'completed' | 'failed';
    passedTestCases: number;
    totalTestCases: number;
    failedTestCases: number;
    errorTestCases: number;
    submittedAt: string;
  } | null;
}

export const aiInterviewerPhaseTransitionRequestSchema = z
  .object({
    participantId: z.uuid().describe('Participant user ID linked to the AI interview session'),
    targetStatus: z.enum(ROOM_STATUSES).describe('Target room status to transition to'),
    reason: z
      .string()
      .min(1)
      .max(240)
      .optional()
      .describe('Optional short rationale for logging/debugging'),
  })
  .strict();

export type AiInterviewerPhaseTransitionRequest = z.infer<
  typeof aiInterviewerPhaseTransitionRequestSchema
>;

export interface AiInterviewerPhaseTransitionResponse {
  roomId: string;
  previousStatus: (typeof ROOM_STATUSES)[number];
  currentStatus: (typeof ROOM_STATUSES)[number];
  transitionedAt: string;
  transitionedBy: string;
}

export const CONTROL_INTERNAL = {
  SNAPSHOT_READY: defineRoute<SnapshotReadyPayload, SnapshotReadyResponse>()(
    'internal/collab/snapshot',
    'POST',
  ),
  USER_DISCONNECTED: defineRoute<UserDisconnectedPayload, { success: boolean }>()(
    'internal/collab/user-disconnected',
    'POST',
  ),
  PARTICIPANT_HEARTBEAT: defineRoute<ParticipantHeartbeatRequest, ParticipantHeartbeatResponse>()(
    'internal/participants/heartbeat',
    'POST',
  ),
  AUTHORIZE_JOIN: defineRoute<AuthorizeJoinRequest, AuthorizeJoinResponse>()(
    'internal/rooms/:roomId/authorize-join',
    'POST',
  ),
  PERSIST_DOC_SNAPSHOT: defineRoute<PersistDocSnapshotPayload, PersistDocSnapshotResponse>()(
    'internal/rooms/:roomId/doc-snapshot',
    'POST',
  ),
  AI_INTERVIEW_TRANSCRIPT: defineRoute<
    AiInterviewTranscriptPayload,
    AiInterviewTranscriptResponse
  >()('internal/rooms/:roomId/ai-transcript', 'POST'),
  AI_INTERVIEWER_CONTEXT: defineRoute<AiInterviewerContextRequest, AiInterviewerContextResponse>()(
    'internal/rooms/:roomId/ai-context',
    'POST',
  ),
  AI_INTERVIEWER_PHASE_TRANSITION: defineRoute<
    AiInterviewerPhaseTransitionRequest,
    AiInterviewerPhaseTransitionResponse
  >()('internal/rooms/:roomId/ai-phase-transition', 'POST'),
};
