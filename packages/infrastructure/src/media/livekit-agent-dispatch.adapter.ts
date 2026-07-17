import { Injectable } from '@nestjs/common';
import type {
  AgentDispatchInfo,
  AgentDispatchJobInfo,
  AgentDispatchJobStatus,
  IAgentDispatchService,
} from '@syncode/shared';
import { AgentDispatchClient } from 'livekit-server-sdk';
import { type LiveKitConfig, LiveKitConfigSchema } from '../config.js';

const LIVEKIT_JOB_STATUS_PENDING = 0;
const LIVEKIT_JOB_STATUS_RUNNING = 1;
const LIVEKIT_JOB_STATUS_SUCCESS = 2;
const LIVEKIT_JOB_STATUS_FAILED = 3;

@Injectable()
export class LiveKitAgentDispatchAdapter implements IAgentDispatchService {
  private readonly client: AgentDispatchClient;

  constructor(config: LiveKitConfig) {
    const validatedConfig = LiveKitConfigSchema.parse(config);
    this.client = new AgentDispatchClient(
      validatedConfig.url,
      validatedConfig.apiKey,
      validatedConfig.apiSecret,
    );
  }

  async createDispatch(
    roomName: string,
    agentName: string,
    options?: { metadata?: string },
  ): Promise<AgentDispatchInfo> {
    const dispatch = await this.client.createDispatch(roomName, agentName, options);

    return {
      dispatchId: dispatch.id,
      roomName: dispatch.room,
      agentName: dispatch.agentName,
      metadata: dispatch.metadata || undefined,
      jobs: this.mapDispatchJobs(dispatch.state?.jobs),
    };
  }

  async listDispatch(roomName: string): Promise<AgentDispatchInfo[]> {
    const dispatches = await this.client.listDispatch(roomName);

    return dispatches.map((dispatch) => ({
      dispatchId: dispatch.id,
      roomName: dispatch.room,
      agentName: dispatch.agentName,
      metadata: dispatch.metadata || undefined,
      jobs: this.mapDispatchJobs(dispatch.state?.jobs),
    }));
  }

  async deleteDispatch(dispatchId: string, roomName: string): Promise<void> {
    await this.client.deleteDispatch(dispatchId, roomName);
  }

  private mapDispatchJobs(
    jobs:
      | Array<{
          id: string;
          state?: { status?: unknown; participantIdentity?: string; workerId?: string };
        }>
      | undefined,
  ): AgentDispatchJobInfo[] | undefined {
    return jobs?.map((job) => ({
      id: job.id,
      status: this.mapJobStatus(job.state?.status),
      participantIdentity: job.state?.participantIdentity || undefined,
      workerId: job.state?.workerId || undefined,
    }));
  }

  private mapJobStatus(status: unknown): AgentDispatchJobStatus {
    switch (status) {
      case LIVEKIT_JOB_STATUS_PENDING:
      case 'JS_PENDING':
      case 'PENDING':
        return 'pending';
      case LIVEKIT_JOB_STATUS_RUNNING:
      case 'JS_RUNNING':
      case 'RUNNING':
        return 'running';
      case LIVEKIT_JOB_STATUS_SUCCESS:
      case 'JS_SUCCESS':
      case 'SUCCESS':
        return 'success';
      case LIVEKIT_JOB_STATUS_FAILED:
      case 'JS_FAILED':
      case 'FAILED':
        return 'failed';
      default:
        return 'unknown';
    }
  }
}
