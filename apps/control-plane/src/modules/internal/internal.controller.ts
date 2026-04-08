import { Body, Controller, Inject, Logger, Post } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CONTROL_INTERNAL } from '@syncode/contracts';
import { type IStorageService, STORAGE_SERVICE } from '@syncode/shared/ports';
import { RoomsService } from '@/modules/rooms/rooms.service.js';
import { SnapshotReadyDto, UserDisconnectedDto } from './dto/internal.dto.js';

/**
 * Receives HTTP callbacks FROM other planes.
 * These endpoints are NOT exposed via nginx.
 *
 * TODO: add shared tokens
 */
@SkipThrottle()
@Controller()
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly roomsService: RoomsService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
  ) {}

  /**
   * Called by collab-plane when a collaborative document snapshot is ready.
   *
   * Stores the snapshot for persistence.
   */
  @Post(CONTROL_INTERNAL.SNAPSHOT_READY.route)
  @ApiExcludeEndpoint()
  async handleSnapshotReady(@Body() payload: SnapshotReadyDto): Promise<{ success: boolean }> {
    try {
      const { roomId, snapshot, timestamp } = payload;

      const snapshotBuffer = Buffer.from(snapshot);
      const key = `snapshots/${roomId}/${timestamp}.yjs`;
      await this.storageService.upload(key, snapshotBuffer, {
        contentType: 'application/octet-stream',
        metadata: {
          roomId,
          timestamp: timestamp.toString(),
        },
      });

      this.logger.log(`Snapshot stored for room ${roomId} at ${timestamp}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to store snapshot', error);
      return { success: false };
    }
  }

  /**
   * Called by collab-plane when a user disconnects from a room.
   *
   * Updates room state in the database.
   */
  @Post(CONTROL_INTERNAL.USER_DISCONNECTED.route)
  @ApiExcludeEndpoint()
  async handleUserDisconnected(
    @Body() payload: UserDisconnectedDto,
  ): Promise<{ success: boolean }> {
    try {
      const { roomId, userId, timestamp } = payload;

      await this.roomsService.markParticipantInactive(roomId, userId, new Date(timestamp));

      this.logger.log(`User ${userId} disconnected from room ${roomId} at ${timestamp}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to handle user disconnection', error);
      return { success: false };
    }
  }
}
