import type { SessionReport } from '@syncode/contracts';

export const SESSION_COMPARISON_MIN_SELECTION = 2;
export const SESSION_COMPARISON_MAX_SELECTION = 3;

export const SESSION_COMPARISON_DIMENSION_KEYS = [
  'correctness',
  'efficiency',
  'codeQuality',
  'communication',
  'problemSolving',
] as const;

export type SessionComparisonDimensionKey = (typeof SESSION_COMPARISON_DIMENSION_KEYS)[number];
export type SessionComparisonTrend = 'improving' | 'stable' | 'declining';

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSessionComparisonIds(rawIds: string | undefined): string[] {
  if (!rawIds) {
    return [];
  }

  const parsedIds: string[] = [];
  const seen = new Set<string>();

  for (const value of rawIds.split(',')) {
    const sessionId = value.trim();
    if (!SESSION_ID_PATTERN.test(sessionId) || seen.has(sessionId)) {
      continue;
    }

    parsedIds.push(sessionId);
    seen.add(sessionId);

    if (parsedIds.length >= SESSION_COMPARISON_MAX_SELECTION) {
      break;
    }
  }

  return parsedIds;
}

export function serializeSessionComparisonIds(ids: string[]): string | undefined {
  if (ids.length === 0) {
    return undefined;
  }

  return ids.join(',');
}

export function resolveComparisonDimensionScore(
  report: SessionReport,
  key: SessionComparisonDimensionKey,
): number | null {
  const score = report.dimensions?.[key]?.score;
  return typeof score === 'number' ? score : null;
}

export function calculateAverageDelta(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  let sum = 0;
  for (let index = 1; index < values.length; index++) {
    const current = values[index];
    const previous = values[index - 1];

    if (current === undefined || previous === undefined) {
      continue;
    }

    sum += current - previous;
  }

  return sum / (values.length - 1);
}

export function resolveComparisonTrend(values: number[]): SessionComparisonTrend {
  if (values.length < 2) {
    return 'stable';
  }

  const averageDelta = calculateAverageDelta(values);
  if (averageDelta >= 2) {
    return 'improving';
  }

  if (averageDelta <= -2) {
    return 'declining';
  }

  return 'stable';
}
