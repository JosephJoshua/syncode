import { CONTROL_API } from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        return [key, ...Object.entries(options).map(([k, v]) => `${k}=${String(v)}`)].join(' ');
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/stores/auth.store.js', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { user: { id: string; role: 'admin' } }) => unknown) =>
      selector({ user: { id: 'admin-1', role: 'admin' } }),
    {
      getState: () => ({ user: { id: 'admin-1', role: 'admin' } }),
    },
  ),
}));

import { toast } from 'sonner';
import { api } from '@/lib/api-client.js';
import { AdminProblemEditorPage } from './admin.problems.js';

const apiMock = vi.mocked(api);
const toastSuccessMock = vi.mocked(toast.success);

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <AdminProblemEditorPage />
    </QueryClientProvider>,
  );
}

function changeField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), {
    target: { value },
  });
}

async function fillValidProblemForm(user: ReturnType<typeof userEvent.setup>) {
  changeField('problemEditor.fields.title', 'Two Sum');
  changeField('problemEditor.fields.company', 'syncode');
  changeField('problemEditor.fields.description', 'Find a pair.');
  changeField('problemEditor.fields.constraints', 'n >= 2');
  changeField('problemEditor.fields.timeLimit', '1500');
  changeField('problemEditor.fields.memoryLimit', '256');
  changeField(
    'problemEditor.fields.examples',
    '[{"input":"1 2","output":"3","explanation":"sum"}]',
  );
  changeField('problemEditor.fields.starterCode', '{"typescript":"function solve() {}"}');
  changeField('problemEditor.testCases.input', '1 2');
  changeField('problemEditor.testCases.output', '3');
  changeField('problemEditor.testCases.description', 'sample');
  changeField('problemEditor.testCases.timeoutMs', '1200');
  changeField('problemEditor.testCases.memoryMb', '128');

  await user.click(screen.getByRole('switch', { name: 'problemEditor.testCases.hidden' }));
  await user.click(screen.getByRole('switch', { name: 'problemEditor.fields.published' }));
  await user.click(screen.getByRole('button', { name: 'problemEditor.actions.save' }));
}

describe('AdminProblemEditorPage', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock;
    apiMock.mockReset();
    toastSuccessMock.mockReset();
    navigateMock.mockReset();
    navigateMock.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN valid problem fields WHEN saving THEN posts the create-problem contract and navigates to the created problem', async () => {
    apiMock.mockResolvedValue({
      id: 'problem-1',
      title: 'Two Sum',
      difficulty: 'medium',
      isPublished: true,
      tags: [],
      company: 'syncode',
      acceptanceRate: null,
      isBookmarked: false,
      attemptStatus: null,
      description: 'Find a pair.',
      constraints: 'n >= 2',
      examples: [],
      testCases: [],
      starterCode: null,
      timeLimit: null,
      memoryLimit: null,
      totalSubmissions: 0,
      userAttempts: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);
    const user = userEvent.setup();

    renderPage();

    await fillValidProblemForm(user);

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.PROBLEMS.CREATE, {
        body: {
          title: 'Two Sum',
          description: 'Find a pair.',
          difficulty: 'medium',
          isPublished: true,
          company: 'syncode',
          constraints: 'n >= 2',
          examples: [{ input: '1 2', output: '3', explanation: 'sum' }],
          starterCode: { typescript: 'function solve() {}' },
          timeLimit: 1500,
          memoryLimit: 256,
          testCases: [
            {
              input: '1 2',
              expectedOutput: '3',
              description: 'sample',
              isHidden: true,
              timeoutMs: 1200,
              memoryMb: 128,
            },
          ],
        },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('problemEditor.toast.saved');
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/problems/$problemId',
      params: { problemId: 'problem-1' },
    });
  }, 10_000);

  it('GIVEN missing required fields WHEN saving THEN shows validation errors and does not call the API', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: 'problemEditor.actions.save' }));

    expect(await screen.findByText('problemEditor.validation.title')).toBeInTheDocument();
    expect(screen.getByText('problemEditor.validation.description')).toBeInTheDocument();
    expect(screen.getByText('problemEditor.validation.testCases')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('GIVEN starter code has an unsupported language key WHEN saving THEN shows validation error', async () => {
    const user = userEvent.setup();

    renderPage();

    changeField('problemEditor.fields.title', 'Two Sum');
    changeField('problemEditor.fields.description', 'Find a pair.');
    changeField('problemEditor.testCases.input', '1 2');
    changeField('problemEditor.testCases.output', '3');
    changeField('problemEditor.fields.starterCode', '{"js":"function solve() {}"}');
    await user.click(screen.getByRole('button', { name: 'problemEditor.actions.save' }));

    expect(await screen.findByText('problemEditor.validation.starterCode')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('GIVEN examples JSON omits required output WHEN saving THEN shows validation error', async () => {
    const user = userEvent.setup();

    renderPage();

    changeField('problemEditor.fields.title', 'Two Sum');
    changeField('problemEditor.fields.description', 'Find a pair.');
    changeField('problemEditor.testCases.input', '1 2');
    changeField('problemEditor.testCases.output', '3');
    changeField('problemEditor.fields.examples', '[{"input":"1 2"}]');
    await user.click(screen.getByRole('button', { name: 'problemEditor.actions.save' }));

    expect(await screen.findByText('problemEditor.validation.examples')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });
});
