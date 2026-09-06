import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import path from 'node:path';

const locales = ['en', 'es', 'pt', 'fr', 'de', 'it'];
const localeDirectory = fileURLToPath(new URL('../src/shared/i18n', import.meta.url));

function completeTranslation(root) {
  const finance = root.finance ?? {};
  const storeCompletion = finance.storeCompletion;
  const financeCompletion = finance.financeCompletion;
  return {
    ...root,
    finance: {
      ...finance,
      ...(storeCompletion?.common ?? {}),
      ...(financeCompletion?.common ?? {}),
      pin: { ...(finance.pin ?? {}), ...(financeCompletion?.pin ?? {}) },
      releaseImport: {
        ...(finance.releaseImport ?? {}),
        ...(financeCompletion?.releaseImport ?? {}),
      },
      store: {
        ...(finance.store ?? {}),
        ...(storeCompletion?.store ?? {}),
        ...(finance.storeMessages ?? {}),
        errors: {
          ...(finance.store?.errors ?? {}),
          ...(storeCompletion?.store?.errors ?? {}),
        },
      },
      storeFilters: { ...(finance.storeFilters ?? {}), ...(storeCompletion?.filters ?? {}) },
    },
  };
}

function leafKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

const resources = Object.fromEntries(
  locales.map((locale) => {
    const filename = path.join(localeDirectory, `translation_${locale}.json`);
    return [locale, completeTranslation(JSON.parse(fs.readFileSync(filename, 'utf8')))];
  }),
);
const expected = new Set(leafKeys(resources.en));
test.each(locales.slice(1))('%s contains all English translation keys', (locale) => {
  const actual = new Set(leafKeys(resources[locale]));
  expect([...expected].filter((key) => !actual.has(key))).toEqual([]);
});
