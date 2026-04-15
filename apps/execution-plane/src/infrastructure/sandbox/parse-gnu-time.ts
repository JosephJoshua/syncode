export interface GnuTimeMetrics {
  /** Wall clock time in milliseconds. */
  wallClockMs: number;
  /** User CPU time in milliseconds. */
  userTimeMs: number;
  /** System CPU time in milliseconds. */
  sysTimeMs: number;
  /** Peak resident set size in kilobytes. */
  peakMemoryKb: number;
}

/**
 * Parse the wall clock time string from GNU `/usr/bin/time -v`.
 *
 * Possible formats:
 *  - `h:mm:ss.ss`  (e.g. `1:23:45.67`)
 *  - `m:ss.ss`     (e.g. `0:00.01`)
 *
 * Returns milliseconds, or `null` if the format is unrecognized.
 */
function parseWallClock(value: string): number | null {
  // h:mm:ss.ss
  const hms = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value);
  if (hms) {
    const hours = Number(hms[1]);
    const minutes = Number(hms[2]);
    const seconds = Number(hms[3]);
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  // m:ss.ss
  const ms = /^(\d+):(\d{2}(?:\.\d+)?)$/.exec(value);
  if (ms) {
    const minutes = Number(ms[1]);
    const seconds = Number(ms[2]);
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  return null;
}

/**
 * Extract a float field (seconds to ms) from GNU time verbose output.
 * Lines look like: `User time (seconds): 0.00`
 */
function extractSeconds(output: string, label: string): number | null {
  const re = new RegExp(`${label}\\s*:\\s*([\\d.]+)`);
  const match = re.exec(output);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : Math.round(value * 1000);
}

/**
 * Extract an integer field (kbytes) from GNU time verbose output.
 * Lines look like: `Maximum resident set size (kbytes): 3456`
 */
function extractKbytes(output: string): number | null {
  const match = /Maximum resident set size \(kbytes\)\s*:\s*(\d+)/.exec(output);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

/**
 * Parse GNU `/usr/bin/time -v` output and extract timing + memory metrics.
 *
 * Returns `null` if the output is missing or cannot be parsed
 * (e.g. the time command was not available or the format is unexpected).
 */
export function parseGnuTimeOutput(output: string): GnuTimeMetrics | null {
  if (!output) return null;

  // Wall clock: "Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.01"
  const wallMatch = /Elapsed \(wall clock\) time \([^)]+\)\s*:\s*(.+)/.exec(output);
  const wallClockMs = wallMatch?.[1] ? parseWallClock(wallMatch[1].trim()) : null;

  const userTimeMs = extractSeconds(output, 'User time \\(seconds\\)');
  const sysTimeMs = extractSeconds(output, 'System time \\(seconds\\)');
  const peakMemoryKb = extractKbytes(output);

  // Require at least wall clock to consider this valid.
  if (wallClockMs == null) return null;

  return {
    wallClockMs,
    userTimeMs: userTimeMs ?? 0,
    sysTimeMs: sysTimeMs ?? 0,
    peakMemoryKb: peakMemoryKb ?? 0,
  };
}
