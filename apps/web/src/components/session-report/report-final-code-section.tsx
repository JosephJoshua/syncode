import type { CodeSnapshot } from '@syncode/contracts';
import { Badge, Button } from '@syncode/ui';
import { useTranslation } from 'react-i18next';
import { formatSessionDateTime } from '@/lib/dashboard-session-history.js';
import { SectionCard } from './report-feedback-shell.js';
import { ReportSnapshotCodeViewer } from './report-snapshot-code-viewer.js';

export function FinalCodeSection({
  snapshot,
  isLoading,
  isError,
  onRetry,
}: {
  snapshot: CodeSnapshot | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('feedback');

  return (
    <SectionCard title={t('sections.finalCode')} description={t('sections.finalCodeDescription')}>
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted/40" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted/40" />
          </div>
          <div className="h-[320px] animate-pulse rounded-xl bg-muted/30" />
        </div>
      ) : isError ? (
        <div>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('snapshots.errorDescription')}
          </p>
          <Button className="mt-5" variant="outline" onClick={onRetry}>
            {t('snapshots.retry')}
          </Button>
        </div>
      ) : snapshot ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge size="sm" variant="neutral">
              {t(`snapshots.trigger.${snapshot.trigger}`)}
            </Badge>
            <Badge size="sm" variant="outline">
              {formatSessionDateTime(snapshot.timestamp)}
            </Badge>
            <Badge size="sm" variant="outline">
              {snapshot.language}
            </Badge>
            <Badge size="sm" variant="outline">
              {t('snapshots.loc', { count: snapshot.linesOfCode })}
            </Badge>
          </div>

          <ReportSnapshotCodeViewer
            code={snapshot.code || t('snapshots.noCode')}
            language={snapshot.language}
            linesOfCode={Math.max(snapshot.linesOfCode, 1)}
          />
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">{t('sections.noFinalCode')}</p>
      )}
    </SectionCard>
  );
}
