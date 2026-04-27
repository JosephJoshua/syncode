import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Database } from '@syncode/db';
import { roomParticipants } from '@syncode/db';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';

/**
 * Participant presence reconciliation — Layer 2.
 *
 * Layer 1 is collab-plane's WS ping/pong which catches zombie sockets. This cron
 * catches the case where collab-plane crashes, its HTTP callback fails, or the
 * row never got flipped for any other reason. Rows are considered stale when:
 *   - active AND
 *   - joined at least STALE_THRESHOLD_MS ago (grace for fresh joiners) AND
 *   - never heartbeated OR last heartbeat older than STALE_THRESHOLD_MS.
 */
@Injectable()
export class ParticipantSweepService {
  // 120s = 4 missed 30s heartbeats; gives new joiners room to send their first one.
  private static readonly STALE_THRESHOLD_MS = 120_000;

  private readonly logger = new Logger(ParticipantSweepService.name);

  constructor(
    @Inject(DB_CLIENT)
    private readonly db: Database,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    await this.sweepOnce();
  }

  async sweepOnce(): Promise<number> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - ParticipantSweepService.STALE_THRESHOLD_MS);

    const updated = await this.db
      .update(roomParticipants)
      .set({ isActive: false, leftAt: now })
      .where(
        and(
          eq(roomParticipants.isActive, true),
          lt(roomParticipants.joinedAt, cutoff),
          or(
            isNull(roomParticipants.lastHeartbeatAt),
            lt(roomParticipants.lastHeartbeatAt, cutoff),
          ),
        ),
      )
      .returning({ id: roomParticipants.id });

    if (updated.length > 0) {
      this.logger.log(`Swept ${updated.length} stale participants`);
    }
    return updated.length;
  }
}
