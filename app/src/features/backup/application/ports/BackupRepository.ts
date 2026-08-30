import type { AppState as FinanceState } from '@/domain/AppState';
import type { StoreState } from '@/features/store/domain/entities/Store';
import type { AppBackup, StoreBackup } from '@/features/backup/application/ports/BackupTypes';

export type BackupRepository = {
  createAppJson: (state: FinanceState) => Promise<AppBackup>;
  createCsv: (state: FinanceState) => string;
  createAppArchive: (state: FinanceState) => Promise<string>;
  parseAppJson: (text: string) => AppBackup;
  parseAppArchive: (base64: string) => AppBackup;
  restoreApp: (backup: AppBackup) => Promise<FinanceState>;
  createStoreJson: (store: StoreState) => Promise<StoreBackup>;
  parseStoreJson: (text: string) => StoreBackup;
  restoreStore: (backup: StoreBackup) => Promise<StoreState>;
  isolateStore: (store: StoreState) => StoreState;
};
