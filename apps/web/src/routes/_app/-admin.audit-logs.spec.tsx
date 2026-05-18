import { type AdminAuditLogsResponse, type AuditLog, CONTROL_API } from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api-client.js', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client.js')>('@/lib/api-client.js');
  return {
    ...actual,
    api: vi.fn(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', resolvedLanguage: 'en' },
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.count !== undefined) return `${key}:${String(options.count)}`;
      if (options?.date !== undefined) return `${key}:${String(options.date)}`;
      return key;
    },
  }),
}));

let authUser: { id: string; role: 'admin' | 'user' } | null = { id: 'admin-1', role: 'admin' };

vi.mock('@/stores/auth.store.js', () => ({
  useAuthStore: (
    selector: (state: { user: { id: string; role: 'admin' | 'user' } | null }) => unknown,
  ) => selector({ user: authUser }),
}));

import { api } from '@/lib/api-client.js';
import { AdminAuditLogsPage } from './admin.audit-logs.js';

const apiMock = vi.mocked(api);

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    actorId: '22222222-2222-4222-8222-222222222222',
    actor: {
      id: '22222222-2222-4222-8222-222222222222',
      username: 'admin',
      email: 'admin@example.com',
      displayName: 'Admin User',
    },
    action: 'auth.login',
    targetType: 'user',
    targetId: '22222222-2222-4222-8222-222222222222',
    metadata: { method: 'password' },
    ipAddress: '203.0.113.10',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeResponse(logs: AuditLog[], hasMore = false): AdminAuditLogsResponse {
  return {
    data: logs,
    pagination: { hasMore, nextCursor: hasMore ? 'next-cursor' : null },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <AdminAuditLogsPage />
      </QueryClientProvider>,
    ),
  };
}

describe('AdminAuditLogsPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    authUser = { id: 'admin-1', role: 'admin' };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN a non-admin user WHEN rendering THEN shows forbidden state and does not query logs', () => {
    authUser = { id: 'user-1', role: 'user' };

    renderPage();

    expect(screen.getByText('audit.forbidden.title')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('GIVEN search changes WHEN the next query is pending THEN stale logs are hidden', async () => {
    let resolveNext: (value: AdminAuditLogsResponse) => void = () => undefined;
    apiMock
      .mockResolvedValueOnce(makeResponse([makeLog({ action: 'auth.login' })]))
      .mockImplementationOnce(
        () =>
          new Promise<AdminAuditLogsResponse>((resolve) => {
            resolveNext = resolve;
          }) as never,
      );

    renderPage();

    expect(await screen.findByText('auth.login')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('audit.filters.searchLabel'), 'ban');

    expect(screen.queryByText('auth.login')).not.toBeInTheDocument();
    expect(screen.getAllByText('loading')).not.toHaveLength(0);

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2), { timeout: 3_000 });

    await act(async () => {
      resolveNext(makeResponse([makeLog({ action: 'admin.user.ban' })]));
    });

    expect(await screen.findByText('admin.user.ban')).toBeInTheDocument();
  });

  it('GIVEN filters and pagination change WHEN querying THEN sends search, action, date, limit, and cursor params', async () => {
    apiMock.mockResolvedValue(makeResponse([makeLog()], true));
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('auth.login')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ADMIN.AUDIT_LOGS, {
        searchParams: {
          action: undefined,
          cursor: undefined,
          from: undefined,
          limit: 20,
          search: undefined,
          to: undefined,
        },
      });
    });

    await user.type(screen.getByLabelText('audit.filters.searchLabel'), 'admin');
    await user.type(screen.getByLabelText('audit.filters.actionLabel'), 'auth.login');
    fireEvent.change(screen.getByLabelText('audit.filters.fromLabel'), {
      target: { value: '2026-01-02' },
    });

    await waitFor(() => {
      const hasFilteredCall = apiMock.mock.calls.some(
        ([route, options]) =>
          route === CONTROL_API.ADMIN.AUDIT_LOGS &&
          options?.searchParams?.search === 'admin' &&
          options.searchParams.action === 'auth.login' &&
          typeof options.searchParams.from === 'string',
      );
      expect(hasFilteredCall).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'audit.pagination.next' }));

    await waitFor(() => {
      const hasCursorCall = apiMock.mock.calls.some(
        ([route, options]) =>
          route === CONTROL_API.ADMIN.AUDIT_LOGS && options?.searchParams?.cursor === 'next-cursor',
      );
      expect(hasCursorCall).toBe(true);
    });
  });

  it('GIVEN an audit row WHEN details are toggled THEN metadata is expanded with aria state', async () => {
    apiMock.mockResolvedValue(makeResponse([makeLog({ metadata: { reason: 'policy' } })]));
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('auth.login')).toBeInTheDocument();
    const detailsButton = screen.getByRole('button', { name: 'audit.actions.expand' });

    await user.click(detailsButton);

    expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/policy/)).toBeInTheDocument();
  });

  it('GIVEN rows are visible WHEN refresh fails THEN shows the load error instead of silently keeping stale data', async () => {
    apiMock
      .mockResolvedValueOnce(makeResponse([makeLog({ action: 'auth.login' })]))
      .mockRejectedValueOnce(new Error('failed'));
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('auth.login')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'audit.actions.refresh' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('audit.feedback.loadError');
    expect(screen.getByText('auth.login')).toBeInTheDocument();
  });

  it('GIVEN initial load fails WHEN no rows are cached THEN shows an error alert instead of empty results', async () => {
    apiMock.mockRejectedValue(new Error('failed'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('audit.feedback.loadErrorTitle');
    expect(screen.getByRole('alert')).toHaveTextContent('audit.feedback.loadError');
    expect(screen.queryByText('audit.empty.title')).not.toBeInTheDocument();
  });

  it('GIVEN the page renders THEN admin navigation and pagination use accessible localized labels', async () => {
    apiMock.mockResolvedValue(makeResponse([makeLog()], true));

    renderPage();

    expect(await screen.findByText('auth.login')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'navLinks.users' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
    expect(
      screen.getByRole('navigation', { name: 'audit.pagination.ariaLabel' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'audit.pagination.previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'audit.pagination.next' })).toBeInTheDocument();
  });
});
