import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app';
import { api, readApiError } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
  readApiError: vi.fn(),
}));

const mockedApi = vi.mocked(api);
const mockedReadApiError = vi.mocked(readApiError);

describe('Register page', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/register');
    mockedApi.mockReset();
    mockedReadApiError.mockReset();
    mockedReadApiError.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('GIVEN the register page loads WHEN the form renders THEN username, email, and password fields are visible', async () => {
    render(<App />);

    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('GIVEN invalid register inputs WHEN the form is submitted THEN client-side validation feedback is shown', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Username must be at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it('GIVEN valid register inputs WHEN registration succeeds THEN username, email, and password are submitted and the user is redirected to login', async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue({
      accessToken: 'new-access-token',
    });

    render(<App />);

    await user.type(await screen.findByLabelText('Username'), 'code_partner');
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        expect.objectContaining({
          route: 'auth/register',
          method: 'POST',
        }),
        {
          body: {
            username: 'code_partner',
            email: 'user@example.com',
            password: 'Password123',
          },
        },
      );
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });

  it('GIVEN a duplicate email WHEN registration fails with conflict THEN the server error is shown', async () => {
    const user = userEvent.setup();
    mockedApi.mockRejectedValue(new Error('Conflict'));
    mockedReadApiError.mockResolvedValue({
      statusCode: 409,
      message: 'Email already registered',
      timestamp: '2026-03-21T12:00:00.000Z',
    });

    render(<App />);

    await user.type(await screen.findByLabelText('Username'), 'code_partner');
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('That email is already registered.')).toBeInTheDocument();
  });
});
