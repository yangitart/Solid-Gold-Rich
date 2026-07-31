import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import enTranslation from './translation_en.json';
import esTranslation from './translation_es.json';
import ptTranslation from './translation_pt.json';
import frTranslation from './translation_fr.json';
import deTranslation from './translation_de.json';
import itTranslation from './translation_it.json';

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

const phoneLanguage = getLocales()[0]?.languageCode?.toLowerCase().split('-')[0] ?? 'en';
const supportedLanguages = ['en', 'es', 'pt', 'fr', 'de', 'it'] as const;
const initialLanguage = supportedLanguages.includes(phoneLanguage as (typeof supportedLanguages)[number])
  ? phoneLanguage
  : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
});

const translateSystem = i18n;
export default translateSystem;
