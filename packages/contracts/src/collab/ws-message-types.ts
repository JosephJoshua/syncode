/**
 * Top-level binary WebSocket message types for the y-protocols wire format.
 * These are the first byte of every binary frame on the WebSocket connection.
 *
 * @see https://github.com/yjs/y-websocket (messageSync, messageAwareness)
 */
export const WsMessageType = {
  SYNC: 0,
  AWARENESS: 1,
} as const;

export type WsMessageType = (typeof WsMessageType)[keyof typeof WsMessageType];
