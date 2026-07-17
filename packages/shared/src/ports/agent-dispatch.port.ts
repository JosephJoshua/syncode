export const AGENT_DISPATCH_SERVICE = Symbol.for('AGENT_DISPATCH_SERVICE');

export type AgentDispatchJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'unknown';

export interface AgentDispatchJobInfo {
  id: string;
  status: AgentDispatchJobStatus;
  participantIdentity?: string;
  workerId?: string;
}

export interface AgentDispatchInfo {
  dispatchId: string;
  roomName: string;
  agentName: string;
  metadata?: string;
  jobs?: AgentDispatchJobInfo[];
}

export interface IAgentDispatchService {
  createDispatch(
    roomName: string,
    agentName: string,
    options?: { metadata?: string },
  ): Promise<AgentDispatchInfo>;
  listDispatch(roomName: string): Promise<AgentDispatchInfo[]>;
  deleteDispatch(dispatchId: string, roomName: string): Promise<void>;
}
