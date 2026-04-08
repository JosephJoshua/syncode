export interface WsMessage<T = unknown> {
  type: string;
  data: T;
  timestamp?: number;
}

export interface JoinMessageData {
  roomId: string;
}

export interface RoomStateData {
  phase: string;
  editorLocked: boolean;
}
