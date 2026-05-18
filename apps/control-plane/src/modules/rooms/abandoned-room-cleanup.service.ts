import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  COLLAB_CLIENT,
  type ICollabClient,
  ROOM_ABANDONED_CLEANUP_QUEUE,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { matchRequests, roomDocSnapshots, roomParticipants, rooms, sessions } from '@syncode/db';
import { RoomStatus } from '@syncode/shared';
import { type IQueueService, QUEUE_SERVICE } from '@syncode/shared/ports';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { SessionReportsService } from '@/modules/sessions/session-reports.service.js';

type StaleRoomCandidate = {
  roomId: string;
};

@Injectable()
export class AbandonedRoomCleanupService implements OnModuleInit {
  private static readonly ABANDONED_ROOM_THRESHOLD_MS = 10 * 60_000;
  private static readonly CLEANUP_BATCH_SIZE = 50;
  private static readonly CLEANUP_JOB_NAME = 'run-cycle';
  private static readonly CLEANUP_ACTOR_ID = 'abandoned-room-cleanup';

  private readonly logger = new Logger(AbandonedRoomCleanupService.name);
  private isCleanupInProgress = false;

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    @Inject(COLLAB_CLIENT) private readonly collabClient: ICollabClient,
    private readonly sessionReportsService: SessionReportsService,
  ) {}

  onModuleInit(): void {
    this.queueService.process(
      ROOM_ABANDONED_CLEANUP_QUEUE,
      async () => {
        await this.cleanupAbandonedRoomsOnce();
      },
      { concurrency: 1 },
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async enqueuePeriodicCleanup(): Promise<void> {
    try {
      await this.queueService.enqueue(
        ROOM_ABANDONED_CLEANUP_QUEUE,
        AbandonedRoomCleanupService.CLEANUP_JOB_NAME,
        { triggeredAt: new Date().toISOString() },
        {
          removeOnComplete: 10,
          removeOnFail: 20,
          attempts: 1,
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to enqueue abandoned-room cleanup: ${(error as Error).message}`);
    }
  }

  async cleanupAbandonedRoomsOnce(): Promise<number> {
    if (this.isCleanupInProgress) {
      return 0;
    }

    this.isCleanupInProgress = true;
    try {
      const now = new Date();
      const cutoff = new Date(
        now.getTime() - AbandonedRoomCleanupService.ABANDONED_ROOM_THRESHOLD_MS,
      );
      const cutoffIso = cutoff.toISOString();

      const staleRooms = await this.db
        .select({
          roomId: rooms.id,
        })
        .from(rooms)
        .where(
          and(
            ne(rooms.status, RoomStatus.FINISHED),
            sql`not exists (
              select 1
              from room_participants rp
              where rp.room_id = ${rooms.id}
                and rp.is_active = true
            )`,
            sql`coalesce(
                (
                  select max(coalesce(rp.left_at, rp.joined_at))
                  from room_participants rp
                  where rp.room_id = ${rooms.id}
                ),
                ${rooms.createdAt}
              ) < ${cutoffIso}::timestamptz`,
          ),
        )
        .orderBy(asc(rooms.createdAt), asc(rooms.id))
        .limit(AbandonedRoomCleanupService.CLEANUP_BATCH_SIZE);

      if (staleRooms.length === 0) {
        return 0;
      }

      let cleanedCount = 0;
      for (const room of staleRooms) {
        try {
          const result = await this.finishAbandonedRoom(room, now, cutoffIso);
          if (!result.cleaned) {
            continue;
          }
          cleanedCount += 1;
          if (result.finishedSessionId) {
            await this.enqueueSessionReports(result.finishedSessionId);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to clean abandoned room ${room.roomId}: ${(error as Error).message}`,
          );
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Marked ${cleanedCount} abandoned rooms as finished`);
      }

      return cleanedCount;
    } finally {
      this.isCleanupInProgress = false;
    }
  }

  private async finishAbandonedRoom(
    candidate: StaleRoomCandidate,
    now: Date,
    cutoffIso: string,
  ): Promise<{ cleaned: boolean; finishedSessionId: string | null }> {
    let restoreCollabState: {
      roomId: string;
      status: (typeof RoomStatus)[keyof typeof RoomStatus];
      editorLocked: boolean;
    } | null = null;

    return this.db
      .transaction(async (tx) => {
        const [lockedRoom] = await tx
          .select({
            id: rooms.id,
            status: rooms.status,
            language: rooms.language,
            editorLocked: rooms.editorLocked,
            phaseStartedAt: rooms.phaseStartedAt,
            timerPaused: rooms.timerPaused,
            elapsedMs: rooms.elapsedMs,
          })
          .from(rooms)
          .where(
            and(
              eq(rooms.id, candidate.roomId),
              ne(rooms.status, RoomStatus.FINISHED),
              sql`not exists (
              select 1
              from room_participants rp
              where rp.room_id = ${rooms.id}
                and rp.is_active = true
            )`,
              sql`coalesce(
                (
                  select max(coalesce(rp.left_at, rp.joined_at))
                  from room_participants rp
                  where rp.room_id = ${rooms.id}
                ),
                ${rooms.createdAt}
              ) < ${cutoffIso}::timestamptz`,
            ),
          )
          .for('update');

        if (!lockedRoom) {
          return { cleaned: false, finishedSessionId: null };
        }

        if (lockedRoom.status !== RoomStatus.WAITING) {
          await this.updateCollabRoomStateStrict(lockedRoom);
          restoreCollabState = {
            roomId: lockedRoom.id,
            status: lockedRoom.status,
            editorLocked: lockedRoom.editorLocked,
          };
        }

        const elapsedMs = this.computeElapsedMs(lockedRoom, now);
        await tx
          .update(rooms)
          .set({
            status: RoomStatus.FINISHED,
            phaseStartedAt: now,
            elapsedMs,
            endedAt: now,
            ...(lockedRoom.status === RoomStatus.CODING ? { timerPaused: false } : {}),
          })
          .where(eq(rooms.id, lockedRoom.id));

        await tx
          .update(roomParticipants)
          .set({ isReady: false })
          .where(eq(roomParticipants.roomId, lockedRoom.id));

        await tx
          .update(roomParticipants)
          .set({ isActive: false, leftAt: now })
          .where(
            and(eq(roomParticipants.roomId, lockedRoom.id), eq(roomParticipants.isActive, true)),
          );

        await tx
          .update(matchRequests)
          .set({ status: 'expired' })
          .where(eq(matchRequests.matchedRoomId, lockedRoom.id));

        if (lockedRoom.status === RoomStatus.WAITING) {
          return { cleaned: true, finishedSessionId: null };
        }

        const [finishedSession] = await tx
          .update(sessions)
          .set({
            status: 'finished',
            finishedAt: now,
            durationMs: elapsedMs,
          })
          .where(and(eq(sessions.roomId, lockedRoom.id), eq(sessions.status, 'ongoing')))
          .returning({ id: sessions.id });

        return {
          cleaned: true,
          finishedSessionId: finishedSession?.id ?? null,
        };
      })
      .catch(async (error: unknown) => {
        if (restoreCollabState) {
          await this.restoreCollabRoomStateStrict(restoreCollabState);
        }
        throw error;
      });
  }

  private computeElapsedMs(
    room: {
      status: (typeof RoomStatus)[keyof typeof RoomStatus];
      phaseStartedAt: Date | null;
      timerPaused: boolean;
      elapsedMs: number;
    },
    now: Date,
  ): number {
    if (room.status !== RoomStatus.CODING || !room.phaseStartedAt || room.timerPaused) {
      return room.elapsedMs;
    }

    return room.elapsedMs + Math.max(0, now.getTime() - room.phaseStartedAt.getTime());
  }

  private async updateCollabRoomStateStrict(room: {
    status: (typeof RoomStatus)[keyof typeof RoomStatus];
    id: string;
    language: string | null;
    editorLocked: boolean;
  }): Promise<void> {
    if (!room.language) {
      throw new ServiceUnavailableException(
        `Cannot finalize abandoned room ${room.id}: language is missing`,
      );
    }

    const request = {
      roomId: room.id,
      phase: RoomStatus.FINISHED,
      editorLocked: room.editorLocked,
      changedBy: AbandonedRoomCleanupService.CLEANUP_ACTOR_ID,
      language: room.language,
    };

    try {
      await this.collabClient.updateRoomState(request);
      return;
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
    }

    const snapshot = await this.loadDocSnapshot(room.id);
    await this.collabClient.createDocument({
      roomId: room.id,
      initialPhase: room.status,
      editorLocked: room.editorLocked,
      initialLanguage: room.language,
      ...(snapshot ? { snapshot: Array.from(snapshot) } : {}),
    });

    await this.collabClient.updateRoomState(request);
  }

  private async restoreCollabRoomStateStrict(room: {
    roomId: string;
    status: (typeof RoomStatus)[keyof typeof RoomStatus];
    editorLocked: boolean;
  }): Promise<void> {
    try {
      await this.collabClient.updateRoomState({
        roomId: room.roomId,
        phase: room.status,
        editorLocked: room.editorLocked,
        changedBy: AbandonedRoomCleanupService.CLEANUP_ACTOR_ID,
      });
    } catch (error) {
      this.logger.error(`Failed to restore collab state for abandoned room ${room.roomId}`, error);
    }
  }

  private async loadDocSnapshot(roomId: string): Promise<Uint8Array | null> {
    const [row] = await this.db
      .select({ state: roomDocSnapshots.state })
      .from(roomDocSnapshots)
      .where(eq(roomDocSnapshots.roomId, roomId))
      .limit(1);
    return row?.state ?? null;
  }

  private isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const maybeError = error as {
      status?: number;
      response?: { status?: number };
    };

    if (maybeError.status === 404 || maybeError.response?.status === 404) {
      return true;
    }

    return error.message.toLowerCase().includes('not found');
  }

  private async enqueueSessionReports(sessionId: string): Promise<void> {
    try {
      await this.sessionReportsService.enqueueForFinishedSession(sessionId);
    } catch (error) {
      this.logger.error(`Failed to enqueue session reports for session ${sessionId}`, error);
    }
  }
}
