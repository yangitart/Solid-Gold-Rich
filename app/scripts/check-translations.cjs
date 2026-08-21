const fs = require('fs');
const path = require('path');

const locales = ['en', 'es', 'pt', 'fr', 'de', 'it'];
const localeDirectory = path.join(__dirname, '..', 'src', 'core', 'locales');

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
      releaseImport: { ...(finance.releaseImport ?? {}), ...(financeCompletion?.releaseImport ?? {}) },
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
  return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key));
}

const resources = Object.fromEntries(locales.map((locale) => {
  const filename = path.join(localeDirectory, `translation_${locale}.json`);
  return [locale, completeTranslation(JSON.parse(fs.readFileSync(filename, 'utf8')))];
}));
const expected = new Set(leafKeys(resources.en));
let failed = false;

for (const locale of locales.slice(1)) {
  const actual = new Set(leafKeys(resources[locale]));
  const missing = [...expected].filter((key) => !actual.has(key));
  if (missing.length) {
    failed = true;
    console.error(`${locale}: missing ${missing.length} keys`);
    missing.forEach((key) => console.error(`  ${key}`));
  }
}

if (failed) process.exit(1);
console.log(`Translation parity passed for ${locales.length} languages`);
