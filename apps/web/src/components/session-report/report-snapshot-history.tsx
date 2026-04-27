import type { CodeSnapshot } from '@syncode/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@syncode/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton.js';
import { formatSessionDateTime } from '@/lib/dashboard-session-history.js';
import { ReportSnapshotCodeViewer } from './report-snapshot-code-viewer.js';

function getTriggerVariant(trigger: CodeSnapshot['trigger']) {
  switch (trigger) {
    case 'submission':
      return 'success';
    case 'session_end':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function ReportSnapshotHistory({
  snapshots,
  isLoading,
  isError,
  onRetry,
}: {
  snapshots: CodeSnapshot[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('feedback');
  const [isExpanded, setIsExpanded] = useState(false);
  const orderedSnapshots = [...snapshots].sort((left, right) => {
    return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
  });

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
        <CardTitle>{t('sections.snapshotHistory')}</CardTitle>
        <CardDescription>{t('sections.snapshotHistoryDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-6">
        {isLoading ? (
          <SnapshotHistorySkeleton />
        ) : isError ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {t('snapshots.errorDescription')}
            </p>
            <Button variant="outline" onClick={onRetry}>
              {t('snapshots.retry')}
            </Button>
          </div>
        ) : snapshots.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {t('snapshots.emptyDescription')}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => setIsExpanded((current) => !current)}>
                {isExpanded
                  ? t('snapshots.hideHistory')
                  : t('snapshots.showHistory', { count: snapshots.length })}
              </Button>
              {!isExpanded ? (
                <p className="text-sm text-muted-foreground">
                  {t('snapshots.collapsedDescription', { count: snapshots.length })}
                </p>
              ) : null}
            </div>

            {isExpanded ? (
              <div className="space-y-3">
                {orderedSnapshots.map((snapshot, index) => (
                  <article
                    key={snapshot.snapshotId}
                    className="rounded-2xl bg-muted/35 px-4 py-4 ring-1 ring-border/50"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {t('snapshots.snapshotLabel', {
                            index: snapshots.length - index,
                          })}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatSessionDateTime(snapshot.timestamp)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge size="sm" variant={getTriggerVariant(snapshot.trigger)}>
                          {t(`snapshots.trigger.${snapshot.trigger}`)}
                        </Badge>
                        <Badge size="sm" variant="outline">
                          {snapshot.language}
                        </Badge>
                        <Badge size="sm" variant="outline">
                          {t('snapshots.loc', { count: snapshot.linesOfCode })}
                        </Badge>
                      </div>
                    </div>

                    <ReportSnapshotCodeViewer
                      code={snapshot.code || t('snapshots.noCode')}
                      language={snapshot.language}
                      linesOfCode={Math.max(snapshot.linesOfCode, 1)}
                    />
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotHistorySkeleton() {
  return (
    <div className="space-y-3">
      {['one', 'two'].map((key) => (
        <div key={key} className="rounded-2xl bg-muted/35 px-4 py-4 ring-1 ring-border/50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="mt-4 h-40 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
