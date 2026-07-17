export class Metrics {
  #records = [];

  record(record) {
    this.#records.push({
      ...record,
      durationMs: Math.round(record.durationMs),
    });
  }

  summary() {
    const groupsByLabel = new Map();
    for (const record of this.#records) {
      const group = groupsByLabel.get(record.label) ?? [];
      group.push(record);
      groupsByLabel.set(record.label, group);
    }

    const groups = [...groupsByLabel.entries()]
      .map(([label, records]) => summarizeGroup(label, records))
      .sort((left, right) => left.label.localeCompare(right.label));

    const totalRequests = this.#records.length;
    const totalFailures = this.#records.filter((record) => !record.ok).length;
    const allDurations = this.#records.map((record) => record.durationMs);

    return {
      totalRequests,
      totalFailures,
      failureRate: totalRequests === 0 ? 0 : totalFailures / totalRequests,
      avgMs: average(allDurations),
      p50Ms: percentile(allDurations, 50),
      p90Ms: percentile(allDurations, 90),
      p95Ms: percentile(allDurations, 95),
      p99Ms: percentile(allDurations, 99),
      maxMs: allDurations.length === 0 ? 0 : Math.max(...allDurations),
      groups,
    };
  }

  report({ scenario, baseUrl, startedAt, finishedAt, thresholds }) {
    const summary = this.summary();
    const passed =
      summary.failureRate <= thresholds.maxFailureRate && summary.p95Ms <= thresholds.maxP95Ms;

    return {
      scenario,
      baseUrl,
      startedAt,
      finishedAt,
      passed,
      thresholds,
      summary,
    };
  }
}

function summarizeGroup(label, records) {
  const durations = records.map((record) => record.durationMs);
  const failures = records.filter((record) => !record.ok).length;
  const statuses = {};
  for (const record of records) {
    statuses[record.status] = (statuses[record.status] ?? 0) + 1;
  }
  return {
    label,
    count: records.length,
    failures,
    failureRate: records.length === 0 ? 0 : failures / records.length,
    avgMs: average(durations),
    p50Ms: percentile(durations, 50),
    p90Ms: percentile(durations, 90),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: durations.length === 0 ? 0 : Math.max(...durations),
    statuses,
  };
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}
