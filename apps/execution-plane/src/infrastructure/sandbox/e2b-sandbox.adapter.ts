import { Sandbox } from '@e2b/code-interpreter';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from '@syncode/shared';
import type { ISandboxProvider } from '@syncode/shared/ports';

const E2B_SUPPORTED_LANGUAGES = new Set<string>([
  'python',
  'javascript',
  'typescript',
  'java',
  'cpp',
]);

export class E2bSandboxAdapter implements ISandboxProvider, OnModuleDestroy {
  private readonly logger = new Logger(E2bSandboxAdapter.name);
  private readonly activeSandboxes = new Set<Sandbox>();

  constructor(private readonly apiKey: string) {}

  async onModuleDestroy() {
    await this.shutdown();
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // TODO: E2B's runCode does not support stdin.
    const { requestId, language, code, timeoutMs = 30_000 } = request;
    this.logger.log(`Executing ${requestId} (language=${language})`);

    const startTime = Date.now();

    // Sandbox.create() is the infra boundary, so if it throws, propagate for BullMQ retry.
    const sandbox = await Sandbox.create({ apiKey: this.apiKey });
    this.activeSandboxes.add(sandbox);

    try {
      const result = await sandbox.runCode(code, {
        language,
        timeoutMs,
      });

      const durationMs = Date.now() - startTime;
      const hasError = !!result.error;

      return {
        requestId,
        status: hasError ? 'failed' : 'completed',
        stdout: result.logs.stdout.join('\n'),
        stderr: result.logs.stderr.join('\n'),
        exitCode: hasError ? 1 : 0,
        durationMs,
        timedOut: false,
        error: result.error ? `${result.error.name}: ${result.error.value}` : undefined,
      };
    } catch (error) {
      // Handles infra-level errors (network, E2B outage).
      const durationMs = Date.now() - startTime;
      const timedOut = durationMs >= timeoutMs; // Best-effort heuristic.

      return {
        requestId,
        status: 'failed',
        stdout: '',
        stderr: '',
        exitCode: -1,
        durationMs,
        timedOut,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.activeSandboxes.delete(sandbox);

      try {
        await sandbox.kill();
      } catch (error) {
        // Sandbox may already be destroyed.
        this.logger.warn('Failed to cleanup E2B sandbox', error);
      }
    }
  }

  supportsLanguage(language: string): language is SupportedLanguage {
    return E2B_SUPPORTED_LANGUAGES.has(language);
  }

  async healthCheck(): Promise<boolean> {
    // TODO: consider taking another approach for this when health probes are more frequent.
    try {
      const sandbox = await Sandbox.create({ apiKey: this.apiKey });
      await sandbox.kill();
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    this.logger.log(`Destroying ${this.activeSandboxes.size} active sandboxes...`);
    const kills = [...this.activeSandboxes].map(async (sandbox) => {
      try {
        await sandbox.kill();
      } catch (error) {
        this.logger.warn(`Failed to kill sandbox: ${error}`);
      }
    });
    await Promise.allSettled(kills);
    this.activeSandboxes.clear();
  }
}
