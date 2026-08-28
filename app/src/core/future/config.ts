import type { DeveloperSupportDestination, FutureCapabilityFlags, PremiumFeature } from './types';

/**
 * Internal-only switches. None of these capabilities may be exposed by a screen,
 * route, menu, translation, deep link, notification, or background task while
 * its flag is false.
 */
export const FUTURE_CAPABILITIES = Object.freeze({
  developerSupport: false,
  premium: false,
  googleIdentity: false,
  cloudBackup: false,
  usBankConnections: false,
}) satisfies FutureCapabilityFlags;

export const DEVELOPER_SUPPORT_CONFIG = Object.freeze({
  enabled: false,
  destination: null as DeveloperSupportDestination | null,
  suggestedAmounts: [] as readonly number[],
  defaultCurrency: null as string | null,
});

export const PREMIUM_CONFIG = Object.freeze({
  enabled: false,
  billingProvider: null as string | null,
  productIds: [] as readonly string[],
  candidateFeatures: [
    'cloudBackup',
    'multiDeviceSync',
    'automaticBankImport',
    'advancedForecasts',
    'customReportTemplates',
    'prioritySupport',
  ] as const satisfies readonly PremiumFeature[],
});

export const GOOGLE_IDENTITY_CONFIG = Object.freeze({
  enabled: false,
  androidClientId: null as string | null,
  serverClientId: null as string | null,
  backendBaseUrl: null as string | null,
});

export const CLOUD_BACKUP_CONFIG = Object.freeze({
  enabled: false,
  backendBaseUrl: null as string | null,
  requiresEncryption: true,
  minimumEnvelopeVersion: 1,
});

export const US_BANK_CONNECTION_CONFIG = Object.freeze({
  enabled: false,
  provider: null as string | null,
  backendBaseUrl: null as string | null,
  country: 'US' as const,
  readOnly: true,
  allowMoneyMovement: false,
});

export function isFutureCapabilityEnabled(capability: keyof typeof FUTURE_CAPABILITIES) {
  return Boolean(FUTURE_CAPABILITIES[capability]);
}

export function areAllFutureCapabilitiesHidden() {
  return Object.values(FUTURE_CAPABILITIES).every((enabled) => !enabled)
    && !DEVELOPER_SUPPORT_CONFIG.enabled
    && !PREMIUM_CONFIG.enabled
    && !GOOGLE_IDENTITY_CONFIG.enabled
    && !CLOUD_BACKUP_CONFIG.enabled
    && !US_BANK_CONNECTION_CONFIG.enabled;
}
