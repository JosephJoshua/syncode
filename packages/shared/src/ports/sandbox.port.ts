import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from '../types/execution';

export const SANDBOX_PROVIDER = Symbol.for('SANDBOX_PROVIDER');
export const SANDBOX_PROVIDER_KEY = 'SANDBOX_PROVIDER';

export interface ISandboxProvider {
  execute(request: ExecutionRequest, sessionId?: string): Promise<ExecutionResult>;
  supportsLanguage(language: string): language is SupportedLanguage;
  healthCheck(): Promise<boolean>;
  createSession(language: SupportedLanguage): Promise<string>;
  destroySession(sessionId: string): Promise<void>;
  shutdown(): Promise<void>;
}
