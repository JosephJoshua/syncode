import { CommandExitError, Sandbox } from '@e2b/code-interpreter';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from '@syncode/shared';
import type { ISandboxProvider } from '@syncode/shared/ports';
import { getLanguageConfig } from '../../execution/language-config.js';

const E2B_SUPPORTED_LANGUAGES = new Set<string>([
  'python',
  'javascript',
  'typescript',
  'java',
  'cpp',
]);

const CODE_DIR = '/tmp/syncode';
const SOURCE_NAME = 'code';
const STDIN_PATH = `${CODE_DIR}/stdin.txt`;
const BINARY_PATH = `${CODE_DIR}/code.out`;
const DURATION_PATH = `${CODE_DIR}/duration_ns.txt`;

/**
 * Wrap a run command with inline nanosecond timing.
 * Measures wall-clock time INSIDE the container (no network overhead).
 * Preserves the inner command's exit code.
 */
function timedCommand(runCmd: string): string {
  // Single sh -c invocation that captures start/end timestamps around the actual command.
  // Uses $$ to avoid variable collision. Writes duration to a file for later retrieval.
  return `sh -c 'SC_START=$(date +%s%N); ${runCmd}; SC_CODE=$?; SC_END=$(date +%s%N); echo $((SC_END - SC_START)) > ${DURATION_PATH}; exit $SC_CODE'`;
}

export class E2bSandboxAdapter implements ISandboxProvider, OnModuleDestroy {
  private readonly logger = new Logger(E2bSandboxAdapter.name);
  private readonly activeSandboxes = new Set<Sandbox>();

  constructor(private readonly apiKey: string) {}

  async onModuleDestroy() {
    await this.shutdown();
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const { requestId, language, code, stdin, timeoutMs = 30_000 } = request;
    this.logger.log(`Executing ${requestId} (language=${language})`);

    const config = getLanguageConfig(language);
    if (!config) {
      return {
        requestId,
        status: 'failed',
        stdout: '',
        stderr: '',
        exitCode: -1,
        durationMs: 0,
        timedOut: false,
        error: `Unsupported language: ${language}`,
      };
    }

    const startTime = Date.now();

    const sandbox = await Sandbox.create({ apiKey: this.apiKey });
    this.activeSandboxes.add(sandbox);

    try {
      const sourcePath = `${CODE_DIR}/${SOURCE_NAME}${config.extension}`;
      const writes: Promise<unknown>[] = [sandbox.files.write(sourcePath, code)];
      if (stdin != null) {
        writes.push(sandbox.files.write(STDIN_PATH, stdin));
      }
      await Promise.all(writes);

      if (config.compile) {
        const compileCmd = config.compile(sourcePath, BINARY_PATH);
        try {
          await sandbox.commands.run(compileCmd, { timeoutMs });
        } catch (e) {
          if (e instanceof CommandExitError) {
            return {
              requestId,
              status: 'failed',
              stdout: e.stdout,
              stderr: e.stderr,
              exitCode: e.exitCode,
              durationMs: Date.now() - startTime,
              timedOut: false,
              error: e.stderr || 'Compilation failed',
            };
          }
          throw e;
        }
      }

      const runTarget = config.compile ? BINARY_PATH : sourcePath;
      let runCmd = config.run(runTarget);
      if (stdin != null) {
        runCmd += ` < ${STDIN_PATH}`;
      }

      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(1, timeoutMs - elapsed);

      const fallbackStart = Date.now();
      const result = await sandbox.commands.run(timedCommand(runCmd), {
        timeoutMs: remainingMs,
      });

      const durationMs = await this.readDurationMs(sandbox, Date.now() - fallbackStart);
      const memoryUsageMb = await this.peakMemoryMb(sandbox);

      return {
        requestId,
        status: 'completed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs,
        timedOut: false,
        memoryUsageMb,
      };
    } catch (error) {
      return await this.buildExecutionFailure(error, sandbox, startTime, timeoutMs, requestId);
    } finally {
      this.activeSandboxes.delete(sandbox);

      try {
        await sandbox.kill();
      } catch (error) {
        this.logger.warn('Failed to cleanup E2B sandbox', error);
      }
    }
  }

  private async buildExecutionFailure(
    error: unknown,
    sandbox: Sandbox,
    startTime: number,
    timeoutMs: number,
    requestId: string,
  ): Promise<ExecutionResult> {
    const totalElapsed = Date.now() - startTime;
    const timedOut = totalElapsed >= timeoutMs;

    if (error instanceof CommandExitError) {
      const durationMs = await this.readDurationMs(sandbox, totalElapsed);
      const memoryUsageMb = await this.peakMemoryMb(sandbox);
      return {
        requestId,
        status: 'failed',
        stdout: error.stdout,
        stderr: error.stderr,
        exitCode: error.exitCode,
        durationMs,
        timedOut,
        memoryUsageMb,
      };
    }

    return {
      requestId,
      status: 'failed',
      stdout: '',
      stderr: '',
      exitCode: -1,
      durationMs: totalElapsed,
      timedOut,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  private async readDurationMs(sandbox: Sandbox, fallbackMs: number): Promise<number> {
    try {
      const content = await sandbox.files.read(DURATION_PATH);
      const ns = Number(content.trim());
      if (Number.isNaN(ns) || ns < 0) return fallbackMs;
      return Math.round(ns / 1_000_000);
    } catch {
      return fallbackMs;
    }
  }

  private async peakMemoryMb(sandbox: Sandbox): Promise<number | undefined> {
    try {
      const metrics = await sandbox.getMetrics();
      if (metrics.length === 0) return undefined;
      const peakBytes = Math.max(...metrics.map((m) => m.memUsed));
      return Math.round((peakBytes / (1024 * 1024)) * 10) / 10;
    } catch {
      this.logger.warn('Could not read sandbox metrics');
      return undefined;
    }
  }

  supportsLanguage(language: string): language is SupportedLanguage {
    return E2B_SUPPORTED_LANGUAGES.has(language);
  }

  async healthCheck(): Promise<boolean> {
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
