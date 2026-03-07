import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function EmptyState({
  icon: Icon,
  heading,
  description,
  ctaLabel,
  onCtaClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <Icon size={48} className="text-[var(--text-tertiary)]" />
      <h3 className="text-base font-medium text-[var(--text-primary)] mt-4">{heading}</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm">{description}</p>
      {ctaLabel && onCtaClick && (
        <div className="mt-4">
          <Button variant="primary" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
