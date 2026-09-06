export type FutureCapability =
  | 'developerSupport'
  | 'premium'
  | 'googleIdentity'
  | 'cloudBackup'
  | 'usBankConnections';

export type FutureCapabilityFlags = Readonly<Record<FutureCapability, boolean>>;

export type PremiumFeature =
  | 'cloudBackup'
  | 'multiDeviceSync'
  | 'automaticBankImport'
  | 'advancedForecasts'
  | 'customReportTemplates'
  | 'prioritySupport';

export type PremiumEntitlementStatus = 'inactive' | 'trial' | 'active' | 'grace' | 'expired';

export type PremiumEntitlement = {
  status: PremiumEntitlementStatus;
  productId?: string;
  expiresAt?: string;
  verifiedAt?: string;
};

export type DeveloperSupportDestination = {
  provider: 'paymentLink' | 'paypal' | 'cashApp' | 'bankTransfer' | 'other';
  accountReference: string;
  currency?: string;
};

export type ExternalIdentity = {
  provider: 'google';
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
};

export type LinkedBankAccount = {
  connectionReference: string;
  institutionName: string;
  accountMask?: string;
  accountType: 'checking' | 'savings' | 'credit' | 'loan' | 'other';
  currency: string;
  status: 'active' | 'reauthorizationRequired' | 'disconnected';
  lastSyncedAt?: string;
};
