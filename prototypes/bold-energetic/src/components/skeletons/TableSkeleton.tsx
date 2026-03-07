import { Skeleton } from '../ui/Skeleton.tsx';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex gap-4 pb-2 border-b border-[var(--border-default)]">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 flex-1" />
        ))}
      </div>

      {/* Body rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={`cell-${colIdx}`}
              className={`h-4 flex-1 ${colIdx % 2 === 0 ? 'max-w-[80%]' : 'max-w-[60%]'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
