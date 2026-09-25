import type { AppState as FinanceState } from '@/domain/AppState';
import type { StoreState } from '@/features/store/domain/entities/Store';
import type { AppBackup, StoreBackup } from '@/features/backup/application/ports/BackupTypes';
import type { CurrencyRates } from '@/shared/domain/finance/currency';

export type BackupRepository = {
  createAppJson: (state: FinanceState) => Promise<AppBackup>;
  createCsv: (state: FinanceState) => string;
  createAppArchive: (state: FinanceState) => Promise<string>;
  parseAppJson: (text: string) => AppBackup;
  parseAppArchive: (base64: string) => AppBackup;
  restoreApp: (backup: AppBackup) => Promise<FinanceState>;
  createStoreJson: (store: StoreState, exchangeRates?: CurrencyRates) => Promise<StoreBackup>;
  parseStoreJson: (text: string) => StoreBackup;
  restoreStore: (backup: StoreBackup) => Promise<StoreState>;
  isolateStore: (store: StoreState) => StoreState;
};
