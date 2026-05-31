import { Button } from '@syncode/ui';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher.js';
import { UserMenu } from '@/components/user-menu.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { MarketingNav } from './-components/marketing-nav';
import { MarketingShell } from './-components/marketing-shell';

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
        <Link
          to="/register"
          className="inline-flex items-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
        >
          <span className="btn-text-holder">
            <span className="btn-text-main">{t('auth.register')}</span>
            <span className="btn-text-hover" aria-hidden="true">
              {t('auth.register')}
            </span>
          </span>
        </Link>
      </>
    );
  } else if (pathname === '/register') {
    actions = (
      <>
        <LanguageSwitcher />
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/login">{t('auth.logIn')}</Link>
        </Button>
      </>
    );
  } else {
    actions = (
      <>
        <LanguageSwitcher />
        <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex">
          <Link to="/login">{t('auth.logIn')}</Link>
        </Button>
        <Link
          to="/register"
          className="inline-flex items-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
        >
          <span className="btn-text-holder">
            <span className="btn-text-main">{t('auth.register')}</span>
            <span className="btn-text-hover" aria-hidden="true">
              {t('auth.register')}
            </span>
          </span>
        </Link>
      </>
    );
  }

  return (
    <MarketingShell>
      <MarketingNav actions={actions} />
      <main>
        <Outlet />
      </main>
    </MarketingShell>
  );
}
