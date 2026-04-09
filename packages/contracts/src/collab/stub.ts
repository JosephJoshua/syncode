import type { ICollabClient } from './client.js';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  KickUserRequest,
  KickUserResponse,
  UpdateRoomStateRequest,
  UpdateRoomStateResponse,
} from './internal.js';

interface StubCollabClientOptions {
  /** Delay in ms before operations complete (default: 200) */
  delayMs?: number;
  /** Probability of failure between 0 and 1 (default: 0) */
  failRate?: number;
}

export class StubCollabClient implements ICollabClient {
  private readonly documents = new Map<
    string,
    { createdAt: number; phase?: string; editorLocked?: boolean }
  >();
  private readonly delayMs: number;
  private readonly failRate: number;

  constructor(options: StubCollabClientOptions = {}) {
    this.delayMs = options.delayMs ?? 200;
    this.failRate = options.failRate ?? 0;
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    await this.delay();
    this.maybeThrow('createDocument');

    const createdAt = Date.now();
    this.documents.set(request.roomId, {
      createdAt,
      phase: request.initialPhase,
      editorLocked: request.editorLocked,
    });
    return { roomId: request.roomId, createdAt };
  }

  async destroyDocument(roomId: string): Promise<DestroyDocumentResponse> {
    await this.delay();
    this.maybeThrow('destroyDocument');

    this.documents.delete(roomId);
    return { roomId, finalSnapshot: undefined };
  }

  async kickUser(_roomId: string, _request: KickUserRequest): Promise<KickUserResponse> {
    await this.delay();
    this.maybeThrow('kickUser');

    return { kicked: true };
  }

  async updateRoomState(request: UpdateRoomStateRequest): Promise<UpdateRoomStateResponse> {
    await this.delay();
    this.maybeThrow('updateRoomState');

    const existing = this.documents.get(request.roomId);
    if (existing) {
      this.documents.set(request.roomId, {
        ...existing,
        phase: request.phase,
        editorLocked: request.editorLocked,
      });
    }

    return { success: true };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }

  private maybeThrow(operation: string): void {
    if (Math.random() < this.failRate) {
      throw new Error(`Stub: simulated ${operation} failure`);
    }
  }
}
