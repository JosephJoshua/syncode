import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

const supportedLngs = ['en', 'zh'] as const;

const namespaces = [
  'common',
  'landing',
  'login',
  'register',
  'dashboard',
  'rooms',
  'problems',
  'bookmarks',
  'profile',
  'feedback',
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs,
    fallbackLng: 'en',
    ns: [...namespaces],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    resources: {
      en: {
        common: {},
        landing: {},
        login: {},
        register: {},
        dashboard: {},
        rooms: {},
        problems: {},
        bookmarks: {},
        profile: {},
        feedback: {},
      },
      zh: {
        common: {},
        landing: {},
        login: {},
        register: {},
        dashboard: {},
        rooms: {},
        problems: {},
        bookmarks: {},
        profile: {},
        feedback: {},
      },
    },
  });

export default i18n;
