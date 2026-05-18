import type {
  AuthorizeJoinResponse,
  ParticipantHeartbeatRequest,
  ParticipantHeartbeatResponse,
  PersistDocSnapshotPayload,
  SnapshotReadyPayload,
  UserDisconnectedPayload,
} from './events.js';

/**
 * Port interface for collab-plane -> control-plane callbacks.
 *
 * Best-effort callers catch delivery errors at the call site. `authorizeJoin`
 * is synchronous in intent: callers await it to make a security decision, so
 * failures must be handled at the call site (default to denying on error).
 */
export interface IControlPlaneCallbackClient {
  notifyUserDisconnected(payload: UserDisconnectedPayload): Promise<void>;
  notifySnapshotReady(payload: SnapshotReadyPayload): Promise<void>;
  heartbeatParticipants(
    request: ParticipantHeartbeatRequest,
  ): Promise<ParticipantHeartbeatResponse | null>;
  authorizeJoin(roomId: string, userId: string): Promise<AuthorizeJoinResponse>;
  persistDocSnapshot(roomId: string, payload: PersistDocSnapshotPayload): Promise<void>;
}

export const CONTROL_PLANE_CALLBACK = Symbol.for('CONTROL_PLANE_CALLBACK');
