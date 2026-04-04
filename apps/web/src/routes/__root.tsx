import { Button } from '@syncode/ui';
import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createRootRoute({
  component: RootLayout,
});

function SynCodeLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-left" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="logo-right" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <clipPath id="logo-weave-lower">
          <rect x="220" y="320" width="130" height="130" rx="12" />
        </clipPath>
      </defs>
      <rect width="512" height="512" rx="108" fill="#0a0a14" />
      <g transform="translate(256 256) scale(0.80) translate(-256 -256)">
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="#0a0a14"
          strokeWidth="56"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="320,56 80,232 320,408"
          fill="none"
          stroke="#0a0a14"
          strokeWidth="56"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="url(#logo-right)"
          strokeWidth="44"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="320,56 80,232 320,408"
          fill="none"
          stroke="url(#logo-left)"
          strokeWidth="44"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="#0a0a14"
          strokeWidth="56"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          clipPath="url(#logo-weave-lower)"
        />
        <polyline
          points="192,104 432,280 192,456"
          fill="none"
          stroke="url(#logo-right)"
          strokeWidth="44"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          clipPath="url(#logo-weave-lower)"
        />
      </g>
    </svg>
  );
}

function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate({ to: '/' }).catch(() => {});
  };

  let navContent: ReactNode;

  if (isAuthenticated) {
    navContent = (
      <>
        <span className="hidden text-muted-foreground sm:inline">Signed in</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut data-icon="inline-start" />
          Log out
        </Button>
      </>
    );
  } else if (pathname === '/') {
    navContent = (
      <Button asChild size="sm">
        <Link to="/login">Log in</Link>
      </Button>
    );
  } else {
    navContent = null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
          >
            <SynCodeLogo className="h-6 w-6" />
            SynCode
          </Link>
          <div className="flex items-center gap-3 text-sm">{navContent}</div>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
