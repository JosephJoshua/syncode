import { Skeleton } from '../ui/Skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

const columnWidths = ['w-1/4', 'w-1/6', 'w-1/5', 'w-1/4', 'w-1/8'];

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  const widths = columnWidths.slice(0, columns);

  return (
    <div>
      {/* Header row */}
      <div className="flex gap-4 pb-3 border-b border-[var(--border-default)]">
        {widths.map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w}`} />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 py-3 border-b border-[var(--border-default)] last:border-0"
        >
          {widths.map((w, j) => (
            <Skeleton key={j} className={`h-4 ${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
