import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Table skeleton */}
      <Card>
        {/* Header row */}
        <div className="flex gap-4 pb-3 border-b border-[var(--border-default)]">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/6" />
          <Skeleton className="h-3 w-1/5" />
          <Skeleton className="h-3 w-1/6" />
          <Skeleton className="h-3 w-1/8" />
        </div>
        {/* Body rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 py-3 border-b border-[var(--border-default)] last:border-0"
          >
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/8" />
          </div>
        ))}
      </Card>
    </div>
  );
}
