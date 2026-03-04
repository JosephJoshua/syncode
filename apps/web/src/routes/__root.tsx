import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { Code2 } from 'lucide-react';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <Code2 className="h-5 w-5" />
            SynCode
          </Link>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
