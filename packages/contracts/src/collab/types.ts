// Control-plane -> Collab-plane commands
export interface CreateDocumentRequest {
  roomId: string;
  initialContent?: string;
}

export interface CreateDocumentResponse {
  roomId: string;
  createdAt: number;
}

export interface DestroyDocumentRequest {
  roomId: string;
}

export interface DestroyDocumentResponse {
  roomId: string;
  finalSnapshot?: Uint8Array;
}

export interface KickUserRequest {
  userId: string;
  reason?: string;
}

export interface KickUserResponse {
  kicked: boolean;
}

// Collab-plane -> Control-plane events
export interface SnapshotReadyPayload {
  roomId: string;
  snapshot: Uint8Array;
  timestamp: number;
}

export interface UserDisconnectedPayload {
  roomId: string;
  userId: string;
  timestamp: number;
}
