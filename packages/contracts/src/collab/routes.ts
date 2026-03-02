/** Control-plane -> Collab-plane commands */
export const COLLAB_INTERNAL_ROUTES = {
  CREATE_DOCUMENT: '/internal/documents',
  DESTROY_DOCUMENT: '/internal/documents/:roomId',
  KICK_USER: '/internal/documents/:roomId/kick',
} as const;

/** Collab-plane -> Control-plane events */
export const CONTROL_PLANE_INTERNAL_ROUTES = {
  SNAPSHOT_READY: '/internal/collab/snapshot',
  USER_DISCONNECTED: '/internal/collab/user-disconnected',
} as const;
