import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';

export interface LanguageSelectorMetadata {
  label: string;
  shortLabel: string;
  fallbackIconText: string;
  iconSrc: string;
  isRunnable?: boolean;
  isComingSoon?: boolean;
}

export interface LanguageSelectorOption extends LanguageSelectorMetadata {
  value: SupportedLanguage;
}

const languageIconSources: Record<SupportedLanguage, string> = {
  python: new URL('./icons/python.svg', import.meta.url).href,
  javascript: new URL('./icons/javascript.svg', import.meta.url).href,
  typescript: new URL('./icons/typescript.svg', import.meta.url).href,
  java: new URL('./icons/java.svg', import.meta.url).href,
  cpp: new URL('./icons/cplusplus.svg', import.meta.url).href,
  c: new URL('./icons/c.svg', import.meta.url).href,
  go: new URL('./icons/go.svg', import.meta.url).href,
  rust: new URL('./icons/rust.svg', import.meta.url).href,
};

export const LANGUAGE_SELECTOR_METADATA: Record<SupportedLanguage, LanguageSelectorMetadata> = {
  python: {
    label: 'Python',
    shortLabel: 'Py',
    fallbackIconText: 'Py',
    iconSrc: languageIconSources.python,
    isRunnable: true,
  },
  javascript: {
    label: 'JavaScript',
    shortLabel: 'JS',
    fallbackIconText: 'JS',
    iconSrc: languageIconSources.javascript,
    isRunnable: true,
  },
  typescript: {
    label: 'TypeScript',
    shortLabel: 'TS',
    fallbackIconText: 'TS',
    iconSrc: languageIconSources.typescript,
    isRunnable: true,
  },
  java: {
    label: 'Java',
    shortLabel: 'J',
    fallbackIconText: 'J',
    iconSrc: languageIconSources.java,
    isRunnable: true,
  },
  cpp: {
    label: 'C++',
    shortLabel: 'C++',
    fallbackIconText: 'C++',
    iconSrc: languageIconSources.cpp,
    isRunnable: true,
  },
  c: {
    label: 'C',
    shortLabel: 'C',
    fallbackIconText: 'C',
    iconSrc: languageIconSources.c,
  },
  go: {
    label: 'Go',
    shortLabel: 'Go',
    fallbackIconText: 'Go',
    iconSrc: languageIconSources.go,
  },
  rust: {
    label: 'Rust',
    shortLabel: 'Rs',
    fallbackIconText: 'Rs',
    iconSrc: languageIconSources.rust,
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
