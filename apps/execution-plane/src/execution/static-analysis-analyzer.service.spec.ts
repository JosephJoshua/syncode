import { describe, expect, it, vi } from 'vitest';
import { StaticAnalysisAnalyzer } from './static-analysis-analyzer.service.js';
import type { StaticAnalysisCommandRunner } from './static-analysis-command-runner.service.js';

function makeRunner(result: Awaited<ReturnType<StaticAnalysisCommandRunner['run']>>) {
  return {
    run: vi.fn().mockResolvedValue(result),
  } satisfies StaticAnalysisCommandRunner;
}

describe('StaticAnalysisAnalyzer', () => {
  it('GIVEN tools exit nonzero without findings WHEN analyzed THEN records tool failures', async () => {
    const runner = makeRunner({
      exitCode: 127,
      stdout: '',
      stderr: 'command not found',
      timedOut: false,
    });
    const analyzer = new StaticAnalysisAnalyzer(runner);

    const result = await analyzer.analyze({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      roomId: '660e8400-e29b-41d4-a716-446655440000',
      runId: '770e8400-e29b-41d4-a716-446655440000',
      language: 'python',
      source: 'run',
      code: 'print("hello")',
    });

    expect(result.status).toBe('failed');
    expect(result.summary.toolFailureCount).toBeGreaterThan(0);
    expect(result.toolResults.every((tool) => tool.status === 'failed')).toBe(true);
  });
});
