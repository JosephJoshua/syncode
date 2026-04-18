import { CONTROL_API } from '@syncode/contracts';
import type { SupportedLanguage } from '@syncode/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, readApiError } from '@/lib/api-client.js';
import { LanguageSelector } from './language-selector.js';

interface LanguagePickerProps {
  roomId: string;
  currentLanguage: SupportedLanguage | null;
  myCapabilities: readonly string[];
  className?: string;
}

/**
 * Picker for switching the room's active programming language. Disabled when the current
 * user does not have `code:change-language`. On error it leaves the trigger pinned to
 * `currentLanguage` (controlled), so the UI matches the server's authoritative state.
 */
export function LanguagePicker({
  roomId,
  currentLanguage,
  myCapabilities,
  className,
}: LanguagePickerProps) {
  const { t } = useTranslation('rooms');
  const queryClient = useQueryClient();

  const canChange = myCapabilities.includes('code:change-language');

  const mutation = useMutation({
    mutationFn: async (language: SupportedLanguage) =>
      api(CONTROL_API.ROOMS.CHANGE_LANGUAGE, {
        params: { id: roomId },
        body: { language },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rooms', roomId] });
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('workspace.languageChangeFailed'));
    },
  });

  return (
    <LanguageSelector
      value={currentLanguage ?? undefined}
      onValueChange={(next) => {
        if (!canChange || mutation.isPending) return;
        if (next === currentLanguage) return;
        mutation.mutate(next);
      }}
      disabled={!canChange || mutation.isPending}
      placeholder={t('workspace.languagePickerPlaceholder')}
      className={className}
    />
  );
}
