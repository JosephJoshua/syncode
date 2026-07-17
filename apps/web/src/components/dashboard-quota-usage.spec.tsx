import type { UserQuotasResponse } from '@syncode/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DashboardQuotaUsage,
  resetDashboardQuotaUsageNotificationsForTest,
} from './dashboard-quota-usage.js';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const toastErrorMock = vi.mocked(toast.error);
const toastWarningMock = vi.mocked(toast.warning);

function makeQuotas(overrides: Partial<UserQuotasResponse> = {}): UserQuotasResponse {
  return {
    ai: {
      used: 2,
      limit: 10,
      resetsAt: '2026-01-02T00:00:00.000Z',
    },
    execution: {
      used: 3,
      limit: 10,
      resetsAt: '2026-01-02T00:00:00.000Z',
    },
    rooms: {
      activeCount: 1,
      maxActive: 5,
    },
    ...overrides,
  };
}

describe('DashboardQuotaUsage', () => {
  beforeEach(() => {
    resetDashboardQuotaUsageNotificationsForTest();
    toastErrorMock.mockClear();
    toastWarningMock.mockClear();
  });

  it('GIVEN quota usage at 80 percent WHEN rendering THEN shows bars and sends warning toast once', async () => {
    const quotas = makeQuotas({
      ai: {
        used: 8,
        limit: 10,
        resetsAt: '2026-01-02T00:00:00.000Z',
      },
    });
    const { rerender } = render(<DashboardQuotaUsage quotas={quotas} isLoading={false} />);

    expect(screen.getByRole('progressbar', { name: 'quotas.ai 8 / 10' })).toHaveAttribute(
      'aria-valuenow',
      '80',
    );
    expect(screen.getByRole('progressbar', { name: 'quotas.execution 3 / 10' })).toHaveAttribute(
      'aria-valuenow',
      '30',
    );
    expect(screen.getByRole('progressbar', { name: 'quotas.rooms 1 / 5' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledWith('quotas.warning.ai');
    });
    expect(toastWarningMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).not.toHaveBeenCalled();

    rerender(<DashboardQuotaUsage quotas={quotas} isLoading={false} />);

    expect(toastWarningMock).toHaveBeenCalledTimes(1);
  });

  it('GIVEN unchanged risky quotas WHEN remounting THEN does not replay the same toast', async () => {
    const quotas = makeQuotas({
      ai: {
        used: 8,
        limit: 10,
        resetsAt: '2026-01-02T00:00:00.000Z',
      },
    });
    const { unmount } = render(<DashboardQuotaUsage quotas={quotas} isLoading={false} />);

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledTimes(1);
    });

    unmount();
    render(<DashboardQuotaUsage quotas={quotas} isLoading={false} />);

    expect(toastWarningMock).toHaveBeenCalledTimes(1);
  });

  it('GIVEN another user has the same risky quotas WHEN rendering THEN notifies for that user too', async () => {
    const quotas = makeQuotas({
      ai: {
        used: 8,
        limit: 10,
        resetsAt: '2026-01-02T00:00:00.000Z',
      },
    });
    const { rerender } = render(
      <DashboardQuotaUsage quotas={quotas} isLoading={false} notificationScope="user-1" />,
    );

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledTimes(1);
    });

    rerender(<DashboardQuotaUsage quotas={quotas} isLoading={false} notificationScope="user-2" />);

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledTimes(2);
    });
  });

  it('GIVEN usage drops below threshold WHEN it later reaches threshold again THEN warns again', async () => {
    const atRiskQuotas = makeQuotas({
      ai: {
        used: 8,
        limit: 10,
        resetsAt: '2026-01-02T00:00:00.000Z',
      },
    });
    const resetQuotas = makeQuotas({
      ai: {
        used: 0,
        limit: 10,
        resetsAt: '2026-01-03T00:00:00.000Z',
      },
    });
    const { rerender } = render(<DashboardQuotaUsage quotas={atRiskQuotas} isLoading={false} />);

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledTimes(1);
    });

    rerender(<DashboardQuotaUsage quotas={resetQuotas} isLoading={false} />);
    rerender(<DashboardQuotaUsage quotas={atRiskQuotas} isLoading={false} />);

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledTimes(2);
    });
  });

  it('GIVEN quota usage reaches the limit WHEN rendering THEN shows exceeded alert and sends error toast', async () => {
    render(
      <DashboardQuotaUsage
        quotas={makeQuotas({
          execution: {
            used: 10,
            limit: 10,
            resetsAt: '2026-01-02T00:00:00.000Z',
          },
        })}
        isLoading={false}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'quotas.execution 10 / 10' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('quotas.exceeded.execution');

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('quotas.exceeded.execution');
    });
    expect(toastWarningMock).not.toHaveBeenCalledWith('quotas.warning.execution');
  });

  it('GIVEN usage drops below exceeded WHEN it later exceeds again THEN errors again', async () => {
    const exceededQuotas = makeQuotas({
      execution: {
        used: 10,
        limit: 10,
        resetsAt: '2026-01-02T00:00:00.000Z',
      },
    });
    const resetQuotas = makeQuotas({
      execution: {
        used: 0,
        limit: 10,
        resetsAt: '2026-01-03T00:00:00.000Z',
      },
    });
    const { rerender } = render(<DashboardQuotaUsage quotas={exceededQuotas} isLoading={false} />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });

    rerender(<DashboardQuotaUsage quotas={resetQuotas} isLoading={false} />);
    rerender(<DashboardQuotaUsage quotas={exceededQuotas} isLoading={false} />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(2);
    });
  });

  it('GIVEN usage exists with a zero limit WHEN rendering THEN treats the quota as exceeded', async () => {
    render(
      <DashboardQuotaUsage
        quotas={makeQuotas({
          rooms: {
            activeCount: 1,
            maxActive: 0,
          },
        })}
        isLoading={false}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'quotas.rooms 1 / 0' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('quotas.exceeded.rooms');

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('quotas.exceeded.rooms');
    });
    expect(toastWarningMock).not.toHaveBeenCalledWith('quotas.warning.rooms');
  });

  it('GIVEN zero usage with a zero limit WHEN rendering THEN treats the quota as exhausted', async () => {
    render(
      <DashboardQuotaUsage
        quotas={makeQuotas({
          ai: {
            used: 0,
            limit: 0,
            resetsAt: '2026-01-02T00:00:00.000Z',
          },
        })}
        isLoading={false}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'quotas.ai 0 / 0' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('quotas.exceeded.ai');

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('quotas.exceeded.ai');
    });
    expect(toastWarningMock).not.toHaveBeenCalledWith('quotas.warning.ai');
  });

  it('GIVEN quota fetch fails WHEN rendering THEN shows retry action', () => {
    const onRetry = vi.fn();

    render(<DashboardQuotaUsage quotas={undefined} isLoading={false} isError onRetry={onRetry} />);

    expect(screen.getByText('quotas.errorTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common:retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('GIVEN stale quota data with a query error WHEN rendering THEN does not toast stale limits', () => {
    render(
      <DashboardQuotaUsage
        quotas={makeQuotas({
          ai: {
            used: 8,
            limit: 10,
            resetsAt: '2026-01-02T00:00:00.000Z',
          },
          execution: {
            used: 10,
            limit: 10,
            resetsAt: '2026-01-02T00:00:00.000Z',
          },
        })}
        isLoading={false}
        isError
      />,
    );

    expect(screen.getByText('quotas.errorTitle')).toBeInTheDocument();
    expect(toastWarningMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('GIVEN stale quota data during background fetch WHEN rendering THEN does not toast stale limits', () => {
    render(
      <DashboardQuotaUsage
        quotas={makeQuotas({
          ai: {
            used: 8,
            limit: 10,
            resetsAt: '2026-01-02T00:00:00.000Z',
          },
          execution: {
            used: 10,
            limit: 10,
            resetsAt: '2026-01-02T00:00:00.000Z',
          },
        })}
        isLoading={false}
        isFetching
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'quotas.ai 8 / 10' })).toBeInTheDocument();
    expect(toastWarningMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
