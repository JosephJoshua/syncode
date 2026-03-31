import { defineRoute } from '../route-utils.js';

export interface CreateDocumentRequest {
  roomId: string;
  initialContent?: string;
}
export interface CreateDocumentResponse {
  roomId: string;
  createdAt: number;
}

export interface DestroyDocumentResponse {
  roomId: string;
  finalSnapshot?: number[];
}

export interface KickUserRequest {
  userId: string;
  reason?: string;
}
export interface KickUserResponse {
  kicked: boolean;
}

export const COLLAB_INTERNAL = {
  CREATE_DOCUMENT: defineRoute<CreateDocumentRequest, CreateDocumentResponse>()(
    'internal/documents',
    'POST',
  ),
  DESTROY_DOCUMENT: defineRoute<void, DestroyDocumentResponse>()(
    'internal/documents/:roomId',
    'DELETE',
  ),
  KICK_USER: defineRoute<KickUserRequest, KickUserResponse>()(
    'internal/documents/:roomId/kick',
    'POST',
  ),
  HEALTH: defineRoute<void, { status: 'ok' }>()('internal/health', 'GET'),
};
