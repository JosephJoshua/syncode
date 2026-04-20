import { type SessionReport, sessionReportSchema } from '@syncode/contracts';

export function parseSessionReportJson(raw: string): SessionReport {
  const normalized = raw.trim();
  const withoutFence = normalized.startsWith('```')
    ? normalized.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
    : normalized;

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

  const result = sessionReportSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`LLM response did not match session report schema: ${issues}`);
  }

  return result.data;
}
