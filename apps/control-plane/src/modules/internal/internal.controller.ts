import {
  Body,
  Controller,
  Inject,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  type AuthorizeJoinResponse,
  CONTROL_INTERNAL,
  type ParticipantHeartbeatResponse,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { codeSnapshots, sessions } from '@syncode/db';
import { type IStorageService, STORAGE_SERVICE } from '@syncode/shared/ports';
import { eq } from 'drizzle-orm';
import { InternalCallbackGuard } from '@/common/guards/internal-callback.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { RoomsService } from '@/modules/rooms/rooms.service.js';
import {
  AuthorizeJoinDto,
  ParticipantHeartbeatDto,
  PersistDocSnapshotDto,
  SnapshotReadyDto,
  UserDisconnectedDto,
} from './dto/internal.dto.js';

/**
 * Receives HTTP callbacks FROM other planes.
 * These endpoints are NOT exposed via nginx and require the shared
 * `X-Internal-Secret` header enforced by `InternalCallbackGuard`.
 */
const MAX_DOC_SNAPSHOT_BYTES = 5 * 1024 * 1024;

@SkipThrottle()
@UseGuards(InternalCallbackGuard)
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
      const { roomId, snapshot, code, language, timestamp, trigger } = payload;

      const [session] = await this.db
        .select({ id: sessions.id, language: sessions.language })
        .from(sessions)
        .where(eq(sessions.roomId, roomId))
        .limit(1);

      // Prefer the payload language (reflects mid-session switches); fall back to
      // the session's initial language only if the payload omitted it.
      const persistedLanguage = language ?? session?.language ?? null;
      let persistedToDatabase = false;

      if (session && persistedLanguage) {
        if (!language) {
          this.logger.warn(
            `Snapshot payload for room ${roomId} missing language; falling back to session.language=${session.language}`,
          );
        }
        await this.db.insert(codeSnapshots).values({
          sessionId: session.id,
          roomId,
          code,
          language: persistedLanguage,
          trigger,
          linesOfCode: code ? code.split('\n').length : 0,
          createdAt: new Date(timestamp),
        });
        persistedToDatabase = true;
      } else {
        this.logger.warn(
          `Skipping DB insert for room ${roomId}: ${!session ? 'no session' : 'no language'}`,
        );
      }

      const snapshotBuffer = Buffer.from(snapshot);
      const key = `snapshots/${roomId}/${timestamp}.yjs`;

      try {
        await this.storageService.upload(key, snapshotBuffer, {
          contentType: 'application/octet-stream',
          metadata: {
            roomId,
            timestamp: timestamp.toString(),
          },
        });

        await this.roomsService.persistDocSnapshot(roomId, new Uint8Array(snapshot));
      } catch (error) {
        if (!persistedToDatabase) {
          throw error;
        }

        this.logger.warn(
          `Snapshot blob upload failed for room ${roomId}, but code history was stored: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      this.logger.log(`Snapshot stored for room ${roomId} at ${timestamp}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to store snapshot', error);
      throw new InternalServerErrorException('Failed to store snapshot');
    }
  }

  /**
   * Called by collab-plane on TTL teardown with the binary Y.Doc state, so the same
   * content can be restored next time the doc is recreated.
   */
  @Post(CONTROL_INTERNAL.PERSIST_DOC_SNAPSHOT.route)
  @ApiExcludeEndpoint()
  async handlePersistDocSnapshot(
    @Param('roomId') roomId: string,
    @Body() payload: PersistDocSnapshotDto,
  ): Promise<{ success: boolean }> {
    try {
      const state = new Uint8Array(payload.state);
      this.logger.debug(`Doc snapshot received for room ${roomId} (${state.byteLength} bytes)`);

      if (state.byteLength > MAX_DOC_SNAPSHOT_BYTES) {
        this.logger.warn(
          `Rejecting oversized doc snapshot for room ${roomId}: ${state.byteLength} bytes exceeds ${MAX_DOC_SNAPSHOT_BYTES}`,
        );
        return { success: false };
      }

      await this.roomsService.persistDocSnapshot(roomId, state);
      this.logger.debug(`Doc snapshot persisted for room ${roomId} (${state.byteLength} bytes)`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to persist doc snapshot for room ${roomId}`, error);
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

  /**
   * Called by collab-plane on its heartbeat loop (~30s cadence) with the set of
   * authenticated, alive (roomId, userId) pairs. Bumps last_heartbeat_at so the
   * participant sweep cron knows these rows are still live.
   */
  @Post(CONTROL_INTERNAL.PARTICIPANT_HEARTBEAT.route)
  @ApiExcludeEndpoint()
  async handleParticipantHeartbeat(
    @Body() payload: ParticipantHeartbeatDto,
  ): Promise<ParticipantHeartbeatResponse> {
    const updated = await this.roomsService.recordParticipantHeartbeats(payload.participants);
    return { updated };
  }

  /**
   * Called by collab-plane on every WS `join` attempt to verify the user is
   * still allowed into the room. Defeats stale-JWT attacks where a kicked
   * user holds a long-lived collab token (24h) and would otherwise reconnect
   * undetected because the in-memory registry has no kick history.
   */
  @Post(CONTROL_INTERNAL.AUTHORIZE_JOIN.route)
  @ApiExcludeEndpoint()
  async handleAuthorizeJoin(
    @Param('roomId') roomId: string,
    @Body() payload: AuthorizeJoinDto,
  ): Promise<AuthorizeJoinResponse> {
    return this.roomsService.authorizeJoin(roomId, payload.userId);
  }
}
