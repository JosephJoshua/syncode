import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ChildProcessStaticAnalysisCommandRunner } from './static-analysis-command-runner.service.js';

const SECRET_ENV_KEY = 'SYNCODE_STATIC_ANALYSIS_SECRET_TEST';

describe('ChildProcessStaticAnalysisCommandRunner', () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    delete process.env[SECRET_ENV_KEY];
    await Promise.all(
      workspaces.map((workspace) => rm(workspace, { recursive: true, force: true })),
    );
    workspaces.length = 0;
  });

  it('GIVEN host process has secrets WHEN command runs THEN environment is sanitized', async () => {
    process.env[SECRET_ENV_KEY] = 'should-not-leak';
    const workspace = await mkdtemp(join(tmpdir(), 'syncode-runner-test-'));
    workspaces.push(workspace);
    const runner = new ChildProcessStaticAnalysisCommandRunner();

    const result = await runner.run(
      process.execPath,
      [
        '-e',
        [
          'process.stdout.write(JSON.stringify({',
          `secret: process.env.${SECRET_ENV_KEY} ?? null,`,
          'hasPath: Boolean(process.env.PATH),',
          'home: process.env.HOME',
          '}));',
        ].join(''),
      ],
      { cwd: workspace, timeoutMs: 5_000 },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      secret: null,
      hasPath: true,
      home: workspace,
    });
  });
});
