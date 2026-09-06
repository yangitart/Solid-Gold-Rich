import type { AppState } from '@/domain/AppState';
import type { AppStateRepository } from '../ports/AppStateRepository';
import { mergeImportedTransactions, resolveImportedFinanceState } from '@/features/finance/application/services/financeStateOperations';

export function prepareJsonImport(
  parser: Pick<AppStateRepository, 'parseJson'>,
  json: string,
  preserveStore = false,
): ((current: AppState) => AppState) | null {
  const parsed = parser.parseJson(json);
  if (!parsed) return null;
  // Apply against the latest state, not the state when parsing started.
  return (current) => resolveImportedFinanceState(current, parsed, preserveStore);
}

export function importCsvIntoState(
  current: AppState,
  parser: Pick<AppStateRepository, 'importCsv'>,
  csv: string,
  accountId: string,
) {
  const account = current.accounts.find((item) => item.id === accountId);
  const result = parser.importCsv(csv, accountId, account?.currency ?? current.settings.preferredCurrency, current.accounts);
  const merged = mergeImportedTransactions(current, result.items);
  return {
    state: merged.state,
    errors: merged.duplicateCount ? [...result.errors, `duplicates:${merged.duplicateCount}`] : result.errors,
  };
}
