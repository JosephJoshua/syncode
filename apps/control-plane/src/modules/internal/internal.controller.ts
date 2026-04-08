import { Body, Controller, Inject, Logger, Post } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CONTROL_INTERNAL } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { codeSnapshots, sessions } from '@syncode/db';
import { type IStorageService, STORAGE_SERVICE } from '@syncode/shared/ports';
import { eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
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
    @Inject(DB_CLIENT)
    private readonly db: Database,
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
      const { roomId, snapshot, code, timestamp, trigger } = payload;

      // S3 upload (binary for reconstruction)
      const snapshotBuffer = Buffer.from(snapshot);
      const key = `snapshots/${roomId}/${timestamp}.yjs`;
      await this.storageService.upload(key, snapshotBuffer, {
        contentType: 'application/octet-stream',
        metadata: {
          roomId,
          timestamp: timestamp.toString(),
        },
      });

      const [session] = await this.db
        .select({ id: sessions.id, language: sessions.language })
        .from(sessions)
        .where(eq(sessions.roomId, roomId))
        .limit(1);

      if (session?.language) {
        await this.db.insert(codeSnapshots).values({
          sessionId: session.id,
          roomId,
          code,
          language: session.language,
          trigger,
          linesOfCode: code ? code.split('\n').length : 0,
          createdAt: new Date(timestamp),
        });
      } else {
        this.logger.warn(
          `Skipping DB insert for room ${roomId}: ${!session ? 'no session' : 'no language'}`,
        );
      }

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
