import { Card } from '../ui/Card.tsx';
import { Skeleton } from '../ui/Skeleton.tsx';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`stat-${i}`}>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-4 w-24" />
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      <Card>
        <Skeleton className="h-48 w-full" />
      </Card>

      {/* Session card skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={`session-${i}`}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
