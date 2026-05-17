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
  try {
    return new Date(reference).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return reference;
  }
}

export function EvidenceCard({
  item,
  language,
}: {
  item: SessionReportEvidence;
  language?: SupportedLanguage;
}) {
  const { t } = useTranslation('feedback');

  return (
    <li className="rounded-xl bg-background/60 px-3 py-2.5">
      <div className="flex items-start gap-1.5">
        <EvidenceTypeIcon type={item.type} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t(`evidence.type.${item.type}`, { defaultValue: item.type })}
          </p>

          <p className="text-sm font-medium text-foreground">
            <AiFeedbackText text={item.description} />
          </p>

          {item.type === 'code_snippet' && language ? (
            <ReportSnapshotCodeViewer
              code={item.reference}
              language={language}
              linesOfCode={Math.max(item.reference.split('\n').length, 1)}
              compact
            />
          ) : item.type === 'code_line' ? (
            <p className="mt-1 rounded-md bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {item.reference}
            </p>
          ) : item.type === 'event_timestamp' ? (
            <p className="mt-1 font-mono text-[11px] text-primary/70">
              {formatTimestampReference(item.reference)}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">{item.reference}</p>
          )}
        </div>
      </div>
    </li>
  );
}
