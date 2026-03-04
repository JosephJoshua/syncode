import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app';

describe('App', () => {
  it('renders the navigation with SynCode branding', async () => {
    render(<App />);
    expect(await screen.findByText('SynCode')).toBeInTheDocument();
  });
});
