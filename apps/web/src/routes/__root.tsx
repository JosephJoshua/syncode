import { CONTROL_API } from '@syncode/contracts';
import { Avatar, AvatarFallback, Button, cn } from '@syncode/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { LogOut, User, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { api, readApiError } from '@/lib/api-client';
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
  const { t } = useTranslation('common');
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
  const wasAuthenticated = useRef(isAuthenticated);
  const accountInitial = getUserInitial(user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      queryClient.clear();
      navigate({ to: '/login' }).catch(() => {});
    }

    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, navigate, queryClient]);

  const isDashboardPage = pathname === '/dashboard';
  const isRoomsPage = pathname.startsWith('/rooms');
  const isProblemsPage = pathname.startsWith('/problems');
  const isBookmarksPage = pathname === '/bookmarks';
  const isProfilePage = pathname === '/profile';
  const showDashboardChrome =
    isDashboardPage ||
    isRoomsPage ||
    isProblemsPage ||
    isBookmarksPage ||
    isSessionFeedbackPage ||
    isProfilePage;

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await api(CONTROL_API.AUTH.LOGOUT);
      } catch (error) {
        const apiError = await readApiError(error);

        if (apiError?.statusCode === 401) {
          return;
        }

        throw error;
      }
    },
    onSuccess: () => {
      toast.success(t('toast.signedOut'));
    },
    onError: () => {
      toast.error(t('toast.signOutFailed'));
    },
    onSettled: () => {
      logout();
      queryClient.clear();
      navigate({ to: '/' }).catch(() => {});
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync().catch(() => {});
  };

  let navContent: ReactNode;

  if (showDashboardChrome) {
    navContent = (
      <nav aria-label="Primary" className="flex items-center gap-0.5 sm:gap-1">
        {[
          {
            label: t('nav.dashboard'),
            to: '/dashboard',
            isActive: isDashboardPage || isSessionFeedbackPage,
          },
          { label: t('nav.rooms'), to: '/rooms', isActive: isRoomsPage },
          {
            label: t('nav.problems'),
            to: '/problems',
            isActive: isProblemsPage,
          },
          {
            label: t('nav.bookmarks'),
            to: '/bookmarks',
            isActive: isBookmarksPage,
          },
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
      <>
        <LanguageSwitcher />
        <Button asChild size="sm">
          <Link to="/register">{t('auth.register')}</Link>
        </Button>
      </>
    );
  } else if (pathname === '/register') {
    navContent = (
      <>
        <LanguageSwitcher />
        <Button asChild variant="outline" size="sm">
          <Link to="/login">{t('auth.logIn')}</Link>
        </Button>
      </>
    );
  } else {
    navContent = (
      <>
        <LanguageSwitcher />
        <Button asChild variant="outline" size="sm">
          <Link to="/login">{t('auth.logIn')}</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/register">{t('auth.register')}</Link>
        </Button>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        {showDashboardChrome ? (
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4">
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
            <div className="flex shrink-0 items-center gap-1">
              <LanguageSwitcher />
              {isAuthenticated ? (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card/85 text-sm font-semibold text-foreground ring-1 ring-foreground/5 transition-all hover:border-primary/30 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <Avatar className="size-9 border-none bg-transparent text-foreground shadow-none ring-0">
                        <AvatarFallback className="text-foreground">
                          {accountInitial ?? <User className="size-4 text-primary" />}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="z-50 min-w-36 rounded-xl border border-border/60 bg-popover p-1 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                    >
                      <DropdownMenu.Item asChild>
                        <Link
                          to="/profile"
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-muted"
                        >
                          <UserRound className="size-3.5" />
                          {t('auth.profile')}
                        </Link>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => {
                          void handleLogout();
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-destructive/10"
                        disabled={logoutMutation.isPending}
                      >
                        <LogOut className="size-3.5" />
                        {logoutMutation.isPending ? t('auth.loggingOut') : t('auth.logOut')}
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
