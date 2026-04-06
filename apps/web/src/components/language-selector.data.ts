import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';

export interface LanguageSelectorMetadata {
  label: string;
  shortLabel: string;
  fallbackIconText: string;
  isRunnable?: boolean;
  isComingSoon?: boolean;
}

export interface LanguageSelectorOption extends LanguageSelectorMetadata {
  value: SupportedLanguage;
}

export const LANGUAGE_SELECTOR_METADATA: Record<SupportedLanguage, LanguageSelectorMetadata> = {
  python: {
    label: 'Python',
    shortLabel: 'Py',
    fallbackIconText: 'Py',
    isRunnable: true,
  },
  javascript: {
    label: 'JavaScript',
    shortLabel: 'JS',
    fallbackIconText: 'JS',
    isRunnable: true,
  },
  typescript: {
    label: 'TypeScript',
    shortLabel: 'TS',
    fallbackIconText: 'TS',
    isRunnable: true,
  },
  java: {
    label: 'Java',
    shortLabel: 'J',
    fallbackIconText: 'J',
    isRunnable: true,
  },
  cpp: {
    label: 'C++',
    shortLabel: 'C++',
    fallbackIconText: 'C++',
    isRunnable: true,
  },
  c: {
    label: 'C',
    shortLabel: 'C',
    fallbackIconText: 'C',
  },
  go: {
    label: 'Go',
    shortLabel: 'Go',
    fallbackIconText: 'Go',
  },
  rust: {
    label: 'Rust',
    shortLabel: 'Rs',
    fallbackIconText: 'Rs',
  },
};

export function getLanguageSelectorOption(language: SupportedLanguage): LanguageSelectorOption {
  return {
    value: language,
    ...LANGUAGE_SELECTOR_METADATA[language],
  };
}

export function getLanguageSelectorOptions(
  languages?: readonly SupportedLanguage[],
): LanguageSelectorOption[] {
  const allowedLanguages = languages ? new Set(languages) : null;

  return SUPPORTED_LANGUAGES.filter((language) => {
    return allowedLanguages ? allowedLanguages.has(language) : true;
  }).map(getLanguageSelectorOption);
}
