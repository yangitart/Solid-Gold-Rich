import React from 'react';
import { FinanceProvider } from '../stores/FinanceContext';
import { AppContent } from './AppContent';

export default function AppRoot() {
  return <FinanceProvider><AppContent /></FinanceProvider>;
}
