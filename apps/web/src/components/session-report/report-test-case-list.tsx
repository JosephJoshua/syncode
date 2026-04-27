import type { SessionReportTestCaseBreakdownItem } from '@syncode/contracts';
import { Badge } from '@syncode/ui';
import { useTranslation } from 'react-i18next';

function getBreakdownVariant(item: SessionReportTestCaseBreakdownItem) {
  if (item.passed) {
    return 'success';
  }

  if (item.timedOut) {
    return 'warning';
  }

  return 'neutral';
}

function getBreakdownLabel(item: SessionReportTestCaseBreakdownItem, t: (key: string) => string) {
  if (item.passed) {
    return t('breakdown.pass');
  }

  if (item.timedOut) {
    return t('breakdown.timeout');
  }

  if (item.errorMessage) {
    return t('breakdown.error');
  }

  return t('breakdown.failed');
}

export function ReportTestCaseList({
  breakdown,
}: {
  breakdown: SessionReportTestCaseBreakdownItem[];
}) {
  const { t } = useTranslation('feedback');

  if (breakdown.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">{t('breakdown.emptyDescription')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {breakdown.map((item) => (
        <article
          key={item.testCaseIndex}
          className="rounded-2xl bg-muted/35 px-4 py-4 ring-1 ring-border/50"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('breakdown.caseLabel', { index: item.testCaseIndex + 1 })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.passed ? t('breakdown.passDescription') : t('breakdown.failDescription')}
              </p>
            </div>

            <Badge variant={getBreakdownVariant(item)}>{getBreakdownLabel(item, t)}</Badge>
          </div>

          {item.errorMessage ? (
            <div className="mt-3 rounded-xl bg-background/70 px-3 py-2.5 text-sm text-muted-foreground">
              {item.errorMessage}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
