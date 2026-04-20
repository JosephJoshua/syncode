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
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  COLLAB_CLIENT,
  type CreateRoomInput,
  type DestroyDocumentResponse,
  ERROR_CODES,
  type ICollabClient,
  type JoinRoomInput,
  type ListRoomsQuery,
  type RoleAssignmentReason,
  type RoomConfig,
  type RunCodeRequest,
  type RunCodeResponse,
  type SubmitProblemInput,
  type SubmitResponse,
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
  roomDocSnapshots,
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
  type RoomCapability,
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
import { ExecutionService } from '@/modules/execution/execution.service.js';
import type {
  CreateRoomResult,
  DestroyRoomResult,
  JoinRoomResult,
  MediaTokenResult,
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
    private readonly executionService: ExecutionService,
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

    const initialContent = await this.resolveStarterContent(room);

    const [collabCreated, mediaCreated] = await Promise.all([
      this.createCollabDocument(room.id, room.status, room.editorLocked, initialContent),
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

    const detail = await this.assembleRoomDetail(room, participantRows, userId);

    if (room.status !== RoomStatus.FINISHED) {
      const collabToken = await this.jwtService.signAsync({
        sub: userId,
        roomId,
        role: detail.myRole,
        type: 'collab',
      });

      return {
        ...detail,
        collabToken,
        collabUrl:
          this.configService.get('COLLAB_PLANE_CLIENT_URL', { infer: true }) ??
          this.configService.get('COLLAB_PLANE_URL', { infer: true })!,
      };
    }

    return detail;
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

    const collabUrl =
      this.configService.get('COLLAB_PLANE_CLIENT_URL', { infer: true }) ??
      this.configService.get('COLLAB_PLANE_URL', { infer: true })!;

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
    if (currentUserId === targetUserId) {
      throw new BadRequestException({
        message: 'Cannot transfer ownership to yourself',
        code: ERROR_CODES.PARTICIPANT_CANNOT_TRANSFER_OWNERSHIP,
      });
    }

    const transferredAt = new Date();

    const previousHostId = await this.db.transaction(async (tx) => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');

      if (!room) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
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

      const [targetParticipant] = await tx
        .select({ isActive: roomParticipants.isActive })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, targetUserId)));

      if (!targetParticipant) {
        throw new NotFoundException({
          message: 'Participant not found in this room',
          code: ERROR_CODES.PARTICIPANT_NOT_FOUND,
        });
      }

      if (!targetParticipant.isActive) {
        throw new BadRequestException({
          message: 'Ownership can only be transferred to an active participant',
          code: ERROR_CODES.PARTICIPANT_CANNOT_TRANSFER_OWNERSHIP,
        });
      }

      await tx
        .update(rooms)
        .set({ hostId: targetUserId, updatedAt: transferredAt })
        .where(eq(rooms.id, roomId));

      return room.hostId;
    });

    return {
      roomId,
      previousHostId,
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
    const updatedAt = new Date();
    let previousRole!: RoomRole;

    const room = await this.db.transaction(async (tx) => {
      const [lockedRoom] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');

      if (!lockedRoom) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
      }

      if (lockedRoom.hostId !== actorUserId) {
        throw new ForbiddenException({
          message: 'Only the host can change participant roles',
          code: ERROR_CODES.ROOM_PERMISSION_DENIED,
        });
      }

      if (lockedRoom.status === RoomStatus.FINISHED) {
        throw new ConflictException({
          message: 'Cannot change roles after the room has finished',
          code: ERROR_CODES.ROOM_FINISHED,
        });
      }

      this.assertRoleAllowedForMode(lockedRoom.mode, nextRole);

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
        lockedRoom.mode,
        targetParticipant.role,
        lockedRoom.hostId,
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
                  lockedRoom.mode,
                  participant.role,
                  lockedRoom.hostId,
                  participant.userId,
                ),
        }));

      this.assertActiveRoleConfiguration(
        lockedRoom.mode,
        lockedRoom.status,
        nextActiveParticipants,
      );

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

      return lockedRoom;
    });

    const [updatedRoom, participantRows] = await Promise.all([
      this.db.query.rooms.findFirst({
        where: (table, { eq }) => eq(table.id, roomId),
      }),
      this.fetchParticipants(roomId),
    ]);

    if (!updatedRoom) {
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

  async toggleReady(roomId: string, userId: string): Promise<RoomDetailResult> {
    const newReady = await this.db.transaction(async (tx) => {
      const [room] = await tx
        .select({ status: rooms.status })
        .from(rooms)
        .where(eq(rooms.id, roomId));

      if (!room) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
      }

      if (room.status !== RoomStatus.WAITING) {
        throw new BadRequestException({
          message: 'Ready status can only be toggled in the waiting phase',
          code: ERROR_CODES.ROOM_INVALID_TRANSITION,
        });
      }

      const [participant] = await tx
        .select({ isReady: roomParticipants.isReady })
        .from(roomParticipants)
        .where(
          and(
            eq(roomParticipants.roomId, roomId),
            eq(roomParticipants.userId, userId),
            eq(roomParticipants.isActive, true),
          ),
        )
        .for('update');

      if (!participant) {
        throw new NotFoundException({
          message: 'Not a participant of this room',
          code: ERROR_CODES.PARTICIPANT_NOT_FOUND,
        });
      }

      const toggled = !participant.isReady;

      await tx
        .update(roomParticipants)
        .set({ isReady: toggled })
        .where(
          and(
            eq(roomParticipants.roomId, roomId),
            eq(roomParticipants.userId, userId),
            eq(roomParticipants.isActive, true),
          ),
        );

      return toggled;
    });

    void this.broadcastParticipantReady(roomId, userId, newReady);

    return this.getRoom(roomId, userId);
  }

  async destroyRoom(roomId: string, userId: string): Promise<DestroyRoomResult> {
    await this.db.transaction(async (tx) => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');

      if (!room) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
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

    // Clean up external resources after authorization + DB delete succeed
    const [collab, mediaDeleted] = await Promise.all([
      this.destroyCollabDocument(roomId),
      this.deleteMediaRoom(roomId),
    ]);

    this.logger.log(
      `Room ${roomId} destroyed. Collab: ${collab ? 'ok' : 'failed'}, media: ${mediaDeleted ? 'ok' : 'failed'}`,
    );

    return { collab, mediaDeleted };
  }

  async runCode(roomId: string, userId: string, request: RunCodeRequest): Promise<RunCodeResponse> {
    await this.assertRoomCapability(roomId, userId, 'code:run');
    return this.executionService.runCode(request);
  }

  async submitProblem(
    roomId: string,
    userId: string,
    body: SubmitProblemInput,
  ): Promise<SubmitResponse> {
    await this.assertRoomCapability(roomId, userId, 'code:submit');

    const [room] = await this.db
      .select({ problemId: rooms.problemId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room?.problemId) {
      throw new NotFoundException({
        message: 'No problem selected for this room',
        code: ERROR_CODES.PROBLEM_NOT_FOUND,
      });
    }

    return this.executionService.submitProblem(userId, {
      ...body,
      problemId: room.problemId,
      roomId,
    });
  }

  private static readonly MEDIA_TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 hours
  private static readonly MEDIA_CAPABILITIES: RoomCapability[] = [
    'media:audio',
    'media:video',
    'media:screenshare',
  ];

  async generateMediaToken(roomId: string, userId: string): Promise<MediaTokenResult> {
    const [room, participant] = await this.getRoomContext(roomId, userId);

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    if (room.status === RoomStatus.FINISHED) {
      throw new ForbiddenException({
        message: 'Cannot generate media token for a finished room',
        code: ERROR_CODES.ROOM_FINISHED,
      });
    }

    const capabilities = resolveRoomPermissions(participant.role, {
      isHost: room.hostId === userId,
    });

    const hasMediaCapability = RoomsService.MEDIA_CAPABILITIES.some((cap) => capabilities.has(cap));

    if (!hasMediaCapability) {
      throw new ForbiddenException({
        message: 'You do not have media permissions in this room',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    const { token, url } = await this.mediaService.generateToken({
      roomName: roomId,
      participantIdentity: userId,
      canPublish: true,
      canSubscribe: true,
      ttlSeconds: RoomsService.MEDIA_TOKEN_TTL_SECONDS,
    });

    const clientUrl = this.configService.get('LIVEKIT_CLIENT_URL', { infer: true }) ?? url;
    const expiresAt = new Date(Date.now() + RoomsService.MEDIA_TOKEN_TTL_SECONDS * 1000);

    return { token, url: clientUrl, expiresAt };
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
        isReady: roomParticipants.isReady,
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
    const now = new Date();

    const { previousStatus, editorLocked } = await this.db.transaction(async (tx) => {
      const [lockedRoom] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');

      if (!lockedRoom) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
      }

      // Auth check against the locked row to prevent TOCTOU race with ownership transfer
      const [participant] = await tx
        .select({ role: roomParticipants.role, isActive: roomParticipants.isActive })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));

      if (!participant?.isActive) {
        throw new ForbiddenException({
          message: 'Not a participant of this room',
          code: ERROR_CODES.ROOM_ACCESS_DENIED,
        });
      }

      if (lockedRoom.hostId !== userId && participant.role !== RoomRole.INTERVIEWER) {
        throw new ForbiddenException({
          message: 'You do not have permission to change the room phase',
          code: ERROR_CODES.ROOM_PERMISSION_DENIED,
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
        const activeParticipants = await this.fetchActiveParticipants(tx, lockedRoom);
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

      // Reset all participants' ready status when leaving the lobby
      if (lockedStatus === RoomStatus.WAITING) {
        await tx
          .update(roomParticipants)
          .set({ isReady: false })
          .where(eq(roomParticipants.roomId, roomId));
      }

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
    void this.updateCollabRoomState(roomId, targetStatus, editorLocked, userId);

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
    changedBy?: string,
  ): Promise<void> {
    try {
      await this.collabClient.updateRoomState({ roomId, phase, editorLocked, changedBy });
    } catch (error) {
      this.logger.warn(`Failed to update collab room state for room ${roomId}`, error);
    }
  }

  private async broadcastParticipantReady(
    roomId: string,
    userId: string,
    isReady: boolean,
  ): Promise<void> {
    try {
      await this.collabClient.broadcastParticipantReady(roomId, { userId, isReady });
    } catch (error) {
      this.logger.warn(`Failed to broadcast participant ready for room ${roomId}`, error);
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
    initialContent?: string,
  ): Promise<boolean> {
    try {
      const snapshot = await this.loadDocSnapshot(roomId);
      // A stored snapshot takes precedence: it represents the latest known state from
      // a previous TTL teardown. Starter code has already been seeded into it.
      await this.collabClient.createDocument(
        snapshot
          ? { roomId, initialPhase, editorLocked, snapshot: Array.from(snapshot) }
          : { roomId, initialPhase, editorLocked, initialContent },
      );
      return true;
    } catch (error) {
      this.logger.warn(`Collab document creation failed for ${roomId}`, error);
      return false;
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

  async persistDocSnapshot(roomId: string, state: Uint8Array): Promise<void> {
    await this.db
      .insert(roomDocSnapshots)
      .values({ roomId, state, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: roomDocSnapshots.roomId,
        set: { state, updatedAt: new Date() },
      });
  }

  async ensureCollab(roomId: string, userId: string): Promise<{ recreated: boolean }> {
    const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    if (room.status === RoomStatus.FINISHED) {
      throw new ConflictException({
        message: 'Room has already finished',
        code: ERROR_CODES.ROOM_FINISHED,
      });
    }

    // Allow any prior participant (active or inactive) so a disconnected user
    // can recover their collab session. Presence of a row is sufficient proof
    // of prior membership.
    const [participant] = await this.db
      .select({ isActive: roomParticipants.isActive })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)))
      .limit(1);

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const healthy = await this.collabClient.healthCheck().catch(() => false);
    if (!healthy) {
      throw new ServiceUnavailableException({
        message: 'Collab plane is currently unavailable',
        code: ERROR_CODES.COLLAB_SERVICE_UNAVAILABLE,
      });
    }

    const snapshot = await this.loadDocSnapshot(roomId);
    const response = await this.collabClient.createDocument(
      snapshot
        ? {
            roomId,
            initialPhase: room.status,
            editorLocked: room.editorLocked,
            snapshot: Array.from(snapshot),
          }
        : {
            roomId,
            initialPhase: room.status,
            editorLocked: room.editorLocked,
            initialContent: await this.resolveStarterContent(room),
          },
    );

    return { recreated: response.created };
  }

  private async resolveStarterContent(
    room: typeof rooms.$inferSelect,
  ): Promise<string | undefined> {
    if (!room.problemId || !room.language) return undefined;
    const [problem] = await this.db
      .select({ starterCode: problems.starterCode })
      .from(problems)
      .where(eq(problems.id, room.problemId))
      .limit(1);
    const starterMap = problem?.starterCode as Record<string, string> | null;
    return starterMap?.[room.language] ?? undefined;
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
