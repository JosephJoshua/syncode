import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app';
import { useAuthStore } from '@/stores/auth.store';

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('GIVEN the app loads WHEN the root layout renders THEN SynCode branding is visible', async () => {
    render(<App />);
    expect(await screen.findByText('SynCode')).toBeInTheDocument();
  });

  it('GIVEN the home page loads WHEN the navbar renders THEN the login link is visible', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('GIVEN the user is authenticated WHEN the home page renders THEN the navbar login link is hidden', async () => {
    useAuthStore.setState({
      user: null,
      accessToken: 'access-token',
      isAuthenticated: true,
    });

    render(<App />);

    expect(await screen.findByText('Signed in')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });
});
