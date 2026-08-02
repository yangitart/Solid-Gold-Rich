import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import enTranslation from './translation_en.json';
import esTranslation from './translation_es.json';
import ptTranslation from './translation_pt.json';
import frTranslation from './translation_fr.json';
import deTranslation from './translation_de.json';
import itTranslation from './translation_it.json';

export const supportedLanguages = ['en', 'es', 'pt', 'fr', 'de', 'it'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

const i18n = createInstance();

const resources = {
  en: {
    translation: enTranslation,
  },
  es: {
    translation: esTranslation,
  },
  pt: {
    translation: ptTranslation,
  },
  fr: {
    translation: frTranslation,
  },
  de: {
    translation: deTranslation,
  },
  it: {
    translation: itTranslation,
  },
};

export function getPhoneLanguage(): SupportedLanguage {
  const phoneLanguage = getLocales()[0]?.languageCode?.toLowerCase() ?? 'en';

  return supportedLanguages.includes(phoneLanguage as SupportedLanguage)
    ? (phoneLanguage as SupportedLanguage)
    : 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: getPhoneLanguage(),
  fallbackLng: 'en',
  supportedLngs: supportedLanguages,
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
});

const translateSystem = i18n;
export default translateSystem;
