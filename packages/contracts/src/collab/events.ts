import { z } from 'zod';
import { defineRoute } from '../route-utils.js';

// Collab-plane -> control-plane
export const snapshotReadyPayloadSchema = z
  .object({
    roomId: z.string().min(1).describe('Room identifier'),
    snapshot: z.array(z.number()).describe('Binary snapshot as JSON array of bytes'),
    code: z.string().describe('Decoded document text content'),
    timestamp: z.number().positive().describe('Epoch timestamp'),
    trigger: z
      .enum(['periodic', 'phase_change', 'submission', 'session_end'])
      .describe('What triggered the snapshot'),
  })
  .strict();

export type SnapshotReadyPayload = z.infer<typeof snapshotReadyPayloadSchema>;
export type SnapshotTrigger = SnapshotReadyPayload['trigger'];

export const userDisconnectedPayloadSchema = z
  .object({
    roomId: z.string().min(1).describe('Room identifier'),
    userId: z.string().min(1).describe('User identifier'),
    timestamp: z.number().positive().describe('Epoch timestamp'),
  })
  .strict();

export type UserDisconnectedPayload = z.infer<typeof userDisconnectedPayloadSchema>;

export const CONTROL_INTERNAL = {
  SNAPSHOT_READY: defineRoute<SnapshotReadyPayload, { success: boolean }>()(
    'internal/collab/snapshot',
    'POST',
  ),
  USER_DISCONNECTED: defineRoute<UserDisconnectedPayload, { success: boolean }>()(
    'internal/collab/user-disconnected',
    'POST',
  ),
};
