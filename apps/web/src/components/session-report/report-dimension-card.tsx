import type { SessionReportDimension } from '@syncode/contracts';
import type { SupportedLanguage } from '@syncode/shared';
import { Button } from '@syncode/ui';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiFeedbackText } from './ai-feedback-rich-text.js';
import { EvidenceCard } from './report-evidence-card.js';

const COLLAPSED_FEEDBACK_MAX_LENGTH = 240;

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
  const { t } = useTranslation('feedback');
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(false);
  const isFeedbackExpandable = dimension.feedback.trim().length > COLLAPSED_FEEDBACK_MAX_LENGTH;

  const showCollapsedFeedback = isFeedbackExpandable && !isFeedbackExpanded;

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

      <div className="mt-4 space-y-2">
        <div className="relative">
          <p
            data-slot="dimension-feedback-text"
            data-testid="dimension-feedback-text"
            className={`text-sm leading-6 text-muted-foreground ${
              showCollapsedFeedback ? 'max-h-[7.5rem] overflow-hidden' : ''
            }`}
          >
            <AiFeedbackText text={dimension.feedback} />
          </p>
          {showCollapsedFeedback ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted/35 to-transparent" />
          ) : null}
        </div>

        {isFeedbackExpandable ? (
          <Button
            variant="ghost"
            className="h-auto px-0 py-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => setIsFeedbackExpanded((current) => !current)}
          >
            {isFeedbackExpanded ? t('actions.showLessReview') : t('actions.showFullReview')}
          </Button>
        ) : null}
      </div>

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
