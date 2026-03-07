interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`bg-[var(--bg-subtle)] rounded animate-pulse ${className}`} />;
}
