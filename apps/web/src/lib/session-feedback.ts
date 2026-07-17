import type {
  CodeSnapshot,
  SessionDetail,
  SessionReport,
  SessionReportDimension,
} from '@syncode/contracts';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';

export function toSupportedLanguage(
  language: string | null | undefined,
): SupportedLanguage | undefined {
  if (!language) {
    return undefined;
  }

  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? (language as SupportedLanguage)
    : undefined;
}

export function getViewerRole(session: SessionDetail | undefined, currentUserId: string | null) {
  if (!session || !currentUserId) {
    return null;
  }

  const participant = session.participants.find((item) => item.userId === currentUserId);
  return participant?.role ?? null;
}

export function getDimensionEntries(report: SessionReport | null) {
  if (!report?.dimensions) {
    return [];
  }

  const entries: Array<[string, SessionReportDimension]> = [];

  for (const key of [
    'correctness',
    'efficiency',
    'codeQuality',
    'communication',
    'problemSolving',
  ] as const) {
    const dimension = report.dimensions[key];

    if (dimension) {
      entries.push([key, dimension]);
    }
  }

  return entries;
}

export function getMostRecentSnapshot(snapshots: CodeSnapshot[]): CodeSnapshot | null {
  if (snapshots.length === 0) {
    return null;
  }

  return (
    [...snapshots].sort((left, right) => {
      return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    })[0] ?? null
  );
}

export function getDetailedFeedbackPreview(markdown: string) {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.slice(0, 1).join('\n\n');
}
