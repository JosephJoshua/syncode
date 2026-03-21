import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app';

describe('App', () => {
  it('renders the navigation with SynCode branding', async () => {
    render(<App />);
    expect(await screen.findByText('SynCode')).toBeInTheDocument();
  });

  it('renders a register call to action on the home page', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Create account' })).toBeInTheDocument();
  });

  it('renders the register page fields', async () => {
    window.history.pushState({}, '', '/register');
    render(<App />);
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});
