import type { SessionReportDimension } from '@syncode/contracts';
import type { SupportedLanguage } from '@syncode/shared';
import type { ReactNode } from 'react';
import { AiFeedbackText } from './ai-feedback-rich-text.js';
import { EvidenceCard } from './report-evidence-card.js';

export function ReportDimensionCard({
  title,
  dimension,
  language,
  icon,
}: {
  title: string;
  dimension: SessionReportDimension;
  language?: SupportedLanguage;
  icon?: ReactNode;
}) {
  return (
    <article className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </p>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {Math.round(dimension.score)}
          </p>
        </div>
        <span className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
          / 100
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        <AiFeedbackText text={dimension.feedback} />
      </p>

      {dimension.evidence.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {dimension.evidence.slice(0, 2).map((item, index) => (
            <EvidenceCard
              key={`${item.type}-${item.reference}-${index}`}
              item={item}
              language={language}
            />
          ))}
        </ul>
      ) : null}
    </article>
  );
}
