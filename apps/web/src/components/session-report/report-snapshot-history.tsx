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
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton.js';
import { formatSessionDateTime } from '@/lib/dashboard-session-history.js';
import { ReportSnapshotCodeViewer } from './report-snapshot-code-viewer.js';

const INITIAL_VISIBLE = 3;

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
  const [showAll, setShowAll] = useState(false);

  const orderedSnapshots = [...snapshots].sort((left, right) => {
    return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
  });

  const visibleSnapshots = showAll ? orderedSnapshots : orderedSnapshots.slice(0, INITIAL_VISIBLE);
  const hasMore = orderedSnapshots.length > INITIAL_VISIBLE;

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
                {isExpanded ? (
                  <ChevronUp className="ml-2 size-4" />
                ) : (
                  <ChevronDown className="ml-2 size-4" />
                )}
              </Button>
              {!isExpanded ? (
                <p className="text-sm text-muted-foreground">
                  {t('snapshots.collapsedDescription', { count: snapshots.length })}
                </p>
              ) : null}
            </div>

            {isExpanded ? (
              <div className="space-y-3">
                {visibleSnapshots.map((snapshot, index) => (
                  <SnapshotCard
                    key={snapshot.snapshotId}
                    snapshot={snapshot}
                    index={orderedSnapshots.length - index}
                    t={t}
                  />
                ))}

                {hasMore ? (
                  <Button
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll
                      ? t('snapshots.hideHistory')
                      : t('snapshots.showHistory', {
                          count: orderedSnapshots.length - INITIAL_VISIBLE,
                        })}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotCard({
  snapshot,
  index,
  t,
}: {
  snapshot: CodeSnapshot;
  index: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [codeVisible, setCodeVisible] = useState(false);

  return (
    <article className="rounded-2xl bg-muted/35 px-4 py-4 ring-1 ring-border/50">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t('snapshots.snapshotLabel', { index })}
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
          <Button
            variant="ghost"
            className="h-auto px-2 py-0.5 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => setCodeVisible((v) => !v)}
          >
            {codeVisible ? t('timeline.hideCode') : t('timeline.showCode')}
          </Button>
        </div>
      </div>

      {codeVisible ? (
        <ReportSnapshotCodeViewer
          code={snapshot.code || t('snapshots.noCode')}
          language={snapshot.language}
          linesOfCode={Math.max(snapshot.linesOfCode, 1)}
          compact
        />
      ) : null}
    </article>
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
        </div>
      ))}
    </div>
  );
}
