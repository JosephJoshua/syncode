import {
  CONTROL_API,
  type ProblemDetail,
  type ProblemSummary,
  type ProblemsListResponse,
} from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/lazy-monaco-editor.js', () => ({
  LazyMonacoEditor: ({
    value,
    onChange,
    options,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    options?: { ariaLabel?: string };
  }) => (
    <textarea
      aria-label={options?.ariaLabel}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
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
    i18n: { language: 'en', resolvedLanguage: 'en' },
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

async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'problemEditor.management.newProblem' }),
  );
  await screen.findByRole('dialog', { name: 'problemEditor.editorDialog.createTitle' });
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
}

function mockProblemList(data = [problemSummary()]): ProblemsListResponse {
  return {
    data,
    pagination: { hasMore: false, nextCursor: null },
  };
}

function problemSummary(): ProblemSummary {
  return {
    id: 'problem-1',
    title: 'Two Sum',
    difficulty: 'medium',
    isPublished: false,
    tags: [],
    company: 'syncode',
    acceptanceRate: null,
    isBookmarked: false,
    attemptStatus: null,
    testCaseCount: 2,
    hiddenTestCaseCount: 1,
    totalSubmissions: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function problemDetail(overrides: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    ...problemSummary(),
    description: 'Find a pair.',
    constraints: 'n >= 2',
    examples: [{ input: '1 2', output: '3', explanation: 'sum' }],
    testCases: [
      {
        input: '1 2',
        expectedOutput: '3',
        description: 'sample',
        isHidden: false,
        timeoutMs: 1200,
        memoryMb: 128,
      },
      {
        input: '9 9',
        expectedOutput: '18',
        description: 'hidden',
        isHidden: true,
      },
    ],
    starterCode: { typescript: 'function solve() {}' },
    timeLimit: 1500,
    memoryLimit: 256,
    totalSubmissions: 0,
    userAttempts: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AdminProblemEditorPage', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock;
    apiMock.mockReset();
    toastSuccessMock.mockReset();
    navigateMock.mockReset();
    navigateMock.mockImplementation(() => Promise.resolve());
    apiMock.mockImplementation(async (route) => {
      if (route === CONTROL_API.PROBLEMS.LIST) {
        return mockProblemList() as never;
      }
      throw new Error(`Unexpected route ${route.route}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN the management page loads WHEN no editor is open THEN authoring fields are not rendered inline', async () => {
    renderPage();

    expect(await screen.findByText('Two Sum')).toBeInTheDocument();
    expect(screen.queryByLabelText('problemEditor.fields.title')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'problemEditor.management.newProblem' }),
    ).toBeInTheDocument();
  });

  it('GIVEN valid problem fields in the create dialog WHEN saving THEN posts the create contract and navigates', async () => {
    apiMock.mockImplementation(async (route) => {
      if (route === CONTROL_API.PROBLEMS.LIST) {
        return mockProblemList([]) as never;
      }
      if (route === CONTROL_API.PROBLEMS.CREATE) {
        return problemDetail({ id: 'created-problem', title: 'Two Sum' }) as never;
      }
      throw new Error(`Unexpected route ${route.route}`);
    });
    const user = userEvent.setup();

    renderPage();
    await openCreateDialog(user);
    await fillValidProblemForm(user);
    await user.click(screen.getByRole('button', { name: 'problemEditor.actions.save' }));

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
      params: { problemId: 'created-problem' },
    });
  });

  it('GIVEN an existing problem with hidden cases WHEN editing THEN updates the problem and preserves hidden cases in the public contract', async () => {
    apiMock.mockImplementation(async (route) => {
      if (route === CONTROL_API.PROBLEMS.LIST) {
        return mockProblemList() as never;
      }
      if (route === CONTROL_API.PROBLEMS.GET_BY_ID) {
        return problemDetail() as never;
      }
      if (route === CONTROL_API.PROBLEMS.UPDATE) {
        return problemDetail({ title: 'Two Sum Updated', isPublished: false }) as never;
      }
      if (route === CONTROL_API.PROBLEMS.PUBLISH_STATUS) {
        return problemDetail({ title: 'Two Sum Updated', isPublished: true }) as never;
      }
      throw new Error(`Unexpected route ${route.route}`);
    });
    const user = userEvent.setup();

    renderPage();
    const row = (await screen.findByText('Two Sum')).closest('tr');
    expect(row).not.toBeNull();
    await user.click(
      within(row as HTMLTableRowElement).getByRole('button', {
        name: 'problemEditor.management.edit',
      }),
    );
    await screen.findByRole('dialog', {
      name: 'problemEditor.editorDialog.editTitle title=Two Sum',
    });
    expect(apiMock).toHaveBeenCalledWith(CONTROL_API.PROBLEMS.GET_BY_ID, {
      params: { id: 'problem-1' },
      searchParams: { includeHidden: true },
    });
    expect(
      screen.getByRole('combobox', { name: 'problemEditor.fields.difficulty' }),
    ).toHaveTextContent('problemEditor.difficulty.medium');
    changeField('problemEditor.fields.title', 'Two Sum Updated');
    await user.click(screen.getByRole('switch', { name: 'problemEditor.fields.published' }));
    await user.click(screen.getByRole('button', { name: 'problemEditor.actions.save' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.PROBLEMS.UPDATE, {
        params: { id: 'problem-1' },
        body: expect.objectContaining({
          title: 'Two Sum Updated',
          testCases: expect.arrayContaining([
            expect.objectContaining({ input: '9 9', expectedOutput: '18', isHidden: true }),
          ]),
        }),
      });
    });
    expect(apiMock).toHaveBeenCalledWith(CONTROL_API.PROBLEMS.PUBLISH_STATUS, {
      params: { id: 'problem-1' },
      body: { isPublished: true },
    });
  });

  it('GIVEN more problem pages WHEN paging forward THEN requests the next cursor', async () => {
    apiMock.mockImplementation(async (_route, options) => {
      if (options?.searchParams?.cursor === 'next-page') {
        return mockProblemList([
          { ...problemSummary(), id: 'problem-2', title: 'Three Sum' },
        ]) as never;
      }
      return {
        data: [problemSummary()],
        pagination: { hasMore: true, nextCursor: 'next-page' },
      } as never;
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Two Sum');
    await user.click(
      screen.getByRole('button', { name: 'problemEditor.management.pagination.next' }),
    );

    expect(await screen.findByText('Three Sum')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith(CONTROL_API.PROBLEMS.LIST, {
      searchParams: {
        cursor: 'next-page',
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeDrafts: true,
      },
    });
  });

  it('GIVEN invalid examples JSON in the dialog WHEN saving THEN validation blocks the API mutation', async () => {
    const user = userEvent.setup();

    renderPage();
    await openCreateDialog(user);
    changeField('problemEditor.fields.title', 'Two Sum');
    changeField('problemEditor.fields.description', 'Find a pair.');
    changeField('problemEditor.testCases.input', '1 2');
    changeField('problemEditor.testCases.output', '3');
    changeField('problemEditor.fields.examples', '[{"input":"1 2"}]');
    await user.click(screen.getByRole('button', { name: 'problemEditor.actions.save' }));

    expect(await screen.findByText('problemEditor.validation.examples')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalledWith(CONTROL_API.PROBLEMS.CREATE, expect.anything());
  });

  it('GIVEN problem list loading fails WHEN rendering THEN a load failure is shown instead of an empty state', async () => {
    apiMock.mockRejectedValue(new Error('network'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'problemEditor.management.loadFailed',
    );
    expect(screen.queryByText('problemEditor.management.empty')).not.toBeInTheDocument();
  });
});
