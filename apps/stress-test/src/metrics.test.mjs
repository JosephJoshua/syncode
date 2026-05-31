import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Metrics } from './metrics.mjs';

describe('Metrics', () => {
  it('summarizes latency and error rate by request label', () => {
    const metrics = new Metrics();

    metrics.record({ label: 'GET /api/health', status: 200, durationMs: 100, ok: true });
    metrics.record({ label: 'GET /api/health', status: 200, durationMs: 200, ok: true });
    metrics.record({ label: 'GET /api/health', status: 503, durationMs: 500, ok: false });

    const summary = metrics.summary();

    assert.equal(summary.totalRequests, 3);
    assert.equal(summary.totalFailures, 1);
    assert.equal(summary.groups[0].label, 'GET /api/health');
    assert.equal(summary.groups[0].count, 3);
    assert.equal(summary.groups[0].failureRate, 1 / 3);
    assert.equal(summary.groups[0].p95Ms, 500);
  });

  it('builds report JSON with pass/fail thresholds', () => {
    const metrics = new Metrics();

    metrics.record({ label: 'GET /api/health', status: 200, durationMs: 120, ok: true });

    const report = metrics.report({
      scenario: 'smoke',
      baseUrl: 'https://syncode.anggita.org',
      startedAt: '2026-05-31T00:00:00.000Z',
      finishedAt: '2026-05-31T00:01:00.000Z',
      thresholds: {
        maxFailureRate: 0.01,
        maxP95Ms: 500,
      },
    });

    assert.equal(report.passed, true);
    assert.equal(report.thresholds.maxFailureRate, 0.01);
    assert.equal(report.summary.totalRequests, 1);
  });
});
