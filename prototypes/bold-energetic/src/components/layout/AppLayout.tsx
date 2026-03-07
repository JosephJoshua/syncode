import { Link, Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { NavBar } from './NavBar.tsx';

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          },
        }}
      />
      <NavBar />

      <main className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-4 pb-8 flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border-default)] py-6 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-tertiary)]">
          <p>&copy; {new Date().getFullYear()} SynCode. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/dev" className="hover:text-[var(--text-secondary)] transition-colors">
              Dev Gallery
            </Link>
            <Link to="/admin" className="hover:text-[var(--text-secondary)] transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
