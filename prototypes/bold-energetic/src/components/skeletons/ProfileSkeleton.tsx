import { Card } from '../ui/Card.tsx';
import { Skeleton } from '../ui/Skeleton.tsx';

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header: avatar + text */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`stat-${i}`}>
            <Skeleton className="h-6 w-12 mb-2" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>

      {/* Settings cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={`setting-${i}`}>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
