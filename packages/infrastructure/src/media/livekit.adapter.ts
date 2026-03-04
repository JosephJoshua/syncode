import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type {
  IMediaService,
  MediaRoomInfo,
  MediaRoomOptions,
  MediaTokenOptions,
  MediaTokenResult,
  ParticipantPermissions,
} from '@syncode/shared';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { type LiveKitConfig, LiveKitConfigSchema } from '../config';

@Injectable()
export class LiveKitAdapter implements IMediaService, OnModuleDestroy {
  private readonly logger = new Logger(LiveKitAdapter.name);
  private readonly client: RoomServiceClient;
  private readonly config: LiveKitConfig;

  constructor(config: LiveKitConfig) {
    const validatedConfig = LiveKitConfigSchema.parse(config);

    this.config = validatedConfig;
    this.client = new RoomServiceClient(
      validatedConfig.url,
      validatedConfig.apiKey,
      validatedConfig.apiSecret,
    );
  }

  async createRoom(name: string, options?: MediaRoomOptions): Promise<void> {
    await this.client.createRoom({
      name,
      maxParticipants: options?.maxParticipants,
      emptyTimeout: options?.emptyTimeoutSeconds,
      metadata: options?.metadata ? JSON.stringify(options.metadata) : undefined,
    });
  }

  async deleteRoom(name: string): Promise<void> {
    await this.client.deleteRoom(name);
  }

  async listRooms(): Promise<MediaRoomInfo[]> {
    const rooms = await this.client.listRooms();

    return rooms.map((room) => ({
      name: room.name,
      numParticipants: room.numParticipants,
      creationTime: Number(room.creationTime),
    }));
  }

  async getRoomInfo(name: string): Promise<MediaRoomInfo | null> {
    const rooms = await this.client.listRooms([name]);

    if (rooms.length === 0) {
      return null;
    }

    const room = rooms[0];
    if (!room) {
      return null;
    }

    return {
      name: room.name,
      numParticipants: room.numParticipants,
      creationTime: Number(room.creationTime),
    };
  }

  async generateToken(options: MediaTokenOptions): Promise<MediaTokenResult> {
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: options.participantIdentity,
      name: options.participantName,
      ttl: options.ttlSeconds,
    });

    token.addGrant({
      roomJoin: true,
      room: options.roomName,
      canPublish: options.canPublish ?? true,
      canSubscribe: options.canSubscribe ?? true,
    });

    return {
      token: await token.toJwt(),
      url: this.config.url,
    };
  }

  async removeParticipant(roomName: string, participantIdentity: string): Promise<void> {
    await this.client.removeParticipant(roomName, participantIdentity);
  }

  async muteParticipantTrack(options: {
    roomName: string;
    participantIdentity: string;
    trackSource: 'microphone' | 'camera' | 'screen_share';
    muted: boolean;
  }): Promise<void> {
    const trackSourceMap: Record<string, TrackSource> = {
      microphone: TrackSource.MICROPHONE,
      camera: TrackSource.CAMERA,
      screen_share: TrackSource.SCREEN_SHARE,
    };

    const source = trackSourceMap[options.trackSource];

    if (!source) {
      throw new Error(`Invalid track source: ${options.trackSource}`);
    }

    const participant = await this.client.getParticipant(
      options.roomName,
      options.participantIdentity,
    );

    if (!participant) {
      throw new Error(
        `Participant ${options.participantIdentity} not found in room ${options.roomName}`,
      );
    }

    const track = participant.tracks.find((t) => t.source === source);

    if (!track) {
      this.logger.warn(
        `Track with source ${options.trackSource} not found for participant ${options.participantIdentity}. Skipping mute operation.`,
      );
      return;
    }

    await this.client.mutePublishedTrack(
      options.roomName,
      options.participantIdentity,
      track.sid,
      options.muted,
    );
  }

  async updateParticipantPermissions(
    roomName: string,
    participantIdentity: string,
    permissions: ParticipantPermissions,
  ): Promise<void> {
    await this.client.updateParticipant(roomName, participantIdentity, undefined, {
      canPublish: permissions.canPublish,
      canSubscribe: permissions.canSubscribe,
    });
  }

  async startRecording(roomName: string): Promise<string> {
    // TODO: support recording
    throw new Error(
      `Recording is not supported. LiveKit recording requires the LiveKit Egress service to be deployed and configured. Room: ${roomName}`,
    );
  }

  async stopRecording(recordingId: string): Promise<void> {
    // TODO: support recording
    throw new Error(
      `Recording is not supported. LiveKit recording requires the LiveKit Egress service to be deployed and configured. Recording ID: ${recordingId}`,
    );
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down LiveKit adapter...');
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }
}
