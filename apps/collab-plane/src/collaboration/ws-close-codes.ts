export const WsCloseCode = {
  UNAUTHORIZED: 4001,
  KICKED: 4002,
  ROOM_CLOSED: 4003,
  ROOM_NOT_FOUND: 4004,
  ALREADY_CONNECTED: 4009,
  RATE_LIMITED: 4029,
} as const;

export type WsCloseCode = (typeof WsCloseCode)[keyof typeof WsCloseCode];
