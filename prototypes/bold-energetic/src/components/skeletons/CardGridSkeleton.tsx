import { Card } from '../ui/Card.tsx';
import { Skeleton } from '../ui/Skeleton.tsx';

interface CardGridSkeletonProps {
  count?: number;
}

export function CardGridSkeleton({ count = 6 }: CardGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={`card-${i}`}>
          <Skeleton className="h-4 w-3/4 mb-3" />
          <Skeleton className="h-3 w-1/2 mb-4" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </Card>
      ))}
    </div>
  );
}
