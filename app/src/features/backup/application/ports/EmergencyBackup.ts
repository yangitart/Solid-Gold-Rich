import type { AppState as FinanceState } from '@/domain/AppState';

export type EmergencyBackup = {
  share: (state: FinanceState) => Promise<void>;
};
