import { Link, Outlet } from 'react-router';
import { TopNav } from './TopNav';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col">
      <TopNav />
      <main className="mx-auto max-w-7xl w-full px-4 md:px-6 pt-16 py-8 flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border-default)] py-4 mt-auto">
        <div className="mx-auto max-w-7xl px-4 md:px-6 flex items-center justify-between">
          <span className="font-mono text-xs text-[var(--text-tertiary)]">&copy; 2026 SynCode</span>
          <div className="flex items-center gap-4">
            <Link
              to="/dev"
              className="font-mono text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
            >
              dev_gallery
            </Link>
            <Link
              to="/admin"
              className="font-mono text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
            >
              admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
