import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { lt } from './locales/lt';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹' }
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('aibudget_lang');
    if (saved === 'en' || saved === 'lt') {
      return saved;
    }
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      lt: { translation: lt }
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export function setLanguage(lang: SupportedLanguage) {
  i18n.changeLanguage(lang);
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('aibudget_lang', lang);
  }
}

export default i18n;
