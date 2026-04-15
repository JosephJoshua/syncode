/**
 * Typed WebSocket message envelope used on the collab-plane WebSocket.
 * Text frames only — binary frames are Yjs sync protocol.
 */
export interface CollabWsMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
}

/** Sent on join and on every state update. */
export interface RoomStateEventData {
  phase: string;
  editorLocked: boolean;
}

/** Sent when the room phase changes. */
export interface PhaseChangeEventData {
  phase: string;
  previousPhase: string;
}

/** Sent when the editor lock state changes. */
export interface EditorLockEventData {
  locked: boolean;
  lockedBy: string | null;
}

export const COLLAB_WS_EVENTS = {
  ROOM_STATE: 'room-state',
  PHASE_CHANGE: 'phase-change',
  EDITOR_LOCK: 'editor-lock',
} as const;
