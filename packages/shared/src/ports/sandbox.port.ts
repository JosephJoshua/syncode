import type {
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
  SupportedLanguage,
} from '../types/execution';

export const SANDBOX_PROVIDER = Symbol.for('SANDBOX_PROVIDER');

/**
 * Sandbox provider for isolated code execution.
 */
export interface ISandboxProvider {
  /**
   * Submit code for execution. Returns immediately.
   * Request ID must be unique.
   *
   * @param request - Execution request with code, language, and constraints
   */
  submit(request: ExecutionRequest): Promise<void>;

  /**
   * Get current execution status.
   *
   * @param requestId - Request ID passed into `submit()`
   * @returns Status: pending | running | completed | failed | cancelled
   */
  getStatus(requestId: string): Promise<ExecutionStatus>;

  /**
   * Retrieve execution result. Returns null if not ready yet.
   *
   * @param requestId - Request ID passed into `submit()`
   * @returns Result or null if pending/running
   */
  getResult(requestId: string): Promise<ExecutionResult | null>;

  /**
   * Cancel a running or pending execution. Best-effort.
   * Sets status to 'cancelled' and cleans up resources.
   *
   * @param requestID - Request ID passed into `submit()`
   */
  cancel(requestID: string): Promise<void>;

  /**
   * Check if provider supports given language.
   * Type guard for compile-time safety.
   *
   * @param language - Language to check
   * @returns True if language is supported
   */
  supportsLanguage(language: string): language is SupportedLanguage;

  /**
   * Health check for monitoring.
   *
   * @returns True if provider is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Graceful shutdown. Must wait for in-flight executions to complete or timeout.
   */
  shutdown(): Promise<void>;
}
