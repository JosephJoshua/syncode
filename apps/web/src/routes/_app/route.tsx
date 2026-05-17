import { cn } from '@syncode/ui';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher.js';
import { SynCodeLogo } from '@/components/syncode-logo.js';
import { UserMenu } from '@/components/user-menu.js';
import { requireAuth } from '@/lib/auth.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app')({
  beforeLoad: requireAuth,
  component: AppLayout,
});

export function AppLayout() {
  const { t } = useTranslation('common');
  const { t: tAdmin } = useTranslation('admin');
  const user = useAuthStore((state) => state.user);
  const activeNavItemRef = useRef<HTMLAnchorElement | null>(null);

  const { pathname, isSessionFeedbackPage } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      isSessionFeedbackPage: state.matches.some(
        (match) => match.routeId === '/_app/sessions/$sessionId',
      ),
    }),
  });

  const isDashboardPage = pathname === '/dashboard';
  const isRoomsPage = pathname.startsWith('/rooms');
  const isProblemsPage = pathname.startsWith('/problems');
  const isBookmarksPage = pathname === '/bookmarks';
  const isAdminPage = pathname.startsWith('/admin');

  useEffect(() => {
    activeNavItemRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  return (
    <>
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
            >
              <SynCodeLogo className="h-6 w-6" />
              <span className="truncate">SynCode</span>
            </Link>
            <nav
              aria-label={t('nav.primaryAria')}
              className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
            >
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
                ...(user?.role === 'admin'
                  ? [
                      {
                        label: tAdmin('nav'),
                        to: '/admin/users',
                        isActive: isAdminPage,
                      },
                    ]
                  : []),
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  ref={item.isActive ? activeNavItemRef : undefined}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                    item.isActive
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </>
  );
}
