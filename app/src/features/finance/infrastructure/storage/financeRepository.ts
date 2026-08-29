import type { FinanceRepository } from '@/features/finance/application/ports/FinanceRepository';
import { emptyFinanceState, importCsv, loadFinanceState, normalizeFinanceState, saveFinanceState } from '@/features/finance/infrastructure/storage/financeStorage';
import type { FinanceState } from '@/features/finance/domain/entities/financeTypes';

function parseJson(json: string): FinanceState | null {
  try {
    const parsed = JSON.parse(json) as Partial<FinanceState>;
    if (!parsed || ![2, 3, 4, 5, 6, 7].includes(Number(parsed.schemaVersion)) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions)) return null;
    return normalizeFinanceState(parsed);
  } catch {
    return null;
  }
}

export const financeRepository: FinanceRepository = {
  load: loadFinanceState,
  save: saveFinanceState,
  reset: emptyFinanceState,
  normalize: normalizeFinanceState,
  parseJson,
  importCsv: (csv, accountId, fallbackCurrency) => importCsv(csv, accountId, fallbackCurrency),
};
