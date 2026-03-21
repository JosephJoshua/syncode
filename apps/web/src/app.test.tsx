import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app';
import { api, readApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
  readApiError: vi.fn(),
}));

const mockedApi = vi.mocked(api);
const mockedReadApiError = vi.mocked(readApiError);

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
    mockedApi.mockReset();
    mockedReadApiError.mockReset();
    mockedReadApiError.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the navigation with SynCode branding', async () => {
    render(<App />);
    expect(await screen.findByText('SynCode')).toBeInTheDocument();
  });

  it('shows a friendly error message for invalid credentials', async () => {
    const user = userEvent.setup();
    mockedApi.mockRejectedValue(new Error('Unauthorized'));
    mockedReadApiError.mockResolvedValue({
      statusCode: 401,
      message: 'Invalid credentials',
      timestamp: '2026-03-21T09:00:00.000Z',
    });
    window.history.pushState({}, '', '/login');

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'incorrect-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid username, email, or password. Please try again.',
    );
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it('submits username and password when the user signs in with a username', async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    window.history.pushState({}, '', '/login');

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'code_partner');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(mockedApi).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'auth/login',
        method: 'POST',
      }),
      {
        body: {
          username: 'code_partner',
          password: 'correct-password',
        },
      },
    );
  });

  it('stores auth tokens and redirects to the dashboard after a successful login', async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    window.history.pushState({}, '', '/login');

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    expect(useAuthStore.getState().accessToken).toBe('access-token');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-token');
    expect(localStorage.getItem('syncode-auth')).toContain('access-token');
    expect(window.location.pathname).toBe('/dashboard');
  });
});
