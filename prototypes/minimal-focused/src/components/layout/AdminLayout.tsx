import { ArrowLeft } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/problems', label: 'Problems' },
  { to: '/admin/system', label: 'System' },
];

export function AdminLayout() {
  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-raised)] p-3 dot-grid flex flex-col">
        {/* Admin header */}
        <div className="mb-3 px-3 py-2">
          <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
            // admin
          </p>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {adminLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-100 ${
                  isActive
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Back to app link */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors mt-auto"
        >
          <ArrowLeft size={12} />
          Back to App
        </Link>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
