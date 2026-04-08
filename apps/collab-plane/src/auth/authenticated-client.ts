import type { WebSocket } from 'ws';
import type { CollabTokenPayload } from './collab-token-payload.js';

/**
 * A WebSocket client with verified user identity attached after authentication.
 * Use this type in downstream message handlers that require an authenticated user.
 */
export interface AuthenticatedClient extends WebSocket {
  user: CollabTokenPayload;
}
