import type { UserQuotasResponse } from '@syncode/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { Skeleton } from '@/components/ui/skeleton';

interface QuotasPanelProps {
  quotas: UserQuotasResponse | undefined;
  isLoading: boolean;
}

export function QuotasPanel({ quotas, isLoading }: QuotasPanelProps) {
  const items = [
    {
      label: 'AI',
      value: quotas?.ai ? `${quotas.ai.used} / ${quotas.ai.limit}` : '--',
      hint: quotas?.ai ? `Resets ${formatResetTime(quotas.ai.resetsAt)}` : 'Daily limit',
    },
    {
      label: 'Execution',
      value: quotas?.execution ? `${quotas.execution.used} / ${quotas.execution.limit}` : '--',
      hint: quotas?.execution
        ? `Resets ${formatResetTime(quotas.execution.resetsAt)}`
        : 'Daily limit',
    },
    {
      label: 'Rooms',
      value: quotas?.rooms ? `${quotas.rooms.activeCount} / ${quotas.rooms.maxActive}` : '--',
      hint: 'Active rooms',
    },
  ];

  return (
    <Card className="bg-card/70 py-0 ring-0 shadow-[0_24px_60px_-40px_oklch(0.22_0.02_260/0.45)]">
      <CardHeader className="border-b border-border/40 pb-5">
        <CardTitle>Usage quotas</CardTitle>
        <CardDescription>Current daily counters and active room cap.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 py-5 sm:px-6">
        {isLoading
          ? ['ai', 'execution', 'rooms'].map((item) => (
              <div key={item} className="rounded-2xl bg-background/70 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-8 w-28" />
                <Skeleton className="mt-2 h-4 w-32" />
              </div>
            ))
          : items.map((item) => (
              <div key={item.label} className="rounded-2xl bg-background/70 p-4">
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {item.value}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{item.hint}</p>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

function formatResetTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'soon';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
