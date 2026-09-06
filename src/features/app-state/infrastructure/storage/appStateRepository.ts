import { hasFinanceImportIntegrity } from '@/features/backup/application/services/backupIntegrity';
import type { AppStateRepository } from '@/features/app-state/application/ports/AppStateRepository';
import {
  emptyFinanceState,
  importCsv,
  loadFinanceState,
  normalizeFinanceState,
  saveFinanceState,
} from '@/features/app-state/infrastructure/storage/appStateStorage';
import type { AppState as FinanceState } from '@/domain/AppState';

function parseJson(json: string): FinanceState | null {
  try {
    const parsed = JSON.parse(json) as Partial<FinanceState>;
    if (
      !parsed ||
      ![2, 3, 4, 5, 6, 7].includes(Number(parsed.schemaVersion)) ||
      !Array.isArray(parsed.accounts) ||
      !Array.isArray(parsed.transactions)
    )
      return null;
    if (!hasFinanceImportIntegrity(parsed)) return null;
    return normalizeFinanceState(parsed);
  } catch {
    return null;
  }
}

export const appStateRepository: AppStateRepository = {
  load: loadFinanceState,
  save: saveFinanceState,
  reset: emptyFinanceState,
  normalize: normalizeFinanceState,
  parseJson,
  importCsv: (csv, accountId, fallbackCurrency, accounts) =>
    importCsv(csv, accountId, fallbackCurrency, accounts),
};
