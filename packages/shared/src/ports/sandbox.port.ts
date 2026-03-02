import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from '../types/execution';

export const SANDBOX_PROVIDER = Symbol.for('SANDBOX_PROVIDER');
export const SANDBOX_PROVIDER_KEY = 'SANDBOX_PROVIDER';

export interface ISandboxProvider {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  supportsLanguage(language: SupportedLanguage): boolean;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}
