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

function completeTranslation(source: unknown) {
  const root = source as Record<string, unknown>;
  const finance = root.finance as Record<string, unknown>;
  const completion = finance.storeCompletion as Record<string, Record<string, unknown>> | undefined;
  const financeCompletion = finance.financeCompletion as
    Record<string, Record<string, unknown>> | undefined;
  const storeMessages = finance.storeMessages as Record<string, unknown> | undefined;
  if (!completion && !financeCompletion) return root;
  return {
    ...root,
    finance: {
      ...finance,
      ...(completion?.common ?? {}),
      ...(financeCompletion?.common ?? {}),
      pin: { ...(finance.pin as Record<string, unknown>), ...(financeCompletion?.pin ?? {}) },
      releaseImport: {
        ...(finance.releaseImport as Record<string, unknown>),
        ...(financeCompletion?.releaseImport ?? {}),
      },
      store: {
        ...(finance.store as Record<string, unknown>),
        ...(completion?.store ?? {}),
        ...(storeMessages ?? {}),
        errors: {
          ...((finance.store as Record<string, unknown>)?.errors as
            Record<string, unknown> | undefined),
          ...((completion?.store?.errors as Record<string, unknown> | undefined) ?? {}),
        },
      },
      storeFilters: {
        ...(finance.storeFilters as Record<string, unknown>),
        ...(completion?.filters ?? {}),
      },
    },
  };
}

const resources = {
  en: {
    translation: completeTranslation(enTranslation),
  },
  es: {
    translation: completeTranslation(esTranslation),
  },
  pt: {
    translation: completeTranslation(ptTranslation),
  },
  fr: {
    translation: completeTranslation(frTranslation),
  },
  de: {
    translation: completeTranslation(deTranslation),
  },
  it: {
    translation: completeTranslation(itTranslation),
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
