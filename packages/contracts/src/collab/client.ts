import type {
  BroadcastParticipantReadyRequest,
  BroadcastParticipantReadyResponse,
  ChangeLanguageRequest,
  ChangeLanguageResponse,
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  KickUserRequest,
  KickUserResponse,
  UpdateRoomStateRequest,
  UpdateRoomStateResponse,
} from './internal.js';

export interface ICollabClient {
  createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse>;
  destroyDocument(roomId: string): Promise<DestroyDocumentResponse>;
  kickUser(roomId: string, request: KickUserRequest): Promise<KickUserResponse>;
  updateRoomState(request: UpdateRoomStateRequest): Promise<UpdateRoomStateResponse>;
  healthCheck(): Promise<boolean>;
  broadcastParticipantReady(
    roomId: string,
    request: BroadcastParticipantReadyRequest,
  ): Promise<BroadcastParticipantReadyResponse>;
  changeLanguage(request: ChangeLanguageRequest): Promise<ChangeLanguageResponse>;
}

export const COLLAB_CLIENT = Symbol.for('COLLAB_CLIENT');
