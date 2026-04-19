import { CONTROL_API } from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HTTPError } from 'ky';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// cmdk (used by the Command/Popover filter dropdown) relies on ResizeObserver, which jsdom lacks.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver =
    ResizeObserverPolyfill;
}

vi.mock('@/lib/api-client.js', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client.js')>('@/lib/api-client.js');
  return {
    ...actual,
    api: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const navigateMock = vi.fn(() => Promise.resolve());

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    Link: ({ children, to: _to, ...rest }: { children: React.ReactNode; to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && typeof options === 'object') {
        const parts = [key];
        for (const [k, v] of Object.entries(options)) {
          if (k === 'count') continue;
          parts.push(`${k}=${String(v)}`);
        }
        return parts.join(' ');
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/stores/auth.store.js', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { isAuthenticated: boolean }) => unknown) =>
      selector({ isAuthenticated: true }),
    {
      getState: () => ({ isAuthenticated: true }),
    },
  ),
}));

import { toast } from 'sonner';
import { api } from '@/lib/api-client.js';
// Import AFTER mocks are set up.
import { BrowseRoomsPage } from './browse.js';

type BrowseResponse = {
  data: Array<{
    roomId: string;
    name: string | null;
    status: 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';
    mode: 'peer';
    hostId: string;
    hostName: string;
    hostAvatarUrl: string | null;
    language: 'python' | 'javascript' | null;
    problemTitle: string | null;
    problemDifficulty: 'easy' | 'medium' | 'hard' | null;
    participantCount: number;
    isParticipant: boolean;
    maxParticipants: number;
    createdAt: string;
  }>;
  pagination: { nextCursor: string | null; hasMore: boolean };
};

const apiMock = vi.mocked(api);
const toastSuccessMock = vi.mocked(toast.success);
const toastErrorMock = vi.mocked(toast.error);

function makeRoom(
  overrides: Partial<BrowseResponse['data'][number]> = {},
): BrowseResponse['data'][number] {
  return {
    roomId: 'room-1',
    name: 'Arrays warmup',
    status: 'waiting',
    mode: 'peer',
    hostId: 'user-1',
    hostName: 'alice',
    hostAvatarUrl: null,
    language: 'python',
    problemTitle: 'Two Sum',
    problemDifficulty: 'easy',
    participantCount: 1,
    isParticipant: false,
    maxParticipants: 2,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeResponse(data: BrowseResponse['data']): BrowseResponse {
  return { data, pagination: { nextCursor: null, hasMore: false } };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <BrowseRoomsPage />
      </QueryClientProvider>,
    ),
  };
}

function makeHttpError(status: number, body: unknown) {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
  return new HTTPError(response, new Request('http://example'), {} as never);
}

describe('BrowseRoomsPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    navigateMock.mockReset();
    navigateMock.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN the API returns 2 rooms WHEN the page renders THEN 2 room cards are visible with the right problem titles', async () => {
    apiMock.mockResolvedValue(
      makeResponse([
        makeRoom({ roomId: 'room-1', problemTitle: 'Two Sum' }),
        makeRoom({ roomId: 'room-2', problemTitle: 'Valid Parentheses' }),
      ]),
    );

    renderPage();

    expect(await screen.findByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Valid Parentheses')).toBeInTheDocument();
  });

  it('GIVEN the API returns 0 rooms THEN the empty-state copy is shown', async () => {
    apiMock.mockResolvedValue(makeResponse([]));

    renderPage();

    expect(await screen.findByText('browse.emptyState.title')).toBeInTheDocument();
    expect(screen.getByText('browse.emptyState.subtitle')).toBeInTheDocument();
  });

  it('GIVEN the user changes the language filter THEN the query refetches with ?language=python', async () => {
    apiMock.mockResolvedValue(makeResponse([makeRoom()]));
    const user = userEvent.setup();

    renderPage();

    await screen.findByText('Two Sum');

    await user.click(screen.getByRole('combobox', { name: /browse\.filters\.language/i }));
    const option = await screen.findByRole('option', { name: /^Python$/ });
    await user.click(option);

    await waitFor(() => {
      const calledWithLanguage = apiMock.mock.calls.some((call) => {
        const [route, opts] = call as [
          { route?: string },
          { searchParams?: Record<string, unknown> }?,
        ];
        return (
          route?.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route &&
          opts?.searchParams?.language === 'python'
        );
      });
      expect(calledWithLanguage).toBe(true);
    });
  });

  it('GIVEN the user clicks Join on a card THEN POST /rooms/:id/join fires with an empty body AND navigates to /rooms/:roomId on success', async () => {
    apiMock.mockImplementation((route) => {
      const typedRoute = route as { route?: string };
      if (typedRoute.route === CONTROL_API.ROOMS.JOIN.route) {
        return Promise.resolve({ ok: true } as never);
      }
      return Promise.resolve(makeResponse([makeRoom({ roomId: 'room-42' })]) as never);
    });
    const user = userEvent.setup();

    renderPage();

    const joinButton = await screen.findByRole('button', { name: /browse\.card\.join/i });
    await user.click(joinButton);

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.JOIN, {
        params: { id: 'room-42' },
        body: {},
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/rooms/$roomId',
        params: { roomId: 'room-42' },
      });
    });
  });

  it('GIVEN the join API returns 403 THEN error toast appears', async () => {
    apiMock.mockImplementation((route) => {
      const typedRoute = route as { route?: string };
      if (typedRoute.route === CONTROL_API.ROOMS.JOIN.route) {
        return Promise.reject(makeHttpError(403, { statusCode: 403, message: 'forbidden' }));
      }
      return Promise.resolve(makeResponse([makeRoom({ roomId: 'room-forbidden' })]) as never);
    });
    const user = userEvent.setup();

    renderPage();

    const joinButton = await screen.findByRole('button', { name: /browse\.card\.join/i });
    await user.click(joinButton);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
    expect(navigateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: '/rooms/$roomId' }),
    );
  });

  it('GIVEN the user types in the search box THEN after debounce the query refetches with search=<value>', async () => {
    apiMock.mockResolvedValue(makeResponse([makeRoom()]));
    const user = userEvent.setup();

    renderPage();

    await screen.findByText('Two Sum');

    const input = screen.getByPlaceholderText('browse.filters.search') as HTMLInputElement;
    await act(async () => {
      await user.type(input, 'two sum');
    });

    await waitFor(() => {
      const searchedForValue = apiMock.mock.calls.some((call) => {
        const [route, opts] = call as [
          { route?: string },
          { searchParams?: Record<string, unknown> }?,
        ];
        return (
          route?.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route &&
          opts?.searchParams?.search === 'two sum'
        );
      });
      expect(searchedForValue).toBe(true);
    });
  });

  it('GIVEN a room WHERE isParticipant is true THEN the card shows Enter and an already-joined indicator', async () => {
    apiMock.mockResolvedValue(
      makeResponse([
        makeRoom({
          roomId: 'room-mine',
          problemTitle: 'Joined Problem',
          isParticipant: true,
          participantCount: 2,
          maxParticipants: 4,
        }),
      ]),
    );

    renderPage();

    await screen.findByText('Joined Problem');

    expect(screen.getByText('browse.card.alreadyJoined')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse\.card\.enter/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /browse\.card\.join/i })).not.toBeInTheDocument();
  });
});
