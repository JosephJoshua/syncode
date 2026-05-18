import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  type EnterMatchmakingQueueInput,
  type EnterMatchmakingQueueResponse,
  type GetMatchmakingStatusResponse,
  MATCHMAKING_ENGINE_QUEUE,
  type MatchmakingPreferences,
  matchmakingPreferencesSchema,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { matchRequests, problems, rooms, users } from '@syncode/db';
import {
  isRoomRole,
  JOINABLE_ROLES,
  PROBLEM_DIFFICULTIES,
  type ProblemDifficulty,
  RoomRole,
  RoomStatus,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@syncode/shared';
import { type IQueueService, QUEUE_SERVICE } from '@syncode/shared/ports';
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { RoomsService } from '@/modules/rooms/rooms.service.js';

type MatchRequestRow = {
  id: string;
  userId: string;
  status: 'pending' | 'matched' | 'expired' | 'cancelled';
  difficulty: ProblemDifficulty | null;
  language: SupportedLanguage | null;
  requestedRole: string | null;
  requestedTags: unknown;
  matchedRoomId: string | null;
  matchedWithUserId: string | null;
  createdAt: Date;
  expiresAt: Date;
};

type ActiveMatchRequest = Omit<MatchRequestRow, 'status'> & { status: 'pending' | 'matched' };

type PendingMatchRequest = Omit<MatchRequestRow, 'status'> & { status: 'pending' };

type ExistingRoomCandidate = {
  roomId: string;
  status: (typeof RoomStatus)[keyof typeof RoomStatus];
  hostId: string;
  participantCount: number;
  createdAt: Date;
};

@Injectable()
export class MatchmakingService implements OnModuleInit {
  private static readonly REQUEST_TTL_MS = 2 * 60_000;
  private static readonly ENGINE_JOB_NAME = 'run-cycle';
  private static readonly MATCH_ROOM_NAME = 'Matchmade Interview';
  private static readonly MATCH_ROOM_MAX_PARTICIPANTS = 5;
  private static readonly MATCH_ROOM_MAX_DURATION_MIN = 120;

  private readonly logger = new Logger(MatchmakingService.name);
  private isMatchingInProgress = false;

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly roomsService: RoomsService,
  ) {}

  onModuleInit(): void {
    this.queueService.process(
      MATCHMAKING_ENGINE_QUEUE,
      async () => {
        await this.runMatchingCycle();
      },
      { concurrency: 1 },
    );
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async enqueuePeriodicCycle(): Promise<void> {
    await this.enqueueEngineRun();
  }

  async enterQueue(
    userId: string,
    input: EnterMatchmakingQueueInput,
  ): Promise<EnterMatchmakingQueueResponse> {
    const preferences = this.normalizePreferences(input);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MatchmakingService.REQUEST_TTL_MS);

    const [inserted] = await this.db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');

      await tx
        .update(matchRequests)
        .set({ status: 'cancelled' })
        .where(and(eq(matchRequests.userId, userId), eq(matchRequests.status, 'pending')));

      return tx
        .insert(matchRequests)
        .values({
          userId,
          difficulty: preferences.difficulties[0] ?? null,
          language: preferences.languages[0] ?? null,
          requestedRole: preferences.roles[0] ?? null,
          requestedTags: preferences,
          status: 'pending',
          expiresAt,
        })
        .returning({ id: matchRequests.id });
    });
    if (!inserted?.id) {
      throw new Error('Failed to create matchmaking request');
    }

    await this.enqueueEngineRun();
    await this.runMatchingCycle();

    const status = await this.getQueueStatus(userId);
    if (status.status === 'idle') {
      const queuePosition = await this.getQueuePosition(inserted.id);
      return {
        status: 'searching',
        requestId: inserted.id,
        queuePosition,
        expiresAt: expiresAt.toISOString(),
        preferences,
      };
    }
    return status;
  }

  async leaveQueue(userId: string): Promise<{ status: 'idle' }> {
    await this.db
      .update(matchRequests)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(matchRequests.userId, userId),
          or(eq(matchRequests.status, 'pending'), eq(matchRequests.status, 'matched')),
        ),
      );

    return { status: 'idle' };
  }

  async getQueueStatus(userId: string): Promise<GetMatchmakingStatusResponse> {
    const request = await this.getLatestActiveRequest(userId);
    if (!request) {
      return { status: 'idle' };
    }

    if (request.status === 'pending') {
      if (request.expiresAt.getTime() <= Date.now()) {
        await this.db
          .update(matchRequests)
          .set({ status: 'expired' })
          .where(eq(matchRequests.id, request.id));
        return { status: 'idle' };
      }

      const refreshedExpiresAt = await this.refreshPendingRequestExpiry(request.id);
      if (!refreshedExpiresAt) {
        const latest = await this.getLatestActiveRequest(userId);
        if (!latest) {
          return { status: 'idle' };
        }
        if (latest.status === 'matched' && latest.matchedRoomId && latest.matchedWithUserId) {
          return this.toMatchedStatus(latest);
        }
      }
      const queuePosition = await this.getQueuePosition(request.id);

      return this.toSearchingStatus(
        {
          ...request,
          expiresAt: refreshedExpiresAt ?? request.expiresAt,
        },
        queuePosition,
      );
    }

    if (request.matchedRoomId && request.matchedWithUserId) {
      return this.toMatchedStatus(request);
    }

    return { status: 'idle' };
  }

  async runMatchingCycle(): Promise<void> {
    if (this.isMatchingInProgress) {
      return;
    }

    this.isMatchingInProgress = true;
    try {
      await this.expirePendingRequests();
      const pending = await this.listPendingRequests();
      const consumed = new Set<string>();

      for (const request of pending) {
        if (consumed.has(request.id)) {
          continue;
        }

        const matchedExistingRoom = await this.tryMatchExistingRoom(request);
        if (matchedExistingRoom) {
          consumed.add(request.id);
        }
      }

      for (let i = 0; i < pending.length; i += 1) {
        const left = pending[i];
        if (!left || consumed.has(left.id)) {
          continue;
        }

        for (let j = i + 1; j < pending.length; j += 1) {
          const right = pending[j];
          if (!right || consumed.has(right.id)) {
            continue;
          }

          const matched = await this.tryMatchPair(left, right);
          if (!matched) {
            continue;
          }

          consumed.add(left.id);
          consumed.add(right.id);
          break;
        }
      }
    } finally {
      this.isMatchingInProgress = false;
    }
  }

  private async enqueueEngineRun(): Promise<void> {
    try {
      await this.queueService.enqueue(
        MATCHMAKING_ENGINE_QUEUE,
        MatchmakingService.ENGINE_JOB_NAME,
        { triggeredAt: new Date().toISOString() },
        {
          removeOnComplete: 10,
          removeOnFail: 20,
          attempts: 1,
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to enqueue matchmaking cycle: ${(error as Error).message}`);
    }
  }

  private async expirePendingRequests(): Promise<void> {
    await this.db
      .update(matchRequests)
      .set({ status: 'expired' })
      .where(and(eq(matchRequests.status, 'pending'), lte(matchRequests.expiresAt, new Date())));
  }

  private async listPendingRequests(): Promise<PendingMatchRequest[]> {
    const rows = await this.db
      .select({
        id: matchRequests.id,
        userId: matchRequests.userId,
        status: matchRequests.status,
        difficulty: matchRequests.difficulty,
        language: matchRequests.language,
        requestedRole: matchRequests.requestedRole,
        requestedTags: matchRequests.requestedTags,
        matchedRoomId: matchRequests.matchedRoomId,
        matchedWithUserId: matchRequests.matchedWithUserId,
        createdAt: matchRequests.createdAt,
        expiresAt: matchRequests.expiresAt,
      })
      .from(matchRequests)
      .where(eq(matchRequests.status, 'pending'))
      .orderBy(asc(matchRequests.createdAt), asc(matchRequests.id));

    return rows.filter((row): row is PendingMatchRequest => row.status === 'pending');
  }

  private async getLatestActiveRequest(userId: string): Promise<ActiveMatchRequest | null> {
    const [request] = await this.db
      .select({
        id: matchRequests.id,
        userId: matchRequests.userId,
        status: matchRequests.status,
        difficulty: matchRequests.difficulty,
        language: matchRequests.language,
        requestedRole: matchRequests.requestedRole,
        requestedTags: matchRequests.requestedTags,
        matchedRoomId: matchRequests.matchedRoomId,
        matchedWithUserId: matchRequests.matchedWithUserId,
        createdAt: matchRequests.createdAt,
        expiresAt: matchRequests.expiresAt,
      })
      .from(matchRequests)
      .where(
        and(
          eq(matchRequests.userId, userId),
          or(eq(matchRequests.status, 'pending'), eq(matchRequests.status, 'matched')),
        ),
      )
      .orderBy(desc(matchRequests.createdAt), desc(matchRequests.id))
      .limit(1);

    if (!request) {
      return null;
    }

    const { status } = request;
    if (status !== 'pending' && status !== 'matched') {
      return null;
    }

    return { ...request, status };
  }

  private async refreshPendingRequestExpiry(requestId: string): Promise<Date | null> {
    const nextExpiry = new Date(Date.now() + MatchmakingService.REQUEST_TTL_MS);
    const [updated] = await this.db
      .update(matchRequests)
      .set({ expiresAt: nextExpiry })
      .where(
        and(
          eq(matchRequests.id, requestId),
          eq(matchRequests.status, 'pending'),
          gt(matchRequests.expiresAt, new Date()),
        ),
      )
      .returning({ expiresAt: matchRequests.expiresAt });

    return updated?.expiresAt ?? null;
  }

  private async getQueuePosition(requestId: string): Promise<number> {
    const [anchor] = await this.db
      .select({
        createdAt: matchRequests.createdAt,
        id: matchRequests.id,
      })
      .from(matchRequests)
      .where(
        and(
          eq(matchRequests.id, requestId),
          eq(matchRequests.status, 'pending'),
          gt(matchRequests.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!anchor) {
      return 1;
    }

    const [positionRow] = await this.db
      .select({
        position: sql<number>`count(*)::int + 1`,
      })
      .from(matchRequests)
      .where(
        and(
          eq(matchRequests.status, 'pending'),
          gt(matchRequests.expiresAt, new Date()),
          or(
            lt(matchRequests.createdAt, anchor.createdAt),
            and(eq(matchRequests.createdAt, anchor.createdAt), lt(matchRequests.id, anchor.id)),
          )!,
        ),
      );

    return Math.max(1, positionRow?.position ?? 1);
  }

  private toSearchingStatus(
    request: ActiveMatchRequest,
    queuePosition: number,
  ): GetMatchmakingStatusResponse {
    return {
      status: 'searching',
      requestId: request.id,
      queuePosition,
      expiresAt: request.expiresAt.toISOString(),
      preferences: this.parsePreferencesFromRow(request),
    };
  }

  private toMatchedStatus(request: ActiveMatchRequest): GetMatchmakingStatusResponse {
    return {
      status: 'matched',
      requestId: request.id,
      roomId: request.matchedRoomId!,
      matchedWithUserId: request.matchedWithUserId!,
      expiresAt: request.expiresAt.toISOString(),
      preferences: this.parsePreferencesFromRow(request),
    };
  }

  private parsePreferencesFromRow(
    request: Pick<
      ActiveMatchRequest,
      'difficulty' | 'language' | 'requestedRole' | 'requestedTags'
    >,
  ): MatchmakingPreferences {
    const parsed = matchmakingPreferencesSchema.safeParse(request.requestedTags);
    if (parsed.success) {
      return this.normalizePreferences(parsed.data);
    }

    return this.normalizePreferences({
      languages: request.language ? [request.language] : [],
      difficulties: request.difficulty ? [request.difficulty] : [],
      problemIds: [],
      topics: [],
      roles:
        request.requestedRole && isRoomRole(request.requestedRole) ? [request.requestedRole] : [],
    });
  }

  private normalizePreferences(input: EnterMatchmakingQueueInput): MatchmakingPreferences {
    const languageSet = new Set(input.languages ?? []);
    const difficultySet = new Set(input.difficulties ?? []);
    const problemSet = new Set(input.problemIds ?? []);
    const topicSet = new Set(
      (input.topics ?? []).map((topic) => topic.trim()).filter((topic) => topic.length > 0),
    );
    const roleSet = new Set(input.roles ?? []);

    return {
      languages: SUPPORTED_LANGUAGES.filter((language) => languageSet.has(language)),
      difficulties: PROBLEM_DIFFICULTIES.filter((difficulty) => difficultySet.has(difficulty)),
      problemIds: [...problemSet],
      topics: [...topicSet],
      roles: JOINABLE_ROLES.filter((role) => roleSet.has(role)),
    };
  }

  private async tryMatchPair(
    first: PendingMatchRequest,
    second: PendingMatchRequest,
  ): Promise<boolean> {
    if (!(await this.arePendingRequestsCurrent([first.id, second.id]))) {
      return false;
    }

    const firstPreferences = this.parsePreferencesFromRow(first);
    const secondPreferences = this.parsePreferencesFromRow(second);
    const roleAssignment = this.resolvePairRoleAssignment(firstPreferences, secondPreferences);

    if (!this.isPairCompatible(firstPreferences, secondPreferences) || !roleAssignment) {
      return false;
    }

    const roomLanguage = this.resolveMatchLanguage(firstPreferences, secondPreferences);
    const roomProblemId = await this.resolveMatchProblemId(firstPreferences, secondPreferences);
    if (this.hasAnyProblemConstraint(firstPreferences, secondPreferences) && !roomProblemId) {
      return false;
    }

    const hostRequest = roleAssignment.hostRequester === 'first' ? first : second;
    const joinerRequest = roleAssignment.hostRequester === 'first' ? second : first;
    let createdRoomId: string | null = null;

    try {
      const createResult = await this.roomsService.createRoom(hostRequest.userId, {
        mode: 'peer',
        name: MatchmakingService.MATCH_ROOM_NAME,
        language: roomLanguage,
        ...(roomProblemId ? { problemId: roomProblemId } : {}),
        config: {
          isPrivate: false,
          maxDuration: MatchmakingService.MATCH_ROOM_MAX_DURATION_MIN,
          maxParticipants: MatchmakingService.MATCH_ROOM_MAX_PARTICIPANTS,
        },
      });
      createdRoomId = createResult.roomId;

      await this.roomsService.joinRoom(createResult.roomId, joinerRequest.userId, {
        requestedRole: roleAssignment.joinerRequestedRole,
      });

      const matchCommitted = await this.db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: matchRequests.id,
            status: matchRequests.status,
            expiresAt: matchRequests.expiresAt,
          })
          .from(matchRequests)
          .where(inArray(matchRequests.id, [first.id, second.id]))
          .for('update');

        const rowsArePending = locked.every(
          (row) => row.status === 'pending' && row.expiresAt.getTime() > Date.now(),
        );
        if (!rowsArePending || locked.length !== 2) {
          return false;
        }

        await tx
          .update(matchRequests)
          .set({
            status: 'matched',
            matchedRoomId: createResult.roomId,
            matchedWithUserId: second.userId,
          })
          .where(eq(matchRequests.id, first.id));

        await tx
          .update(matchRequests)
          .set({
            status: 'matched',
            matchedRoomId: createResult.roomId,
            matchedWithUserId: first.userId,
          })
          .where(eq(matchRequests.id, second.id));

        return true;
      });

      if (!matchCommitted) {
        await this.cleanupCreatedMatchRoom(createdRoomId, hostRequest.userId);
        return false;
      }

      return true;
    } catch (error) {
      if (createdRoomId) {
        await this.cleanupCreatedMatchRoom(createdRoomId, hostRequest.userId);
      }
      this.logger.warn(
        `Matchmaking pair failed (${first.userId}, ${second.userId}): ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async tryMatchExistingRoom(request: PendingMatchRequest): Promise<boolean> {
    if (!(await this.isPendingRequestCurrent(request.id))) {
      return false;
    }

    const preferences = this.parsePreferencesFromRow(request);
    const candidates = await this.listExistingRoomCandidates(preferences, request.userId);

    for (const candidate of candidates) {
      const requestedRoles = this.resolveRequestedRolesForRoomStatus(preferences, candidate.status);
      if (requestedRoles.length === 0) {
        continue;
      }

      for (const requestedRole of requestedRoles) {
        try {
          await this.roomsService.joinRoom(candidate.roomId, request.userId, {
            ...(requestedRole ? { requestedRole } : {}),
          });
        } catch {
          continue;
        }

        const [updated] = await this.db
          .update(matchRequests)
          .set({
            status: 'matched',
            matchedRoomId: candidate.roomId,
            matchedWithUserId: candidate.hostId,
          })
          .where(
            and(
              eq(matchRequests.id, request.id),
              eq(matchRequests.status, 'pending'),
              gt(matchRequests.expiresAt, new Date()),
            ),
          )
          .returning({ id: matchRequests.id });

        if (!updated) {
          this.logger.warn(
            `Request ${request.id} joined room ${candidate.roomId} but status update was skipped`,
          );
          await this.cleanupJoinedExistingRoom(candidate.roomId, request.userId);
          return false;
        }
        return true;
      }
    }

    return false;
  }

  private async isPendingRequestCurrent(requestId: string): Promise<boolean> {
    return this.arePendingRequestsCurrent([requestId]);
  }

  private async arePendingRequestsCurrent(requestIds: string[]): Promise<boolean> {
    const rows = await this.db
      .select({
        id: matchRequests.id,
        status: matchRequests.status,
        expiresAt: matchRequests.expiresAt,
      })
      .from(matchRequests)
      .where(inArray(matchRequests.id, requestIds));

    if (rows.length !== requestIds.length) {
      return false;
    }

    const now = Date.now();
    return rows.every((row) => row.status === 'pending' && row.expiresAt.getTime() > now);
  }

  private async cleanupCreatedMatchRoom(roomId: string, hostUserId: string): Promise<void> {
    try {
      await this.roomsService.destroyRoom(roomId, hostUserId);
    } catch (error) {
      this.logger.warn(
        `Failed to clean up uncommitted match room ${roomId}: ${(error as Error).message}`,
      );
    }
  }

  private async cleanupJoinedExistingRoom(roomId: string, userId: string): Promise<void> {
    try {
      await this.roomsService.markParticipantInactive(roomId, userId, new Date());
    } catch (error) {
      this.logger.warn(
        `Failed to roll back uncommitted matchmaking join for room ${roomId}: ${(error as Error).message}`,
      );
    }
  }

  private async listExistingRoomCandidates(
    preferences: MatchmakingPreferences,
    userId: string,
  ): Promise<ExistingRoomCandidate[]> {
    const conditions = [
      eq(rooms.isPrivate, false),
      eq(rooms.status, RoomStatus.WAITING),
      ne(rooms.hostId, userId),
      or(isNull(rooms.problemId), eq(problems.isPublished, true))!,
      sql`(select count(*)::int from room_participants rp
           where rp.room_id = ${rooms.id} and rp.is_active = true) > 0`,
      sql`(select count(*)::int from room_participants rp
           where rp.room_id = ${rooms.id} and rp.is_active = true) < ${rooms.maxParticipants}`,
      sql`not exists (
          select 1
          from room_participants rp
          where rp.room_id = ${rooms.id}
            and rp.user_id = ${userId}
            and rp.is_active = true
        )`,
    ];

    if (preferences.languages.length > 0) {
      conditions.push(inArray(rooms.language, preferences.languages));
    }
    if (preferences.difficulties.length > 0) {
      conditions.push(inArray(problems.difficulty, preferences.difficulties));
    }
    if (preferences.problemIds.length > 0) {
      conditions.push(inArray(rooms.problemId, preferences.problemIds));
    }
    if (preferences.topics.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1
          FROM problem_tags pt
          INNER JOIN tags t ON t.id = pt.tag_id
          WHERE pt.problem_id = ${rooms.problemId}
            AND t.slug IN (${sql.join(
              preferences.topics.map((topic) => sql`${topic}`),
              sql`, `,
            )})
        )`,
      );
    }

    const rows = await this.db
      .select({
        roomId: rooms.id,
        status: rooms.status,
        hostId: rooms.hostId,
        participantCount: sql<number>`(
          select count(*)::int
          from room_participants rp
          where rp.room_id = ${rooms.id}
            and rp.is_active = true
        )`.as('participant_count'),
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .leftJoin(problems, eq(problems.id, rooms.problemId))
      .where(and(...conditions))
      .orderBy(asc(rooms.createdAt), asc(rooms.id))
      .limit(100);

    return rows.sort((left, right) => {
      const waitingFirst =
        Number(left.status !== RoomStatus.WAITING) - Number(right.status !== RoomStatus.WAITING);
      if (waitingFirst !== 0) {
        return waitingFirst;
      }

      const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return left.roomId.localeCompare(right.roomId);
    });
  }

  private resolveRequestedRolesForRoomStatus(
    preferences: MatchmakingPreferences,
    status: (typeof RoomStatus)[keyof typeof RoomStatus],
  ): Array<MatchmakingPreferences['roles'][number] | null> {
    if (status !== RoomStatus.WAITING) {
      return [];
    }

    if (preferences.roles.length === 0) {
      return [null];
    }

    return [...preferences.roles];
  }

  private isPairCompatible(first: MatchmakingPreferences, second: MatchmakingPreferences): boolean {
    if (!this.hasOverlapOrAny(first.languages, second.languages)) {
      return false;
    }

    if (!this.hasOverlapOrAny(first.difficulties, second.difficulties)) {
      return false;
    }

    if (
      first.problemIds.length > 0 &&
      second.problemIds.length > 0 &&
      this.resolveIntersection(first.problemIds, second.problemIds).length === 0
    ) {
      return false;
    }

    if (!this.hasOverlapOrAny(first.topics, second.topics)) {
      return false;
    }

    if (!this.resolvePairRoleAssignment(first, second)) {
      return false;
    }

    return true;
  }

  private resolvePairRoleAssignment(
    first: MatchmakingPreferences,
    second: MatchmakingPreferences,
  ): {
    hostRequester: 'first' | 'second';
    joinerRequestedRole: MatchmakingPreferences['roles'][number];
  } | null {
    const firstCanInterview = this.canTakeRole(first.roles, RoomRole.INTERVIEWER);
    const firstCanCandidate = this.canTakeRole(first.roles, RoomRole.CANDIDATE);
    const secondCanInterview = this.canTakeRole(second.roles, RoomRole.INTERVIEWER);
    const secondCanCandidate = this.canTakeRole(second.roles, RoomRole.CANDIDATE);

    if (firstCanInterview && secondCanCandidate) {
      return {
        hostRequester: 'first',
        joinerRequestedRole: RoomRole.CANDIDATE,
      };
    }

    if (secondCanInterview && firstCanCandidate) {
      return {
        hostRequester: 'second',
        joinerRequestedRole: RoomRole.CANDIDATE,
      };
    }

    return null;
  }

  private canTakeRole(
    preferredRoles: MatchmakingPreferences['roles'],
    role: MatchmakingPreferences['roles'][number],
  ): boolean {
    if (preferredRoles.length === 0) {
      return true;
    }

    return preferredRoles.includes(role);
  }

  private hasOverlapOrAny<T extends string>(left: T[], right: T[]): boolean {
    if (left.length === 0 || right.length === 0) {
      return true;
    }
    return this.resolveIntersection(left, right).length > 0;
  }

  private resolveIntersection<T extends string>(left: T[], right: T[]): T[] {
    const rightSet = new Set(right);
    return left.filter((value) => rightSet.has(value));
  }

  private resolveMatchLanguage(
    first: MatchmakingPreferences,
    second: MatchmakingPreferences,
  ): SupportedLanguage {
    const shared = this.resolveIntersection(first.languages, second.languages);
    if (shared[0]) {
      return shared[0];
    }
    if (first.languages[0]) {
      return first.languages[0];
    }
    if (second.languages[0]) {
      return second.languages[0];
    }
    return 'python';
  }

  private hasAnyProblemConstraint(
    first: MatchmakingPreferences,
    second: MatchmakingPreferences,
  ): boolean {
    return (
      first.problemIds.length > 0 ||
      second.problemIds.length > 0 ||
      first.difficulties.length > 0 ||
      second.difficulties.length > 0 ||
      first.topics.length > 0 ||
      second.topics.length > 0
    );
  }

  private async resolveMatchProblemId(
    first: MatchmakingPreferences,
    second: MatchmakingPreferences,
  ): Promise<string | undefined> {
    const effectiveProblemIds = this.resolveEffectiveProblemIds(
      first.problemIds,
      second.problemIds,
    );
    const effectiveDifficulties = this.resolveEffectiveDifficulties(
      first.difficulties,
      second.difficulties,
    );
    const effectiveTopics = this.resolveEffectiveTopics(first.topics, second.topics);

    const conditions = [eq(problems.isPublished, true)];
    if (effectiveProblemIds.length > 0) {
      conditions.push(inArray(problems.id, effectiveProblemIds));
    }
    if (effectiveDifficulties.length > 0) {
      conditions.push(inArray(problems.difficulty, effectiveDifficulties));
    }
    if (effectiveTopics.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1
          FROM problem_tags pt
          INNER JOIN tags t ON t.id = pt.tag_id
          WHERE pt.problem_id = ${problems.id}
            AND t.slug IN (${sql.join(
              effectiveTopics.map((topic) => sql`${topic}`),
              sql`, `,
            )})
        )`,
      );
    }

    const randomizeProblemChoice = effectiveProblemIds.length > 0;
    const [problem] = await this.db
      .select({ id: problems.id })
      .from(problems)
      .where(and(...conditions))
      .orderBy(
        ...(randomizeProblemChoice
          ? [sql`random()`]
          : [desc(problems.updatedAt), desc(problems.id)]),
      )
      .limit(1);

    return problem?.id;
  }

  private resolveEffectiveProblemIds(left: string[], right: string[]): string[] {
    if (left.length > 0 && right.length > 0) {
      return this.resolveIntersection(left, right);
    }
    if (left.length > 0) {
      return left;
    }
    return right;
  }

  private resolveEffectiveDifficulties(
    left: ProblemDifficulty[],
    right: ProblemDifficulty[],
  ): ProblemDifficulty[] {
    if (left.length > 0 && right.length > 0) {
      return this.resolveIntersection(left, right);
    }
    if (left.length > 0) {
      return left;
    }
    return right;
  }

  private resolveEffectiveTopics(left: string[], right: string[]): string[] {
    if (left.length > 0 && right.length > 0) {
      return this.resolveIntersection(left, right);
    }
    if (left.length > 0) {
      return left;
    }
    return right;
  }
}
