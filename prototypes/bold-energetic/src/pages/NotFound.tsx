import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button.tsx';

export function NotFound() {
  return (
    <div className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      {/* Geometric pattern overlay */}
      <div className="geo-grid absolute inset-0 opacity-5 pointer-events-none" />

      <h1 className="font-display text-8xl md:text-9xl font-bold gradient-text mb-4">404</h1>

      <p className="font-display text-xl font-semibold text-[var(--text-primary)] mb-2">
        Page not found
      </p>

      <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link to="/dashboard">
        <Button variant="primary">
          <ArrowLeft size={16} className="mr-2" />
          Go Home
        </Button>
      </Link>

      <Link
        to="/"
        className="mt-4 text-sm text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors"
      >
        Go to Landing
      </Link>
    </div>
  );
}
