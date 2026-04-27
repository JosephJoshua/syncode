/**
 * Normalizers for session-report payloads sourced from the AI plane.
 *
 * Shared between the session detail page (PR #281) and the session report
 * page (PR #280). Both endpoints surface the same generated report, so
 * keeping the type-narrowing logic in one place avoids drift.
 *
 * Note: the strict 0–100 integer score validation lives in
 * {@link normalizeReportScoreMap} so PR #280's report endpoint, which renders
 * the bounded values directly, gets the validated map for free.
 */

/**
 * Normalize an unknown payload into a `Record<string, number>` of category
 * scores, dropping any entries whose value is not an integer in the [0, 100]
 * range.
 */
export function normalizeReportScoreMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => {
      const score = entry[1];
      return (
        typeof score === 'number' &&
        Number.isFinite(score) &&
        Number.isInteger(score) &&
        score >= 0 &&
        score <= 100
      );
    }),
  );
}

/**
 * Normalize an unknown payload into a `string[]`, dropping any non-string
 * entries.
 */
export function normalizeReportStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}
