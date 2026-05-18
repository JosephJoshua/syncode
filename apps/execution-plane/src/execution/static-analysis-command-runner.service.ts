import { spawn } from 'node:child_process';
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
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;

      const appendOutput = (current: string, chunk: Buffer) =>
        `${current}${chunk.toString('utf8')}`.slice(0, MAX_CAPTURE_BYTES);

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
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
