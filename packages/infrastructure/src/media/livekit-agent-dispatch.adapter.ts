import { Injectable } from '@nestjs/common';
import type { AgentDispatchInfo, IAgentDispatchService } from '@syncode/shared';
import { AgentDispatchClient } from 'livekit-server-sdk';
import { type LiveKitConfig, LiveKitConfigSchema } from '../config.js';

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
    };
  }

  async listDispatch(roomName: string): Promise<AgentDispatchInfo[]> {
    const dispatches = await this.client.listDispatch(roomName);

    return dispatches.map((dispatch) => ({
      dispatchId: dispatch.id,
      roomName: dispatch.room,
      agentName: dispatch.agentName,
      metadata: dispatch.metadata || undefined,
    }));
  }

  async deleteDispatch(dispatchId: string, roomName: string): Promise<void> {
    await this.client.deleteDispatch(dispatchId, roomName);
  }
}
