import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app';
import { useAuthStore } from '@/stores/auth.store';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: true,
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

  it('GIVEN the home page loads WHEN the hero section renders THEN the login call to action is visible', async () => {
    render(<App />);
    expect((await screen.findAllByRole('link', { name: 'Log in' })).length).toBeGreaterThan(0);
  });
});
