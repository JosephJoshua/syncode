import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from '../types/execution';

export const SANDBOX_PROVIDER = Symbol.for('SANDBOX_PROVIDER');

/**
 * Sandbox provider for isolated code execution.
 */
export interface ISandboxProvider {
  /** Execute code and await completion. */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;

  /**
   * Check if provider supports given language.
   * Type guard for compile-time safety.
   */
  supportsLanguage(language: string): language is SupportedLanguage;

  /** Health check for monitoring. */
  healthCheck(): Promise<boolean>;

  /** Graceful shutdown. Must wait for in-flight executions to complete or timeout. */
  shutdown(): Promise<void>;
}
