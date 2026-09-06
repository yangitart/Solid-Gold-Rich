import type {
  Account,
  Budget,
  Debt,
  FinanceCategories,
  RecurringTransaction,
  Reminder,
  SavingsGoal,
  Transaction,
  Transfer,
} from '@/features/finance/domain/entities/financeTypes';
import type { Note, NoteFolder } from '@/features/notes/domain/entities/Note';
import type { StoreState } from '@/features/store/domain/entities/Store';
import type { Currency } from '@/shared/domain/finance/types';

export type AppLanguage = 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it';

export type AppSettings = {
  activeAccountId?: string;
  activeWorkspace?: 'personal' | 'store';
  preferredCurrency: Currency;
  exchangeRates?: Record<string, number>;
  firstDayOfWeek: 0 | 1;
  dateFormat: 'system' | 'iso';
  language?: AppLanguage;
  theme?: 'dark' | 'light';
  pinHash?: string;
};

export type AppState = {
  schemaVersion: 7;
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  reminders: Reminder[];
  notes: Note[];
  noteFolders: NoteFolder[];
  categories: FinanceCategories;
  store: StoreState;
  settings: AppSettings;
};
