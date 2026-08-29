import React from 'react';
import { FinanceProvider } from '@/features/finance/application/FinanceContext';
import { AppContent } from '@/application/AppContent';
import { appDependencies } from '@/application/composition/dependencies';

export default function AppRoot() {
  return <FinanceProvider repository={appDependencies.financeRepository}><AppContent preferences={appDependencies.appPreferences} emergencyBackup={appDependencies.emergencyBackup} backupRepository={appDependencies.backupRepository} fileService={appDependencies.fileService} imageStorage={appDependencies.imageStorage} financeRepository={appDependencies.financeRepository} reportRepository={appDependencies.reportRepository} /></FinanceProvider>;
}
