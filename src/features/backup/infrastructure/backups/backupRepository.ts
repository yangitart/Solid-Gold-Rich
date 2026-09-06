import type { BackupRepository } from '@/features/backup/application/ports/BackupRepository';
import {
  createAppArchive,
  createAppBackup,
  createStoreBackup,
  isolateStoreBackupForImport,
  parseAppArchive,
  parseAppBackup,
  parseStoreBackup,
  restoreAppBackupToDevice,
  restoreStoreBackupToDevice,
} from '@/features/backup/infrastructure/backups/backupSerialization';
import { exportFinanceCsv } from '@/features/finance/application/services/csvExport';
import { bytesToBase64 } from '@/shared/utils/base64';

export const backupRepository: BackupRepository = {
  createAppJson: createAppBackup,
  createCsv: exportFinanceCsv,
  createAppArchive: async (state) => bytesToBase64(await createAppArchive(state)),
  parseAppJson: parseAppBackup,
  parseAppArchive,
  restoreApp: restoreAppBackupToDevice,
  createStoreJson: createStoreBackup,
  parseStoreJson: parseStoreBackup,
  restoreStore: restoreStoreBackupToDevice,
  isolateStore: isolateStoreBackupForImport,
};
