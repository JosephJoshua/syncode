import type { RoomRole } from '@syncode/shared';

/**
 * Shape of the JWT payload signed by control-plane when a user joins a room.
 * Must stay in sync with the signing code in control-plane's RoomsService.
 */
export interface CollabTokenPayload {
  /** userId */
  sub: string;
  /** Authorized room */
  roomId: string;
  /** Participant role in the room */
  role: RoomRole;
  /** Issued-at (epoch seconds, added by JWT library) */
  iat: number;
  /** Expiration (epoch seconds, added by JWT library) */
  exp: number;
}
