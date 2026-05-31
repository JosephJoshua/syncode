export const AGENT_DISPATCH_SERVICE = Symbol.for('AGENT_DISPATCH_SERVICE');

export interface AgentDispatchInfo {
  dispatchId: string;
  roomName: string;
  agentName: string;
  metadata?: string;
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
