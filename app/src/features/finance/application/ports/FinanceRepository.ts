import type { FinanceState, Transaction } from '@/features/finance/domain/entities/financeTypes';

export type CsvImportResult = { items: Transaction[]; errors: string[] };

export type FinanceRepository = {
  load: () => Promise<FinanceState>;
  save: (state: FinanceState) => Promise<void>;
  reset: () => FinanceState;
  normalize: (state: Partial<FinanceState>) => FinanceState;
  parseJson: (json: string) => FinanceState | null;
  importCsv: (csv: string, accountId: string, fallbackCurrency: string) => CsvImportResult;
};
