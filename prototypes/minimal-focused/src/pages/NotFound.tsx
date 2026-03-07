import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none dot-grid-lg" style={{ opacity: 0.1 }} />

      {/* Subtle accent glow behind 404 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--accent-muted) 0%, transparent 70%)',
          opacity: 0.4,
        }}
      />

      <div className="relative z-[1] flex flex-col items-center text-center px-6">
        <span className="font-mono text-8xl font-bold text-[var(--text-tertiary)] opacity-20 select-none">
          404
        </span>
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] mt-4">
          Page not found
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/dashboard"
          className="font-mono text-sm text-[var(--accent)] hover:underline mt-6 transition-colors"
        >
          // go_home
        </Link>
      </div>
    </div>
  );
}
