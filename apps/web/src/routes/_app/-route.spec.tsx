import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let authUser: { role: 'admin' | 'user' } | null = { role: 'admin' };
let pathname = '/admin/users';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  Link: forwardRef<HTMLAnchorElement, { children: React.ReactNode; to: string }>(
    ({ children, to, ...props }, ref) => (
      <a ref={ref} href={to} {...props}>
        {children}
      </a>
    ),
  ),
  Outlet: () => <div data-testid="outlet" />,
  useRouterState: () => ({
    pathname,
    isSessionFeedbackPage: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: (namespace: string) => ({ t: (key: string) => `${namespace}:${key}` }),
}));

vi.mock('@/components/language-switcher.js', () => ({
  LanguageSwitcher: () => <button type="button">language</button>,
}));

vi.mock('@/components/syncode-logo.js', () => ({
  SynCodeLogo: () => <svg aria-hidden="true" />,
}));

vi.mock('@/components/user-menu.js', () => ({
  UserMenu: () => <button type="button">user</button>,
}));

vi.mock('@/lib/auth.js', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/stores/auth.store.js', () => ({
  useAuthStore: (selector: (state: { user: { role: 'admin' | 'user' } | null }) => unknown) =>
    selector({ user: authUser }),
}));

import { AppLayout } from './route.js';

describe('AppLayout admin nav', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    authUser = { role: 'admin' };
    pathname = '/admin/users';
    scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  it('GIVEN admin user WHEN rendering primary nav THEN admin link is visible and active item is scrolled into view', () => {
    render(<AppLayout />);

    expect(screen.getByRole('link', { name: 'admin:nav' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('navigation', { name: 'common:nav.primaryAria' })).toHaveClass(
      'overflow-x-auto',
    );
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('GIVEN regular user WHEN rendering primary nav THEN admin link is hidden', () => {
    authUser = { role: 'user' };

    render(<AppLayout />);

    expect(screen.queryByRole('link', { name: 'admin:nav' })).not.toBeInTheDocument();
  });
});
