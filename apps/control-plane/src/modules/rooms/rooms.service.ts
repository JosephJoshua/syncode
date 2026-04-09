import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  COLLAB_CLIENT,
  type CreateRoomInput,
  type DestroyDocumentResponse,
  ERROR_CODES,
  EXECUTION_CLIENT,
  type ICollabClient,
  type IExecutionClient,
  type JoinRoomInput,
  type ListRoomsQuery,
  type RoomConfig,
  type RunCodeRequest,
  type TestCaseInput,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  problems,
  roomParticipants,
  rooms,
  sessionParticipants,
  sessions,
  users,
} from '@syncode/db';
import {
  getRoomPermissions,
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  INVITE_CODE_MAX_RETRIES,
  isValidStatusTransition,
  RoomRole,
  RoomStatus,
} from '@syncode/shared';
import {
  type IMediaService,
  type IStorageService,
  MEDIA_SERVICE,
  STORAGE_SERVICE,
} from '@syncode/shared/ports';
import { type PaginatedResult, paginate } from '@syncode/shared/server';
import { and, asc, desc, eq, gt, lt, or, sql } from 'drizzle-orm';
import { resolveAvatarUrls } from '@/common/resolve-avatar-urls.js';
import type { EnvConfig } from '@/config/env.config.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import type {
  CreateRoomResult,
  DestroyRoomResult,
  JoinRoomResult,
  RoomDetailResult,
  RoomSummaryResult,
  TransitionPhaseResult,
} from './rooms.types.js';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(EXECUTION_CLIENT)
    private readonly executionClient: IExecutionClient,
    @Inject(COLLAB_CLIENT)
    private readonly collabClient: ICollabClient,
    @Inject(MEDIA_SERVICE)
    private readonly mediaService: IMediaService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig>,
  ) {}

  async createRoom(hostId: string, input: CreateRoomInput): Promise<CreateRoomResult> {
    const room = await this.db.transaction(async (tx) => {
      const inserted = await this.insertRoomWithRetry(hostId, input, tx);
      await tx.insert(roomParticipants).values({
        roomId: inserted.id,
        userId: hostId,
        role: 'host',
      });
      return inserted;
    });

    const [collabCreated, mediaCreated] = await Promise.all([
      this.createCollabDocument(room.id),
      this.createMediaRoom(room.id),
    ]);

    this.logger.log(
      `Room ${room.id} created. Collab: ${collabCreated ? 'ok' : 'failed'}, media: ${mediaCreated ? 'ok' : 'failed'}`,
    );

    return {
      roomId: room.id,
      roomCode: room.inviteCode,
      name: room.name,
      status: room.status,
      mode: room.mode,
      hostId: room.hostId,
      problemId: room.problemId,
      language: room.language,
      config: this.buildRoomConfig(room),
      createdAt: room.createdAt,
      collabCreated,
      mediaCreated,
    };
  }

  async listRooms(
    userId: string,
    query: ListRoomsQuery,
  ): Promise<PaginatedResult<RoomSummaryResult>> {
    const sortDir = query.sortOrder === 'asc' ? asc : desc;
    const compareOp = query.sortOrder === 'asc' ? gt : lt;

    return paginate<RoomSummaryResult>({
      cursor: query.cursor,
      limit: query.limit,
      getCursorValues: (row) => [
        query.sortBy === 'status' ? row.status : row.createdAt.toISOString(),
        row.roomId,
      ],
      fetchPage: async (decoded, fetchLimit) => {
        const conditions = [eq(roomParticipants.userId, userId)];

        if (query.status) conditions.push(eq(rooms.status, query.status));
        if (query.mode) conditions.push(eq(rooms.mode, query.mode));

        if (decoded?.length === 2 && decoded[0] && decoded[1]) {
          const [cursorSort, cursorId] = decoded;

          if (query.sortBy === 'status') {
            conditions.push(
              or(
                compareOp(rooms.status, cursorSort as RoomStatus),
                and(eq(rooms.status, cursorSort as RoomStatus), compareOp(rooms.id, cursorId)),
              )!,
            );
          } else {
            const cursorDate = new Date(cursorSort);
            if (!Number.isNaN(cursorDate.getTime())) {
              conditions.push(
                or(
                  compareOp(rooms.createdAt, cursorDate),
                  and(eq(rooms.createdAt, cursorDate), compareOp(rooms.id, cursorId)),
                )!,
              );
            }
          }
        }

        const rows = await this.db
          .select({
            roomId: rooms.id,
            roomCode: rooms.inviteCode,
            name: rooms.name,
            status: rooms.status,
            mode: rooms.mode,
            hostId: rooms.hostId,
            myRole: roomParticipants.role,
            problemTitle: problems.title,
            language: rooms.language,
            participantCount: sql<number>`(
              select count(*)::int from room_participants rp
              where rp.room_id = ${rooms.id} and rp.is_active = true
            )`.as('participant_count'),
            createdAt: rooms.createdAt,
          })
          .from(roomParticipants)
          .innerJoin(rooms, eq(rooms.id, roomParticipants.roomId))
          .leftJoin(problems, eq(problems.id, rooms.problemId))
          .where(and(...conditions))
          .orderBy(
            sortDir(query.sortBy === 'status' ? rooms.status : rooms.createdAt),
            sortDir(rooms.id),
          )
          .limit(fetchLimit);

        return rows.map((row) => ({
          ...row,
          problemTitle: row.problemTitle ?? null,
        }));
      },
    });
  }

  async getRoom(roomId: string, userId: string): Promise<RoomDetailResult> {
    const [[room], participantRows] = await Promise.all([
      this.db.select().from(rooms).where(eq(rooms.id, roomId)),
      this.fetchParticipants(roomId),
    ]);

    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    return this.assembleRoomDetail(room, participantRows, userId);
  }

  async joinRoom(roomId: string, userId: string, input: JoinRoomInput): Promise<JoinRoomResult> {
    const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    if (room.inviteCode !== input.roomCode.toUpperCase()) {
      throw new BadRequestException({
        message: 'Invalid room code',
        code: ERROR_CODES.ROOM_INVALID_CODE,
      });
    }

    if (room.status === RoomStatus.FINISHED) {
      throw new ConflictException({
        message: 'Room has already finished',
        code: ERROR_CODES.ROOM_FINISHED,
      });
    }

    const assignedRole: RoomRole = input.preferredRole ?? RoomRole.CANDIDATE;

    await this.db.transaction(async (tx) => {
      const existingParticipants = await tx
        .select({
          id: roomParticipants.id,
          userId: roomParticipants.userId,
          isActive: roomParticipants.isActive,
        })
        .from(roomParticipants)
        .where(eq(roomParticipants.roomId, roomId));

      const existing = existingParticipants.find((p) => p.userId === userId);
      if (existing?.isActive) {
        throw new ConflictException({
          message: 'Already joined this room',
          code: ERROR_CODES.ROOM_ALREADY_JOINED,
        });
      }

      const activeCount = existingParticipants.filter((p) => p.isActive).length;
      if (activeCount >= room.maxParticipants) {
        throw new ConflictException({ message: 'Room is full', code: ERROR_CODES.ROOM_FULL });
      }

      if (existing) {
        await tx
          .update(roomParticipants)
          .set({ role: assignedRole, isActive: true, leftAt: null, joinedAt: new Date() })
          .where(eq(roomParticipants.id, existing.id));
      } else {
        await tx.insert(roomParticipants).values({
          roomId,
          userId,
          role: assignedRole,
        });
      }
    });

    const [roomDetail, collabToken] = await Promise.all([
      this.fetchParticipants(roomId).then((rows) => this.assembleRoomDetail(room, rows, userId)),
      this.jwtService.signAsync({
        sub: userId,
        roomId,
        role: assignedRole,
        type: 'collab',
      }),
    ]);

    const collabUrl = this.configService.get('COLLAB_PLANE_URL', { infer: true })!;

    return {
      room: roomDetail,
      assignedRole,
      myCapabilities: roomDetail.myCapabilities,
      collabToken,
      collabUrl,
    };
  }

  async destroyRoom(roomId: string): Promise<DestroyRoomResult> {
    const [collab, mediaDeleted] = await Promise.all([
      this.destroyCollabDocument(roomId),
      this.deleteMediaRoom(roomId),
    ]);

    this.logger.log(
      `Room ${roomId} destroyed. Collab: ${collab ? 'ok' : 'failed'}, media: ${mediaDeleted ? 'ok' : 'failed'}`,
    );

    return { collab, mediaDeleted };
  }

  async runCode(_roomId: string, request: RunCodeRequest): Promise<{ jobId: string }> {
    const { jobId } = await this.executionClient.submit(request);
    this.logger.debug(`Code execution submitted: ${jobId}`);
    return { jobId };
  }

  async submitProblem(
    _roomId: string,
    request: RunCodeRequest,
    testCases: TestCaseInput[],
  ): Promise<
    Array<{ jobId: string | null; testCaseIndex: number; description?: string; error?: string }>
  > {
    const submissions = testCases.map((testCase, i) => {
      const testRequest: RunCodeRequest = {
        ...request,
        stdin: testCase.input,
        timeoutMs: testCase.timeoutMs ?? request.timeoutMs,
        memoryMb: testCase.memoryMb ?? request.memoryMb,
      };

      return this.executionClient
        .submit(testRequest)
        .then(({ jobId }) => {
          this.logger.debug(`Test case ${i} submitted: ${jobId}`);
          return {
            jobId,
            testCaseIndex: i,
            description: testCase.description,
          };
        })
        .catch((error) => {
          this.logger.error(`Failed to submit test case ${i}`, error);
          return {
            jobId: null as string | null,
            testCaseIndex: i,
            description: testCase.description,
            error: 'submission_failed',
          };
        });
    });

    return Promise.all(submissions);
  }

  private fetchParticipants(roomId: string) {
    return this.db
      .select({
        userId: roomParticipants.userId,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: roomParticipants.role,
        isActive: roomParticipants.isActive,
        joinedAt: roomParticipants.joinedAt,
      })
      .from(roomParticipants)
      .innerJoin(users, eq(users.id, roomParticipants.userId))
      .where(eq(roomParticipants.roomId, roomId));
  }

  private async assembleRoomDetail(
    room: typeof rooms.$inferSelect,
    participantRows: Awaited<ReturnType<typeof this.fetchParticipants>>,
    userId: string,
  ): Promise<RoomDetailResult> {
    participantRows = await resolveAvatarUrls(participantRows, this.storageService);
    const myParticipation = participantRows.find((p) => p.userId === userId);
    if (!myParticipation) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const myRole = myParticipation.role as RoomRole;

    return {
      roomId: room.id,
      roomCode: room.inviteCode,
      name: room.name,
      status: room.status,
      mode: room.mode,
      hostId: room.hostId,
      problemId: room.problemId,
      language: room.language,
      config: this.buildRoomConfig(room),
      participants: participantRows,
      myRole,
      myCapabilities: [...getRoomPermissions(myRole)],
      currentPhaseStartedAt: room.phaseStartedAt,
      timerPaused: room.timerPaused,
      elapsedMs: room.elapsedMs,
      editorLocked: room.editorLocked,
      createdAt: room.createdAt,
    };
  }

  private buildRoomConfig(room: {
    maxParticipants: number;
    maxDuration: number;
    isPrivate: boolean;
  }): RoomConfig {
    return {
      maxParticipants: room.maxParticipants,
      maxDuration: room.maxDuration,
      isPrivate: room.isPrivate,
    };
  }

  private async insertRoomWithRetry(
    hostId: string,
    input: CreateRoomInput,
    db: Pick<Database, 'insert'> = this.db,
  ) {
    for (let attempt = 0; attempt < INVITE_CODE_MAX_RETRIES; attempt++) {
      const inviteCode = this.generateInviteCode();
      const rows = await db
        .insert(rooms)
        .values({
          hostId,
          name: input.name ?? null,
          mode: input.mode,
          language: input.language ?? null,
          problemId: input.problemId ?? null,
          maxParticipants: input.config.maxParticipants,
          maxDuration: input.config.maxDuration,
          isPrivate: input.config.isPrivate,
          inviteCode,
        })
        .onConflictDoNothing({ target: rooms.inviteCode })
        .returning();

      if (rows.length > 0) return rows[0]!;

      this.logger.warn(`Invite code collision on attempt ${attempt + 1}, retrying...`);
    }

    throw new InternalServerErrorException({
      message: 'Failed to generate unique invite code',
      code: ERROR_CODES.ROOM_INVITE_CODE_EXHAUSTED,
    });
  }

  private generateInviteCode(): string {
    const bytes = randomBytes(INVITE_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_CHARSET[bytes[i]! % INVITE_CODE_CHARSET.length];
    }
    return code;
  }

  async transitionPhase(
    roomId: string,
    userId: string,
    targetStatus: RoomStatus,
  ): Promise<TransitionPhaseResult> {
    const [[room], [participant]] = await Promise.all([
      this.db.select().from(rooms).where(eq(rooms.id, roomId)),
      this.db
        .select({ role: roomParticipants.role })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId))),
    ]);

    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const capabilities = getRoomPermissions(participant.role as RoomRole);
    if (!capabilities.has('room:change-phase')) {
      throw new ForbiddenException({
        message: 'You do not have permission to change the room phase',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    const previousStatus = room.status;

    if (!isValidStatusTransition(previousStatus, targetStatus)) {
      throw new BadRequestException({
        message: `Cannot transition from '${previousStatus}' to '${targetStatus}'`,
        code: ERROR_CODES.ROOM_INVALID_TRANSITION,
      });
    }

    const now = new Date();

    await this.db.transaction(async (tx) => {
      const roomUpdate: Partial<typeof rooms.$inferInsert> = {
        status: targetStatus,
        phaseStartedAt: now,
      };

      if (targetStatus === RoomStatus.FINISHED) {
        roomUpdate.endedAt = now;
      }

      await tx.update(rooms).set(roomUpdate).where(eq(rooms.id, roomId));

      // Create session when leaving 'waiting' (except waiting → finished)
      if (previousStatus === RoomStatus.WAITING && targetStatus !== RoomStatus.FINISHED) {
        const [session] = await tx
          .insert(sessions)
          .values({
            roomId,
            problemId: room.problemId,
            mode: room.mode,
            language: room.language,
            status: 'ongoing',
            startedAt: now,
          })
          .returning();

        const participantRows = await tx
          .select({
            userId: roomParticipants.userId,
            role: roomParticipants.role,
            joinedAt: roomParticipants.joinedAt,
          })
          .from(roomParticipants)
          .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.isActive, true)));

        if (participantRows.length > 0) {
          await tx.insert(sessionParticipants).values(
            participantRows.map((p) => ({
              sessionId: session!.id,
              userId: p.userId,
              role: p.role,
              joinedAt: p.joinedAt,
            })),
          );
        }
      }

      // Finalize session when entering 'finished' (only if session exists)
      if (targetStatus === RoomStatus.FINISHED && previousStatus !== RoomStatus.WAITING) {
        await tx
          .update(sessions)
          .set({
            status: 'finished',
            finishedAt: now,
            durationMs: room.elapsedMs,
          })
          .where(eq(sessions.roomId, roomId));
      }
    });

    this.logger.log(
      `Room ${roomId} transitioned from '${previousStatus}' to '${targetStatus}' by user ${userId}`,
    );

    void this.notifyCollabPhaseChange(roomId, targetStatus);

    // TODO: Queue a session report generation job when the room finishes.
    // This requires a dedicated AI-plane queue job type (e.g. 'ai.generate-session-report')
    // that doesn't exist yet. The report should be triggered once the final code snapshot
    // is available (i.e., after the collab-plane snapshot callback arrives), not here.
    // Tracking issue: implement IAiClient.submitSessionReportRequest() in ai-plane.

    return {
      roomId,
      previousStatus,
      currentStatus: targetStatus,
      transitionedAt: now,
      transitionedBy: userId,
    };
  }

  private async notifyCollabPhaseChange(roomId: string, newPhase: RoomStatus): Promise<void> {
    try {
      await this.collabClient.notifyPhaseChange({ roomId, newPhase });
    } catch (error) {
      this.logger.warn(`Failed to notify collab-plane of phase change for room ${roomId}`, error);
    }
  }

  async markParticipantInactive(roomId: string, userId: string, leftAt: Date): Promise<void> {
    await this.db
      .update(roomParticipants)
      .set({ isActive: false, leftAt })
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
  }

  private async createCollabDocument(roomId: string): Promise<boolean> {
    try {
      await this.collabClient.createDocument({ roomId });
      return true;
    } catch (error) {
      this.logger.warn(`Collab document creation failed for ${roomId}`, error);
      return false;
    }
  }

  private async destroyCollabDocument(roomId: string): Promise<DestroyDocumentResponse | null> {
    try {
      return await this.collabClient.destroyDocument(roomId);
    } catch (error) {
      this.logger.warn(`Collab document destruction failed for ${roomId}`, error);
      return null;
    }
  }

  private async createMediaRoom(roomId: string): Promise<boolean> {
    try {
      await this.mediaService.createRoom(roomId);
      return true;
    } catch (error) {
      this.logger.warn(`Media room creation failed for ${roomId}`, error);
      return false;
    }
  }

  private async deleteMediaRoom(roomId: string): Promise<boolean> {
    try {
      await this.mediaService.deleteRoom(roomId);
      return true;
    } catch (error) {
      this.logger.warn(`Media room deletion failed for ${roomId}`, error);
      return false;
    }
  }
}
