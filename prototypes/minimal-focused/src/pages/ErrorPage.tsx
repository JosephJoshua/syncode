import { AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface ErrorPageProps {
  onRetry?: () => void;
}

export function ErrorPage({ onRetry }: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none dot-grid-lg" style={{ opacity: 0.1 }} />

      {/* Subtle accent glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--accent-muted) 0%, transparent 70%)',
          opacity: 0.4,
        }}
      />

      <div className="relative z-[1] flex flex-col items-center text-center px-6">
        <AlertTriangle size={48} className="text-[var(--error)]" />
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] mt-4">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-sm">
          An unexpected error occurred. Please try again.
        </p>
        {onRetry && (
          <div className="mt-6">
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
