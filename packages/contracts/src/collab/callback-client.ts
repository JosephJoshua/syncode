import type {
  ParticipantHeartbeatRequest,
  ParticipantHeartbeatResponse,
  SnapshotReadyPayload,
  UserDisconnectedPayload,
} from './events.js';

/**
 * Port interface for collab-plane -> control-plane callbacks.
 * Fire-and-forget so implementations should catch errors internally.
 */
export interface IControlPlaneCallbackClient {
  notifyUserDisconnected(payload: UserDisconnectedPayload): Promise<void>;
  notifySnapshotReady(payload: SnapshotReadyPayload): Promise<void>;
  heartbeatParticipants(
    request: ParticipantHeartbeatRequest,
  ): Promise<ParticipantHeartbeatResponse | null>;
}

export const CONTROL_PLANE_CALLBACK = Symbol.for('CONTROL_PLANE_CALLBACK');
