import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileCode,
  LayoutDashboard,
  Server,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/problems', label: 'Problems', icon: FileCode, end: false },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, end: false },
  { to: '/admin/system', label: 'System', icon: Server, end: false },
] as const;

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-14rem)]">
      {/* Sidebar */}
      <aside
        className="bg-[var(--bg-card)] border-r border-[var(--border-default)] flex flex-col shrink-0"
        style={{
          width: collapsed ? 64 : 240,
          transition: 'width 200ms ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border-default)]">
          {!collapsed && (
            <span className="font-display text-sm font-bold text-[var(--text-primary)]">Admin</span>
          )}
          <span className="gradient-brand text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
            {collapsed ? 'A' : 'Panel'}
          </span>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center h-10 mx-2 mt-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 mt-2 px-2 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--primary-muted)] text-[var(--primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
                ].join(' ')
              }
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Back to app */}
        <div className="px-2 pb-3 border-t border-[var(--border-default)] pt-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={20} className="shrink-0" />
            {!collapsed && <span>Back to App</span>}
          </Link>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--gradient-surface)' }}>
        <Outlet />
      </div>
    </div>
  );
}
