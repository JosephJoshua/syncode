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

// iptables rules applied inside every sandbox before user code runs.
//
// IPv4 chain (must succeed — fail-closed on error):
//   1. Preserve ESTABLISHED/RELATED so the E2B control-plane gRPC channel is
//      not torn down after we lock the table.
//   2. Drop RFC 1918, loopback, link-local (169.254/16 covers AWS/GCP/Azure
//      IMDS), and RFC 6598 shared address space — all SSRF targets.
//   3. Drop every remaining NEW outbound connection (no internet for user code).
//
// IPv6 chain (best-effort — skipped gracefully if ip6tables absent):
//   Same pattern: allow ESTABLISHED, block loopback (::1), unique-local
//   (fc00::/7), link-local (fe80::/10), then drop all NEW.
const NETWORK_HARDENING_CMD = (() => {
  const ipv4 = [
    'iptables -w 5 -I OUTPUT 1 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
    'iptables -w 5 -A OUTPUT -d 10.0.0.0/8     -j DROP',
    'iptables -w 5 -A OUTPUT -d 172.16.0.0/12  -j DROP',
    'iptables -w 5 -A OUTPUT -d 192.168.0.0/16 -j DROP',
    'iptables -w 5 -A OUTPUT -d 127.0.0.0/8    -j DROP',
    'iptables -w 5 -A OUTPUT -d 169.254.0.0/16 -j DROP',
    'iptables -w 5 -A OUTPUT -d 100.64.0.0/10  -j DROP',
    'iptables -w 5 -A OUTPUT -m conntrack --ctstate NEW -j DROP',
  ].join(' && ');

  const ipv6 = [
    'ip6tables -w 5 -I OUTPUT 1 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
    'ip6tables -w 5 -A OUTPUT -d ::1/128   -j DROP',
    'ip6tables -w 5 -A OUTPUT -d fc00::/7  -j DROP',
    'ip6tables -w 5 -A OUTPUT -d fe80::/10 -j DROP',
    'ip6tables -w 5 -A OUTPUT -m conntrack --ctstate NEW -j DROP',
  ].join(' && ');

  // Apply IPv4 rules (required), then attempt IPv6 rules (optional — not all
  // E2B images ship ip6tables, so we skip silently if unavailable).
  return `${ipv4} && { command -v ip6tables >/dev/null 2>&1 && { ${ipv6}; } || true; }`;
})();

const SOURCE_NAME = 'code';
const STDIN_PATH = `${CODE_DIR}/stdin.txt`;
const BINARY_PATH = `${CODE_DIR}/code.out`;
const DURATION_PATH = `${CODE_DIR}/duration_ns.txt`;
const MEMORY_PATH = `${CODE_DIR}/peak_kb.txt`;
const E2B_DENY_OUT_CIDRS = ['0.0.0.0/0'];

/**
 * Wrap a run command with inline nanosecond timing AND peak-RSS measurement.
 *
 * `sandbox.getMetrics()` is a periodic sampler — short algorithm runs finish
 * before any sample is taken, so we'd always report no memory. `/usr/bin/time
 * -f %M` records the child's peak resident set in KB into a file we can read
 * after the run, regardless of duration. If `/usr/bin/time` is unavailable on
 * the image we fall back to running the command bare so a missing tool never
 * breaks execution.
 *
 * Preserves the inner command's exit code.
 */
function timedCommand(runCmd: string): string {
  return `sh -c 'SC_START=$(date +%s%N); if [ -x /usr/bin/time ]; then /usr/bin/time -f %M -o ${MEMORY_PATH} -- ${runCmd}; else ${runCmd}; fi; SC_CODE=$?; SC_END=$(date +%s%N); echo $((SC_END - SC_START)) > ${DURATION_PATH}; exit $SC_CODE'`;
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

    const sandbox = await Sandbox.create({
      apiKey: this.apiKey,
      allowInternetAccess: false,
      // E2B rejects `::/0` at sandbox creation; IPv6 egress is handled by
      // the best-effort in-sandbox ip6tables rules in NETWORK_HARDENING_CMD.
      network: { denyOut: E2B_DENY_OUT_CIDRS },
    });
    this.activeSandboxes.add(sandbox);

    try {
      await this.hardenNetwork(sandbox);

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
      const content = await sandbox.files.read(MEMORY_PATH);
      // `/usr/bin/time -f %M` writes max RSS in kilobytes, sometimes with a
      // trailing newline. An empty file means the wrapper fell back to the
      // bare run path (no time available on the image).
      const kb = Number(content.trim());
      if (!Number.isFinite(kb) || kb <= 0) return undefined;
      return Math.round((kb / 1024) * 10) / 10;
    } catch {
      return undefined;
    }
  }

  private async hardenNetwork(sandbox: Sandbox): Promise<void> {
    const hasIptables = await this.commandExists(sandbox, 'iptables');
    if (!hasIptables) {
      this.logger.warn(
        'Skipping in-sandbox iptables hardening because iptables is unavailable; relying on E2B network policy',
      );
      return;
    }

    try {
      await sandbox.commands.run(NETWORK_HARDENING_CMD, { timeoutMs: 10_000 });
      this.logger.debug('Sandbox network hardening applied');
    } catch (error) {
      this.logger.error('Sandbox network hardening failed — aborting execution', error);
      throw new Error(
        'Could not apply sandbox network firewall rules; refusing to run untrusted code',
      );
    }
  }

  private async commandExists(sandbox: Sandbox, command: 'iptables'): Promise<boolean> {
    try {
      await sandbox.commands.run(`command -v ${command} >/dev/null 2>&1`, { timeoutMs: 5_000 });
      return true;
    } catch (error) {
      if (error instanceof CommandExitError) {
        return false;
      }
      throw error;
    }
  }

  supportsLanguage(language: string): language is SupportedLanguage {
    return E2B_SUPPORTED_LANGUAGES.has(language);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const sandbox = await Sandbox.create({
        apiKey: this.apiKey,
        allowInternetAccess: false,
        network: { denyOut: E2B_DENY_OUT_CIDRS },
      });
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
