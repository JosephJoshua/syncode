import { randomBytes } from 'node:crypto';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import {
  COLLAB_CLIENT,
  type CreateRoomInput,
  type DestroyDocumentResponse,
  EXECUTION_CLIENT,
  type ICollabClient,
  type IExecutionClient,
  type RunCodeRequest,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { rooms } from '@syncode/db';
import { INVITE_CODE_CHARSET, INVITE_CODE_LENGTH, INVITE_CODE_MAX_RETRIES } from '@syncode/shared';
import { type IMediaService, MEDIA_SERVICE } from '@syncode/shared/ports';
import { DB_CLIENT } from '@/modules/db/db.module';
import type { CreateRoomResult, DestroyRoomResult, TestCase } from './rooms.types.js';

/**
 * Core business logic for room lifecycle and code execution.
 */
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
  ) {}

  /**
   * Create a new room.
   */
  async createRoom(hostId: string, input: CreateRoomInput): Promise<CreateRoomResult> {
    const room = await this.insertRoomWithRetry(hostId, input);

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
      config: {
        maxParticipants: room.maxParticipants,
        maxDuration: room.maxDuration,
        isPrivate: room.isPrivate,
      },
      createdAt: room.createdAt,
      collabCreated,
      mediaCreated,
    };
  }

  /**
   * Destroy a room
   */
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

  /**
   * Submits code for execution and returns a job ID for polling.
   */
  async runCode(_roomId: string, request: RunCodeRequest): Promise<{ jobId: string }> {
    const { jobId } = await this.executionClient.submit(request);
    this.logger.debug(`Code execution submitted: ${jobId}`);
    return { jobId };
  }

  /**
   * Submits code against multiple test cases in parallel.
   */
  async submitProblem(
    _roomId: string,
    request: RunCodeRequest,
    testCases: TestCase[],
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

  private async insertRoomWithRetry(hostId: string, input: CreateRoomInput) {
    for (let attempt = 0; attempt < INVITE_CODE_MAX_RETRIES; attempt++) {
      const inviteCode = this.generateInviteCode();
      const rows = await this.db
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

    throw new InternalServerErrorException('Failed to generate unique invite code');
  }

  private generateInviteCode(): string {
    const bytes = randomBytes(INVITE_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_CHARSET[bytes[i]! % INVITE_CODE_CHARSET.length];
    }
    return code;
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
