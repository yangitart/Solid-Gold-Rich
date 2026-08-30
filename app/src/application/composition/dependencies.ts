import 'reflect-metadata';
import { Container } from 'inversify';
import type { AppPreferences } from '@/application/ports/AppPreferences';
import type { EmergencyBackup } from '@/application/ports/EmergencyBackup';
import type { FileService } from '@/application/ports/FileService';
import { appPreferences } from '@/application/infrastructure/storage/appPreferences';
import { emergencyBackup } from '@/application/infrastructure/backups/emergencyBackup';
import { expoFileService } from '@/application/infrastructure/files/expoFileService';
import type { BackupRepository } from '@/features/store/application/ports/BackupRepository';
import type { ImageStorage } from '@/features/store/application/ports/ImageStorage';
import type { ReportRepository } from '@/features/store/application/ports/ReportRepository';
import { backupRepository } from '@/features/store/infrastructure/backups/backupRepository';
import { expoImageStorage } from '@/features/store/infrastructure/storage/expoImageStorage';
import { reportRepository } from '@/features/store/infrastructure/backups/reportRepository';
import type { FinanceRepository } from '@/features/finance/application/ports/FinanceRepository';
import { financeRepository } from '@/features/finance/infrastructure/storage/financeRepository';

export const APP_TYPES = {
  appPreferences: Symbol.for('AppPreferences'),
  emergencyBackup: Symbol.for('EmergencyBackup'),
  backupRepository: Symbol.for('BackupRepository'),
  fileService: Symbol.for('FileService'),
  imageStorage: Symbol.for('ImageStorage'),
  financeRepository: Symbol.for('FinanceRepository'),
  reportRepository: Symbol.for('ReportRepository'),
};

export const appContainer = new Container();

appContainer.bind<AppPreferences>(APP_TYPES.appPreferences).toConstantValue(appPreferences);
appContainer.bind<EmergencyBackup>(APP_TYPES.emergencyBackup).toConstantValue(emergencyBackup);
appContainer.bind<BackupRepository>(APP_TYPES.backupRepository).toConstantValue(backupRepository);
appContainer.bind<FileService>(APP_TYPES.fileService).toConstantValue(expoFileService);
appContainer.bind<ImageStorage>(APP_TYPES.imageStorage).toConstantValue(expoImageStorage);
appContainer.bind<FinanceRepository>(APP_TYPES.financeRepository).toConstantValue(financeRepository);
appContainer.bind<ReportRepository>(APP_TYPES.reportRepository).toConstantValue(reportRepository);

export const appDependencies = {
  appPreferences: appContainer.get<AppPreferences>(APP_TYPES.appPreferences),
  emergencyBackup: appContainer.get<EmergencyBackup>(APP_TYPES.emergencyBackup),
  backupRepository: appContainer.get<BackupRepository>(APP_TYPES.backupRepository),
  fileService: appContainer.get<FileService>(APP_TYPES.fileService),
  imageStorage: appContainer.get<ImageStorage>(APP_TYPES.imageStorage),
  financeRepository: appContainer.get<FinanceRepository>(APP_TYPES.financeRepository),
  reportRepository: appContainer.get<ReportRepository>(APP_TYPES.reportRepository),
};
