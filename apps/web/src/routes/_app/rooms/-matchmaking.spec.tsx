import { CONTROL_API } from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const apiMock = vi.mocked(api);
const toastSuccessMock = vi.mocked(toast.success);
const toastErrorMock = vi.mocked(toast.error);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MatchmakingPage />
    </QueryClientProvider>,
  );
}

function mockProblemsList() {
  return {
    data: [
      {
        id: '550e8400-e29b-41d4-a716-446655440100',
        title: 'Two Sum',
        difficulty: 'easy' as const,
        isPublished: true,
        tags: [],
        company: null,
        acceptanceRate: null,
        isBookmarked: false,
        attemptStatus: null,
      },
    ],
    pagination: { nextCursor: null, hasMore: false },
  };
}

function mockProblemTags() {
  return {
    data: [
      {
        slug: 'array',
        name: 'Array',
        count: 1,
      },
    ],
  };
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

  it('GIVEN compatible waiting room exists WHEN user starts matchmaking THEN joins room before entering queue', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [
            {
              roomId: '550e8400-e29b-41d4-a716-446655440002',
              name: 'Two Sum Practice',
              status: 'waiting',
              mode: 'peer',
              hostId: '550e8400-e29b-41d4-a716-446655440003',
              hostName: 'host-user',
              hostAvatarUrl: null,
              language: 'python',
              problemTitle: 'Two Sum',
              problemDifficulty: 'medium',
              participantCount: 1,
              isParticipant: false,
              maxParticipants: 2,
              createdAt: '2026-05-18T10:00:00.000Z',
            },
          ],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.ROOMS.JOIN.route) {
        return Promise.resolve({
          roomId: '550e8400-e29b-41d4-a716-446655440002',
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.JOIN, {
        params: { id: '550e8400-e29b-41d4-a716-446655440002' },
        body: {},
      });
    });

    expect(
      apiMock.mock.calls.some(
        ([route]) => route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route,
      ),
    ).toBe(false);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/rooms/$roomId',
        params: { roomId: '550e8400-e29b-41d4-a716-446655440002' },
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('browse.joinSuccess');
  });

  it('GIVEN role filter is selected WHEN joining compatible waiting room THEN join request includes requestedRole', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [
            {
              roomId: '550e8400-e29b-41d4-a716-446655440202',
              name: 'Two Sum Practice',
              status: 'waiting',
              mode: 'peer',
              hostId: '550e8400-e29b-41d4-a716-446655440203',
              hostName: 'host-user',
              hostAvatarUrl: null,
              language: 'python',
              problemTitle: 'Two Sum',
              problemDifficulty: 'medium',
              participantCount: 1,
              isParticipant: false,
              maxParticipants: 2,
              createdAt: '2026-05-18T10:00:00.000Z',
            },
          ],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.ROOMS.JOIN.route) {
        return Promise.resolve({
          roomId: '550e8400-e29b-41d4-a716-446655440202',
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'matchmaking.roleLabel' }));
    await user.click(screen.getByRole('button', { name: 'role.candidate' }));
    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.JOIN, {
        params: { id: '550e8400-e29b-41d4-a716-446655440202' },
        body: { requestedRole: 'candidate' },
      });
    });

    expect(
      apiMock.mock.calls.some(
        ([route]) => route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route,
      ),
    ).toBe(false);
  });

  it('GIVEN non-waiting public room exists WHEN user starts matchmaking THEN joins as observer', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [
            {
              roomId: '550e8400-e29b-41d4-a716-446655440212',
              name: 'Live coding room',
              status: 'coding',
              mode: 'peer',
              hostId: '550e8400-e29b-41d4-a716-446655440213',
              hostName: 'host-user',
              hostAvatarUrl: null,
              language: 'python',
              problemTitle: 'Two Sum',
              problemDifficulty: 'medium',
              participantCount: 2,
              isParticipant: false,
              maxParticipants: 5,
              createdAt: '2026-05-18T10:00:00.000Z',
            },
          ],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.ROOMS.JOIN.route) {
        return Promise.resolve({
          roomId: '550e8400-e29b-41d4-a716-446655440212',
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'matchmaking.roleLabel' }));
    await user.click(screen.getByRole('button', { name: 'role.candidate' }));
    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.JOIN, {
        params: { id: '550e8400-e29b-41d4-a716-446655440212' },
        body: { requestedRole: 'observer' },
      });
    });

    expect(
      apiMock.mock.calls.some(
        ([route]) => route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route,
      ),
    ).toBe(false);
  });

  it('GIVEN queue status poll fails WHEN user is searching THEN shows idle without leaving queue', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route === CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS) {
        return Promise.reject(new Error('network'));
      }
      if (route === CONTROL_API.MATCHMAKING.ENTER_QUEUE) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440214',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(
      () => {
        expect(toastErrorMock).toHaveBeenCalledWith('matchmaking.searchFailed');
      },
      { timeout: 5_000 },
    );
    expect(
      apiMock.mock.calls.some(([route]) => route === CONTROL_API.MATCHMAKING.LEAVE_QUEUE),
    ).toBe(false);
    expect(screen.getByText('matchmaking.status.idle')).toBeInTheDocument();
  });

  it('GIVEN searching status WHEN user cancels queue THEN calls leave endpoint and returns idle status', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440011',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440011',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.LEAVE_QUEUE.route) {
        return Promise.resolve({ status: 'idle' });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));
    await waitFor(() => {
      expect(screen.getByText('matchmaking.status.searching')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /matchmaking\.cancel/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.MATCHMAKING.LEAVE_QUEUE);
    });
    await waitFor(() => {
      expect(screen.getByText('matchmaking.status.idle')).toBeInTheDocument();
    });
  });

  it('GIVEN room preflight is pending WHEN start is clicked twice THEN only one search starts', async () => {
    let resolveBrowse:
      | ((value: { data: []; pagination: { nextCursor: null; hasMore: false } }) => void)
      | undefined;
    const browsePromise = new Promise<{
      data: [];
      pagination: { nextCursor: null; hasMore: false };
    }>((resolve) => {
      resolveBrowse = resolve;
    });

    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return browsePromise;
      }
      if (route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440042',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440042',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    const startButton = screen.getByRole('button', { name: /matchmaking\.start/i });
    await user.click(startButton);
    await user.click(startButton);
    if (!resolveBrowse) {
      throw new Error('expected browse resolver');
    }
    resolveBrowse({ data: [], pagination: { nextCursor: null, hasMore: false } });

    await waitFor(() => {
      expect(
        apiMock.mock.calls.filter(
          ([route]) => route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route,
        ),
      ).toHaveLength(1);
    });
  });

  it('GIVEN searching status WHEN user leaves matchmaking page THEN queue is canceled automatically', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440031',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440031',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.LEAVE_QUEUE.route) {
        return Promise.resolve({ status: 'idle' });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    const view = renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));
    await waitFor(() => {
      expect(screen.getByText('matchmaking.status.searching')).toBeInTheDocument();
    });

    view.unmount();

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.MATCHMAKING.LEAVE_QUEUE);
    });
  });

  it('GIVEN only empty waiting room exists WHEN user starts matchmaking THEN skips room join and enters queue', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [
            {
              roomId: '550e8400-e29b-41d4-a716-446655440102',
              name: 'Empty stale room',
              status: 'waiting',
              mode: 'peer',
              hostId: '550e8400-e29b-41d4-a716-446655440103',
              hostName: 'host-user',
              hostAvatarUrl: null,
              language: 'python',
              problemTitle: 'Two Sum',
              problemDifficulty: 'easy',
              participantCount: 0,
              isParticipant: false,
              maxParticipants: 2,
              createdAt: '2026-05-18T10:00:00.000Z',
            },
          ],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440104',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440104',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: [],
            roles: [],
          },
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.MATCHMAKING.ENTER_QUEUE, {
        body: {
          languages: ['python'],
          difficulties: ['medium'],
          problemIds: [],
          topics: [],
          roles: [],
        },
      });
    });

    expect(apiMock.mock.calls.some(([route]) => route.route === CONTROL_API.ROOMS.JOIN.route)).toBe(
      false,
    );
    expect(navigateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: '/rooms/$roomId' }),
    );
  });

  it('GIVEN user enables problem filter and selects one WHEN entering queue THEN payload includes selected problem IDs', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440021',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['easy'],
            problemIds: ['550e8400-e29b-41d4-a716-446655440100'],
            topics: [],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440021',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['easy'],
            problemIds: ['550e8400-e29b-41d4-a716-446655440100'],
            topics: [],
            roles: [],
          },
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'matchmaking.difficulty.medium' }));
    await user.click(screen.getByRole('button', { name: 'matchmaking.difficulty.easy' }));
    await user.click(screen.getByRole('button', { name: /matchmaking\.anyProblem/i }));
    await user.click(screen.getByText(/Two Sum · matchmaking\.difficulty\.easy/i));
    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.MATCHMAKING.ENTER_QUEUE, {
        body: {
          languages: ['python'],
          difficulties: ['easy'],
          problemIds: ['550e8400-e29b-41d4-a716-446655440100'],
          topics: [],
          roles: [],
        },
      });
    });
  });

  it('GIVEN topic is selected WHEN entering queue THEN payload includes selected topic slugs', async () => {
    apiMock.mockImplementation((route) => {
      if (route.route === CONTROL_API.PROBLEMS.TAGS.route) {
        return Promise.resolve(mockProblemTags());
      }
      if (route.route === CONTROL_API.PROBLEMS.LIST.route) {
        return Promise.resolve(mockProblemsList());
      }
      if (route.route === CONTROL_API.ROOMS.BROWSE_PUBLIC.route) {
        return Promise.resolve({
          data: [],
          pagination: { nextCursor: null, hasMore: false },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.ENTER_QUEUE.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440025',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: ['array'],
            roles: [],
          },
        });
      }
      if (route.route === CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS.route) {
        return Promise.resolve({
          status: 'searching',
          requestId: '550e8400-e29b-41d4-a716-446655440025',
          queuePosition: 1,
          expiresAt: '2026-05-18T12:00:00.000Z',
          preferences: {
            languages: ['python'],
            difficulties: ['medium'],
            problemIds: [],
            topics: ['array'],
            roles: [],
          },
        });
      }
      throw new Error(`Unexpected route: ${route.route}`);
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /matchmaking\.anyTopic/i }));
    await user.click(screen.getByText(/Array \(1\)/i));
    await user.click(screen.getByRole('button', { name: /matchmaking\.start/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.MATCHMAKING.ENTER_QUEUE, {
        body: {
          languages: ['python'],
          difficulties: ['medium'],
          problemIds: [],
          topics: ['array'],
          roles: [],
        },
      });
    });
  });
});
