import 'reflect-metadata';
import { Container } from 'inversify';
import type { AppPreferences } from '@/features/onboarding/application/ports/AppPreferences';
import { appPreferences } from '@/features/onboarding/infrastructure/storage/appPreferences';
import type { BackupRepository } from '@/features/backup/application/ports/BackupRepository';
import type { EmergencyBackup } from '@/features/backup/application/ports/EmergencyBackup';
import { backupRepository } from '@/features/backup/infrastructure/backups/backupRepository';
import { emergencyBackup } from '@/features/backup/infrastructure/backups/emergencyBackup';
import type { AppStateRepository } from '@/features/app-state/application/ports/AppStateRepository';
import { appStateRepository } from '@/features/app-state/infrastructure/storage/appStateRepository';
import type { ImageStorage } from '@/features/store/application/ports/ImageStorage';
import type { ReportRepository } from '@/features/store/application/ports/ReportRepository';
import { reportRepository } from '@/features/store/infrastructure/reports/reportRepository';
import { expoImageStorage } from '@/features/store/infrastructure/storage/expoImageStorage';
import type { FileService } from '@/shared/application/ports/FileService';
import { expoFileService } from '@/shared/infrastructure/files/expoFileService';

export const APP_TYPES = {
  appPreferences: Symbol.for('AppPreferences'),
  emergencyBackup: Symbol.for('EmergencyBackup'),
  backupRepository: Symbol.for('BackupRepository'),
  fileService: Symbol.for('FileService'),
  imageStorage: Symbol.for('ImageStorage'),
  appStateRepository: Symbol.for('AppStateRepository'),
  reportRepository: Symbol.for('ReportRepository'),
};

export const appContainer = new Container();

appContainer.bind<AppPreferences>(APP_TYPES.appPreferences).toConstantValue(appPreferences);
appContainer.bind<EmergencyBackup>(APP_TYPES.emergencyBackup).toConstantValue(emergencyBackup);
appContainer.bind<BackupRepository>(APP_TYPES.backupRepository).toConstantValue(backupRepository);
appContainer.bind<FileService>(APP_TYPES.fileService).toConstantValue(expoFileService);
appContainer.bind<ImageStorage>(APP_TYPES.imageStorage).toConstantValue(expoImageStorage);
appContainer
  .bind<AppStateRepository>(APP_TYPES.appStateRepository)
  .toConstantValue(appStateRepository);
appContainer.bind<ReportRepository>(APP_TYPES.reportRepository).toConstantValue(reportRepository);

export const appDependencies = {
  appPreferences: appContainer.get<AppPreferences>(APP_TYPES.appPreferences),
  emergencyBackup: appContainer.get<EmergencyBackup>(APP_TYPES.emergencyBackup),
  backupRepository: appContainer.get<BackupRepository>(APP_TYPES.backupRepository),
  fileService: appContainer.get<FileService>(APP_TYPES.fileService),
  imageStorage: appContainer.get<ImageStorage>(APP_TYPES.imageStorage),
  appStateRepository: appContainer.get<AppStateRepository>(APP_TYPES.appStateRepository),
  reportRepository: appContainer.get<ReportRepository>(APP_TYPES.reportRepository),
};
