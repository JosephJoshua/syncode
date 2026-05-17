import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enAdmin from '../locales/en/admin.json';
import enBookmarks from '../locales/en/bookmarks.json';
import enCommon from '../locales/en/common.json';
import enDashboard from '../locales/en/dashboard.json';
import enFeedback from '../locales/en/feedback.json';
import enLanding from '../locales/en/landing.json';
import enLogin from '../locales/en/login.json';
import enProblems from '../locales/en/problems.json';
import enProfile from '../locales/en/profile.json';
import enRegister from '../locales/en/register.json';
import enRooms from '../locales/en/rooms.json';
import enSessionDetail from '../locales/en/sessionDetail.json';
import enSessionReport from '../locales/en/sessionReport.json';

import zhAdmin from '../locales/zh/admin.json';
import zhBookmarks from '../locales/zh/bookmarks.json';
import zhCommon from '../locales/zh/common.json';
import zhDashboard from '../locales/zh/dashboard.json';
import zhFeedback from '../locales/zh/feedback.json';
import zhLanding from '../locales/zh/landing.json';
import zhLogin from '../locales/zh/login.json';
import zhProblems from '../locales/zh/problems.json';
import zhProfile from '../locales/zh/profile.json';
import zhRegister from '../locales/zh/register.json';
import zhRooms from '../locales/zh/rooms.json';
import zhSessionDetail from '../locales/zh/sessionDetail.json';
import zhSessionReport from '../locales/zh/sessionReport.json';

export const supportedLngs = ['en', 'zh'] as const;

const namespaces = [
  'common',
  'admin',
  'landing',
  'login',
  'register',
  'dashboard',
  'rooms',
  'problems',
  'bookmarks',
  'profile',
  'feedback',
  'sessionDetail',
  'sessionReport',
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
        admin: enAdmin,
        common: enCommon,
        landing: enLanding,
        login: enLogin,
        register: enRegister,
        dashboard: enDashboard,
        rooms: enRooms,
        problems: enProblems,
        bookmarks: enBookmarks,
        profile: enProfile,
        feedback: enFeedback,
        sessionDetail: enSessionDetail,
        sessionReport: enSessionReport,
      },
      zh: {
        admin: zhAdmin,
        common: zhCommon,
        landing: zhLanding,
        login: zhLogin,
        register: zhRegister,
        dashboard: zhDashboard,
        rooms: zhRooms,
        problems: zhProblems,
        bookmarks: zhBookmarks,
        profile: zhProfile,
        feedback: zhFeedback,
        sessionDetail: zhSessionDetail,
        sessionReport: zhSessionReport,
      },
    },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;

export default i18n;
