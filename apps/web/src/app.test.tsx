import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app';

describe('App', () => {
  it('GIVEN the app loads WHEN the root layout renders THEN SynCode branding is visible', async () => {
    render(<App />);

    expect(await screen.findByText('SynCode')).toBeInTheDocument();
  });

  it('GIVEN the home page loads WHEN the hero section renders THEN the register call to action is visible', async () => {
    render(<App />);

    expect(await screen.findByRole('link', { name: 'Create account' })).toBeInTheDocument();
  });
});
