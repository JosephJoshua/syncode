import { Card, CardContent } from '@syncode/ui';
import { Skeleton } from '@/components/ui/skeleton.js';

export function ReportPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full max-w-80" />
        <Skeleton className="h-5 w-56" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <Card className="overflow-hidden border border-border/50 bg-black/85 py-0">
          <CardContent className="grid gap-8 px-5 py-6 md:grid-cols-[170px_minmax(0,1fr)] sm:px-6">
            <div className="flex justify-center md:justify-start">
              <Skeleton className="size-[150px] rounded-full" />
            </div>

            <div className="space-y-5">
              {['one', 'two', 'three', 'four'].map((key) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="space-y-4 px-5 py-6 sm:px-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-[320px] w-full rounded-xl" />
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="space-y-4 px-5 py-6 sm:px-6">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="grid gap-4 pt-2 md:grid-cols-2">
              {['a', 'b', 'c', 'd'].map((key) => (
                <div
                  key={key}
                  className="space-y-3 rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50"
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
