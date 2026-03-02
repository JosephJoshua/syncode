export const MEDIA_SERVICE = Symbol.for('MEDIA_SERVICE');
export const MEDIA_SERVICE_KEY = 'MEDIA_SERVICE';

export interface MediaTokenOptions {
  roomName: string;
  participantIdentity: string;
  participantName?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  ttlSeconds?: number;
}

export interface MediaRoomInfo {
  name: string;
  numParticipants: number;
  creationTime: number;
}

export interface IMediaService {
  createRoom(name: string): Promise<void>;
  deleteRoom(name: string): Promise<void>;
  listRooms(): Promise<MediaRoomInfo[]>;
  getRoomInfo(name: string): Promise<MediaRoomInfo | null>;
  generateToken(options: MediaTokenOptions): Promise<string>;
  removeParticipant(roomName: string, participantIdentity: string): Promise<void>;
  shutdown(): Promise<void>;
}
