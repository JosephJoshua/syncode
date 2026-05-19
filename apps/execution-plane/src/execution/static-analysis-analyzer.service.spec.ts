import { describe, expect, it, vi } from 'vitest';
import { StaticAnalysisAnalyzer } from './static-analysis-analyzer.service.js';
import type { StaticAnalysisCommandRunner } from './static-analysis-command-runner.service.js';

function makeRunner(result: Awaited<ReturnType<StaticAnalysisCommandRunner['run']>>) {
  return {
    run: vi.fn().mockResolvedValue(result),
  } satisfies StaticAnalysisCommandRunner;
}

describe('StaticAnalysisAnalyzer', () => {
  const request = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    roomId: '660e8400-e29b-41d4-a716-446655440000',
    runId: '770e8400-e29b-41d4-a716-446655440000',
    language: 'python' as const,
    source: 'run' as const,
    code: 'print("hello")',
  };

  it('GIVEN analyzer tools return findings WHEN analyzed THEN summarizes diagnostics complexity and duplication', async () => {
    const runner = {
      run: vi.fn().mockImplementation(async (command: string) => {
        if (command === 'ruff') {
          return {
            exitCode: 1,
            stdout: JSON.stringify([
              {
                code: 'F841',
                message: 'Local variable `x` is assigned to but never used',
                filename: 'Main.py',
                location: { row: 3, column: 5 },
              },
            ]),
            stderr: '',
            timedOut: false,
          };
        }
        if (command === 'lizard') {
          return {
            exitCode: 0,
            stdout:
              '<cppncss><function name="solve" line="12" endline="40" complexity="14" file="Main.py" /></cppncss>',
            stderr: '',
            timedOut: false,
          };
        }
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            duplications: [
              {
                lines: 8,
                tokens: 54,
                files: [
                  { name: 'Main.py', startLine: 3, endLine: 10 },
                  { name: 'Main.py', startLine: 14, endLine: 21 },
                ],
              },
            ],
          }),
          stderr: '',
          timedOut: false,
        };
      }),
    } satisfies StaticAnalysisCommandRunner;
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze(request);

    expect(result.status).toBe('completed');
    expect(result.summary).toMatchObject({
      diagnosticCount: 1,
      errorCount: 1,
      warningCount: 0,
      maxCyclomaticComplexity: 14,
      highComplexityCount: 1,
      duplicationCount: 1,
      toolFailureCount: 0,
    });
    expect(result.toolResults).toHaveLength(3);
  });

  it.each([
    ['javascript', 'const value = 1;'],
    ['typescript', 'const value: number = 1;'],
    ['java', 'class Main {}'],
    ['c', 'int main(void) { return 0; }'],
    ['cpp', 'int main() { return 0; }'],
    ['go', 'package main\nfunc main() {}'],
    ['rust', 'fn main() {}'],
  ] as const)('GIVEN %s source WHEN analyzed THEN builds and parses the language toolchain', async (language, code) => {
    const runner = {
      run: vi.fn().mockImplementation(async (command: string, args: string[]) => {
        if (command === 'biome') {
          return { exitCode: 0, stdout: '{"diagnostics":[]}', stderr: '', timedOut: false };
        }
        if (command === 'pmd' && args[0] === 'check') {
          return { exitCode: 0, stdout: '{"files":[]}', stderr: '', timedOut: false };
        }
        if (command === 'cppcheck') {
          return {
            exitCode: 0,
            stdout: '',
            stderr: '<results><errors /></results>',
            timedOut: false,
          };
        }
        if (command === 'golangci-lint') {
          return { exitCode: 0, stdout: '{"Issues":[]}', stderr: '', timedOut: false };
        }
        if (command === 'cargo') {
          return { exitCode: 0, stdout: '', stderr: '', timedOut: false };
        }
        if (command === 'lizard') {
          return { exitCode: 0, stdout: '<cppncss />', stderr: '', timedOut: false };
        }
        return {
          exitCode: 0,
          stdout: '{"duplications":[]}',
          stderr: '',
          timedOut: false,
        };
      }),
    } satisfies StaticAnalysisCommandRunner;
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze({
      ...request,
      language,
      code,
    });

    expect(result.status).toBe('completed');
    expect(result.summary.toolFailureCount).toBe(0);
    expect(runner.run).toHaveBeenCalled();
  });

  it('GIVEN code is empty WHEN analyzed THEN returns validation failure', async () => {
    const runner = makeRunner({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
    });
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze({ ...request, code: '   ' });

    expect(result).toMatchObject({
      status: 'failed',
      error: 'Code cannot be empty',
      toolResults: [],
    });
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('GIVEN language is unsupported WHEN analyzed THEN returns validation failure', async () => {
    const runner = makeRunner({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
    });
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze({ ...request, language: 'ruby' as never });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Unsupported language: ruby');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('GIVEN request has no target WHEN analyzed THEN returns validation failure', async () => {
    const runner = makeRunner({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
    });
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze({ ...request, runId: null });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Exactly one of runId or submissionId is required');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('GIVEN request has both run and submission targets WHEN analyzed THEN returns validation failure', async () => {
    const runner = makeRunner({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
    });
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze({
      ...request,
      submissionId: '880e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Exactly one of runId or submissionId is required');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('GIVEN tools exit nonzero without findings WHEN analyzed THEN records tool failures', async () => {
    const runner = makeRunner({
      exitCode: 127,
      stdout: '',
      stderr: 'command not found',
      timedOut: false,
    });
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze(request);

    expect(result.status).toBe('failed');
    expect(result.summary.toolFailureCount).toBeGreaterThan(0);
    expect(result.toolResults.every((tool) => tool.status === 'failed')).toBe(true);
  });
});
