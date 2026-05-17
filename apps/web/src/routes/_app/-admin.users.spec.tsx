import { type AdminUser, type AdminUsersResponse, CONTROL_API } from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', resolvedLanguage: 'en' },
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count === undefined ? key : `${key}:${String(options.count)}`,
  }),
}));

let authUser: { id: string; role: 'admin' | 'user' } | null = { id: 'admin-1', role: 'admin' };

vi.mock('@/stores/auth.store.js', () => ({
  useAuthStore: (
    selector: (state: { user: { id: string; role: 'admin' | 'user' } | null }) => unknown,
  ) => selector({ user: authUser }),
}));

import { api } from '@/lib/api-client.js';
import { AdminUsersPage } from './admin.users.js';

const apiMock = vi.mocked(api);

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    username: 'alice',
    displayName: null,
    role: 'user',
    avatarUrl: null,
    bannedAt: null,
    bannedReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeResponse(users: AdminUser[], hasMore = false): AdminUsersResponse {
  return {
    data: users,
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
        <AdminUsersPage />
      </QueryClientProvider>,
    ),
  };
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    authUser = { id: 'admin-1', role: 'admin' };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN search changes WHEN the next query is pending THEN stale users from the previous filter are hidden', async () => {
    let resolveNext: (value: AdminUsersResponse) => void = () => undefined;
    apiMock
      .mockResolvedValueOnce(makeResponse([makeUser({ email: 'alice@example.com' })]))
      .mockImplementationOnce(
        () =>
          new Promise<AdminUsersResponse>((resolve) => {
            resolveNext = resolve;
          }) as never,
      );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('users.search.label'), 'b');

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/alice@example.com/)).not.toBeInTheDocument();
    expect(screen.getAllByText('loading')).not.toHaveLength(0);

    await act(async () => {
      resolveNext(makeResponse([makeUser({ id: 'user-2', email: 'bob@example.com' })]));
    });

    expect(await screen.findByText(/bob@example.com/)).toBeInTheDocument();
  });

  it('GIVEN the page renders THEN status and pagination controls have localized accessible names', async () => {
    apiMock.mockResolvedValue(makeResponse([makeUser()], true));

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'users.status.label' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'users.pagination.ariaLabel' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'users.pagination.previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'users.pagination.next' })).toBeInTheDocument();
  });

  it('GIVEN a non-admin user WHEN rendering THEN shows forbidden state and does not query users', () => {
    authUser = { id: 'user-1', role: 'user' };

    renderPage();

    expect(screen.getByText('users.forbidden.title')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('GIVEN filters and pagination change WHEN querying THEN sends status, search, limit, and cursor params', async () => {
    apiMock.mockResolvedValue(makeResponse([makeUser()], true));
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ADMIN.USERS.LIST, {
        searchParams: {
          cursor: undefined,
          limit: 20,
          search: undefined,
          status: undefined,
        },
      });
    });

    await user.type(screen.getByLabelText('users.search.label'), 'bob');
    await user.click(screen.getByRole('combobox', { name: 'users.status.label' }));
    await user.click(await screen.findByRole('option', { name: 'users.status.banned' }));

    await waitFor(() => {
      const hasFilteredCall = apiMock.mock.calls.some(
        ([route, options]) =>
          route === CONTROL_API.ADMIN.USERS.LIST &&
          options?.searchParams?.search === 'bob' &&
          options.searchParams.status === 'banned',
      );
      expect(hasFilteredCall).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'users.pagination.next' }));

    await waitFor(() => {
      const hasCursorCall = apiMock.mock.calls.some(
        ([route, options]) =>
          route === CONTROL_API.ADMIN.USERS.LIST && options?.searchParams?.cursor === 'next-cursor',
      );
      expect(hasCursorCall).toBe(true);
    });
  });

  it('GIVEN admin confirms ban WHEN mutation succeeds THEN sends ban reason and closes dialog', async () => {
    apiMock.mockImplementation((route) => {
      if (route === CONTROL_API.ADMIN.USERS.BAN) {
        return Promise.resolve(makeUser({ bannedAt: '2026-01-02T00:00:00.000Z' }) as never);
      }

      return Promise.resolve(makeResponse([makeUser()]) as never);
    });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'users.actions.ban' }));
    await user.type(screen.getByLabelText('users.banDialog.reasonLabel'), 'policy violation');
    await user.click(screen.getByRole('button', { name: 'users.banDialog.confirm' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ADMIN.USERS.BAN, {
        params: { id: 'user-1' },
        body: { reason: 'policy violation' },
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('GIVEN ban fails WHEN mutation rejects THEN keeps the dialog open with the typed reason', async () => {
    apiMock.mockImplementation((route) => {
      if (route === CONTROL_API.ADMIN.USERS.BAN) {
        return Promise.reject(new Error('failed'));
      }

      return Promise.resolve(makeResponse([makeUser()]) as never);
    });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'users.actions.ban' }));
    const reasonInput = screen.getByLabelText('users.banDialog.reasonLabel');
    await user.type(reasonInput, 'needs review');
    await user.click(screen.getByRole('button', { name: 'users.banDialog.confirm' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ADMIN.USERS.BAN, {
        params: { id: 'user-1' },
        body: { reason: 'needs review' },
      });
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('needs review')).toBeInTheDocument();
  });

  it('GIVEN ban is pending WHEN escape is pressed THEN keeps the dialog open', async () => {
    let resolveBan: (value: AdminUser) => void = () => undefined;
    apiMock.mockImplementation((route) => {
      if (route === CONTROL_API.ADMIN.USERS.BAN) {
        return new Promise<AdminUser>((resolve) => {
          resolveBan = resolve;
        }) as never;
      }

      return Promise.resolve(makeResponse([makeUser()]) as never);
    });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'users.actions.ban' }));
    await user.type(screen.getByLabelText('users.banDialog.reasonLabel'), 'still pending');
    await user.click(screen.getByRole('button', { name: 'users.banDialog.confirm' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('still pending')).toBeInTheDocument();

    await act(async () => {
      resolveBan(makeUser({ bannedAt: '2026-01-02T00:00:00.000Z' }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('GIVEN ban succeeds while users refetch is pending THEN keeps row actions disabled', async () => {
    let listCalls = 0;
    let resolveRefetch: (value: AdminUsersResponse) => void = () => undefined;
    apiMock.mockImplementation((route) => {
      if (route === CONTROL_API.ADMIN.USERS.BAN) {
        return Promise.resolve(makeUser({ bannedAt: '2026-01-02T00:00:00.000Z' }) as never);
      }

      listCalls += 1;
      if (listCalls === 1) {
        return Promise.resolve(makeResponse([makeUser()]) as never);
      }

      return new Promise<AdminUsersResponse>((resolve) => {
        resolveRefetch = resolve;
      }) as never;
    });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'users.actions.ban' }));
    await user.click(screen.getByRole('button', { name: 'users.banDialog.confirm' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'users.actions.ban' })).toBeDisabled();

    await act(async () => {
      resolveRefetch(makeResponse([makeUser({ bannedAt: '2026-01-02T00:00:00.000Z' })]));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'users.actions.unban' })).toBeEnabled();
    });
  });

  it('GIVEN a banned user WHEN unbanning THEN sends the unban mutation', async () => {
    apiMock.mockImplementation((route) => {
      if (route === CONTROL_API.ADMIN.USERS.UNBAN) {
        return Promise.resolve(makeUser() as never);
      }

      return Promise.resolve(
        makeResponse([
          makeUser({
            bannedAt: '2026-01-02T00:00:00.000Z',
            bannedReason: 'policy',
          }),
        ]) as never,
      );
    });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/alice@example.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'users.actions.unban' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ADMIN.USERS.UNBAN, {
        params: { id: 'user-1' },
      });
    });
  });
});
