import type { BackupRepository } from '@/features/store/application/ports/BackupRepository';
import { createAppArchive, createAppBackup, createStoreBackup, isolateStoreBackupForImport, parseAppArchive, parseAppBackup, parseStoreBackup, restoreAppBackupToDevice, restoreStoreBackupToDevice } from '@/features/store/infrastructure/backups/storeBackup';
import { exportCsv } from '@/features/finance/infrastructure/storage/financeStorage';
import { bytesToBase64 } from '@/shared/encoding/base64';

export const backupRepository: BackupRepository = {
  createAppJson: createAppBackup,
  createCsv: exportCsv,
  createAppArchive: async (state) => bytesToBase64(await createAppArchive(state)),
  parseAppJson: parseAppBackup,
  parseAppArchive,
  restoreApp: restoreAppBackupToDevice,
  createStoreJson: createStoreBackup,
  parseStoreJson: parseStoreBackup,
  restoreStore: restoreStoreBackupToDevice,
  isolateStore: isolateStoreBackupForImport,
};
