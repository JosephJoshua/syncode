import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';

const MAX_CAPTURE_BYTES = 256 * 1024;

export interface StaticAnalysisCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
}

export interface StaticAnalysisCommandRunner {
  run(
    command: string,
    args: string[],
    options: { cwd: string; timeoutMs: number },
  ): Promise<StaticAnalysisCommandResult>;
}

@Injectable()
export class ChildProcessStaticAnalysisCommandRunner implements StaticAnalysisCommandRunner {
  run(
    command: string,
    args: string[],
    options: { cwd: string; timeoutMs: number },
  ): Promise<StaticAnalysisCommandResult> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: buildSanitizedEnv(options.cwd),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;

      const appendOutput = (current: string, chunk: Buffer) =>
        `${current}${chunk.toString('utf8')}`.slice(0, MAX_CAPTURE_BYTES);

      const timeout = setTimeout(() => {
        timedOut = true;
        killChildProcessTree(child.pid);
      }, options.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout = appendOutput(stdout, chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = appendOutput(stderr, chunk);
      });

      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({
          exitCode: null,
          stdout,
          stderr,
          timedOut,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      child.on('close', (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({ exitCode, stdout, stderr, timedOut });
      });
    });
  }
}

function buildSanitizedEnv(cwd: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    CI: '1',
    HOME: cwd,
    TMPDIR: cwd,
    TMP: cwd,
    TEMP: cwd,
    NO_COLOR: '1',
    PATH: process.env.PATH ?? '',
    GOCACHE: join(cwd, '.cache', 'go-build'),
    GOMODCACHE: join(cwd, '.cache', 'go-mod'),
    CARGO_HOME: join(cwd, '.cache', 'cargo'),
  };

  for (const key of ['ANALYSIS_TOOLS_HOME', 'JAVA_HOME', 'LANG', 'LC_ALL', 'PMD_HOME'] as const) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }

  return env;
}

function killChildProcessTree(pid: number | undefined): void {
  if (!pid) return;

  if (process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL');
      return;
    } catch {}
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {}
}
