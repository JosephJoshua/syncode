import { CONTROL_API } from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HTTPError } from 'ky';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { toast } from 'sonner';
import { api } from '@/lib/api-client.js';
import { MatchmakingPage } from './matchmaking.js';

type BrowseResponse = {
  data: Array<{
    roomId: string;
    name: string | null;
    status: 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';
    mode: 'peer' | 'ai';
    hostId: string;
    hostName: string;
    hostAvatarUrl: string | null;
    language: 'python' | 'javascript' | 'typescript' | 'java' | 'cpp' | 'c' | 'go' | 'rust' | null;
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

function makePaginatedResponse(
  data: BrowseResponse['data'],
  nextCursor: string | null,
): BrowseResponse {
  return { data, pagination: { nextCursor, hasMore: nextCursor !== null } };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MatchmakingPage />
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

describe('MatchmakingPage', () => {
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

  it('GIVEN a matching public room WHEN the user starts matchmaking THEN it joins without forcing a role and navigates to the room', async () => {
    apiMock.mockImplementation((route) => {
      const typedRoute = route as { route?: string };
      if (typedRoute.route === CONTROL_API.ROOMS.JOIN.route) {
        return Promise.resolve({ ok: true } as never);
      }
      return Promise.resolve(makeResponse([makeRoom({ roomId: 'room-match' })]) as never);
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.BROWSE_PUBLIC, {
        searchParams: {
          limit: 5,
          cursor: undefined,
          language: 'python',
          difficulty: 'medium',
          status: 'waiting',
        },
      });
    });
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.JOIN, {
        params: { id: 'room-match' },
        body: {},
      });
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/rooms/$roomId',
        params: { roomId: 'room-match' },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('matchmaking.toastMatched');
  });

  it('GIVEN the first page is already joined or fails to join WHEN a later page has a candidate THEN it advances and joins that candidate', async () => {
    apiMock.mockImplementation((route, options) => {
      const typedRoute = route as { route?: string };
      if (typedRoute.route !== CONTROL_API.ROOMS.JOIN.route) {
        const cursor = (options as { searchParams?: { cursor?: string } }).searchParams?.cursor;
        return Promise.resolve(
          cursor === 'page-2'
            ? makeResponse([makeRoom({ roomId: 'room-next' })])
            : makePaginatedResponse(
                [
                  makeRoom({ roomId: 'room-own', isParticipant: true }),
                  makeRoom({ roomId: 'room-stale' }),
                ],
                'page-2',
              ),
        ) as never;
      }

      const roomId = (options as { params: { id: string } }).params.id;
      if (roomId === 'room-stale') {
        return Promise.reject(
          makeHttpError(409, { statusCode: 409, message: 'full', code: 'ROOM_FULL' }),
        );
      }
      return Promise.resolve({ ok: true } as never);
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.JOIN, {
        params: { id: 'room-stale' },
        body: {},
      });
    });
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.JOIN, {
        params: { id: 'room-next' },
        body: {},
      });
    });
    expect(apiMock).not.toHaveBeenCalledWith(
      CONTROL_API.ROOMS.JOIN,
      expect.objectContaining({ params: { id: 'room-own' } }),
    );
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/rooms/$roomId',
        params: { roomId: 'room-next' },
      });
    });
    expect(toastErrorMock).toHaveBeenCalledWith('lobby.roomFull');
  });

  it('GIVEN search is pending WHEN the user leaves the queue THEN late search results do not join or navigate', async () => {
    let resolveSearch: ((response: BrowseResponse) => void) | null = null;
    const completeSearch = () => {
      if (!resolveSearch) {
        throw new Error('search request was not started');
      }
      resolveSearch(makeResponse([makeRoom({ roomId: 'room-late' })]));
    };
    apiMock.mockImplementation((route) => {
      const typedRoute = route as { route?: string };
      if (typedRoute.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return new Promise((resolve) => {
          resolveSearch = (response) => resolve(response as never);
        }) as never;
      }
      return Promise.resolve({ ok: true } as never);
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        CONTROL_API.ROOMS.BROWSE_PUBLIC,
        expect.objectContaining({ searchParams: expect.any(Object) }),
      );
    });

    await user.click(screen.getByRole('button', { name: /matchmaking\.cancel/i }));
    completeSearch();

    await waitFor(() => {
      expect(screen.getByText('matchmaking.status.idle')).toBeInTheDocument();
    });
    expect(apiMock).not.toHaveBeenCalledWith(
      CONTROL_API.ROOMS.JOIN,
      expect.objectContaining({ params: { id: 'room-late' } }),
    );
    expect(navigateMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
