import type { LucideIcon } from 'lucide-react';
import { Button } from './Button.tsx';

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
    <div className="flex flex-col items-center text-center py-12">
      <Icon size={48} className="text-[var(--text-tertiary)] mb-4" />
      <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">{heading}</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xs">{description}</p>
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
