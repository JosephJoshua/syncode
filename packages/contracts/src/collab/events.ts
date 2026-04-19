import { z } from 'zod';
import { defineRoute } from '../route-utils.js';

// Collab-plane -> control-plane
export const snapshotReadyPayloadSchema = z
  .object({
    roomId: z.uuid().describe('Room identifier'),
    snapshot: z.array(z.number()).describe('Binary snapshot as JSON array of bytes'),
    code: z.string().describe('Decoded document text content'),
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

export const persistDocSnapshotPayloadSchema = z
  .object({
    roomId: z.uuid().describe('Room identifier'),
    state: z.array(z.number()).describe('Binary Y.Doc state as JSON array of bytes'),
  })
  .strict();

export type PersistDocSnapshotPayload = z.infer<typeof persistDocSnapshotPayloadSchema>;

export interface PersistDocSnapshotResponse {
  success: boolean;
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
  PERSIST_DOC_SNAPSHOT: defineRoute<PersistDocSnapshotPayload, PersistDocSnapshotResponse>()(
    'internal/rooms/:roomId/doc-snapshot',
    'POST',
  ),
};
