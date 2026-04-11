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
  type RoleAssignmentReason,
  type RoomConfig,
  type RunCodeRequest,
  type TestCaseInput,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  aiHints,
  aiMessages,
  aiReviews,
  codeSnapshots,
  matchRequests,
  peerFeedback,
  problems,
  roomParticipants,
  rooms,
  runs,
  sessionParticipants,
  sessions,
  submissions,
  users,
} from '@syncode/db';
import {
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  INVITE_CODE_MAX_RETRIES,
  isRoomRole,
  isValidStatusTransition,
  type RoomMode,
  RoomRole,
  RoomStatus,
  resolveRoomPermissions,
} from '@syncode/shared';
import {
  type IMediaService,
  type IStorageService,
  MEDIA_SERVICE,
  STORAGE_SERVICE,
} from '@syncode/shared/ports';
import { type PaginatedResult, paginate } from '@syncode/shared/server';
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import { resolveAvatarUrls } from '@/common/resolve-avatar-urls.js';
import type { EnvConfig } from '@/config/env.config.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import type {
  CreateRoomResult,
  DestroyRoomResult,
  JoinRoomResult,
  RoomDetailResult,
  RoomSummaryResult,
  TransferOwnershipResult,
  TransitionPhaseResult,
  UpdateParticipantRoleResult,
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
        role: this.getInitialHostRole(inserted.mode),
      });
      return inserted;
    });

    const [collabCreated, mediaCreated] = await Promise.all([
      this.createCollabDocument(room.id, room.status, room.editorLocked),
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
          myRole: this.normalizeParticipantRole(row.mode, row.myRole, row.hostId, userId),
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

    let assignedRole!: RoomRole;
    let assignmentReason!: RoleAssignmentReason;

    await this.db.transaction(async (tx) => {
      const existingParticipants = await tx
        .select({
          id: roomParticipants.id,
          userId: roomParticipants.userId,
          role: roomParticipants.role,
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

      const roleSelection = this.selectJoinRole(
        room.mode,
        existingParticipants
          .filter((participant) => participant.isActive)
          .map((participant) => ({
            userId: participant.userId,
            role: this.normalizeParticipantRole(
              room.mode,
              participant.role,
              room.hostId,
              participant.userId,
            ),
          })),
        input.requestedRole ?? null,
      );

      assignedRole = roleSelection.assignedRole;
      assignmentReason = roleSelection.assignmentReason;

      const nextActiveParticipants = existingParticipants
        .filter((participant) => participant.isActive && participant.userId !== userId)
        .map((participant) => ({
          userId: participant.userId,
          role: this.normalizeParticipantRole(
            room.mode,
            participant.role,
            room.hostId,
            participant.userId,
          ),
        }))
        .concat({ userId, role: assignedRole });

      this.assertActiveRoleConfiguration(room.mode, room.status, nextActiveParticipants);

      if (existing) {
        await tx
          .update(roomParticipants)
          .set({ role: assignedRole, isActive: true, leftAt: null, joinedAt: new Date() })
          .where(eq(roomParticipants.id, existing.id));
      } else {
        await tx
          .insert(roomParticipants)
          .values({
            roomId,
            userId,
            role: assignedRole,
          })
          .onConflictDoUpdate({
            target: [roomParticipants.roomId, roomParticipants.userId],
            set: { role: assignedRole, isActive: true, leftAt: null, joinedAt: new Date() },
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
      requestedRole: input.requestedRole ?? null,
      assignmentReason,
      myCapabilities: roomDetail.myCapabilities,
      collabToken,
      collabUrl,
    };
  }

  async transferOwnership(
    roomId: string,
    currentUserId: string,
    targetUserId: string,
  ): Promise<TransferOwnershipResult> {
    const [[room], [targetParticipant]] = await Promise.all([
      this.db.select().from(rooms).where(eq(rooms.id, roomId)),
      this.db
        .select({
          userId: roomParticipants.userId,
          isActive: roomParticipants.isActive,
        })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, targetUserId))),
    ]);

    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    if (room.hostId !== currentUserId) {
      throw new ForbiddenException({
        message: 'Only the host can transfer room ownership',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    if (room.status === RoomStatus.FINISHED) {
      throw new ConflictException({
        message: 'Cannot transfer ownership after the room has finished',
        code: ERROR_CODES.ROOM_FINISHED,
      });
    }

    if (!targetParticipant?.isActive) {
      throw new BadRequestException({
        message: 'Ownership can only be transferred to an active participant',
        code: ERROR_CODES.PARTICIPANT_CANNOT_TRANSFER_OWNERSHIP,
      });
    }

    const transferredAt = new Date();

    await this.db
      .update(rooms)
      .set({ hostId: targetUserId, updatedAt: transferredAt })
      .where(eq(rooms.id, roomId));

    return {
      roomId,
      previousHostId: room.hostId,
      currentHostId: targetUserId,
      transferredAt,
      transferredBy: currentUserId,
    };
  }

  async updateParticipantRole(
    roomId: string,
    actorUserId: string,
    targetUserId: string,
    nextRole: RoomRole,
  ): Promise<UpdateParticipantRoleResult> {
    const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));

    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    if (room.hostId !== actorUserId) {
      throw new ForbiddenException({
        message: 'Only the host can change participant roles',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    if (room.status === RoomStatus.FINISHED) {
      throw new ConflictException({
        message: 'Cannot change roles after the room has finished',
        code: ERROR_CODES.ROOM_FINISHED,
      });
    }

    this.assertRoleAllowedForMode(room.mode, nextRole);

    const updatedAt = new Date();
    let previousRole!: RoomRole;

    await this.db.transaction(async (tx) => {
      const participants = await tx
        .select({
          userId: roomParticipants.userId,
          role: roomParticipants.role,
          isActive: roomParticipants.isActive,
        })
        .from(roomParticipants)
        .where(eq(roomParticipants.roomId, roomId));

      const targetParticipant = participants.find(
        (participant) => participant.userId === targetUserId && participant.isActive,
      );

      if (!targetParticipant) {
        throw new NotFoundException({
          message: 'Participant not found',
          code: ERROR_CODES.PARTICIPANT_NOT_FOUND,
        });
      }

      previousRole = this.normalizeParticipantRole(
        room.mode,
        targetParticipant.role,
        room.hostId,
        targetParticipant.userId,
      );

      const nextActiveParticipants = participants
        .filter((participant) => participant.isActive)
        .map((participant) => ({
          userId: participant.userId,
          role:
            participant.userId === targetUserId
              ? nextRole
              : this.normalizeParticipantRole(
                  room.mode,
                  participant.role,
                  room.hostId,
                  participant.userId,
                ),
        }));

      this.assertActiveRoleConfiguration(room.mode, room.status, nextActiveParticipants);

      await tx
        .update(roomParticipants)
        .set({ role: nextRole })
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, targetUserId)));

      const [ongoingSession] = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.roomId, roomId), eq(sessions.status, 'ongoing')));

      if (ongoingSession) {
        await tx
          .update(sessionParticipants)
          .set({ role: nextRole })
          .where(
            and(
              eq(sessionParticipants.sessionId, ongoingSession.id),
              eq(sessionParticipants.userId, targetUserId),
            ),
          );
      }
    });

    const [updatedRoom, participantRows] = await Promise.all([
      this.db.query.rooms.findFirst({
        where: (table, { eq }) => eq(table.id, roomId),
      }),
      this.fetchParticipants(roomId),
    ]);

    if (!updatedRoom || !previousRole) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    return {
      room: await this.assembleRoomDetail(updatedRoom, participantRows, actorUserId),
      updatedUserId: targetUserId,
      previousRole,
      currentRole: nextRole,
      updatedAt,
      updatedBy: actorUserId,
    };
  }

  async destroyRoom(roomId: string, userId: string): Promise<DestroyRoomResult> {
    const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));

    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    if (room.hostId !== userId) {
      throw new ForbiddenException({
        message: 'Only the host can destroy this room',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    if (room.status === RoomStatus.FINISHED) {
      throw new ConflictException({
        message: 'Finished rooms cannot be destroyed',
        code: ERROR_CODES.ROOM_FINISHED,
      });
    }

    const [collab, mediaDeleted] = await Promise.all([
      this.destroyCollabDocument(roomId),
      this.deleteMediaRoom(roomId),
    ]);

    await this.db.transaction(async (tx) => {
      const roomSessionIds = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.roomId, roomId));

      const sessionIds = roomSessionIds.map((session) => session.id);

      await tx.delete(aiHints).where(eq(aiHints.roomId, roomId));
      await tx.delete(aiMessages).where(eq(aiMessages.roomId, roomId));
      await tx.delete(aiReviews).where(eq(aiReviews.roomId, roomId));
      await tx.delete(codeSnapshots).where(eq(codeSnapshots.roomId, roomId));
      await tx.delete(matchRequests).where(eq(matchRequests.matchedRoomId, roomId));
      await tx.delete(peerFeedback).where(eq(peerFeedback.roomId, roomId));
      await tx.delete(runs).where(eq(runs.roomId, roomId));
      await tx.delete(submissions).where(eq(submissions.roomId, roomId));

      if (sessionIds.length > 0) {
        await tx
          .delete(sessionParticipants)
          .where(inArray(sessionParticipants.sessionId, sessionIds));
      }

      await tx.delete(sessions).where(eq(sessions.roomId, roomId));
      await tx.delete(rooms).where(eq(rooms.id, roomId));
    });

    this.logger.log(
      `Room ${roomId} destroyed. Collab: ${collab ? 'ok' : 'failed'}, media: ${mediaDeleted ? 'ok' : 'failed'}`,
    );

    return { collab, mediaDeleted };
  }

  async runCode(
    roomId: string,
    userId: string,
    request: RunCodeRequest,
  ): Promise<{ jobId: string }> {
    await this.assertRoomCapability(roomId, userId, 'code:run');
    const { jobId } = await this.executionClient.submit(request);
    this.logger.debug(`Code execution submitted: ${jobId}`);
    return { jobId };
  }

  async submitProblem(
    roomId: string,
    userId: string,
    request: RunCodeRequest,
    testCases: TestCaseInput[],
  ): Promise<
    Array<{ jobId: string | null; testCaseIndex: number; description?: string; error?: string }>
  > {
    await this.assertRoomCapability(roomId, userId, 'code:submit');

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
    const normalizedParticipants = participantRows.map((participant) => ({
      ...participant,
      role: this.normalizeParticipantRole(
        room.mode,
        participant.role,
        room.hostId,
        participant.userId,
      ),
    }));
    const myParticipation = normalizedParticipants.find((p) => p.userId === userId && p.isActive);
    if (!myParticipation) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const myRole = myParticipation.role as RoomRole;
    const myCapabilities = resolveRoomPermissions(myRole, {
      isHost: room.hostId === userId,
    });

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
      participants: normalizedParticipants,
      myRole,
      myCapabilities: [...myCapabilities],
      currentPhaseStartedAt: room.phaseStartedAt,
      timerPaused: room.timerPaused,
      elapsedMs: room.elapsedMs,
      editorLocked: room.editorLocked,
      createdAt: room.createdAt,
    };
  }

  async transitionPhase(
    roomId: string,
    userId: string,
    targetStatus: RoomStatus,
  ): Promise<TransitionPhaseResult> {
    // Read participant info outside the transaction for permission checks.
    const [room, participant] = await this.getRoomContext(roomId, userId);

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    if (room.hostId !== userId && participant.role !== RoomRole.INTERVIEWER) {
      throw new ForbiddenException({
        message: 'You do not have permission to change the room phase',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    const now = new Date();

    // Re-read the room row inside the transaction with FOR UPDATE to prevent
    // concurrent transitions from both seeing the same status.
    const { previousStatus, editorLocked } = await this.db.transaction(async (tx) => {
      const [lockedRoom] = await tx
        .select({
          status: rooms.status,
          editorLocked: rooms.editorLocked,
          phaseStartedAt: rooms.phaseStartedAt,
          timerPaused: rooms.timerPaused,
          elapsedMs: rooms.elapsedMs,
          mode: rooms.mode,
          hostId: rooms.hostId,
          problemId: rooms.problemId,
          language: rooms.language,
        })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .for('update');

      if (!lockedRoom) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
      }

      const lockedStatus = lockedRoom.status as RoomStatus;

      if (!isValidStatusTransition(lockedStatus, targetStatus)) {
        throw new BadRequestException({
          message: `Cannot transition from '${lockedStatus}' to '${targetStatus}'`,
          code: ERROR_CODES.ROOM_INVALID_TRANSITION,
        });
      }

      const computedElapsedMs =
        lockedStatus === RoomStatus.CODING && lockedRoom.phaseStartedAt && !lockedRoom.timerPaused
          ? lockedRoom.elapsedMs + Math.max(0, now.getTime() - lockedRoom.phaseStartedAt.getTime())
          : lockedRoom.elapsedMs;

      if (lockedStatus === RoomStatus.WAITING && targetStatus === RoomStatus.WARMUP) {
        const activeParticipants = await this.fetchActiveParticipants(tx, {
          ...room,
          ...lockedRoom,
        });
        this.assertActiveRoleConfiguration(
          lockedRoom.mode as RoomMode,
          RoomStatus.WARMUP,
          activeParticipants,
        );
      }

      const roomUpdate: Partial<typeof rooms.$inferInsert> = {
        status: targetStatus,
        phaseStartedAt: now,
        elapsedMs: computedElapsedMs,
      };

      if (lockedStatus === RoomStatus.CODING || targetStatus === RoomStatus.CODING) {
        roomUpdate.timerPaused = false;
      }

      if (targetStatus === RoomStatus.FINISHED) {
        roomUpdate.endedAt = now;
      }

      await tx.update(rooms).set(roomUpdate).where(eq(rooms.id, roomId));

      if (lockedStatus === RoomStatus.WAITING && targetStatus === RoomStatus.WARMUP) {
        const [session] = await tx
          .insert(sessions)
          .values({
            roomId,
            problemId: lockedRoom.problemId,
            mode: lockedRoom.mode,
            language: lockedRoom.language,
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
            participantRows.map((participantRow) => ({
              sessionId: session!.id,
              userId: participantRow.userId,
              role: this.normalizeParticipantRole(
                lockedRoom.mode as RoomMode,
                participantRow.role,
                lockedRoom.hostId,
                participantRow.userId,
              ),
              joinedAt: participantRow.joinedAt,
            })),
          );
        }
      }

      if (targetStatus === RoomStatus.FINISHED && lockedStatus !== RoomStatus.WAITING) {
        await tx
          .update(sessions)
          .set({
            status: 'finished',
            finishedAt: now,
            durationMs: computedElapsedMs,
          })
          .where(eq(sessions.roomId, roomId));
      }

      return {
        previousStatus: lockedStatus,
        editorLocked: lockedRoom.editorLocked,
      };
    });

    this.logger.log(
      `Room ${roomId} transitioned from '${previousStatus}' to '${targetStatus}' by user ${userId}`,
    );

    // Fire-and-forget collab notification stays outside the transaction.
    void this.updateCollabRoomState(roomId, targetStatus, editorLocked);

    return {
      roomId,
      previousStatus,
      currentStatus: targetStatus,
      transitionedAt: now,
      transitionedBy: userId,
    };
  }

  private getInitialHostRole(mode: RoomMode): RoomRole {
    return mode === 'peer' ? RoomRole.INTERVIEWER : RoomRole.CANDIDATE;
  }

  private assertRoleAllowedForMode(mode: RoomMode, role: RoomRole): void {
    if (mode === 'ai' && role === RoomRole.INTERVIEWER) {
      throw new ConflictException({
        message: 'AI rooms do not support interviewer participants',
        code: ERROR_CODES.ROOM_NOT_PEER_MODE,
      });
    }
  }

  private selectJoinRole(
    mode: RoomMode,
    activeParticipants: Array<{ userId: string; role: RoomRole }>,
    requestedRole: RoomRole | null,
  ): { assignedRole: RoomRole; assignmentReason: RoleAssignmentReason } {
    const activeInterviewer = activeParticipants.some(
      (participant) => participant.role === RoomRole.INTERVIEWER,
    );
    const activeCandidate = activeParticipants.some(
      (participant) => participant.role === RoomRole.CANDIDATE,
    );

    if (requestedRole) {
      this.assertRoleAllowedForMode(mode, requestedRole);

      if (requestedRole === RoomRole.OBSERVER) {
        return { assignedRole: requestedRole, assignmentReason: 'requested' };
      }

      if (requestedRole === RoomRole.INTERVIEWER && !activeInterviewer) {
        return { assignedRole: requestedRole, assignmentReason: 'requested' };
      }

      if (requestedRole === RoomRole.CANDIDATE && !activeCandidate) {
        return { assignedRole: requestedRole, assignmentReason: 'requested' };
      }

      throw new ConflictException({
        message: 'Requested room role is not currently available',
        code: ERROR_CODES.ROOM_ROLE_UNAVAILABLE,
      });
    }

    if (mode === 'peer') {
      if (!activeInterviewer) {
        return { assignedRole: RoomRole.INTERVIEWER, assignmentReason: 'auto-assigned' };
      }

      if (!activeCandidate) {
        return { assignedRole: RoomRole.CANDIDATE, assignmentReason: 'auto-assigned' };
      }
    } else if (!activeCandidate) {
      return { assignedRole: RoomRole.CANDIDATE, assignmentReason: 'auto-assigned' };
    }

    return { assignedRole: RoomRole.OBSERVER, assignmentReason: 'fallback-observer' };
  }

  private assertActiveRoleConfiguration(
    mode: RoomMode,
    status: RoomStatus,
    activeParticipants: Array<{ userId: string; role: RoomRole }>,
  ): void {
    const interviewerCount = activeParticipants.filter(
      (participant) => participant.role === RoomRole.INTERVIEWER,
    ).length;
    const candidateCount = activeParticipants.filter(
      (participant) => participant.role === RoomRole.CANDIDATE,
    ).length;

    if (mode === 'peer') {
      if (interviewerCount > 1 || candidateCount > 1) {
        throw new ConflictException({
          message: 'Peer rooms can only have one active interviewer and one active candidate',
          code: ERROR_CODES.ROOM_ROLE_CONSTRAINT_VIOLATION,
        });
      }

      if (status !== RoomStatus.WAITING && (interviewerCount !== 1 || candidateCount !== 1)) {
        throw new ConflictException({
          message: 'Peer rooms require exactly one active interviewer and one active candidate',
          code: ERROR_CODES.ROOM_ROLE_CONSTRAINT_VIOLATION,
        });
      }

      return;
    }

    if (interviewerCount > 0 || candidateCount > 1) {
      throw new ConflictException({
        message: 'AI rooms support at most one active candidate and no interviewer participants',
        code: ERROR_CODES.ROOM_ROLE_CONSTRAINT_VIOLATION,
      });
    }

    if (status !== RoomStatus.WAITING && candidateCount !== 1) {
      throw new ConflictException({
        message: 'AI rooms require exactly one active candidate after the room starts',
        code: ERROR_CODES.ROOM_ROLE_CONSTRAINT_VIOLATION,
      });
    }
  }

  private async getRoomContext(roomId: string, userId: string) {
    const [[room], [participant]] = await Promise.all([
      this.db.select().from(rooms).where(eq(rooms.id, roomId)),
      this.db
        .select({
          userId: roomParticipants.userId,
          role: roomParticipants.role,
          isActive: roomParticipants.isActive,
        })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId))),
    ]);

    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    return [
      room,
      participant?.isActive
        ? {
            ...participant,
            role: this.normalizeParticipantRole(room.mode, participant.role, room.hostId, userId),
          }
        : null,
    ] as const;
  }

  private async fetchActiveParticipants(
    db: Pick<Database, 'select'>,
    room: typeof rooms.$inferSelect,
  ): Promise<Array<{ userId: string; role: RoomRole }>> {
    const participants = await db
      .select({
        userId: roomParticipants.userId,
        role: roomParticipants.role,
      })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.isActive, true)));

    return participants.map((participant) => ({
      userId: participant.userId,
      role: this.normalizeParticipantRole(
        room.mode,
        participant.role,
        room.hostId,
        participant.userId,
      ),
    }));
  }

  private normalizeParticipantRole(
    mode: RoomMode,
    role: string,
    hostId: string,
    userId: string,
  ): RoomRole {
    if (isRoomRole(role)) {
      return role;
    }

    if (role === 'spectator') {
      return RoomRole.OBSERVER;
    }

    if (role === 'host') {
      return mode === 'ai' ? RoomRole.CANDIDATE : RoomRole.INTERVIEWER;
    }

    this.logger.warn(
      `Unknown room role "${role}" for user ${userId} in room hosted by ${hostId}; falling back to observer`,
    );
    return RoomRole.OBSERVER;
  }

  private async assertRoomCapability(
    roomId: string,
    userId: string,
    capability: 'code:run' | 'code:submit',
  ): Promise<void> {
    const [room, participant] = await this.getRoomContext(roomId, userId);

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    if (room.editorLocked) {
      throw new ConflictException({
        message: 'The editor is locked for this room',
        code: ERROR_CODES.ROOM_EDITOR_LOCKED,
      });
    }

    const capabilities = resolveRoomPermissions(participant.role, {
      isHost: room.hostId === userId,
    });

    if (!capabilities.has(capability)) {
      throw new ForbiddenException({
        message: `You do not have permission to ${capability === 'code:run' ? 'run' : 'submit'} code in this room`,
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }
  }

  private async updateCollabRoomState(
    roomId: string,
    phase: RoomStatus,
    editorLocked: boolean,
  ): Promise<void> {
    try {
      await this.collabClient.updateRoomState({ roomId, phase, editorLocked });
    } catch (error) {
      this.logger.warn(`Failed to update collab room state for room ${roomId}`, error);
    }
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

  async markParticipantInactive(roomId: string, userId: string, leftAt: Date): Promise<void> {
    await this.db
      .update(roomParticipants)
      .set({ isActive: false, leftAt })
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
  }

  private async createCollabDocument(
    roomId: string,
    initialPhase: RoomStatus,
    editorLocked: boolean,
  ): Promise<boolean> {
    try {
      await this.collabClient.createDocument({ roomId, initialPhase, editorLocked });
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
