import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app';
import { LoginApiError, loginUser } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/lib/auth-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-api')>('@/lib/auth-api');

  return {
    ...actual,
    loginUser: vi.fn(),
  };
});

const mockedLoginUser = vi.mocked(loginUser);

describe('Login page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/login');
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
    mockedLoginUser.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('GIVEN the login page loads WHEN the form renders THEN identifier and password fields are visible', async () => {
    render(<App />);

    expect(await screen.findByLabelText('Email or username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('GIVEN invalid login inputs WHEN the form is submitted THEN client-side validation feedback is shown', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter your email address or username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(mockedLoginUser).not.toHaveBeenCalled();
  });

  it('GIVEN a username login WHEN authentication succeeds THEN POST auth login is called with identifier and password and the user is redirected to the dashboard', async () => {
    const user = userEvent.setup();
    const locationAssignSpy = vi.fn();

    vi.stubGlobal('location', {
      ...window.location,
      assign: locationAssignSpy,
    });

    mockedLoginUser.mockResolvedValue({
      accessToken: 'access-token',
      user: {
        id: 'user_123',
        email: 'user@example.com',
        username: 'code_partner',
        displayName: null,
        role: 'user',
        avatarUrl: null,
        bio: null,
        stats: {},
        createdAt: '2026-03-21T12:00:00.000Z',
        updatedAt: '2026-03-21T12:00:00.000Z',
      },
    });

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'code_partner');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(mockedLoginUser).toHaveBeenCalledWith({
        identifier: 'code_partner',
        password: 'Password123',
      });
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    expect(useAuthStore.getState().accessToken).toBe('access-token');
    expect(useAuthStore.getState().user?.username).toBe('code_partner');
    expect(window.localStorage.getItem('syncode-auth')).toContain('access-token');
    expect(locationAssignSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('GIVEN an email login WHEN authentication succeeds THEN POST auth login is called with identifier and password', async () => {
    const user = userEvent.setup();
    const locationAssignSpy = vi.fn();

    vi.stubGlobal('location', {
      ...window.location,
      assign: locationAssignSpy,
    });

    mockedLoginUser.mockResolvedValue({
      accessToken: 'access-token',
    });

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(mockedLoginUser).toHaveBeenCalledWith({
        identifier: 'user@example.com',
        password: 'Password123',
      });
    });

    expect(locationAssignSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('GIVEN invalid credentials WHEN authentication fails with unauthorized THEN the invalid credentials message is shown', async () => {
    const user = userEvent.setup();

    mockedLoginUser.mockRejectedValue(
      new LoginApiError('Invalid credentials', {
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        timestamp: '2026-03-21T12:00:00.000Z',
      }),
    );

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid username, email, or password. Please try again.',
    );
  });

  it('GIVEN a banned user WHEN authentication fails with forbidden THEN the banned account message is shown', async () => {
    const user = userEvent.setup();

    mockedLoginUser.mockRejectedValue(
      new LoginApiError('User banned', {
        statusCode: 403,
        code: 'USER_BANNED',
        message: 'User banned',
        timestamp: '2026-03-21T12:00:00.000Z',
      }),
    );

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account has been suspended. Please contact support.',
    );
  });

  it('GIVEN server-side validation errors WHEN authentication fails with bad request THEN field-specific validation feedback is shown', async () => {
    const user = userEvent.setup();

    mockedLoginUser.mockRejectedValue(
      new LoginApiError('Validation failed', {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        timestamp: '2026-03-21T12:00:00.000Z',
        details: {
          identifier: 'Identifier is required.',
          password: 'Password is required.',
        },
      }),
    );

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'code_partner');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Identifier is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('GIVEN an unexpected server failure WHEN authentication fails THEN a generic fallback error is shown', async () => {
    const user = userEvent.setup();

    mockedLoginUser.mockRejectedValue(new Error('Request failed'));

    render(<App />);

    await user.type(await screen.findByLabelText('Email or username'), 'code_partner');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
  });
});
