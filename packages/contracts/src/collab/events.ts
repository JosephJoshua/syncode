import { SUPPORTED_LANGUAGES } from '@syncode/shared';
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
  })
  .strict();

export type SnapshotReadyPayload = z.infer<typeof snapshotReadyPayloadSchema>;
export type SnapshotTrigger = SnapshotReadyPayload['trigger'];

export const userDisconnectedPayloadSchema = z
  .object({
    roomId: z.uuid().describe('Room identifier'),
    userId: z.uuid().describe('User identifier'),
    timestamp: z.number().int().positive().describe('Epoch timestamp (ms)'),
  })
  .strict();

export type UserDisconnectedPayload = z.infer<typeof userDisconnectedPayloadSchema>;

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

export const CONTROL_INTERNAL = {
  SNAPSHOT_READY: defineRoute<SnapshotReadyPayload, { success: boolean }>()(
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
};
