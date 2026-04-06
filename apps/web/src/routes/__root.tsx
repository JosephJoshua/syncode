import { Button, cn } from '@syncode/ui';
import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { LogOut, User } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { getUserInitial } from '@/lib/user-utils';
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
  const { pathname, isSessionFeedbackPage } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      isSessionFeedbackPage: state.matches.some(
        (match) => match.routeId === '/sessions/$sessionId/feedback',
      ),
    }),
  });
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const accountInitial = getUserInitial(user);
  const isDashboardPage = pathname === '/dashboard';
  const isRoomsPage = pathname === '/rooms';
  const isProblemsPage = pathname.startsWith('/problems');
  const showDashboardChrome =
    isDashboardPage || isRoomsPage || isProblemsPage || isSessionFeedbackPage;

  const handleLogout = () => {
    logout();
    navigate({ to: '/' }).catch(() => {});
  };

  let navContent: ReactNode;

  if (showDashboardChrome) {
    navContent = (
      <nav aria-label="Primary" className="flex items-center gap-0.5 sm:gap-1">
        {[
          {
            label: 'Dashboard',
            to: '/dashboard',
            isActive: isDashboardPage || isSessionFeedbackPage,
          },
          { label: 'Rooms', to: '/rooms', isActive: isRoomsPage },
          { label: 'Problems', to: '/problems', isActive: isProblemsPage },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
              item.isActive
                ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  } else if (pathname === '/login') {
    navContent = (
      <Button asChild size="sm">
        <Link to="/register">Register</Link>
      </Button>
    );
  } else if (pathname === '/register') {
    navContent = (
      <Button asChild variant="outline" size="sm">
        <Link to="/login">Log in</Link>
      </Button>
    );
  } else {
    navContent = (
      <>
        <Button asChild variant="outline" size="sm">
          <Link to="/login">Log in</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/register">Register</Link>
        </Button>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        {showDashboardChrome ? (
          <div className="relative h-14">
            <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                <Link
                  to="/"
                  className="flex shrink-0 items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
                >
                  <SynCodeLogo className="h-6 w-6" />
                  <span className="truncate">SynCode</span>
                </Link>
                {navContent}
              </div>
            </div>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 sm:right-6">
              {isAuthenticated ? (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card/85 text-sm font-semibold text-foreground ring-1 ring-foreground/5 transition-all hover:border-primary/30 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {accountInitial ? (
                        <span>{accountInitial}</span>
                      ) : (
                        <User className="size-4 text-primary" />
                      )}
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="z-50 min-w-36 rounded-xl border border-border/60 bg-popover p-1 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                    >
                      <DropdownMenu.Item
                        onSelect={handleLogout}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none transition-colors data-[highlighted]:bg-destructive/10"
                      >
                        <LogOut className="size-3.5" />
                        Log out
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card/85 text-sm font-semibold text-foreground ring-1 ring-foreground/5"
                >
                  <User className="size-4 text-primary" />
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <Link
                to="/"
                className="flex shrink-0 items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
              >
                <SynCodeLogo className="h-6 w-6" />
                <span className="truncate">SynCode</span>
              </Link>
            </div>
            <div className="flex items-center gap-3 text-sm">{navContent}</div>
          </div>
        )}
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
