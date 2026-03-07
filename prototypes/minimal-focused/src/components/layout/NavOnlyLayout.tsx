import { Outlet } from 'react-router';
import { TopNav } from './TopNav';

export function NavOnlyLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <TopNav />
      <div className="pt-12">
        <Outlet />
      </div>
    </div>
  );
}
