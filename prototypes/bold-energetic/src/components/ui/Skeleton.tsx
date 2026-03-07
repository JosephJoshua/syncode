interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-[var(--bg-subtle)] rounded-lg ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, var(--bg-raised) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}
