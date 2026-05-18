import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
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
  AI_CLIENT,
  type AuthorizeJoinResponse,
  BROWSEABLE_ROOM_STATUSES,
  type BrowseRoomsQuery,
  COLLAB_CLIENT,
  type CreateRoomInput,
  type DestroyDocumentResponse,
  ERROR_CODES,
  type GenerateHintRequest,
  type IAiClient,
  type ICollabClient,
  type JobId,
  type JoinRoomInput,
  type ListRoomsQuery,
  type RequestRoomAiHintInput,
  type RequestRoomCodeAnalysisInput,
  type RoleAssignmentReason,
  type RoomChatMediaUploadInput,
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
  hasResolvedRoomPermission,
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
  type SupportedLanguage,
} from '@syncode/shared';
import {
  CACHE_SERVICE,
  type ICacheService,
  type IMediaService,
  type IStorageService,
  MEDIA_SERVICE,
  STORAGE_SERVICE,
} from '@syncode/shared/ports';
import { type PaginatedResult, paginate } from '@syncode/shared/server';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { resolveAvatarUrls } from '@/common/resolve-avatar-urls.js';
import type { EnvConfig } from '@/config/env.config.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { ExecutionService } from '@/modules/execution/execution.service.js';
import { SessionReportsService } from '@/modules/sessions/session-reports.service.js';
import type {
  CreateRoomResult,
  DestroyRoomResult,
  GetRoomAiHintResult,
  GetRoomCodeAnalysisResult,
  JoinRoomResult,
  MediaTokenResult,
  PublicRoomSummaryResult,
  RequestRoomAiHintResult,
  RequestRoomCodeAnalysisResult,
  RoomChatMediaUploadResult,
  RoomDetailResult,
  RoomSummaryResult,
  SetEditorLockResult,
  TransferOwnershipResult,
  TransitionPhaseResult,
  UpdateParticipantRoleResult,
} from './rooms.types.js';

interface HintJobMapping {
  hintId: string;
  roomId: string;
  userId: string;
  phase: 'initial' | 'follow_up';
  previousHint?: string;
  reflectionResponse: string | null;
}

interface CodeAnalysisJobMapping {
  roomId: string;
  userId: string;
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly executionService: ExecutionService,
    @Inject(AI_CLIENT)
    private readonly aiClient: IAiClient,
    @Inject(COLLAB_CLIENT)
    private readonly collabClient: ICollabClient,
    @Inject(MEDIA_SERVICE)
    private readonly mediaService: IMediaService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    @Inject(CACHE_SERVICE)
    private readonly cacheService: ICacheService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig>,
    private readonly sessionReportsService: SessionReportsService,
  ) {}

  async createRoom(hostId: string, input: CreateRoomInput): Promise<CreateRoomResult> {
    if (input.problemId) {
      await this.assertPublishedProblem(input.problemId);
    }

    const room = await this.db.transaction(async (tx) => {
      const inserted = await this.insertRoomWithRetry(hostId, input, tx);
      await tx.insert(roomParticipants).values({
        roomId: inserted.id,
        userId: hostId,
        role: this.getInitialHostRole(inserted.mode),
      });
      return inserted;
    });

    const initialContentByLanguage = await this.resolveStarterContentMap(room);

    const [collabCreated, mediaCreated] = await Promise.all([
      this.createCollabDocument(
        room.id,
        room.status,
        room.editorLocked,
        initialContentByLanguage,
        room.language ?? undefined,
      ),
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

  async browsePublicRooms(
    userId: string,
    query: BrowseRoomsQuery,
  ): Promise<PaginatedResult<PublicRoomSummaryResult>> {
    const escapedSearch = query.search
      ? query.search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
      : null;

    const result = await paginate<PublicRoomSummaryResult>({
      cursor: query.cursor,
      limit: query.limit,
      getCursorValues: (row) => [row.createdAt.toISOString(), row.roomId],
      fetchPage: async (decoded, fetchLimit) => {
        const conditions = [
          eq(rooms.isPrivate, false),
          inArray(rooms.status, [...BROWSEABLE_ROOM_STATUSES]),
          or(isNull(rooms.problemId), eq(problems.isPublished, true))!,
          sql`(select count(*)::int from room_participants rp
               where rp.room_id = ${rooms.id} and rp.is_active = true) < ${rooms.maxParticipants}`,
        ];

        if (query.status) conditions.push(eq(rooms.status, query.status));
        if (query.language) conditions.push(eq(rooms.language, query.language));
        if (query.difficulty) conditions.push(eq(problems.difficulty, query.difficulty));
        if (escapedSearch) {
          const searchPattern = `%${escapedSearch}%`;
          conditions.push(sql`${problems.title} ILIKE ${searchPattern} ESCAPE '\\'`);
        }

        if (decoded?.length === 2 && decoded[0] && decoded[1]) {
          const [cursorSort, cursorId] = decoded;
          const cursorDate = new Date(cursorSort);
          if (!Number.isNaN(cursorDate.getTime())) {
            conditions.push(
              or(
                lt(rooms.createdAt, cursorDate),
                and(eq(rooms.createdAt, cursorDate), lt(rooms.id, cursorId)),
              )!,
            );
          }
        }

        const rows = await this.db
          .select({
            roomId: rooms.id,
            name: rooms.name,
            status: rooms.status,
            mode: rooms.mode,
            hostId: rooms.hostId,
            hostUsername: users.username,
            hostDisplayName: users.displayName,
            hostAvatarUrl: users.avatarUrl,
            language: rooms.language,
            problemTitle: problems.title,
            problemDifficulty: problems.difficulty,
            maxParticipants: rooms.maxParticipants,
            participantCount: sql<number>`(
              select count(*)::int from room_participants rp
              where rp.room_id = ${rooms.id} and rp.is_active = true
            )`.as('participant_count'),
            isParticipant: sql<boolean>`exists(
              select 1 from room_participants rp
              where rp.room_id = ${rooms.id}
                and rp.user_id = ${userId}
                and rp.is_active = true
            )`.as('is_participant'),
            createdAt: rooms.createdAt,
          })
          .from(rooms)
          .innerJoin(users, eq(users.id, rooms.hostId))
          .leftJoin(problems, eq(problems.id, rooms.problemId))
          .where(and(...conditions))
          .orderBy(desc(rooms.createdAt), desc(rooms.id))
          .limit(fetchLimit);

        const withResolvedAvatars = await resolveAvatarUrls(
          rows.map((row) => ({ ...row, avatarUrl: row.hostAvatarUrl })),
          this.storageService,
        );

        return withResolvedAvatars.map((row) => ({
          roomId: row.roomId,
          name: row.name,
          status: row.status,
          mode: row.mode,
          hostId: row.hostId,
          hostName: row.hostDisplayName ?? row.hostUsername,
          hostAvatarUrl: row.avatarUrl,
          language: row.language,
          problemTitle: row.problemTitle ?? null,
          problemDifficulty: row.problemDifficulty ?? null,
          participantCount: row.participantCount,
          isParticipant: row.isParticipant,
          maxParticipants: row.maxParticipants,
          createdAt: row.createdAt,
        }));
      },
    });

    return result;
  }

  async getRoom(roomId: string, userId: string): Promise<RoomDetailResult> {
    const [[room], participantRows] = await Promise.all([
      this.db.select().from(rooms).where(eq(rooms.id, roomId)),
      this.fetchParticipants(roomId),
    ]);

    if (!room) {
      throw new NotFoundException({ message: 'Room not found', code: ERROR_CODES.ROOM_NOT_FOUND });
    }

    const allowInactiveViewer = room.status === RoomStatus.FINISHED;
    if (allowInactiveViewer) {
      const [membership] = await this.db
        .select({ removedAt: roomParticipants.removedAt })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)))
        .limit(1);

      if (!membership || membership.removedAt !== null) {
        throw new ForbiddenException({
          message: 'Not a participant of this room',
          code: ERROR_CODES.ROOM_ACCESS_DENIED,
        });
      }
    }

    const detail = await this.assembleRoomDetail(
      room,
      participantRows,
      userId,
      allowInactiveViewer,
    );

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
          removedAt: roomParticipants.removedAt,
        })
        .from(roomParticipants)
        .where(eq(roomParticipants.roomId, roomId));

      const existing = existingParticipants.find((p) => p.userId === userId);

      if (existing?.removedAt) {
        throw new ForbiddenException({
          message: 'You have been removed from this room',
          code: ERROR_CODES.ROOM_PARTICIPANT_REMOVED,
        });
      }

      // Code check applies only to NEW joiners. Existing participants (active or
      // inactive) were already admitted once; requiring the invite code on re-join
      // would break WS reconnect reactivation, which re-calls this endpoint with
      // an empty body.
      if (!existing) {
        this.assertJoinCode(room.isPrivate, room.inviteCode, input.roomCode);
      }

      if (existing?.isActive) {
        // Idempotent re-join: user is already active in this room. Skip the
        // DB write and let the post-transaction code mint a fresh collab
        // token so the caller can (re-)enter the workspace.
        assignedRole = this.normalizeParticipantRole(room.mode, existing.role, room.hostId, userId);
        assignmentReason = 'auto-assigned';
        return;
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

    await this.db.transaction(async (tx) => {
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

      if (lockedRoom.status !== RoomStatus.WAITING) {
        throw new BadRequestException({
          message: 'Participant roles are locked once the session has started',
          code: ERROR_CODES.ROOM_ROLES_LOCKED,
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
        { strict: true },
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

  async removeParticipant(
    roomId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    if (requesterId === targetUserId) {
      throw new BadRequestException({
        message: 'Cannot remove yourself. Use transfer-ownership or leave the room.',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    await this.db.transaction(async (tx) => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');

      if (!room) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
      }

      if (room.hostId !== requesterId) {
        throw new ForbiddenException({
          message: 'Only the host can remove participants',
          code: ERROR_CODES.ROOM_PERMISSION_DENIED,
        });
      }

      const [targetParticipant] = await tx
        .select({
          id: roomParticipants.id,
          isActive: roomParticipants.isActive,
        })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, targetUserId)))
        .for('update');

      if (!targetParticipant?.isActive) {
        throw new NotFoundException({
          message: 'Participant not found',
          code: ERROR_CODES.PARTICIPANT_NOT_FOUND,
        });
      }

      const now = new Date();
      await tx
        .update(roomParticipants)
        .set({ isActive: false, leftAt: now, removedAt: now })
        .where(eq(roomParticipants.id, targetParticipant.id));
    });

    // Best-effort kick: close the target's WS connection. Transaction already
    // committed, so a failure here must not propagate.
    try {
      await this.collabClient.kickUser(roomId, {
        userId: targetUserId,
        reason: 'Removed by host',
      });
    } catch (err) {
      this.logger.warn(
        `kickUser failed for user ${targetUserId} in room ${roomId}: ${(err as Error).message}`,
      );
    }
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

  async changeLanguage(
    roomId: string,
    userId: string,
    language: SupportedLanguage,
  ): Promise<RoomDetailResult> {
    const prevLanguage = await this.db.transaction(async (tx) => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');
      if (!room) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
      }

      if (room.status === RoomStatus.FINISHED) {
        throw new BadRequestException({
          message: 'Cannot change language in a finished room',
          code: ERROR_CODES.ROOM_INVALID_STATE,
        });
      }

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

      const role = this.normalizeParticipantRole(room.mode, participant.role, room.hostId, userId);
      const isHost = room.hostId === userId;

      if (!hasResolvedRoomPermission(role, 'code:change-language', { isHost })) {
        throw new ForbiddenException({
          message: 'You do not have permission to change the language',
          code: ERROR_CODES.ROOM_PERMISSION_DENIED,
        });
      }

      if (room.language === language) {
        return room.language;
      }

      await tx.update(rooms).set({ language }).where(eq(rooms.id, roomId));
      await tx
        .update(sessions)
        .set({ language })
        .where(and(eq(sessions.roomId, roomId), eq(sessions.status, 'ongoing')));
      return room.language;
    });

    if (prevLanguage !== language) {
      try {
        await this.collabClient.changeLanguage({ roomId, language, changedBy: userId });
      } catch (err) {
        this.logger.warn(
          `changeLanguage broadcast failed for ${roomId}: ${(err as Error).message}`,
        );
      }
    }

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
    const [collab, mediaDeleted, whiteboardAssetsDeleted] = await Promise.all([
      this.destroyCollabDocument(roomId),
      this.deleteMediaRoom(roomId),
      this.deleteWhiteboardAssets(roomId),
    ]);

    this.logger.log(
      `Room ${roomId} destroyed. Collab: ${collab ? 'ok' : 'failed'}, media: ${mediaDeleted ? 'ok' : 'failed'}, whiteboard-assets: ${whiteboardAssetsDeleted ? 'ok' : 'failed'}`,
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

  async requestAiHint(
    roomId: string,
    userId: string,
    body: RequestRoomAiHintInput,
  ): Promise<RequestRoomAiHintResult> {
    const { problemId, activeLanguage } = await this.getAiRequestRoomContext(
      roomId,
      userId,
      body.language,
      'Hint',
    );
    const isFollowUp = Boolean(body.followUpToHintId);
    let followUpTarget:
      | {
          id: string;
          hint: string;
        }
      | undefined;

    const [totalHints] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiHints)
      .where(and(eq(aiHints.roomId, roomId), eq(aiHints.userId, userId)));

    let hintIteration = (totalHints?.count ?? 0) + (isFollowUp ? 0 : 1);

    if (isFollowUp) {
      const [existingHint] = await this.db
        .select({
          id: aiHints.id,
          hint: aiHints.hint,
        })
        .from(aiHints)
        .where(
          and(
            eq(aiHints.id, body.followUpToHintId!),
            eq(aiHints.roomId, roomId),
            eq(aiHints.userId, userId),
          ),
        )
        .limit(1);

      if (!existingHint) {
        throw new NotFoundException({
          message: 'Hint not found',
          code: ERROR_CODES.VALIDATION_FAILED,
        });
      }

      followUpTarget = existingHint;
      hintIteration = Math.max(totalHints?.count ?? 1, 1);
    } else {
      const limitWindowStart = new Date(Date.now() - RoomsService.AI_HINT_LIMIT_WINDOW_MS);
      const [usage] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiHints)
        .where(
          and(
            eq(aiHints.roomId, roomId),
            eq(aiHints.userId, userId),
            gte(aiHints.createdAt, limitWindowStart),
          ),
        );

      if ((usage?.count ?? 0) >= RoomsService.AI_HINT_LIMIT_COUNT) {
        throw new HttpException(
          {
            message: 'Hint rate limit exceeded (3 per 5 minutes)',
            code: ERROR_CODES.AI_HINT_RATE_LIMIT,
          },
          429,
        );
      }
    }

    const problemDescription = await this.loadAiProblemDescription(problemId);
    const conversationHistory = await this.loadHintConversationHistory(roomId);
    const latestSubmissionSummary = await this.loadLatestHintSubmissionSummary(roomId, userId);
    const reflectionResponse = body.noReply
      ? 'No reflection provided by learner.'
      : body.reflectionResponse?.trim();

    let hintId: string;
    if (followUpTarget) {
      hintId = followUpTarget.id;
    } else {
      const [insertedHint] = await this.db
        .insert(aiHints)
        .values({
          roomId,
          userId,
          hint: '',
          hintLevel: body.hintLevel,
        })
        .returning({ id: aiHints.id });

      if (!insertedHint) {
        throw new InternalServerErrorException({
          message: 'Failed to persist AI hint',
          code: ERROR_CODES.INTERNAL_ERROR,
        });
      }
      hintId = insertedHint.id;
    }

    let submitted: { jobId: JobId<'ai:hint'> };
    try {
      submitted = await this.aiClient.submitHintRequest({
        roomId,
        participantId: userId,
        problemDescription,
        currentCode: body.code,
        language: activeLanguage,
        hintLevel: body.hintLevel === 'subtle' ? 'gentle' : body.hintLevel,
        conversationHistory,
        latestSubmissionSummary,
        hintStage: isFollowUp ? 'follow_up' : 'initial',
        hintIteration,
        previousHint: followUpTarget?.hint,
        reflectionResponse,
      });
    } catch (error) {
      this.logger.warn(`AI hint submission failed for room ${roomId}`, error);
      if (!followUpTarget) {
        await this.db.delete(aiHints).where(eq(aiHints.id, hintId));
      }
      throw new ServiceUnavailableException({
        message: 'AI service unavailable',
        code: ERROR_CODES.AI_SERVICE_UNAVAILABLE,
      });
    }

    await this.cacheService.set<HintJobMapping>(
      `${RoomsService.AI_HINT_JOB_CACHE_PREFIX}${submitted.jobId}`,
      {
        hintId,
        roomId,
        userId,
        phase: isFollowUp ? 'follow_up' : 'initial',
        previousHint: followUpTarget?.hint,
        reflectionResponse: reflectionResponse ?? null,
      },
      RoomsService.AI_HINT_JOB_CACHE_TTL_SECONDS,
    );

    return {
      jobId: submitted.jobId,
      hintId,
      phase: isFollowUp ? 'follow_up' : 'initial',
    };
  }

  async getAiHintResult(
    roomId: string,
    userId: string,
    jobId: string,
  ): Promise<GetRoomAiHintResult> {
    const [, participant] = await this.getRoomContext(roomId, userId);
    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const mapping = await this.cacheService.get<HintJobMapping>(
      `${RoomsService.AI_HINT_JOB_CACHE_PREFIX}${jobId}`,
    );
    if (mapping?.roomId !== roomId || mapping?.userId !== userId) {
      throw new NotFoundException({
        message: 'Hint job not found',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    const typedJobId = jobId as JobId<'ai:hint'>;
    const hintResult = await this.aiClient.getHintResult(typedJobId);

    if (!hintResult) {
      const status = await this.aiClient.getHintJobStatus(typedJobId);
      if (status === 'failed') {
        return { status: 'failed', jobId };
      }
      return { status: 'pending', jobId };
    }

    const finalHint =
      mapping.phase === 'follow_up' && mapping.previousHint != null
        ? this.appendHintFollowUp(
            mapping.previousHint,
            mapping.reflectionResponse ?? 'No reflection provided by learner.',
            hintResult.hint,
          )
        : hintResult.hint;

    const expectedCurrentHint = mapping.phase === 'follow_up' ? (mapping.previousHint ?? '') : '';
    await this.db
      .update(aiHints)
      .set({ hint: finalHint })
      .where(and(eq(aiHints.id, mapping.hintId), eq(aiHints.hint, expectedCurrentHint)));

    return {
      status: 'ready',
      jobId,
      hintId: mapping.hintId,
      phase: mapping.phase,
      hint: finalHint,
      suggestedApproach: hintResult.suggestedApproach,
      reflectionPrompt: hintResult.reflectionPrompt,
    };
  }

  async requestCodeAnalysis(
    roomId: string,
    userId: string,
    body: RequestRoomCodeAnalysisInput,
  ): Promise<RequestRoomCodeAnalysisResult> {
    const { problemId, activeLanguage } = await this.getAiRequestRoomContext(
      roomId,
      userId,
      body.language,
      'Analysis',
    );
    if (body.code.length > RoomsService.AI_CODE_ANALYSIS_MAX_CODE_LENGTH) {
      throw new BadRequestException({
        message: `Code snapshot must be at most ${RoomsService.AI_CODE_ANALYSIS_MAX_CODE_LENGTH} characters`,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    const problemDescription = await this.loadAiProblemDescription(problemId);
    let submitted: { jobId: JobId<'ai:code-analysis'> };
    const limitKey = `${RoomsService.AI_CODE_ANALYSIS_LIMIT_PREFIX}${roomId}:${userId}`;
    const usage = await this.cacheService.incrBy(
      limitKey,
      1,
      RoomsService.AI_CODE_ANALYSIS_LIMIT_WINDOW_SECONDS,
    );

    if (usage > RoomsService.AI_CODE_ANALYSIS_LIMIT_COUNT) {
      throw new HttpException(
        {
          message: 'Code analysis rate limit exceeded (10 per 5 minutes)',
          code: ERROR_CODES.AI_CODE_ANALYSIS_RATE_LIMIT,
        },
        429,
      );
    }

    try {
      submitted = await this.aiClient.submitCodeAnalysisRequest({
        roomId,
        participantId: userId,
        problemDescription,
        code: body.code,
        language: activeLanguage,
      });
    } catch (error) {
      await this.cacheService.incrBy(limitKey, -1);
      this.logger.warn(`AI code analysis submission failed for room ${roomId}`, error);
      throw new ServiceUnavailableException({
        message: 'AI service unavailable',
        code: ERROR_CODES.AI_SERVICE_UNAVAILABLE,
      });
    }

    await this.cacheService.set<CodeAnalysisJobMapping>(
      `${RoomsService.AI_CODE_ANALYSIS_JOB_CACHE_PREFIX}${submitted.jobId}`,
      {
        roomId,
        userId,
      },
      RoomsService.AI_CODE_ANALYSIS_JOB_CACHE_TTL_SECONDS,
    );

    return { jobId: submitted.jobId };
  }

  async getCodeAnalysisResult(
    roomId: string,
    userId: string,
    jobId: string,
  ): Promise<GetRoomCodeAnalysisResult> {
    const [, participant] = await this.getRoomContext(roomId, userId);
    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const mapping = await this.cacheService.get<CodeAnalysisJobMapping>(
      `${RoomsService.AI_CODE_ANALYSIS_JOB_CACHE_PREFIX}${jobId}`,
    );
    if (!mapping || mapping.roomId !== roomId || mapping.userId !== userId) {
      throw new NotFoundException({
        message: 'Code analysis job not found',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    const typedJobId = jobId as JobId<'ai:code-analysis'>;
    const analysisResult = await this.aiClient.getCodeAnalysisResult(typedJobId);

    if (!analysisResult) {
      const status = await this.aiClient.getCodeAnalysisJobStatus(typedJobId);
      if (status === 'failed') {
        return { status: 'failed', jobId };
      }
      return { status: 'pending', jobId };
    }

    return {
      status: 'ready',
      jobId,
      summary: analysisResult.summary,
      focusAreas: analysisResult.focusAreas,
      followUpQuestions: analysisResult.followUpQuestions,
    };
  }

  async getRoomChatMediaUploadUrl(
    roomId: string,
    userId: string,
    input: RoomChatMediaUploadInput,
  ): Promise<RoomChatMediaUploadResult> {
    const [room, participant] = await this.getRoomContext(roomId, userId);

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const capabilities = resolveRoomPermissions(participant.role, {
      isHost: room.hostId === userId,
    });

    if (!capabilities.has('chat:send')) {
      throw new ForbiddenException({
        message: 'You do not have permission to send chat messages in this room',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    if (input.sizeBytes > RoomsService.CHAT_MEDIA_MAX_SIZE_BYTES) {
      throw new BadRequestException({
        message: `File is too large. Max size is ${RoomsService.CHAT_MEDIA_MAX_SIZE_BYTES} bytes`,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    const normalizedContentType = input.contentType.trim().toLowerCase();
    if (!RoomsService.CHAT_MEDIA_ALLOWED_TYPES.has(normalizedContentType)) {
      throw new BadRequestException({
        message: `Unsupported file type: ${input.contentType}`,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    const safeFileName = this.sanitizeFileName(input.fileName);
    const key = `rooms/${roomId}/chat/${Date.now()}-${randomBytes(6).toString('hex')}-${safeFileName}`;

    const [uploadUrl, downloadUrl] = await Promise.all([
      this.storageService.getUploadUrl(key, {
        expiresInSeconds: RoomsService.CHAT_MEDIA_UPLOAD_URL_EXPIRY_SECONDS,
        contentType: normalizedContentType,
      }),
      this.storageService.getDownloadUrl(key, RoomsService.CHAT_MEDIA_DOWNLOAD_URL_EXPIRY_SECONDS),
    ]);

    return {
      key,
      uploadUrl,
      downloadUrl,
      fileName: safeFileName,
      contentType: normalizedContentType,
      sizeBytes: input.sizeBytes,
    };
  }

  private static readonly MEDIA_TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 hours
  private static readonly MEDIA_CAPABILITIES: RoomCapability[] = [
    'media:audio',
    'media:video',
    'media:screenshare',
  ];
  private static readonly CHAT_MEDIA_UPLOAD_URL_EXPIRY_SECONDS = 15 * 60;
  private static readonly CHAT_MEDIA_DOWNLOAD_URL_EXPIRY_SECONDS = 24 * 60 * 60;
  private static readonly CHAT_MEDIA_MAX_SIZE_BYTES = 10 * 1024 * 1024;
  private static readonly CHAT_MEDIA_ALLOWED_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'application/pdf',
    'text/plain',
  ]);
  private static readonly AI_HINT_LIMIT_COUNT = 3;
  private static readonly AI_HINT_LIMIT_WINDOW_MS = 5 * 60 * 1000;
  private static readonly AI_HINT_CHAT_HISTORY_LIMIT = 50;
  private static readonly AI_HINT_JOB_CACHE_PREFIX = 'ai-hint-job:';
  private static readonly AI_HINT_JOB_CACHE_TTL_SECONDS = 60 * 60;
  private static readonly AI_CODE_ANALYSIS_MAX_CODE_LENGTH = 16_000;
  private static readonly AI_CODE_ANALYSIS_LIMIT_COUNT = 10;
  private static readonly AI_CODE_ANALYSIS_LIMIT_WINDOW_SECONDS = 5 * 60;
  private static readonly AI_CODE_ANALYSIS_LIMIT_PREFIX = 'ai-code-analysis-limit:';
  private static readonly AI_CODE_ANALYSIS_JOB_CACHE_PREFIX = 'ai-code-analysis-job:';
  private static readonly AI_CODE_ANALYSIS_JOB_CACHE_TTL_SECONDS = 60 * 60;

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
    allowInactiveViewer = false,
  ): Promise<RoomDetailResult> {
    const [roomSession] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.roomId, room.id))
      .limit(1);

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
    const myParticipation = normalizedParticipants.find(
      (p) => p.userId === userId && (p.isActive || allowInactiveViewer),
    );
    if (!myParticipation) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const myRole = myParticipation.role;
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
      sessionId: roomSession?.id ?? null,
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
    let restoreFinalCollabState: { phase: RoomStatus; editorLocked: boolean } | null = null;

    const transactionResult = await this.db
      .transaction(async (tx) => {
        const [lockedRoom] = await tx
          .select()
          .from(rooms)
          .where(eq(rooms.id, roomId))
          .for('update');

        if (!lockedRoom) {
          throw new NotFoundException({
            message: 'Room not found',
            code: ERROR_CODES.ROOM_NOT_FOUND,
          });
        }

        const lockedStatus = lockedRoom.status;
        await this.assertPhaseTransitionAllowed(tx, lockedRoom, userId, targetStatus);

        const computedElapsedMs =
          lockedStatus === RoomStatus.CODING && lockedRoom.phaseStartedAt && !lockedRoom.timerPaused
            ? lockedRoom.elapsedMs +
              Math.max(0, now.getTime() - lockedRoom.phaseStartedAt.getTime())
            : lockedRoom.elapsedMs;

        restoreFinalCollabState = await this.prepareFinalCollabSnapshot(
          lockedRoom,
          targetStatus,
          userId,
        );

        const roomUpdate = this.buildPhaseTransitionUpdate(
          lockedStatus,
          targetStatus,
          now,
          computedElapsedMs,
        );
        await tx.update(rooms).set(roomUpdate).where(eq(rooms.id, roomId));
        await this.applyPhaseTransitionSideEffects(tx, lockedRoom, lockedStatus, targetStatus, now);
        const completedSessionId = await this.finishSessionForPhaseTransition(
          tx,
          roomId,
          lockedStatus,
          targetStatus,
          now,
          computedElapsedMs,
        );

        return {
          previousStatus: lockedStatus,
          editorLocked: lockedRoom.editorLocked,
          finishedSessionId: completedSessionId,
        };
      })
      .catch(async (error: unknown) => {
        if (restoreFinalCollabState) {
          await this.restoreCollabRoomStateStrict(
            roomId,
            restoreFinalCollabState.phase,
            restoreFinalCollabState.editorLocked,
            userId,
          );
        }
        throw error;
      });

    const { previousStatus, editorLocked, finishedSessionId } = transactionResult;

    this.logger.log(
      `Room ${roomId} transitioned from '${previousStatus}' to '${targetStatus}' by user ${userId}`,
    );

    if (finishedSessionId) {
      try {
        await this.sessionReportsService.enqueueForFinishedSession(finishedSessionId);
      } catch (error) {
        this.logger.error(
          `Failed to enqueue session reports for session ${finishedSessionId}`,
          error,
        );
      }
    }

    // Fire-and-forget collab notification stays outside the transaction.
    if (targetStatus !== RoomStatus.FINISHED) {
      void this.updateCollabRoomState(roomId, targetStatus, editorLocked, userId);
    }

    return {
      roomId,
      previousStatus,
      currentStatus: targetStatus,
      transitionedAt: now,
      transitionedBy: userId,
    };
  }

  private async assertPhaseTransitionAllowed(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    lockedRoom: typeof rooms.$inferSelect,
    userId: string,
    targetStatus: RoomStatus,
  ): Promise<void> {
    // Auth check against the locked row to prevent TOCTOU race with ownership transfer.
    const [participant] = await tx
      .select({
        role: roomParticipants.role,
        isActive: roomParticipants.isActive,
        removedAt: roomParticipants.removedAt,
      })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, lockedRoom.id), eq(roomParticipants.userId, userId)));

    if (!participant || participant.removedAt !== null) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const allowInactiveHostFinish =
      targetStatus === RoomStatus.FINISHED && lockedRoom.hostId === userId;

    if (!participant.isActive && !allowInactiveHostFinish) {
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

    if (!isValidStatusTransition(lockedRoom.status, targetStatus)) {
      throw new BadRequestException({
        message: `Cannot transition from '${lockedRoom.status}' to '${targetStatus}'`,
        code: ERROR_CODES.ROOM_INVALID_TRANSITION,
      });
    }

    if (lockedRoom.status === RoomStatus.WAITING && targetStatus === RoomStatus.WARMUP) {
      const activeParticipants = await this.fetchActiveParticipants(tx, lockedRoom);
      this.assertActiveRoleConfiguration(lockedRoom.mode, RoomStatus.WARMUP, activeParticipants, {
        strict: true,
      });
      this.assertRequiredParticipantsReady(lockedRoom.mode, activeParticipants);
    }
  }

  private async prepareFinalCollabSnapshot(
    lockedRoom: typeof rooms.$inferSelect,
    targetStatus: RoomStatus,
    userId: string,
  ): Promise<{ phase: RoomStatus; editorLocked: boolean } | null> {
    if (targetStatus !== RoomStatus.FINISHED) {
      return null;
    }

    const language = this.requireLanguageForFinalSnapshot(lockedRoom);
    await this.ensureCollabDocumentForFinalSnapshot(lockedRoom);
    await this.updateCollabRoomStateStrict(
      lockedRoom.id,
      targetStatus,
      lockedRoom.editorLocked,
      language,
      userId,
    );

    return {
      phase: lockedRoom.status,
      editorLocked: lockedRoom.editorLocked,
    };
  }

  private requireLanguageForFinalSnapshot(room: typeof rooms.$inferSelect): SupportedLanguage {
    if (room.language) {
      return room.language;
    }

    throw new BadRequestException({
      message: 'Cannot finish a room before selecting a programming language',
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  }

  private buildPhaseTransitionUpdate(
    previousStatus: RoomStatus,
    targetStatus: RoomStatus,
    now: Date,
    elapsedMs: number,
  ): Partial<typeof rooms.$inferInsert> {
    return {
      status: targetStatus,
      phaseStartedAt: now,
      elapsedMs,
      ...(previousStatus === RoomStatus.CODING || targetStatus === RoomStatus.CODING
        ? { timerPaused: false }
        : {}),
      ...(targetStatus === RoomStatus.FINISHED ? { endedAt: now } : {}),
    };
  }

  private async applyPhaseTransitionSideEffects(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    lockedRoom: typeof rooms.$inferSelect,
    previousStatus: RoomStatus,
    targetStatus: RoomStatus,
    now: Date,
  ): Promise<void> {
    if (targetStatus === RoomStatus.FINISHED) {
      // Cascade: mark any remaining active participants as inactive. They
      // weren't kicked — the room just ended — so we set leftAt but NOT
      // removedAt.
      await tx
        .update(roomParticipants)
        .set({ isActive: false, leftAt: now })
        .where(
          and(eq(roomParticipants.roomId, lockedRoom.id), eq(roomParticipants.isActive, true)),
        );
    }

    // Reset all participants' ready status when leaving the lobby.
    if (previousStatus === RoomStatus.WAITING) {
      await tx
        .update(roomParticipants)
        .set({ isReady: false })
        .where(eq(roomParticipants.roomId, lockedRoom.id));
    }

    if (previousStatus === RoomStatus.WAITING && targetStatus === RoomStatus.WARMUP) {
      await this.startSessionForRoom(tx, lockedRoom, now);
    }
  }

  private async finishSessionForPhaseTransition(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    roomId: string,
    previousStatus: RoomStatus,
    targetStatus: RoomStatus,
    now: Date,
    durationMs: number,
  ): Promise<string | null> {
    if (targetStatus !== RoomStatus.FINISHED || previousStatus === RoomStatus.WAITING) {
      return null;
    }

    const [finishedSession] = await tx
      .update(sessions)
      .set({
        status: 'finished',
        finishedAt: now,
        durationMs,
      })
      .where(eq(sessions.roomId, roomId))
      .returning({ id: sessions.id });

    return finishedSession?.id ?? null;
  }

  async setEditorLock(
    roomId: string,
    userId: string,
    locked: boolean,
  ): Promise<SetEditorLockResult> {
    const now = new Date();

    const { currentStatus, changed } = await this.db.transaction(async (tx) => {
      const [lockedRoom] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');

      if (!lockedRoom) {
        throw new NotFoundException({
          message: 'Room not found',
          code: ERROR_CODES.ROOM_NOT_FOUND,
        });
      }

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
          message: 'You do not have permission to change the editor lock',
          code: ERROR_CODES.ROOM_PERMISSION_DENIED,
        });
      }

      if (lockedRoom.status === RoomStatus.FINISHED) {
        throw new ConflictException({
          message: 'Room has already finished',
          code: ERROR_CODES.ROOM_FINISHED,
        });
      }

      // Idempotent: requesting the current state is a no-op, not an error.
      if (lockedRoom.editorLocked === locked) {
        return { currentStatus: lockedRoom.status, changed: false };
      }

      await tx.update(rooms).set({ editorLocked: locked }).where(eq(rooms.id, roomId));

      return { currentStatus: lockedRoom.status, changed: true };
    });

    if (changed) {
      this.logger.log(`Room ${roomId} editor ${locked ? 'locked' : 'unlocked'} by user ${userId}`);
      // Fire-and-forget broadcast — clients reflect the lock by re-querying or
      // by reacting to the room-state patch event.
      void this.updateCollabRoomState(roomId, currentStatus, locked, userId);
    }

    return {
      roomId,
      editorLocked: locked,
      changed,
      ...(changed ? { changedAt: now, changedBy: userId } : {}),
    };
  }

  private async startSessionForRoom(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    lockedRoom: typeof rooms.$inferSelect,
    now: Date,
  ): Promise<void> {
    const [session] = await tx
      .insert(sessions)
      .values({
        roomId: lockedRoom.id,
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
      .where(and(eq(roomParticipants.roomId, lockedRoom.id), eq(roomParticipants.isActive, true)));

    if (participantRows.length === 0) return;

    await tx.insert(sessionParticipants).values(
      participantRows.map((participantRow) => ({
        sessionId: session!.id,
        userId: participantRow.userId,
        role: this.normalizeParticipantRole(
          lockedRoom.mode,
          participantRow.role,
          lockedRoom.hostId,
          participantRow.userId,
        ),
        joinedAt: participantRow.joinedAt,
      })),
    );
  }

  private assertJoinCode(
    isPrivate: boolean,
    inviteCode: string,
    suppliedCode: string | undefined,
  ): void {
    if (isPrivate && !suppliedCode) {
      throw new BadRequestException({
        message: 'Room code required for private rooms',
        code: ERROR_CODES.ROOM_INVALID_CODE,
      });
    }
    if (suppliedCode && inviteCode !== suppliedCode.toUpperCase()) {
      throw new BadRequestException({
        message: 'Invalid room code',
        code: ERROR_CODES.ROOM_INVALID_CODE,
      });
    }
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
    options: { strict?: boolean } = {},
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

      if (
        options.strict &&
        status !== RoomStatus.WAITING &&
        (interviewerCount !== 1 || candidateCount !== 1)
      ) {
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

    if (options.strict && status !== RoomStatus.WAITING && candidateCount !== 1) {
      throw new ConflictException({
        message: 'AI rooms require exactly one active candidate after the room starts',
        code: ERROR_CODES.ROOM_ROLE_CONSTRAINT_VIOLATION,
      });
    }
  }

  private assertRequiredParticipantsReady(
    mode: RoomMode,
    activeParticipants: Array<{ userId: string; role: RoomRole; isReady: boolean }>,
  ): void {
    const requiredRoles: RoomRole[] =
      mode === 'peer' ? [RoomRole.INTERVIEWER, RoomRole.CANDIDATE] : [RoomRole.CANDIDATE];

    // role is the mode-resolved runtime role (see fetchActiveParticipants), not the raw DB value,
    // so host-as-candidate in AI mode lands on CANDIDATE here as expected.
    const required = activeParticipants.filter((participant) =>
      requiredRoles.includes(participant.role),
    );

    if (required.length === 0 || required.some((participant) => !participant.isReady)) {
      throw new BadRequestException({
        message: 'All required participants must be ready to start the session.',
        code: ERROR_CODES.ROOM_PARTICIPANTS_NOT_READY,
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
  ): Promise<Array<{ userId: string; role: RoomRole; isReady: boolean }>> {
    const participants = await db
      .select({
        userId: roomParticipants.userId,
        role: roomParticipants.role,
        isReady: roomParticipants.isReady,
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
      isReady: participant.isReady,
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

  private async getAiRequestRoomContext(
    roomId: string,
    userId: string,
    language: SupportedLanguage,
    label: 'Hint' | 'Analysis',
  ): Promise<{ problemId: string; activeLanguage: SupportedLanguage }> {
    const [room, participant] = await this.getRoomContext(roomId, userId);

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const capabilities = resolveRoomPermissions(participant.role, {
      isHost: room.hostId === userId,
    });

    if (!capabilities.has('ai:request-hint')) {
      throw new ForbiddenException({
        message: 'No ai:request-hint capability',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }

    if (!room.problemId) {
      throw new NotFoundException({
        message: 'No problem selected in room',
        code: ERROR_CODES.PROBLEM_NOT_FOUND,
      });
    }

    if (room.language && language !== room.language) {
      throw new BadRequestException({
        message: `${label} language must match room language (${room.language})`,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    return {
      problemId: room.problemId,
      activeLanguage: room.language ?? language,
    };
  }

  private async loadAiProblemDescription(problemId: string): Promise<string> {
    const [problem] = await this.db
      .select({
        title: problems.title,
        description: problems.description,
      })
      .from(problems)
      .where(eq(problems.id, problemId))
      .limit(1);

    if (!problem) {
      throw new NotFoundException({
        message: 'No problem selected in room',
        code: ERROR_CODES.PROBLEM_NOT_FOUND,
      });
    }

    return [problem.title, problem.description].filter(Boolean).join('\n\n');
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

  private async updateCollabRoomStateStrict(
    roomId: string,
    phase: RoomStatus,
    editorLocked: boolean,
    language: SupportedLanguage,
    changedBy?: string,
  ): Promise<boolean> {
    try {
      await this.collabClient.updateRoomState({ roomId, phase, editorLocked, changedBy, language });
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to confirm final collab room state for room ${roomId}; continuing finish transition`,
        error,
      );
      return false;
    }
  }

  private async restoreCollabRoomStateStrict(
    roomId: string,
    phase: RoomStatus,
    editorLocked: boolean,
    changedBy?: string,
  ): Promise<void> {
    try {
      await this.collabClient.updateRoomState({ roomId, phase, editorLocked, changedBy });
    } catch (error) {
      this.logger.warn(
        `Failed to restore collab room state after aborted finish transition for room ${roomId}`,
        error,
      );
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

  private sanitizeFileName(fileName: string): string {
    const trimmed = fileName.trim();
    if (!trimmed) {
      return 'attachment.bin';
    }

    const withoutPath = trimmed.replaceAll('\\', '/').split('/').pop() ?? 'attachment.bin';
    const safe = withoutPath.replace(/[^a-zA-Z0-9._-]/g, '_');
    return safe.length > 0 ? safe.slice(0, 120) : 'attachment.bin';
  }

  private appendHintFollowUp(
    initialHint: string,
    reflectionResponse: string,
    followUpHint: string,
  ): string {
    const reflectionSection = reflectionResponse.trim().length
      ? reflectionResponse.trim()
      : 'No reflection provided by learner.';

    return [
      initialHint.trim(),
      '---',
      `Learner reflection:\n${reflectionSection}`,
      `Coach follow-up:\n${followUpHint.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async loadHintConversationHistory(
    roomId: string,
  ): Promise<Array<{ role: string; content: string }>> {
    try {
      const [chatHistory, participants] = await Promise.all([
        this.collabClient.getRoomChatHistory(roomId, {
          limit: RoomsService.AI_HINT_CHAT_HISTORY_LIMIT,
        }),
        this.db
          .select({
            userId: users.id,
            username: users.username,
            displayName: users.displayName,
          })
          .from(roomParticipants)
          .innerJoin(users, eq(users.id, roomParticipants.userId))
          .where(eq(roomParticipants.roomId, roomId)),
      ]);

      const identityByUserId = new Map(
        participants.map((participant) => [
          participant.userId,
          participant.displayName ?? participant.username,
        ]),
      );

      return chatHistory.messages
        .filter((message) => message.text.trim().length > 0 || message.attachments.length > 0)
        .map((message) => {
          const identity = identityByUserId.get(message.userId) ?? message.userId;
          const parts: string[] = [];
          const text = message.text.trim();
          if (text.length > 0) {
            parts.push(text);
          }
          if (message.attachments.length > 0) {
            parts.push(
              `[attachments: ${message.attachments.map((attachment) => attachment.fileName).join(', ')}]`,
            );
          }

          return {
            role: 'user',
            content: `${identity}: ${parts.join('\n')}`,
          };
        });
    } catch (error) {
      this.logger.warn(`Unable to load room chat history for AI hint in room ${roomId}`, error);
      return [];
    }
  }

  private async loadLatestHintSubmissionSummary(
    roomId: string,
    userId: string,
  ): Promise<GenerateHintRequest['latestSubmissionSummary']> {
    const [latest] = await this.db
      .select({
        status: submissions.status,
        passedTestCases: submissions.passedTestCases,
        totalTestCases: submissions.totalTestCases,
        failedTestCases: submissions.failedTestCases,
        errorTestCases: submissions.errorTestCases,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .where(and(eq(submissions.roomId, roomId), eq(submissions.userId, userId)))
      .orderBy(desc(submissions.submittedAt))
      .limit(1);

    if (!latest) {
      return null;
    }

    const allTestsPassed =
      latest.status === 'completed' &&
      latest.totalTestCases > 0 &&
      latest.passedTestCases === latest.totalTestCases &&
      latest.failedTestCases === 0 &&
      latest.errorTestCases === 0;

    return {
      status: latest.status,
      passedTestCases: latest.passedTestCases,
      totalTestCases: latest.totalTestCases,
      failedTestCases: latest.failedTestCases,
      errorTestCases: latest.errorTestCases,
      allTestsPassed,
      submittedAt: latest.submittedAt.toISOString(),
    };
  }

  async markParticipantInactive(roomId: string, userId: string, leftAt: Date): Promise<void> {
    await this.db
      .update(roomParticipants)
      .set({ isActive: false, leftAt })
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
  }

  /**
   * Authoritative check for collab-plane: can this user (re)join the room?
   *
   * Called on every WS join to defeat stale-JWT attacks where a kicked user
   * still holds a 24h collab token. Kick durability lives here, not in the
   * collab gateway's local registry.
   */
  async authorizeJoin(roomId: string, userId: string): Promise<AuthorizeJoinResponse> {
    const [room] = await this.db
      .select({ status: rooms.status })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room) {
      return { authorized: false, reason: 'room-not-found' };
    }

    if (room.status === RoomStatus.FINISHED) {
      return { authorized: false, reason: 'room-finished' };
    }

    const [participant] = await this.db
      .select({ removedAt: roomParticipants.removedAt })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)))
      .limit(1);

    if (!participant) {
      return { authorized: false, reason: 'not-participant' };
    }

    if (participant.removedAt !== null) {
      return { authorized: false, reason: 'participant-removed' };
    }

    return { authorized: true };
  }

  /**
   * Bulk-record participant heartbeats from collab-plane. Idempotent: only touches
   * rows that are currently active and whose (roomId, userId) appear in the batch.
   * Returns how many rows were actually updated.
   */
  async recordParticipantHeartbeats(
    participants: Array<{ roomId: string; userId: string }>,
  ): Promise<number> {
    if (participants.length === 0) return 0;

    const values = sql.join(
      participants.map((p) => sql`(${p.roomId}::uuid, ${p.userId}::uuid)`),
      sql`, `,
    );
    const now = new Date();
    const updated = await this.db
      .update(roomParticipants)
      .set({ lastHeartbeatAt: now })
      .where(
        and(
          eq(roomParticipants.isActive, true),
          sql`(${roomParticipants.roomId}, ${roomParticipants.userId}) IN (VALUES ${values})`,
        ),
      )
      .returning({ id: roomParticipants.id });
    return updated.length;
  }

  private async createCollabDocument(
    roomId: string,
    initialPhase: RoomStatus,
    editorLocked: boolean,
    initialContentByLanguage?: Record<string, string>,
    initialLanguage?: string,
  ): Promise<boolean> {
    try {
      const snapshot = await this.loadDocSnapshot(roomId);
      // A stored snapshot takes precedence: it represents the latest known state from
      // a previous TTL teardown. Starter code has already been seeded into it.
      await this.collabClient.createDocument(
        snapshot
          ? {
              roomId,
              initialPhase,
              editorLocked,
              snapshot: Array.from(snapshot),
              initialLanguage,
            }
          : {
              roomId,
              initialPhase,
              editorLocked,
              initialContentByLanguage,
              initialLanguage,
            },
      );
      return true;
    } catch (error) {
      this.logger.warn(`Collab document creation failed for ${roomId}`, error);
      return false;
    }
  }

  private async ensureCollabDocumentForFinalSnapshot(
    room: typeof rooms.$inferSelect,
  ): Promise<void> {
    const snapshot = await this.loadDocSnapshot(room.id);
    if (!snapshot) {
      return;
    }

    try {
      await this.collabClient.createDocument({
        roomId: room.id,
        initialPhase: room.status,
        editorLocked: room.editorLocked,
        snapshot: Array.from(snapshot),
        initialLanguage: room.language ?? undefined,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to ensure collab document before final snapshot for room ${room.id}; continuing finish transition`,
        error,
      );
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
    const initialLanguage = room.language ?? undefined;
    const response = await this.collabClient.createDocument(
      snapshot
        ? {
            roomId,
            initialPhase: room.status,
            editorLocked: room.editorLocked,
            snapshot: Array.from(snapshot),
            initialLanguage,
          }
        : {
            roomId,
            initialPhase: room.status,
            editorLocked: room.editorLocked,
            initialContentByLanguage: await this.resolveStarterContentMap(room),
            initialLanguage,
          },
    );

    return { recreated: response.created };
  }

  private async assertPublishedProblem(problemId: string): Promise<void> {
    const [problem] = await this.db
      .select({ id: problems.id })
      .from(problems)
      .where(
        and(eq(problems.id, problemId), isNull(problems.deletedAt), eq(problems.isPublished, true)),
      )
      .limit(1);

    if (!problem) {
      throw new NotFoundException({
        message: 'Problem not found',
        code: ERROR_CODES.PROBLEM_NOT_FOUND,
      });
    }
  }

  private async resolveStarterContentMap(
    room: typeof rooms.$inferSelect,
  ): Promise<Record<string, string> | undefined> {
    if (!room.problemId) return undefined;
    const [problem] = await this.db
      .select({ starterCode: problems.starterCode })
      .from(problems)
      .where(eq(problems.id, room.problemId))
      .limit(1);
    const starterMap = (problem?.starterCode ?? null) as Record<string, string> | null;
    if (!starterMap || Object.keys(starterMap).length === 0) return undefined;
    return starterMap;
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

  // Best-effort sweep of every whiteboard asset uploaded into this room.
  // Pages through the listing in case there are more keys than the storage
  // adapter returns in a single call. Failures never block room destroy:
  // orphaned objects can be reaped by a separate retention job.
  private async deleteWhiteboardAssets(roomId: string): Promise<boolean> {
    const prefix = `whiteboard/${roomId}/`;
    try {
      const allKeys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const page = await this.storageService.list({ prefix, continuationToken });
        allKeys.push(...page.keys);
        continuationToken = page.isTruncated ? page.continuationToken : undefined;
      } while (continuationToken);

      if (allKeys.length === 0) {
        return true;
      }

      const { failed } = await this.storageService.deleteMany(allKeys);
      if (failed.length > 0) {
        this.logger.warn(
          `Whiteboard asset deletion partially failed for room ${roomId}: ${failed.length}/${allKeys.length} keys could not be removed`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Whiteboard asset deletion failed for room ${roomId}`, error);
      return false;
    }
  }
}
