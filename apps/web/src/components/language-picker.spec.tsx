import { CONTROL_API } from '@syncode/contracts';
import type { SupportedLanguage } from '@syncode/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HTTPError } from 'ky';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import { toast } from 'sonner';
import { api } from '@/lib/api-client.js';
import { LanguagePicker } from './language-picker.js';

const apiMock = vi.mocked(api);
const toastErrorMock = vi.mocked(toast.error);

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

function makeErrorResponse(status: number, body: unknown) {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
  return new HTTPError(response, new Request('http://example'), {} as never);
}

describe('LanguagePicker', () => {
  beforeEach(() => {
    apiMock.mockReset();
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GIVEN myCapabilities lacks code:change-language THEN picker is disabled', () => {
    renderWithQuery(
      <LanguagePicker roomId="room-1" currentLanguage="python" myCapabilities={['code:edit']} />,
    );

    const trigger = screen.getByRole('combobox', { name: /Programming language/i });
    expect(trigger).toBeDisabled();
  });

  it('GIVEN myCapabilities has code:change-language THEN picker is enabled', () => {
    renderWithQuery(
      <LanguagePicker
        roomId="room-1"
        currentLanguage="python"
        myCapabilities={['code:change-language']}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: /Programming language/i });
    expect(trigger).not.toBeDisabled();
  });

  it('GIVEN user selects a language THEN PATCH /rooms/:id/language is called with { language }', async () => {
    apiMock.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();

    renderWithQuery(
      <LanguagePicker
        roomId="room-1"
        currentLanguage={'python' as SupportedLanguage}
        myCapabilities={['code:change-language']}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: /Programming language/i }));
    const option = await screen.findByRole('option', { name: /JavaScript/i });
    await user.click(option);

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(CONTROL_API.ROOMS.CHANGE_LANGUAGE, {
        params: { id: 'room-1' },
        body: { language: 'javascript' },
      });
    });
  });

  it('GIVEN server returns 403 THEN error toast shown AND picker stays on previous language', async () => {
    apiMock.mockRejectedValueOnce(
      makeErrorResponse(403, { statusCode: 403, message: 'forbidden' }),
    );
    const user = userEvent.setup();

    renderWithQuery(
      <LanguagePicker
        roomId="room-1"
        currentLanguage={'python' as SupportedLanguage}
        myCapabilities={['code:change-language']}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: /Programming language/i }));
    const option = await screen.findByRole('option', { name: /JavaScript/i });
    await user.click(option);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });

    // Trigger still reflects the original (controlled) language.
    const trigger = screen.getByRole('combobox', { name: /Programming language/i });
    expect(trigger.textContent ?? '').toMatch(/Python/i);
  });
});
