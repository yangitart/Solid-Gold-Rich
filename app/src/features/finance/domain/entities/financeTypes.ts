import type { Note, NoteFolder } from '@/features/notes/domain/entities/Note';
import type { StoreState } from '@/features/store/domain/entities/Store';

export type { Note, NoteFolder } from '@/features/notes/domain/entities/Note';
export type {
  StoreAccount,
  StoreCashMovement,
  StoreCategory,
  StoreClient,
  StoreEmployee,
  StoreProduct,
  StoreProductType,
  StoreSale,
  StoreSaleItem,
  StoreState,
  StoreStockMovement,
  StoreStockMovementType,
  StoreSaleStatus,
  StoreCashMovementType,
  StorePayFrequency,
  StorePayMode,
} from '@/features/store/domain/entities/Store';

export type Currency = string;

export type AccountType = 'cash' | 'bank' | 'card' | 'savings' | 'debt' | 'other';
export type TransactionKind = 'expense' | 'income' | 'adjustment' | 'transfer';
export type TransactionStatus = 'pending' | 'cleared' | 'void';
export type PaymentMethod = 'cash' | 'card' | 'bank' | 'transfer' | 'other';
export type BudgetPeriod = 'monthly' | 'weekly' | 'custom';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type TransactionSplit = {
  id: string;
  category: string;
  amount: number;
  note?: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  kind: TransactionKind;
  amount: number;
  currency: Currency;
  date: string;
  payee: string;
  category: string;
  subcategory?: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  reference: string;
  description: string;
  /** Historical converted value captured when the operation was recorded. */
  baseAmount?: number;
  /** Currency used by baseAmount at the time of the operation. */
  baseCurrency?: Currency;
  splits?: TransactionSplit[];
  transferId?: string;
  recurringId?: string;
  debtId?: string;
  savingsGoalId?: string;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  exchangeRate?: number;
  openingBalance: number;
  color: string;
  archived: boolean;
};

export type Transfer = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number;
  toAmount: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  fee: number;
  date: string;
  note: string;
  status: TransactionStatus;
};

export type Budget = {
  id: string;
  accountId: string;
  category: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  limit: number;
  rollover: boolean;
  rolloverAmount: number;
};

export type RecurringTransaction = {
  id: string;
  accountId: string;
  kind: 'expense' | 'income';
  amount: number;
  currency: Currency;
  payee: string;
  category: string;
  paymentMethod: PaymentMethod;
  frequency: RecurringFrequency;
  nextDate: string;
  dayOfMonth?: number;
  description: string;
  active: boolean;
  lastGeneratedDate?: string;
};

export type DebtPayment = {
  id: string;
  amount: number;
  date: string;
  note: string;
  accountId?: string;
  transactionId?: string;
};

export type Debt = {
  id: string;
  name: string;
  creditor: string;
  accountId?: string;
  currency: Currency;
  originalAmount: number;
  balance: number;
  interestRate: number;
  dueDate: string;
  payments: DebtPayment[];
  active: boolean;
};

export type SavingsContribution = {
  id: string;
  amount: number;
  date: string;
  note: string;
  fromAccountId?: string;
  transferId?: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  currency: Currency;
  targetAmount: number;
  balance: number;
  deadline: string;
  accountId?: string;
  contributions: SavingsContribution[];
  active: boolean;
};

export type Reminder = {
  id: string;
  title: string;
  date: string;
  note: string;
  completed: boolean;
  linkedAccountId?: string;
  linkedTransactionId?: string;
};
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

export type AppLanguage = 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it';

export type FinanceCategory = {
  id: string;
  icon: string;
  name?: string;
  builtIn?: boolean;
};

export type FinanceCategories = {
  expense: FinanceCategory[];
  income: FinanceCategory[];
  tag: FinanceCategory[];
};

export type FinanceState = {
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
