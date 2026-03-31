import i18next from 'i18next';
import { createI18nStore } from 'svelte-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import zhCN from './locales/zh-cn.json';
import zhTW from './locales/zh-tw.json';

const allLocales = ['en', 'es', 'zh-CN', 'zh-TW'];

function getLanguageFromCookie() {
  const match = document.cookie.match(/(^| )language=([^;]+)/);
  const matchedLanguage = allLocales.find((locale) => locale === match?.[2]);
  return matchedLanguage;
}

function getLanguageFromBrowser() {
  const language = allLocales.find((locale) => locale === navigator.language);
  return language;
}

export function getLocale() {
  return getLanguageFromCookie() || getLanguageFromBrowser() || 'en';
}

void i18next.init({
  lng: getLocale(),
  resources: {
    en: {
      translation: en,
    },
    es: {
      translation: es,
    },
    'zh-CN': {
      translation: zhCN,
    },
    'zh-TW': {
      translation: zhTW,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

const i18n = createI18nStore(i18next);

export default i18n;
