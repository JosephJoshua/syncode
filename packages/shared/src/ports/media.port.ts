export const MEDIA_SERVICE = Symbol.for('MEDIA_SERVICE');

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

export interface MediaRoomOptions {
  maxParticipants?: number;
  emptyTimeoutSeconds?: number;
  metadata?: Record<string, string>;
}

export interface MediaTokenResult {
  token: string;
  url: string;
}

export interface ParticipantPermissions {
  canPublish?: boolean;
  canSubscribe?: boolean;
}

export interface IMediaService {
  createRoom(name: string, options?: MediaRoomOptions): Promise<void>;
  deleteRoom(name: string): Promise<void>;
  listRooms(): Promise<MediaRoomInfo[]>;
  getRoomInfo(name: string): Promise<MediaRoomInfo | null>;
  generateToken(options: MediaTokenOptions): Promise<MediaTokenResult>;
  removeParticipant(roomName: string, participantIdentity: string): Promise<void>;
  muteParticipantTrack(options: {
    roomName: string;
    participantIdentity: string;
    trackSource: 'microphone' | 'camera' | 'screen_share';
    muted: boolean;
  }): Promise<void>;
  updateParticipantPermissions(
    roomName: string,
    participantIdentity: string,
    permissions: ParticipantPermissions,
  ): Promise<void>;
  startRecording(roomName: string): Promise<string>;
  stopRecording(recordingId: string): Promise<void>;
  shutdown(): Promise<void>;
}
