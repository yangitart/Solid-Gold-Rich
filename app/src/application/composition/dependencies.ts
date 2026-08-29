import { appPreferences } from '@/application/infrastructure/storage/appPreferences';
import { emergencyBackup } from '@/application/infrastructure/backups/emergencyBackup';
import { expoFileService } from '@/application/infrastructure/files/expoFileService';
import { backupRepository } from '@/features/store/infrastructure/backups/backupRepository';
import { expoImageStorage } from '@/features/store/infrastructure/storage/expoImageStorage';
import { reportRepository } from '@/features/store/infrastructure/backups/reportRepository';
import { financeRepository } from '@/features/finance/infrastructure/storage/financeRepository';

export const appDependencies = {
  appPreferences,
  emergencyBackup,
  backupRepository,
  fileService: expoFileService,
  imageStorage: expoImageStorage,
  financeRepository,
  reportRepository,
};
