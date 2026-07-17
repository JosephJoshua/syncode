import type { SessionReportEvidence } from '@syncode/contracts';
import type { SupportedLanguage } from '@syncode/shared';
import { Clock, Code, FileCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AiFeedbackText } from './ai-feedback-rich-text.js';
import { ReportSnapshotCodeViewer } from './report-snapshot-code-viewer.js';

function EvidenceTypeIcon({ type }: { type: string }) {
  if (type === 'code_line' || type === 'code_snippet') {
    return <FileCode className="size-3 shrink-0 text-primary/70" />;
  }
  if (type === 'event_timestamp') {
    return <Clock className="size-3 shrink-0 text-primary/70" />;
  }
  return <Code className="size-3 shrink-0 text-muted-foreground" />;
}

function formatTimestampReference(reference: string): string {
  const timestamp = new Date(reference);
  if (Number.isNaN(timestamp.getTime())) {
    return reference;
  }
  return timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function isKnownEvidenceType(type: string) {
  return type === 'code_line' || type === 'code_snippet' || type === 'event_timestamp';
}

export function EvidenceCard({
  item,
  language,
}: {
  item: SessionReportEvidence;
  language?: SupportedLanguage;
}) {
  const { t } = useTranslation('feedback');
  const reference = item.reference.trim();
  const referenceFallback = t('evidence.referenceUnavailable');
  const typeLabel = isKnownEvidenceType(item.type)
    ? t(`evidence.type.${item.type}`)
    : t('evidence.type.unknown');

  return (
    <li className="rounded-xl bg-background/60 px-3 py-2.5">
      <div className="flex items-start gap-1.5">
        <EvidenceTypeIcon type={item.type} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {typeLabel}
          </p>

          <p className="text-sm font-medium text-foreground">
            <AiFeedbackText text={item.description} />
          </p>

          {item.type === 'code_snippet' && language && reference ? (
            <ReportSnapshotCodeViewer
              code={reference}
              language={language}
              linesOfCode={Math.max(reference.split('\n').length, 1)}
              compact
            />
          ) : item.type === 'code_line' ? (
            <p className="mt-1 overflow-x-auto rounded-md bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              <span className="whitespace-pre-wrap break-words">
                {reference || referenceFallback}
              </span>
            </p>
          ) : item.type === 'event_timestamp' ? (
            <p className="mt-1 overflow-x-auto font-mono text-[11px] text-primary/70">
              <span className="whitespace-pre-wrap break-words">
                {reference ? formatTimestampReference(reference) : referenceFallback}
              </span>
            </p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
              {reference || referenceFallback}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
