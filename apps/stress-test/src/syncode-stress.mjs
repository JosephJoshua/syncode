#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadUsers, parseArgs, printHelp } from './config.mjs';
import { ApiClient } from './http.mjs';
import { Metrics } from './metrics.mjs';
import { runScenarioIteration, selectUser } from './workloads.mjs';

async function main() {
  const config = parseArgs();
  if (config.help) {
    console.log(printHelp());
    return;
  }

  const users = await loadUsers(config.usersFile);
  const metrics = new Metrics();
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + config.durationSeconds * 1_000;

  console.log(
    `Starting SynCode stress test: scenario=${config.scenario} vus=${config.vus} duration=${config.durationSeconds}s base=${config.baseUrl}`,
  );

  await Promise.all(
    Array.from({ length: config.vus }, (_, index) =>
      runVirtualUser({
        index,
        config,
        user: selectUser(users, index),
        metrics,
        deadline,
      }),
    ),
  );

  const finishedAt = new Date().toISOString();
  const report = metrics.report({
    scenario: config.scenario,
    baseUrl: config.baseUrl,
    startedAt,
    finishedAt,
    thresholds: {
      maxFailureRate: config.maxFailureRate,
      maxP95Ms: config.maxP95Ms,
    },
  });

  printSummary(report);

  if (config.reportFile) {
    await mkdir(dirname(config.reportFile), { recursive: true });
    await writeFile(config.reportFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Wrote report to ${config.reportFile}`);
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

async function runVirtualUser({ index, config, user, metrics, deadline }) {
  const client = new ApiClient({
    baseUrl: config.baseUrl,
    metrics,
    timeoutMs: config.requestTimeoutMs,
    userLabel: `vu-${index + 1}`,
  });

  while (Date.now() < deadline) {
    try {
      await runScenarioIteration(client, {
        scenario: config.scenario,
        user,
        cleanupRooms: config.cleanupRooms,
        includeExpensive: config.includeExpensive,
        pollTimeoutMs: config.pollTimeoutMs,
        pollIntervalMs: config.pollIntervalMs,
      });
    } catch (error) {
      metrics.record({
        label: 'scenario error',
        status: 0,
        durationMs: 0,
        ok: false,
        userLabel: `vu-${index + 1}`,
      });
      console.error(`[vu-${index + 1}] ${error.message}`);
      if (config.scenario !== 'smoke' && /requires --users-file/.test(error.message)) {
        break;
      }
    }

    if (config.thinkTimeMs > 0) {
      await sleep(config.thinkTimeMs);
    }
  }
}

function printSummary(report) {
  const summary = report.summary;
  console.log('');
  console.log(`Result: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log(
    `Requests=${summary.totalRequests} failures=${summary.totalFailures} failureRate=${formatPercent(summary.failureRate)} avg=${summary.avgMs}ms p95=${summary.p95Ms}ms p99=${summary.p99Ms}ms max=${summary.maxMs}ms`,
  );
  console.table(
    summary.groups.map((group) => ({
      label: group.label,
      count: group.count,
      failures: group.failures,
      failureRate: formatPercent(group.failureRate),
      avgMs: group.avgMs,
      p95Ms: group.p95Ms,
      p99Ms: group.p99Ms,
      maxMs: group.maxMs,
      statuses: JSON.stringify(group.statuses),
    })),
  );
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
