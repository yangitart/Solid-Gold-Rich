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
  description: string;
  active: boolean;
  lastGeneratedDate?: string;
};

export type DebtPayment = {
  id: string;
  amount: number;
  date: string;
  note: string;
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

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  linkedAccountId?: string;
  linkedTransactionId?: string;
  pinned: boolean;
};

export type AppSettings = {
  preferredCurrency: Currency;
  firstDayOfWeek: 0 | 1;
  dateFormat: 'system' | 'iso';
};

export type FinanceCategories = {
  expense: string[];
  income: string[];
};

export type FinanceState = {
  schemaVersion: 2;
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  reminders: Reminder[];
  notes: Note[];
  categories: FinanceCategories;
  settings: AppSettings;
};
