import React from 'react';
import { FinanceProvider } from '@/features/app-state/presentation/components/AppStateContext';
import { AppContent } from '@/components/AppContent';
import { appDependencies } from '@/ioc/dependencies';

export default function AppRoot() {
  return (
    <FinanceProvider repository={appDependencies.appStateRepository}>
      <AppContent
        preferences={appDependencies.appPreferences}
        emergencyBackup={appDependencies.emergencyBackup}
        backupRepository={appDependencies.backupRepository}
        fileService={appDependencies.fileService}
        imageStorage={appDependencies.imageStorage}
        appStateRepository={appDependencies.appStateRepository}
        reportRepository={appDependencies.reportRepository}
      />
    </FinanceProvider>
  );
}
