import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  KickUserRequest,
  KickUserResponse,
  NotifyPhaseChangeRequest,
  NotifyPhaseChangeResponse,
} from './internal.js';

export interface ICollabClient {
  createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse>;
  destroyDocument(roomId: string): Promise<DestroyDocumentResponse>;
  kickUser(roomId: string, request: KickUserRequest): Promise<KickUserResponse>;
  notifyPhaseChange(request: NotifyPhaseChangeRequest): Promise<NotifyPhaseChangeResponse>;
  healthCheck(): Promise<boolean>;
}

export const COLLAB_CLIENT = Symbol.for('COLLAB_CLIENT');
