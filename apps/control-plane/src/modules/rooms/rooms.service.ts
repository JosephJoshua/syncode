import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  COLLAB_CLIENT,
  type CreateDocumentResponse,
  type DestroyDocumentResponse,
  EXECUTION_CLIENT,
  type ICollabClient,
  type IExecutionClient,
  type RunCodeRequest,
} from '@syncode/contracts';
import { type IMediaService, MEDIA_SERVICE } from '@syncode/shared/ports';
import type { CreateRoomResult, DestroyRoomResult, TestCase } from './rooms.types';

/**
 * Core business logic for room lifecycle and code execution.
 */
@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(EXECUTION_CLIENT)
    private readonly executionClient: IExecutionClient,
    @Inject(COLLAB_CLIENT)
    private readonly collabClient: ICollabClient,
    @Inject(MEDIA_SERVICE)
    private readonly mediaService: IMediaService,
  ) {}

  /**
   * Create a new room
   *
   * @param roomId - Unique room identifier
   * @param initialContent - Optional initial document content
   * @returns Composite result with collab/media status
   */
  async createRoom(roomId: string, initialContent?: string): Promise<CreateRoomResult> {
    const [collab, mediaCreated] = await Promise.all([
      this.createCollabDocument(roomId, initialContent),
      this.createMediaRoom(roomId),
    ]);

    this.logger.log(
      `Room ${roomId} created — collab: ${collab ? 'ok' : 'failed'}, media: ${mediaCreated ? 'ok' : 'failed'}`,
    );

    return { collab, mediaCreated };
  }

  /**
   * Destroy a room
   *
   * @param roomId - Room identifier to destroy
   * @returns Composite result with collab/media status
   */
  async destroyRoom(roomId: string): Promise<DestroyRoomResult> {
    const [collab, mediaDeleted] = await Promise.all([
      this.destroyCollabDocument(roomId),
      this.deleteMediaRoom(roomId),
    ]);

    this.logger.log(
      `Room ${roomId} destroyed — collab: ${collab ? 'ok' : 'failed'}, media: ${mediaDeleted ? 'ok' : 'failed'}`,
    );

    return { collab, mediaDeleted };
  }

  /**
   * Submits code for execution and returns a job ID for polling.
   * Used for interactive "Run" button in the editor.
   *
   * @param request - Code execution request
   * @returns Job ID for polling execution result
   */
  async runCode(_roomId: string, request: RunCodeRequest): Promise<{ jobId: string }> {
    const { jobId } = await this.executionClient.submit(request);
    this.logger.debug(`Code execution submitted: ${jobId}`);
    return { jobId };
  }

  /**
   * Submits code against multiple test cases in parallel.
   * Used for "Submit" button when solving problems.
   *
   * TODO: This currently returns per-test-case job IDs. The final design should
   * aggregate results server-side (poll all jobs, compare actual vs expected
   * output, compute verdict) and expose a single submission ID to the frontend.
   *
   * @param request - Code execution request (base)
   * @param testCases - Array of test cases to validate against
   * @returns Array of job IDs with test case indices
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

  private async createCollabDocument(
    roomId: string,
    initialContent?: string,
  ): Promise<CreateDocumentResponse | null> {
    try {
      return await this.collabClient.createDocument({ roomId, initialContent });
    } catch (error) {
      this.logger.warn(`Collab document creation failed for ${roomId}`, error);
      return null;
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
      this.logger.log(`Media room created: ${roomId}`);
      return true;
    } catch (error) {
      this.logger.warn(`Media room creation failed for ${roomId}`, error);
      return false;
    }
  }

  private async deleteMediaRoom(roomId: string): Promise<boolean> {
    try {
      await this.mediaService.deleteRoom(roomId);
      this.logger.log(`Media room deleted: ${roomId}`);
      return true;
    } catch (error) {
      this.logger.warn(`Media room deletion failed for ${roomId}`, error);
      return false;
    }
  }
}
