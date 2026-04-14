import { Sandbox } from '@e2b/code-interpreter';
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

    // Sandbox.create() is the infra boundary, so if it throws, propagate for BullMQ retry.
    const sandbox = await Sandbox.create({ apiKey: this.apiKey });
    this.activeSandboxes.add(sandbox);

    try {
      // Set up workspace directory.
      await sandbox.commands.run(`mkdir -p ${CODE_DIR}`);

      // Write source code to file.
      const sourcePath = `${CODE_DIR}/${SOURCE_NAME}${config.extension}`;
      await sandbox.files.write(sourcePath, code);

      // Write stdin to file if provided.
      if (stdin != null) {
        await sandbox.files.write(STDIN_PATH, stdin);
      }

      // Compile if needed (compiled languages).
      if (config.compile) {
        const compileCmd = config.compile(sourcePath, BINARY_PATH);
        const compileResult = await sandbox.commands.run(compileCmd, { timeoutMs });

        if (compileResult.exitCode !== 0) {
          const durationMs = Date.now() - startTime;
          return {
            requestId,
            status: 'failed',
            stdout: compileResult.stdout,
            stderr: compileResult.stderr,
            exitCode: compileResult.exitCode,
            durationMs,
            timedOut: false,
            error: compileResult.stderr || 'Compilation failed',
          };
        }
      }

      // Build run command.
      const runTarget = config.compile ? BINARY_PATH : sourcePath;
      let runCmd = config.run(runTarget);
      if (stdin != null) {
        runCmd += ` < ${STDIN_PATH}`;
      }

      // Calculate remaining timeout after compilation.
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(1, timeoutMs - elapsed);

      const result = await sandbox.commands.run(runCmd, { timeoutMs: remainingMs });
      const durationMs = Date.now() - startTime;

      return {
        requestId,
        status: result.exitCode === 0 ? 'completed' : 'failed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs,
        timedOut: durationMs >= timeoutMs,
      };
    } catch (error) {
      // Handles infra-level errors (network, E2B outage, timeout).
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
