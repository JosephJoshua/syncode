import { Link, Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left — gradient branding panel (desktop only) */}
      <div className="hidden md:flex gradient-brand relative overflow-hidden items-center justify-center">
        {/* Floating blobs */}
        <div
          className="absolute top-[15%] left-[10%] w-72 h-72 rounded-full bg-white/10"
          style={{ animation: 'float 6s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[20%] right-[8%] w-96 h-96 rounded-full bg-white/10"
          style={{ animation: 'float 6s ease-in-out infinite 2s' }}
        />
        <div
          className="absolute top-[45%] right-[30%] w-48 h-48 rounded-full bg-white/5"
          style={{ animation: 'float 6s ease-in-out infinite 4s' }}
        />

        <div className="relative z-10 text-center px-8">
          <h1 className="font-display text-2xl font-bold text-white">SynCode</h1>
          <p className="text-white/80 text-lg mt-2">Practice coding interviews together</p>
        </div>
      </div>

      {/* Right — form content */}
      <div className="flex items-center justify-center bg-[var(--bg-card)] px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--primary)] transition-colors mb-4 inline-block"
          >
            &larr; Back to home
          </Link>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
