import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './translation_en.json';
import esTranslation from './translation_es.json';

const resources = {
  en: {
    translation: enTranslation,
  },
  es: {
    translation: esTranslation,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'es',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

const translateSystem = i18n;
export default translateSystem;
