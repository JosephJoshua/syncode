import { Button } from '@syncode/ui';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher.js';
import { SynCodeLogo } from '@/components/syncode-logo.js';
import { UserMenu } from '@/components/user-menu.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});

function PublicLayout() {
  const { t } = useTranslation('common');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  let actions: ReactNode;

  if (isAuthenticated) {
    actions = (
      <>
        <LanguageSwitcher />
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">{t('nav.dashboard')}</Link>
        </Button>
        <UserMenu />
      </>
    );
  } else if (pathname === '/login') {
    actions = (
      <>
        <LanguageSwitcher />
        <Button asChild size="sm">
          <Link to="/register">{t('auth.register')}</Link>
        </Button>
      </>
    );
  } else if (pathname === '/register') {
    actions = (
      <>
        <LanguageSwitcher />
        <Button asChild variant="outline" size="sm">
          <Link to="/login">{t('auth.logIn')}</Link>
        </Button>
      </>
    );
  } else {
    actions = (
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
          </div>
          <div className="flex items-center gap-3 text-sm">{actions}</div>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}
