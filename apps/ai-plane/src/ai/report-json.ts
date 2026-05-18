import {
  SESSION_REPORT_TREND_OPTIONS,
  type SessionReport,
  sessionReportSchema,
} from '@syncode/contracts';

export function parseSessionReportJson(raw: string): SessionReport {
  const trimmed = raw.trim();
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
    : trimmed;

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('LLM response was not valid JSON');
  }

  const jsonText = withoutFence.slice(firstBrace, lastBrace + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `LLM response was not valid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`,
    );
  }

  const normalizedPayload = normalizeSessionReportPayload(parsed);
  const result = sessionReportSchema.safeParse(normalizedPayload);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`LLM response did not match session report schema: ${issues}`);
  }

  return result.data;
}

function normalizeSessionReportPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed;
  }

  const report = { ...parsed } as Record<string, unknown>;
  normalizeDimensions(report);
  normalizePeerFeedbackSummary(report);
  normalizeComparisonToHistory(report);

  return report;
}

function normalizePeerFeedbackSummary(report: Record<string, unknown>) {
  const summary = report.peerFeedbackSummary;

  if (typeof summary === 'string') {
    report.peerFeedbackSummary = null;
    return;
  }

  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return;
  }

  const candidate = { ...summary } as Record<string, unknown>;
  const averageRating = toNumber(candidate.averageRating);
  const wouldPairAgain = toNumber(candidate.wouldPairAgain);

  if (averageRating === null || wouldPairAgain === null) {
    report.peerFeedbackSummary = null;
    return;
  }

  if (!Array.isArray(candidate.themes)) {
    candidate.themes = [];
  }

  candidate.averageRating = averageRating;
  candidate.wouldPairAgain = wouldPairAgain;
  report.peerFeedbackSummary = candidate;
}

function normalizeComparisonToHistory(report: Record<string, unknown>) {
  const comparison = report.comparisonToHistory;

  if (typeof comparison === 'string') {
    report.comparisonToHistory = null;
    return;
  }

  if (!comparison || typeof comparison !== 'object' || Array.isArray(comparison)) {
    return;
  }

  const candidate = { ...comparison } as Record<string, unknown>;
  const trend = normalizeTrend(candidate.trend);
  const sessionsCompared = toNumber(candidate.sessionsCompared);
  const averageScore = toNumber(candidate.averageScore);

  if (trend === null || sessionsCompared === null || averageScore === null) {
    report.comparisonToHistory = null;
    return;
  }

  candidate.trend = trend;
  candidate.sessionsCompared = sessionsCompared;
  candidate.averageScore = averageScore;
  report.comparisonToHistory = candidate;
}

function normalizeDimensions(report: Record<string, unknown>) {
  const dimensions = report.dimensions;
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    return;
  }

  const normalizedDimensions = { ...dimensions } as Record<string, unknown>;

  for (const [key, label] of Object.entries(DIMENSION_LABELS)) {
    const normalized = normalizeDimension(normalizedDimensions[key], label);

    if (normalized) {
      normalizedDimensions[key] = normalized;
    } else {
      delete normalizedDimensions[key];
    }
  }

  report.dimensions = normalizedDimensions;
}

function normalizeDimension(dimension: unknown, label: string) {
  if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) {
    return null;
  }

  const candidate = { ...dimension } as Record<string, unknown>;

  if (typeof candidate.score !== 'number' || Number.isNaN(candidate.score)) {
    return null;
  }

  if (typeof candidate.feedback !== 'string' || candidate.feedback.trim().length === 0) {
    candidate.feedback = `No explicit ${label} feedback was provided.`;
  }

  if (!Array.isArray(candidate.evidence)) {
    candidate.evidence = [];
  }

  return candidate;
}

function normalizeTrend(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    SESSION_REPORT_TREND_OPTIONS.includes(
      normalized as (typeof SESSION_REPORT_TREND_OPTIONS)[number],
    )
  ) {
    return normalized;
  }

  if (
    normalized === 'improve' ||
    normalized === 'improved' ||
    normalized === 'improvement' ||
    normalized === 'better' ||
    normalized === 'upward'
  ) {
    return 'improving';
  }

  if (
    normalized === 'decline' ||
    normalized === 'declined' ||
    normalized === 'worse' ||
    normalized === 'downward' ||
    normalized === 'regressing'
  ) {
    return 'declining';
  }

  if (
    normalized === 'same' ||
    normalized === 'unchanged' ||
    normalized === 'consistent' ||
    normalized === 'no_change'
  ) {
    return 'stable';
  }

  return null;
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

const DIMENSION_LABELS = {
  correctness: 'correctness',
  efficiency: 'efficiency',
  codeQuality: 'code quality',
  communication: 'communication',
  problemSolving: 'problem-solving',
} as const;
