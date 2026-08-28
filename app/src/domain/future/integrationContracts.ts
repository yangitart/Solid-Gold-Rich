import type { ExternalIdentity, LinkedBankAccount, PremiumEntitlement } from '../../core/future/types';

/**
 * These are provider-neutral boundaries for future implementations. They have
 * no runtime implementation and must not be imported by current UI code.
 * Provider secrets, refresh tokens, bank access tokens, and encryption keys
 * belong on a backend or in an approved secure credential store, never in
 * FinanceState, AsyncStorage, backups, logs, analytics, or source control.
 */

export type IdentitySession = {
  identity: ExternalIdentity;
  sessionReference: string;
};

export interface IdentityGateway {
  signInWithGoogle(): Promise<IdentitySession>;
  restoreSession(): Promise<IdentitySession | null>;
  signOut(sessionReference: string): Promise<void>;
}

export type EncryptedBackupEnvelope = {
  version: number;
  algorithm: string;
  keyReference: string;
  nonce: string;
  ciphertext: string;
  createdAt: string;
  deviceReference?: string;
};

export interface CloudBackupGateway {
  upload(sessionReference: string, envelope: EncryptedBackupEnvelope): Promise<{ revision: string }>;
  downloadLatest(sessionReference: string): Promise<{ revision: string; envelope: EncryptedBackupEnvelope } | null>;
  deleteAll(sessionReference: string): Promise<void>;
}

export type BankLinkSession = {
  linkSessionReference: string;
  expiresAt: string;
};

export type ImportedBankTransaction = {
  externalReference: string;
  accountConnectionReference: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  pending: boolean;
};

export interface BankConnectionGateway {
  createLinkSession(sessionReference: string): Promise<BankLinkSession>;
  exchangeLinkResult(sessionReference: string, linkResultReference: string): Promise<LinkedBankAccount[]>;
  listAccounts(sessionReference: string): Promise<LinkedBankAccount[]>;
  importTransactions(sessionReference: string, connectionReference: string, cursor?: string): Promise<{ transactions: ImportedBankTransaction[]; cursor?: string }>;
  disconnect(sessionReference: string, connectionReference: string): Promise<void>;
}

export interface PremiumEntitlementGateway {
  getEntitlement(sessionReference?: string): Promise<PremiumEntitlement>;
  restorePurchases(sessionReference?: string): Promise<PremiumEntitlement>;
}

export type DeveloperSupportCheckout = {
  amount: number;
  currency: string;
  destinationReference: string;
};

export interface DeveloperSupportGateway {
  createCheckout(input: DeveloperSupportCheckout): Promise<{ externalUrl: string }>;
}
