import type { FinanceState } from '@/features/finance/domain/entities/financeTypes';

export type EmergencyBackup = {
  share: (state: FinanceState) => Promise<void>;
};
