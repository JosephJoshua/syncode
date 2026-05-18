import type { CodeSnapshot } from '@syncode/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSnapshotCodeViewer } from './report-snapshot-code-viewer.js';

interface TimelineSnapshotItem {
  id: string;
  label: string;
  timestamp: string;
  snapshot: CodeSnapshot | null;
}

function formatElapsedTimelineTime(startedAt: string, timestamp: string) {
  const elapsedMs = Math.max(0, new Date(timestamp).getTime() - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function buildTimelineItems(
  startedAt: string,
  finishedAt: string | null,
  snapshots: CodeSnapshot[],
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  const importantSnapshots = [...snapshots]
    .filter((snapshot) => snapshot.trigger !== 'periodic')
    .sort((left, right) => {
      return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    });

  const items: TimelineSnapshotItem[] = [
    {
      id: 'session-start',
      label: t('timeline.events.sessionStart'),
      timestamp: startedAt,
      snapshot: null,
    },
  ];

  for (const snapshot of importantSnapshots) {
    const baseLabel = t(`timeline.events.${snapshot.trigger}`);
    const label =
      snapshot.trigger === 'phase_change' && snapshot.phase
        ? t('timeline.phaseChangeWithTarget', {
            phase: t(`phase.${snapshot.phase}`),
            defaultValue: `${baseLabel} → ${snapshot.phase}`,
          })
        : baseLabel;

    items.push({
      id: snapshot.snapshotId,
      label,
      timestamp: snapshot.timestamp,
      snapshot,
    });
  }

  const hasSessionEndSnapshot = importantSnapshots.some(
    (snapshot) => snapshot.trigger === 'session_end',
  );

  if (finishedAt && !hasSessionEndSnapshot) {
    items.push({
      id: 'session-end',
      label: t('timeline.events.sessionEnd'),
      timestamp: finishedAt,
      snapshot: null,
    });
  }

  return items;
}

export function ReportSessionTimeline({
  startedAt,
  finishedAt,
  snapshots,
}: {
  startedAt: string;
  finishedAt: string | null;
  snapshots: CodeSnapshot[];
}) {
  const { t } = useTranslation('feedback');
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    return buildTimelineItems(startedAt, finishedAt, snapshots, t);
  }, [finishedAt, snapshots, startedAt, t]);

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
        <CardTitle>{t('sections.timeline')}</CardTitle>
        <CardDescription>{t('sections.timelineDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-6">
        <div className="relative">
          <div className="pointer-events-none absolute left-[18px] top-1.5 bottom-1.5 w-px bg-border/60" />

          <ol className="space-y-4 pl-10">
            {items.map((item) => {
              const isExpanded = expandedItemIds[item.id] ?? false;
              const elapsedLabel = formatElapsedTimelineTime(startedAt, item.timestamp);

              return (
                <li key={item.id} className="relative">
                  <span className="absolute left-[-28px] top-1.5 size-3 rounded-full bg-primary shadow-[0_0_14px_rgba(98,240,168,0.45)]" />

                  <div className="space-y-2.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-mono text-[1.05rem] tracking-tight text-primary">
                          {elapsedLabel}
                        </p>
                        <p className="mt-0.5 text-[0.95rem] text-foreground">{item.label}</p>
                      </div>

                      {item.snapshot ? (
                        <Button
                          variant="ghost"
                          className="h-auto w-fit px-0 py-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                          onClick={() =>
                            setExpandedItemIds((current) => ({
                              ...current,
                              [item.id]: !isExpanded,
                            }))
                          }
                        >
                          {isExpanded ? t('timeline.hideCode') : t('timeline.showCode')}
                          {isExpanded ? (
                            <ChevronUp className="ml-2 size-4" />
                          ) : (
                            <ChevronDown className="ml-2 size-4" />
                          )}
                        </Button>
                      ) : null}
                    </div>

                    {item.snapshot && isExpanded ? (
                      <div className="rounded-2xl bg-muted/35 px-4 py-4 ring-1 ring-border/50">
                        <ReportSnapshotCodeViewer
                          code={item.snapshot.code || t('snapshots.noCode')}
                          language={item.snapshot.language}
                          linesOfCode={Math.max(item.snapshot.linesOfCode, 1)}
                          compact
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
