import type {
  BroadcastParticipantReadyRequest,
  BroadcastParticipantReadyResponse,
  ChangeLanguageRequest,
  ChangeLanguageResponse,
  CreateInternalChatMessageRequest,
  CreateInternalChatMessageResponse,
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  GetRoomChatHistoryRequest,
  GetRoomChatHistoryResponse,
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
  getRoomChatHistory(
    roomId: string,
    request?: GetRoomChatHistoryRequest,
  ): Promise<GetRoomChatHistoryResponse>;
  createChatMessage(
    roomId: string,
    request: CreateInternalChatMessageRequest,
  ): Promise<CreateInternalChatMessageResponse>;
}

export const COLLAB_CLIENT = Symbol.for('COLLAB_CLIENT');
