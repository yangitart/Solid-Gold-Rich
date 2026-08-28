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

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  linkedAccountId?: string;
  linkedTransactionId?: string;
  pinned: boolean;
};

export type NoteFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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

export type StoreProductType = 'product' | 'service';
export type StoreStockMovementType = 'initial' | 'entry' | 'exit' | 'adjustment' | 'sale' | 'saleReversal';
export type StoreSaleStatus = 'completed' | 'void';
export type StoreCashMovementType = 'opening' | 'funding' | 'withdrawal' | 'sale' | 'saleReversal' | 'purchase' | 'purchaseReversal' | 'salary';
export type StorePayFrequency = 'weekly' | 'biweekly' | 'monthly';
export type StorePayMode = 'manual' | 'automatic';

export type StoreCategory = {
  id: string;
  name: string;
  builtIn?: boolean;
};

export type StoreProduct = {
  id: string;
  key: string;
  name: string;
  type: StoreProductType;
  unit: string;
  unitAbbreviation?: string;
  categoryId: string;
  sku?: string;
  salePrice: number;
  purchasePrice: number;
  additionalSalePrices: number[];
  picture?: string;
  icon?: string;
  initialStock: number;
  reservedQuantity: number;
  stockMinimum: number;
  expirationDate?: string;
  additionalInfo?: string;
  active: boolean;
};

export type StoreStockMovement = {
  id: string;
  productId: string;
  type: StoreStockMovementType;
  quantity: number;
  date: string;
  note: string;
  saleId?: string;
  cashMovementId?: string;
  personalTransactionId?: string;
};

export type StoreSaleItem = {
  productId: string;
  name: string;
  type: StoreProductType;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type StoreSale = {
  id: string;
  date: string;
  items: StoreSaleItem[];
  total: number;
  paymentMethod?: PaymentMethod;
  status: StoreSaleStatus;
  note: string;
  clientId?: string;
  employeeId?: string;
};

export type StoreCashMovement = {
  id: string;
  type: StoreCashMovementType;
  amount: number;
  date: string;
  note: string;
  transferId?: string;
  saleId?: string;
  productId?: string;
  personalTransactionId?: string;
};

export type StoreAccount = {
  id: 'store-business';
  name: string;
  currency: Currency;
  balance: number;
};

export type StoreEmployee = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  salary: number;
  payFrequency: StorePayFrequency;
  payMode: StorePayMode;
  nextPayDate?: string;
  lastPaidDate?: string;
  active: boolean;
  createdAt: string;
};

export type StoreClient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  active: boolean;
  createdAt: string;
};

export type StoreState = {
  name: string;
  currency: Currency;
  categories: StoreCategory[];
  businessAccount: StoreAccount;
  cashMovements: StoreCashMovement[];
  employees: StoreEmployee[];
  clients: StoreClient[];
  products: StoreProduct[];
  stockMovements: StoreStockMovement[];
  sales: StoreSale[];
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
