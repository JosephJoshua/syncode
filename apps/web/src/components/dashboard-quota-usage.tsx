import type { UserQuotasResponse } from '@syncode/contracts';
import { Button, Card, CardContent, cn, Progress } from '@syncode/ui';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton.js';

type QuotaKey = 'ai' | 'execution' | 'rooms';

interface DashboardQuotaUsageProps {
  readonly quotas: UserQuotasResponse | undefined;
  readonly isLoading: boolean;
  readonly isFetching?: boolean;
  readonly isError?: boolean;
  readonly notificationScope?: string | null;
  readonly onRetry?: () => void;
}

type QuotaItem = {
  key: QuotaKey;
  label: string;
  value: string;
  percent: number;
  isAtRisk: boolean;
  isExceeded: boolean;
  notificationKey: string;
  warningMessage: string;
  exceededMessage: string;
};

const WARNING_THRESHOLD = 80;
const notifiedQuotaEvents = new Set<string>();

export function resetDashboardQuotaUsageNotificationsForTest() {
  notifiedQuotaEvents.clear();
}

export function DashboardQuotaUsage({
  quotas,
  isLoading,
  isFetching = false,
  isError = false,
  notificationScope = null,
  onRetry,
}: DashboardQuotaUsageProps) {
  const { t } = useTranslation('dashboard');
  const items = useMemo(() => buildQuotaItems(quotas, t), [quotas, t]);
  const exceededItems = items.filter((item) => item.isExceeded);

  useEffect(() => {
    if (!quotas || isLoading || isFetching || isError) {
      return;
    }

    for (const item of items) {
      if (item.isExceeded) {
        clearQuotaNotificationEvents(notificationScope, item.key, 'warning');
        const eventKey = getQuotaNotificationEventKey(notificationScope, item, 'exceeded');
        if (!notifiedQuotaEvents.has(eventKey)) {
          notifiedQuotaEvents.add(eventKey);
          toast.error(item.exceededMessage);
        }

        continue;
      }

      clearQuotaNotificationEvents(notificationScope, item.key, 'exceeded');

      if (!item.isAtRisk) {
        clearQuotaNotificationEvents(notificationScope, item.key, 'warning');
        continue;
      }

      const eventKey = getQuotaNotificationEventKey(notificationScope, item, 'warning');
      if (notifiedQuotaEvents.has(eventKey)) {
        continue;
      }

      notifiedQuotaEvents.add(eventKey);
      toast.warning(item.warningMessage);
    }
  }, [isError, isFetching, isLoading, items, notificationScope, quotas]);

  return (
    <section className="mt-8 sm:mt-10" aria-labelledby="dashboard-quota-usage-heading">
      <Card className="border border-border/50 bg-card/80 py-4 backdrop-blur-sm sm:py-5">
        <CardContent className="space-y-4 px-4 sm:px-5">
          <p
            id="dashboard-quota-usage-heading"
            className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground/90"
          >
            {t('quotas.heading')}
          </p>

          {isLoading ? (
            <QuotaRowsSkeleton />
          ) : isError ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">{t('quotas.errorTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('quotas.errorDescription')}</p>
              </div>
              {onRetry ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start sm:self-center"
                  onClick={onRetry}
                >
                  {t('common:retry')}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
                {items.map((item) => (
                  <QuotaRow key={item.key} item={item} />
                ))}
              </div>

              {exceededItems.length > 0 ? (
                <div className="space-y-2" role="alert">
                  {exceededItems.map((item) => (
                    <p
                      key={item.key}
                      className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {item.exceededMessage}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function getQuotaNotificationEventKey(
  scope: string | null,
  item: QuotaItem,
  severity: 'warning' | 'exceeded',
) {
  return `${scope ?? 'anonymous'}:${severity}:${item.key}:${item.notificationKey}`;
}

function clearQuotaNotificationEvents(
  scope: string | null,
  key: QuotaKey,
  severity: 'warning' | 'exceeded',
) {
  const prefix = `${scope ?? 'anonymous'}:${severity}:${key}:`;

  for (const eventKey of notifiedQuotaEvents) {
    if (eventKey.startsWith(prefix)) {
      notifiedQuotaEvents.delete(eventKey);
    }
  }
}

function QuotaRow({ item }: { readonly item: QuotaItem }) {
  const progressTone = item.isAtRisk ? 'bg-destructive' : 'bg-primary';

  return (
    <div
      className={cn(
        'w-full rounded-lg border border-border/45 bg-background/60 p-3.5 sm:p-4 lg:w-auto',
        item.isExceeded && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <div className="grid grid-cols-[auto_minmax(5rem,1fr)_auto] items-center gap-4 sm:grid-cols-[auto_14rem_auto]">
        <p
          className={cn(
            'font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground/90',
            item.isExceeded && 'text-destructive',
          )}
        >
          {item.label}
        </p>

        <Progress
          aria-label={`${item.label} ${item.value}`}
          className="h-2 w-full bg-muted/80 sm:w-56"
          indicatorClassName={progressTone}
          value={item.percent}
        />

        <p
          className={cn(
            'shrink-0 font-mono text-sm font-semibold text-foreground sm:text-right',
            item.isExceeded && 'text-destructive',
          )}
        >
          {item.value}
        </p>
      </div>
    </div>
  );
}

function QuotaRowsSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
      {['ai', 'execution', 'rooms'].map((item) => (
        <div
          key={item}
          data-testid="quota-row-skeleton"
          className="w-full rounded-lg border border-border/45 bg-background/60 p-4 lg:w-auto"
        >
          <div className="grid grid-cols-[auto_minmax(5rem,1fr)_auto] items-center gap-4 sm:grid-cols-[auto_14rem_auto]">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2 w-full rounded-full sm:w-56" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function buildQuotaItems(
  quotas: UserQuotasResponse | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): QuotaItem[] {
  return [
    buildDailyQuotaItem({
      key: 'ai',
      label: t('quotas.ai'),
      quota: quotas?.ai,
      warningMessage: t('quotas.warning.ai'),
      exceededMessage: t('quotas.exceeded.ai'),
    }),
    buildDailyQuotaItem({
      key: 'execution',
      label: t('quotas.execution'),
      quota: quotas?.execution,
      warningMessage: t('quotas.warning.execution'),
      exceededMessage: t('quotas.exceeded.execution'),
    }),
    buildRoomsQuotaItem({
      label: t('quotas.rooms'),
      quota: quotas?.rooms,
      warningMessage: t('quotas.warning.rooms'),
      exceededMessage: t('quotas.exceeded.rooms'),
    }),
  ];
}

function buildDailyQuotaItem({
  key,
  label,
  quota,
  warningMessage,
  exceededMessage,
}: {
  readonly key: Extract<QuotaKey, 'ai' | 'execution'>;
  readonly label: string;
  readonly quota: UserQuotasResponse[Extract<QuotaKey, 'ai' | 'execution'>] | undefined;
  readonly warningMessage: string;
  readonly exceededMessage: string;
}): QuotaItem {
  const current = quota?.used ?? 0;
  const limit = quota?.limit ?? 0;
  const percent = getUsagePercent(current, limit);

  return {
    key,
    label,
    value: quota ? `${current} / ${limit}` : '--',
    percent,
    isAtRisk: percent >= WARNING_THRESHOLD,
    isExceeded: isQuotaExceeded(current, limit),
    notificationKey: `${current}/${limit}/${quota?.resetsAt ?? ''}`,
    warningMessage,
    exceededMessage,
  };
}

function buildRoomsQuotaItem({
  label,
  quota,
  warningMessage,
  exceededMessage,
}: {
  readonly label: string;
  readonly quota: UserQuotasResponse['rooms'] | undefined;
  readonly warningMessage: string;
  readonly exceededMessage: string;
}): QuotaItem {
  const current = quota?.activeCount ?? 0;
  const limit = quota?.maxActive ?? 0;
  const percent = getUsagePercent(current, limit);

  return {
    key: 'rooms',
    label,
    value: quota ? `${current} / ${limit}` : '--',
    percent,
    isAtRisk: percent >= WARNING_THRESHOLD,
    isExceeded: isQuotaExceeded(current, limit),
    notificationKey: `${current}/${limit}`,
    warningMessage,
    exceededMessage,
  };
}

function getUsagePercent(current: number, limit: number) {
  if (limit <= 0) {
    return 100;
  }

  return Math.min(Math.max((current / limit) * 100, 0), 100);
}

function isQuotaExceeded(current: number, limit: number) {
  if (limit <= 0) {
    return true;
  }

  return current >= limit;
}
