import { defineRoute } from '../route-utils.js';
import type { ChatMessage } from './ws-events.js';

export interface CreateDocumentRequest {
  roomId: string;
  initialContentByLanguage?: Record<string, string>;
  initialLanguage?: string;
  initialPhase?: string;
  editorLocked?: boolean;
  /**
   * Binary Y.Doc update (as number[] for JSON transport). When present, the collab-plane
   * applies it to the fresh doc instead of seeding from `initialContent`.
   */
  snapshot?: number[];
}
export interface CreateDocumentResponse {
  roomId: string;
  createdAt: number;
  /** True if this call actually created a new doc; false if one already existed. */
  created: boolean;
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

export interface UpdateRoomStateRequest {
  roomId: string;
  phase: string;
  editorLocked: boolean;
  changedBy?: string;
}

export interface UpdateRoomStateResponse {
  success: boolean;
}

export interface BroadcastParticipantReadyRequest {
  userId: string;
  isReady: boolean;
}

export interface BroadcastParticipantReadyResponse {
  success: boolean;
}

export interface ChangeLanguageRequest {
  roomId: string;
  language: string;
  changedBy?: string;
}

export interface ChangeLanguageResponse {
  success: boolean;
}

export interface GetRoomChatHistoryRequest {
  limit?: number;
}

export interface GetRoomChatHistoryResponse {
  messages: ChatMessage[];
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
  UPDATE_ROOM_STATE: defineRoute<UpdateRoomStateRequest, UpdateRoomStateResponse>()(
    'internal/documents/:roomId/state',
    'POST',
  ),
  BROADCAST_PARTICIPANT_READY: defineRoute<
    BroadcastParticipantReadyRequest,
    BroadcastParticipantReadyResponse
  >()('internal/documents/:roomId/participant-ready', 'POST'),
  CHANGE_LANGUAGE: defineRoute<ChangeLanguageRequest, ChangeLanguageResponse>()(
    'internal/documents/:roomId/language',
    'POST',
  ),
  GET_ROOM_CHAT_HISTORY: defineRoute<void, GetRoomChatHistoryResponse>()(
    'internal/documents/:roomId/chat',
    'GET',
  ),
  HEALTH: defineRoute<void, { status: 'ok' }>()('internal/health', 'GET'),
};
