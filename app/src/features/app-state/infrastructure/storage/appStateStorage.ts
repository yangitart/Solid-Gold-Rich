import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppLanguage, AppState as FinanceState } from '@/domain/AppState';
import type {
  FinanceCategory,
  FinanceCategories,
  PaymentMethod,
  Transaction,
  TransactionKind,
  TransactionStatus,
} from '@/features/finance/domain/entities/financeTypes';
import type { NoteFolder } from '@/features/notes/domain/entities/Note';
import type { StoreClient, StoreCategory, StoreCashMovement, StoreDefaultOperation, StoreEmployee, StoreProduct, StoreProvider, StoreSale, StoreSaleItem, StoreState, StoreStockMovement } from '@/features/store/domain/entities/Store';
import { captureCurrencySnapshot, currencyRate } from '@/shared/domain/finance/currency';
import { DEFAULT_COLORS } from '@/features/finance/domain/entities/defaultColors';

export { DEFAULT_COLORS } from '@/features/finance/domain/entities/defaultColors';

export const FINANCE_STATE_KEY = '@solid-gold/finance-state-v7';
const FINANCE_STATE_V6_KEY = '@solid-gold/finance-state-v6';
const FINANCE_STATE_V5_KEY = '@solid-gold/finance-state-v5';
const FINANCE_STATE_V3_KEY = '@solid-gold/finance-state-v3';
const FINANCE_STATE_V2_KEY = '@solid-gold/finance-state-v2';
const LEGACY_BUDGETS_KEY = '@solid-gold/budget-accounts-v1';
const LEGACY_ACTIVE_KEY = '@solid-gold/active-budget-v1';
const LEGACY_TRANSACTIONS_KEY = '@solid-gold/transactions';
const LEGACY_BUDGET_KEY = '@solid-gold/monthly-budget';
const LEGACY_DEFAULT_LIMIT = 2500;

export const DEFAULT_STORE_CATEGORIES: StoreCategory[] = [
  { id: 'general', name: 'General', builtIn: true },
  { id: 'food', name: 'Food', builtIn: true },
  { id: 'beverages', name: 'Beverages', builtIn: true },
  { id: 'cleaning', name: 'Cleaning', builtIn: true },
  { id: 'personal-care', name: 'Personal care', builtIn: true },
  { id: 'electronics', name: 'Electronics', builtIn: true },
  { id: 'clothing', name: 'Clothing', builtIn: true },
  { id: 'home', name: 'Home', builtIn: true },
  { id: 'office', name: 'Office', builtIn: true },
  { id: 'services', name: 'Services', builtIn: true },
];
export const DEFAULT_CATEGORIES: FinanceCategories = {
  expense: [
    { id: 'food', icon: 'restaurant-outline', builtIn: true },
    { id: 'housing', icon: 'home-outline', builtIn: true },
    { id: 'transport', icon: 'car-outline', builtIn: true },
    { id: 'shopping', icon: 'cart-outline', builtIn: true },
    { id: 'health', icon: 'medkit-outline', builtIn: true },
    { id: 'other', icon: 'pricetag-outline', builtIn: true },
  ],
  income: [
    { id: 'salary', icon: 'cash-outline', builtIn: true },
    { id: 'business', icon: 'briefcase-outline', builtIn: true },
    { id: 'gift', icon: 'gift-outline', builtIn: true },
    { id: 'refund', icon: 'refresh-outline', builtIn: true },
    { id: 'other', icon: 'pricetag-outline', builtIn: true },
  ],
  tag: [],
};

export const emptyStoreState = (): StoreState => ({
  name: '',
  currency: 'USD',
  categories: DEFAULT_STORE_CATEGORIES.map((category) => ({ ...category })),
  businessAccount: { id: 'store-business', name: 'Business', currency: 'USD', balance: 0 },
  cashMovements: [],
  employees: [],
  clients: [],
  providers: [],
  products: [],
  stockMovements: [],
  sales: [],
});

export const emptyFinanceState = (): FinanceState => ({
  schemaVersion: 7,
  accounts: [],
  transactions: [],
  transfers: [],
  budgets: [],
  recurring: [],
  debts: [],
  savingsGoals: [],
  reminders: [],
  notes: [],
  noteFolders: [],
  categories: cloneCategories(DEFAULT_CATEGORIES),
  store: emptyStoreState(),
  settings: { preferredCurrency: 'USD', exchangeRates: { USD: 1 }, firstDayOfWeek: 1, dateFormat: 'system', activeWorkspace: 'personal', theme: 'dark' },
});

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'es', 'pt', 'fr', 'de', 'it'];

const DEFAULT_CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  [...DEFAULT_CATEGORIES.expense, ...DEFAULT_CATEGORIES.income, ...DEFAULT_CATEGORIES.tag].map((category) => [category.id, category.icon]),
);

function cloneCategories(categories: FinanceCategories): FinanceCategories {
  return {
    expense: categories.expense.map((category) => ({ ...category })),
    income: categories.income.map((category) => ({ ...category })),
    tag: categories.tag.map((category) => ({ ...category })),
  };
}

function normalizeCategory(value: unknown): FinanceCategory | null {
  if (typeof value === 'string') {
    return { id: value, icon: DEFAULT_CATEGORY_ICONS[value] ?? 'pricetag-outline' };
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = text(record.id).trim().toLowerCase();
  if (!id) return null;
  return {
    id,
    icon: text(record.icon, DEFAULT_CATEGORY_ICONS[id] ?? 'pricetag-outline'),
    name: text(record.name).trim() || undefined,
    builtIn: Boolean(record.builtIn),
  };
}

function normalizeCategories(value: unknown, fallback: FinanceCategory[]) {
  const normalized = Array.isArray(value) ? value.map(normalizeCategory).filter((item): item is FinanceCategory => Boolean(item)) : [];
  const defaultIds = new Set(fallback.map((category) => category.id));
  const normalizedById = new Map(normalized.map((category) => [category.id, category]));
  return [
    ...fallback.map((category) => ({ ...category, ...(normalizedById.get(category.id) ?? {}), builtIn: true })),
    ...Array.from(normalizedById.values()).filter((category) => !defaultIds.has(category.id)).map((category) => ({ ...category, builtIn: false })),
  ];
}

function normalizeTransaction(value: Partial<Transaction>, accountId: string): Transaction {
  const kind = value.kind === 'income' || value.kind === 'adjustment' || value.kind === 'transfer'
    ? value.kind
    : 'expense';
  const status: TransactionStatus = value.status === 'pending' || value.status === 'void' ? value.status : 'cleared';
  const paymentMethod: PaymentMethod = ['cash', 'card', 'bank', 'transfer', 'other'].includes(value.paymentMethod ?? '')
    ? (value.paymentMethod as PaymentMethod)
    : 'cash';
  return {
    id: text(value.id, `transaction-${Date.now()}-${Math.random()}`),
    accountId: text(value.accountId, accountId),
    kind: kind as TransactionKind,
    amount: number(value.amount),
    currency: text(value.currency, 'USD').trim().toUpperCase(),
    date: text(value.date, new Date().toISOString()),
    payee: text(value.payee),
    category: text(value.category, 'other'),
    subcategory: text(value.subcategory),
    paymentMethod,
    status,
    reference: text(value.reference),
    description: text(value.description || value.payee),
    baseAmount: Number.isFinite(value.baseAmount) && Number(value.baseAmount) >= 0 ? Number(value.baseAmount) : undefined,
    baseCurrency: text(value.baseCurrency).toUpperCase() || undefined,
    splits: Array.isArray(value.splits) ? value.splits : undefined,
    transferId: text(value.transferId) || undefined,
    recurringId: text(value.recurringId) || undefined,
    debtId: text(value.debtId) || undefined,
    savingsGoalId: text(value.savingsGoalId) || undefined,
  };
}

function slug(value: string, fallback: string) {
  const result = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return result || fallback;
}

function normalizedName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

function normalizeStoreState(value: Partial<StoreState> | undefined, fallbackCurrency = 'USD'): StoreState {
  const source = value && typeof value === 'object' ? value as Partial<StoreState> & Record<string, unknown> : {};
  const storeCurrency = text(source.currency, text(source.businessAccount?.currency, fallbackCurrency)).trim().toUpperCase();
  const rawCategories: unknown[] = Array.isArray(source.categories) ? source.categories as unknown[] : [];
  const categories: StoreCategory[] = DEFAULT_STORE_CATEGORIES.map((category) => ({ ...category }));
  const usedCategoryIds = new Set<string>();
  DEFAULT_STORE_CATEGORIES.forEach((category) => usedCategoryIds.add(category.id));
  const addCategory = (category: StoreCategory) => {
    let id = category.id || 'category';
    let suffix = 2;
    while (usedCategoryIds.has(id)) { id = `${category.id || 'category'}-${suffix}`; suffix += 1; }
    usedCategoryIds.add(id);
    categories.push({ ...category, id });
  };
  rawCategories.forEach((raw, index) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
    const name = typeof raw === 'string' ? raw.trim() : text(record?.name).trim();
    if (!name || name.toLocaleLowerCase() === 'general') return;
    const requestedId = text(record?.id).trim() || slug(name, `category-${index + 1}`);
    if (DEFAULT_STORE_CATEGORIES.some((category) => category.id === requestedId) || categories.some((category) => normalizedName(category.name) === normalizedName(name))) return;
    addCategory({ id: requestedId, name, icon: text(record?.icon).trim() || undefined, builtIn: false });
  });
  const categoryIdFor = (rawId: unknown, rawName: unknown) => {
    const id = text(rawId).trim();
    if (categories.some((item) => item.id === id)) return id;
    const name = text(rawName).trim();
    return categories.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())?.id ?? 'general';
  };
  const products = uniqueById(recordArray(source.products).map((product, index) => {
    const item = product as Partial<StoreProduct> & { category?: unknown; costPrice?: unknown; additionalPrices?: unknown };
    const type = item.type === 'service' ? 'service' : 'product';
    const key = text(item.key, text(item.sku, `product-${index + 1}`)).trim();
    const purchasePrice = number(item.purchasePrice, number(item.costPrice));
    const rawAdditionalPrices = item.additionalSalePrices ?? item.additionalPrices;
    return {
      id: text(item.id, `store-product-${index}`),
      key,
      name: text(item.name, `Product ${index + 1}`),
      type,
      unit: text(item.unit, 'unit'),
      unitAbbreviation: Array.from(text(item.unitAbbreviation).trim()).slice(0, 4).join('') || undefined,
       categoryId: categoryIdFor(item.categoryId, item.category),
       providerId: text(item.providerId) || undefined,
       currency: text(item.currency, storeCurrency).trim().toUpperCase(),
      sku: text(item.sku) || undefined,
      salePrice: Math.max(0, number(item.salePrice)),
      purchasePrice: Math.max(0, purchasePrice),
      additionalSalePrices: Array.isArray(rawAdditionalPrices) ? rawAdditionalPrices.map((price) => number(price)).filter((price) => price >= 0) : [],
      picture: text(item.picture) || undefined,
      icon: text(item.icon) || undefined,
      initialStock: Math.max(0, number(item.initialStock)),
      reservedQuantity: Math.max(0, number(item.reservedQuantity)),
      stockMinimum: Math.max(0, number(item.stockMinimum)),
      expirationDate: text(item.expirationDate) || undefined,
      additionalInfo: text(item.additionalInfo) || undefined,
      active: item.active !== false,
    } satisfies StoreProduct;
  }));
  const productIds = new Set(products.map((product) => product.id));
  const stockMovements = uniqueById(recordArray(source.stockMovements).map((movement, index) => {
    const item = movement as Partial<StoreStockMovement>;
    const type: StoreStockMovement['type'] = ['initial', 'entry', 'exit', 'adjustment', 'sale', 'saleReversal'].includes(item.type ?? '')
      ? item.type as StoreStockMovement['type'] : 'adjustment';
    return {
      id: text(item.id, `store-stock-${index}`),
      productId: text(item.productId),
      type,
      quantity: number(item.quantity),
      date: text(item.date, new Date().toISOString()),
      note: text(item.note),
      providerId: text(item.providerId) || undefined,
      clientId: text(item.clientId) || undefined,
      saleId: text(item.saleId) || undefined,
      cashMovementId: text(item.cashMovementId) || undefined,
      personalTransactionId: text(item.personalTransactionId) || undefined,
    } satisfies StoreStockMovement;
  }));
  const sales = uniqueById(recordArray(source.sales).map((sale, index) => {
    const item = sale as Partial<StoreSale>;
    const items: StoreSaleItem[] = recordArray(item.items).map((line) => ({
      productId: text(line.productId),
      name: text(line.name, 'Product'),
      type: (line.type === 'service' ? 'service' : 'product') as StoreSaleItem['type'],
      quantity: Math.max(0, number(line.quantity)),
      unitPrice: Math.max(0, number(line.unitPrice)),
      total: Math.max(0, number(line.total, number(line.quantity) * number(line.unitPrice))),
    })).filter((line) => line.quantity > 0);
    const paymentMethod = ['cash', 'card', 'bank', 'transfer', 'other'].includes(item.paymentMethod ?? '')
      ? item.paymentMethod as PaymentMethod : undefined;
    return {
      id: text(item.id, `store-sale-${index}`),
      date: text(item.date, new Date().toISOString()),
      items,
      total: Math.max(0, number(item.total, items.reduce((sum, line) => sum + line.total, 0))),
      currency: text(item.currency, storeCurrency).trim().toUpperCase(),
      paymentMethod,
      status: item.status === 'void' ? 'void' : 'completed',
      note: text(item.note),
      clientId: text(item.clientId) || undefined,
      employeeId: text(item.employeeId) || undefined,
    } satisfies StoreSale;
  }).filter((sale) => sale.items.length > 0));
  const employees = uniqueById(recordArray(source.employees).map((employee, index) => {
    const item = employee as Partial<StoreEmployee>;
    return {
      id: text(item.id, `store-employee-${index}`),
      name: text(item.name, `Employee ${index + 1}`),
      role: text(item.role) || undefined,
      phone: text(item.phone) || undefined,
      salary: Math.max(0, number(item.salary)),
      salaryCurrency: text(item.salaryCurrency, storeCurrency).trim().toUpperCase(),
      payFrequency: ['weekly', 'biweekly', 'monthly'].includes(item.payFrequency ?? '') ? item.payFrequency as StoreEmployee['payFrequency'] : 'monthly',
      payMode: item.payMode === 'automatic' ? 'automatic' : 'manual',
      nextPayDate: text(item.nextPayDate) || undefined,
      lastPaidDate: text(item.lastPaidDate) || undefined,
      active: item.active !== false,
      createdAt: text(item.createdAt, new Date().toISOString()),
    } satisfies StoreEmployee;
  }));
  const clients = uniqueById(recordArray(source.clients).map((client, index) => {
    const item = client as Partial<StoreClient>;
    return {
      id: text(item.id, `store-client-${index}`),
      name: text(item.name, `Client ${index + 1}`),
      phone: text(item.phone) || undefined,
      email: text(item.email) || undefined,
      note: text(item.note) || undefined,
      defaultOperations: recordArray(item.defaultOperations).map((operation, operationIndex) => {
        const value = operation as Partial<StoreDefaultOperation>;
        return { id: text(value.id, `store-client-operation-${index}-${operationIndex}`), productId: text(value.productId), quantity: Math.max(0, number(value.quantity)) } satisfies StoreDefaultOperation;
      }).filter((operation) => productIds.has(operation.productId) && operation.quantity > 0),
      active: item.active !== false,
      createdAt: text(item.createdAt, new Date().toISOString()),
    } satisfies StoreClient;
  }));
  const providers = uniqueById(recordArray(source.providers).map((provider, index) => {
    const item = provider as Partial<StoreProvider>;
    return {
      id: text(item.id, `store-provider-${index}`),
      name: text(item.name, `Provider ${index + 1}`),
      phone: text(item.phone) || undefined,
      email: text(item.email) || undefined,
      note: text(item.note) || undefined,
      defaultOperations: recordArray(item.defaultOperations).map((operation, operationIndex) => {
        const value = operation as Partial<StoreDefaultOperation>;
        return { id: text(value.id, `store-provider-operation-${index}-${operationIndex}`), productId: text(value.productId), quantity: Math.max(0, number(value.quantity)) } satisfies StoreDefaultOperation;
      }).filter((operation) => productIds.has(operation.productId) && operation.quantity > 0),
      active: item.active !== false,
      createdAt: text(item.createdAt, new Date().toISOString()),
    } satisfies StoreProvider;
  }));
  const rawBalance = number(source.businessAccount?.balance);
  const cashMovements: StoreCashMovement[] = uniqueById(recordArray(source.cashMovements).map((movement, index) => {
    const item = movement as Partial<StoreCashMovement>;
    const type = ['opening', 'funding', 'withdrawal', 'sale', 'saleReversal', 'purchase', 'purchaseReversal', 'salary'].includes(item.type ?? '')
      ? item.type as StoreCashMovement['type'] : 'opening';
    return {
      id: text(item.id, `store-cash-${index}`),
      type,
      amount: number(item.amount),
      currency: text(item.currency, storeCurrency).trim().toUpperCase(),
      date: text(item.date, new Date().toISOString()),
      note: text(item.note),
      transferId: text(item.transferId) || undefined,
      saleId: text(item.saleId) || undefined,
      productId: text(item.productId) || undefined,
      personalTransactionId: text(item.personalTransactionId) || undefined,
    };
  }).filter((movement) => movement.amount !== 0));
  if (!cashMovements.length && rawBalance !== 0) {
    cashMovements.push({ id: 'store-cash-opening-v5', type: 'opening', amount: rawBalance, currency: storeCurrency, date: new Date().toISOString(), note: '' });
  }
  const businessBalance = cashMovements.reduce((total, movement) => total + movement.amount, 0);
  const storeName = text(source.name, text(source.businessAccount?.name));
  return {
    name: storeName,
    currency: storeCurrency,
    categories,
    businessAccount: {
      id: 'store-business',
      name: text(source.businessAccount?.name, storeName || 'Business'),
      currency: storeCurrency,
      balance: businessBalance,
    },
    cashMovements,
    employees,
    clients,
    providers,
    products,
    stockMovements,
    sales,
  };
}

export function normalizeFinanceState(value: Partial<FinanceState>): FinanceState {
  const sourceSchemaVersion = number(value.schemaVersion);
  const state = emptyFinanceState();
  state.accounts = uniqueById(recordArray(value.accounts).map((account, index) => ({
    id: text(account.id, `account-${index}`),
    name: text(account.name, `Account ${index + 1}`),
    type: ['cash', 'bank', 'card', 'savings', 'debt'].includes(text(account.type)) ? text(account.type) as FinanceState['accounts'][number]['type'] : 'other',
    currency: text(account.currency, 'USD').trim().toUpperCase(),
    exchangeRate: typeof account.exchangeRate === 'number' && Number.isFinite(account.exchangeRate) && account.exchangeRate > 0 ? account.exchangeRate : undefined,
    openingBalance: number(account.openingBalance),
    color: text(account.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
    archived: Boolean(account.archived),
  })) as FinanceState['accounts']);
  const firstAccountId = state.accounts[0]?.id ?? 'personal';
  const accountIds = new Set(state.accounts.map((account) => account.id));
  state.transactions = uniqueById(recordArray(value.transactions)
    .map((item) => normalizeTransaction(item, firstAccountId))
    .filter((item) => accountIds.has(item.accountId) && item.amount >= 0));
  state.transfers = uniqueById(recordArray(value.transfers).map((item, index) => ({
    id: text(item.id, `transfer-${index}`), fromAccountId: text(item.fromAccountId), toAccountId: text(item.toAccountId),
    fromAmount: Math.max(0, number(item.fromAmount)), toAmount: Math.max(0, number(item.toAmount)),
    fromCurrency: text(item.fromCurrency, 'USD').trim().toUpperCase(), toCurrency: text(item.toCurrency, 'USD').trim().toUpperCase(), rate: Math.max(0, number(item.rate)), fee: Math.max(0, number(item.fee)),
    date: text(item.date, new Date().toISOString()), note: text(item.note), status: item.status === 'pending' || item.status === 'void' ? item.status : 'cleared',
  } satisfies FinanceState['transfers'][number])).filter((item) => item.fromAccountId !== item.toAccountId
    && (accountIds.has(item.fromAccountId) || item.fromAccountId === 'store-business')
    && (accountIds.has(item.toAccountId) || item.toAccountId === 'store-business')
    && item.fromAmount > 0 && item.toAmount > 0 && item.rate > 0));
  state.budgets = uniqueById(recordArray(value.budgets).map((item, index) => ({
    id: text(item.id, `budget-${index}`), accountId: text(item.accountId), category: text(item.category, 'other'),
    period: item.period === 'weekly' || item.period === 'custom' ? item.period : 'monthly',
    startDate: text(item.startDate, new Date().toISOString()), endDate: text(item.endDate, new Date().toISOString()),
    limit: Math.max(0, number(item.limit)), rollover: false, rolloverAmount: 0,
  } satisfies FinanceState['budgets'][number])).filter((item) => {
    const isAutomaticLegacyLimit = sourceSchemaVersion < 6
      && item.limit === LEGACY_DEFAULT_LIMIT
      && item.category === 'all'
      && item.id.startsWith('budget-')
      && item.id.endsWith('-total');
    return accountIds.has(item.accountId) && item.limit > 0 && !isAutomaticLegacyLimit;
  }));
  state.recurring = uniqueById(recordArray(value.recurring).map((item, index) => ({
    id: text(item.id, `recurring-${index}`), accountId: text(item.accountId), kind: item.kind === 'income' ? 'income' : 'expense',
    amount: Math.max(0, number(item.amount)), currency: text(item.currency, 'USD').trim().toUpperCase(), payee: text(item.payee), category: text(item.category, 'other'),
    paymentMethod: ['cash', 'card', 'bank', 'transfer', 'other'].includes(text(item.paymentMethod)) ? item.paymentMethod as PaymentMethod : 'cash',
    frequency: ['daily', 'weekly', 'monthly', 'yearly'].includes(text(item.frequency)) ? item.frequency as FinanceState['recurring'][number]['frequency'] : 'monthly',
    nextDate: text(item.nextDate, new Date().toISOString()), dayOfMonth: Math.min(31, Math.max(1, number(item.dayOfMonth, new Date(text(item.nextDate, new Date().toISOString())).getDate()))), description: text(item.description), active: item.active !== false,
    lastGeneratedDate: text(item.lastGeneratedDate) || undefined,
  } satisfies FinanceState['recurring'][number])).filter((item) => accountIds.has(item.accountId) && item.amount > 0));
  state.debts = uniqueById(recordArray(value.debts).map((item, index) => {
    const originalAmount = Math.max(0, number(item.originalAmount));
    return {
      id: text(item.id, `debt-${index}`), name: text(item.name, `Debt ${index + 1}`), creditor: text(item.creditor), accountId: accountIds.has(text(item.accountId)) ? text(item.accountId) : undefined,
      currency: text(item.currency, 'USD').trim().toUpperCase(), originalAmount, balance: Math.min(originalAmount, Math.max(0, number(item.balance, originalAmount))), interestRate: Math.max(0, number(item.interestRate)),
      dueDate: text(item.dueDate, new Date().toISOString()), active: item.active !== false,
      payments: uniqueById(recordArray(item.payments).map((payment, paymentIndex) => ({ id: text(payment.id, `debt-payment-${index}-${paymentIndex}`), amount: Math.max(0, number(payment.amount)), date: text(payment.date, new Date().toISOString()), note: text(payment.note), accountId: accountIds.has(text(payment.accountId)) ? text(payment.accountId) : undefined, transactionId: text(payment.transactionId) || undefined })).filter((payment) => payment.amount > 0)),
    };
  }).filter((item) => item.originalAmount > 0));
  state.savingsGoals = uniqueById(recordArray(value.savingsGoals).map((item, index) => ({
    id: text(item.id, `savings-${index}`), name: text(item.name, `Goal ${index + 1}`), currency: text(item.currency, 'USD').trim().toUpperCase(), targetAmount: Math.max(0, number(item.targetAmount)), balance: Math.max(0, number(item.balance)), deadline: text(item.deadline, new Date().toISOString()), accountId: accountIds.has(text(item.accountId)) ? text(item.accountId) : undefined, active: item.active !== false,
    contributions: uniqueById(recordArray(item.contributions).map((contribution, contributionIndex) => ({ id: text(contribution.id, `contribution-${index}-${contributionIndex}`), amount: Math.max(0, number(contribution.amount)), date: text(contribution.date, new Date().toISOString()), note: text(contribution.note), fromAccountId: accountIds.has(text(contribution.fromAccountId)) ? text(contribution.fromAccountId) : undefined, transferId: text(contribution.transferId) || undefined })).filter((contribution) => contribution.amount > 0)),
  })).filter((item) => item.targetAmount > 0));
  state.reminders = uniqueById(recordArray(value.reminders).map((item, index) => ({ id: text(item.id, `reminder-${index}`), title: text(item.title, `Reminder ${index + 1}`), date: text(item.date, new Date().toISOString()), note: text(item.note), completed: Boolean(item.completed), linkedAccountId: accountIds.has(text(item.linkedAccountId)) ? text(item.linkedAccountId) : undefined, linkedTransactionId: text(item.linkedTransactionId) || undefined })));
  state.notes = uniqueById(recordArray(value.notes).map((item, index) => ({ id: text(item.id, `note-${index}`), title: text(item.title), body: text(item.body), tags: Array.isArray(item.tags) ? item.tags.map((tag) => text(tag)).filter(Boolean) : [], folderId: text(item.folderId) || undefined, createdAt: text(item.createdAt, new Date().toISOString()), updatedAt: text(item.updatedAt, new Date().toISOString()), linkedAccountId: accountIds.has(text(item.linkedAccountId)) ? text(item.linkedAccountId) : undefined, linkedTransactionId: text(item.linkedTransactionId) || undefined, pinned: Boolean(item.pinned) })));
  state.noteFolders = uniqueById(recordArray(value.noteFolders).filter((folder) => Boolean(text(folder.id).trim()) && Boolean(text(folder.name).trim())).map((folder) => ({ id: text(folder.id), name: text(folder.name), parentFolderId: text(folder.parentFolderId) || undefined, createdAt: text(folder.createdAt, new Date().toISOString()), updatedAt: text(folder.updatedAt, new Date().toISOString()) } satisfies NoteFolder)));
  const folderIds = new Set(state.noteFolders.map((folder) => folder.id));
  state.noteFolders = state.noteFolders.map((folder) => folder.parentFolderId && folder.parentFolderId !== folder.id && folderIds.has(folder.parentFolderId) ? folder : { ...folder, parentFolderId: undefined });
  state.notes = state.notes.map((note) => note.folderId && !folderIds.has(note.folderId) ? { ...note, folderId: undefined } : note);
  state.categories = {
    expense: normalizeCategories(value.categories?.expense, DEFAULT_CATEGORIES.expense),
    income: normalizeCategories(value.categories?.income, DEFAULT_CATEGORIES.income),
    tag: normalizeCategories(value.categories?.tag, DEFAULT_CATEGORIES.tag),
  };
  (['expense', 'income'] as const).forEach((type) => {
    const configuredIds = new Set(state.categories[type].map((category) => category.id));
    const usedIds = new Set([
      ...state.transactions.filter((transaction) => transaction.kind === type && !transaction.transferId).map((transaction) => transaction.category),
      ...state.recurring.filter((transaction) => transaction.kind === type).map((transaction) => transaction.category),
    ].filter(Boolean));
    usedIds.forEach((id) => {
      if (!configuredIds.has(id)) state.categories[type].push({ id, icon: DEFAULT_CATEGORY_ICONS[id] ?? 'pricetag-outline', builtIn: false });
    });
  });
  state.store = normalizeStoreState(value.store, text(value.settings?.preferredCurrency, 'USD').trim().toUpperCase());
  const exchangeRates = Object.entries(value.settings?.exchangeRates ?? {}).reduce<Record<string, number>>((all, [currency, rate]) => {
    if (Number.isFinite(rate) && rate > 0) all[currency.toUpperCase()] = rate;
    return all;
  }, { USD: 1 });
  state.settings = {
    ...state.settings,
    ...(value.settings ?? {}),
    preferredCurrency: text(value.settings?.preferredCurrency, 'USD').trim().toUpperCase(),
    exchangeRates,
    language: SUPPORTED_LANGUAGES.includes(value.settings?.language as AppLanguage) ? value.settings?.language as AppLanguage : undefined,
    theme: value.settings?.theme === 'light' ? 'light' : 'dark',
    pinHash: text(value.settings?.pinHash) || undefined,
    activeAccountId: state.accounts.some((account) => account.id === value.settings?.activeAccountId)
      ? value.settings?.activeAccountId
      : state.accounts.find((account) => !account.archived)?.id,
    activeWorkspace: value.settings?.activeWorkspace === 'store' ? 'store' : 'personal',
  };
  state.transactions = state.transactions.map((transaction) => {
    if (Number.isFinite(transaction.baseAmount) && transaction.baseCurrency) return transaction;
    return { ...transaction, ...captureCurrencySnapshot(transaction.amount, transaction.currency, state.settings.preferredCurrency, exchangeRates) };
  });
  state.store.businessAccount = {
    ...state.store.businessAccount,
    currency: state.store.currency,
    balance: state.store.cashMovements.reduce((total, movement) => {
      const rate = currencyRate(movement.currency ?? state.store.currency, state.store.currency, exchangeRates);
      return total + movement.amount * (rate ?? 1);
    }, 0),
  };
  state.schemaVersion = 7;
  return state;
}

function migrateLegacy(
  legacyBudgets: string | null,
  legacyActiveId: string | null,
  legacyTransactions: string | null,
  legacyLimit: string | null,
): FinanceState {
  const state = emptyFinanceState();
  const hasLegacyData = Boolean(legacyBudgets || legacyActiveId || legacyTransactions || legacyLimit);
  if (!hasLegacyData) return state;
  let parsedBudgets: Record<string, unknown>[] = [];
  try {
    const parsed = legacyBudgets ? JSON.parse(legacyBudgets) : [];
    if (Array.isArray(parsed)) parsedBudgets = parsed;
  } catch {
    parsedBudgets = [];
  }

  if (parsedBudgets.length === 0) {
    parsedBudgets = [{ id: 'personal', name: 'Personal', openingBalance: 0, limit: number(legacyLimit), color: DEFAULT_COLORS[0], transactions: [] }];
  }

  state.accounts = parsedBudgets.map((budget, index) => ({
    id: text(budget.id, `account-${index}`),
    name: text(budget.name, index === 0 ? 'Personal' : `Personal ${index + 1}`),
    type: ['cash', 'bank', 'card', 'savings', 'debt', 'other'].includes(text(budget.type)) ? text(budget.type) as FinanceState['accounts'][number]['type'] : 'cash',
    currency: text(budget.currency, 'USD').trim().toUpperCase(),
    exchangeRate: number(budget.exchangeRate) > 0 ? number(budget.exchangeRate) : undefined,
    openingBalance: number(budget.openingBalance),
    color: text(budget.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
    archived: false,
  }));

  let legacyItems: Record<string, unknown>[] = [];
  try {
    const parsed = legacyTransactions ? JSON.parse(legacyTransactions) : null;
    const standaloneItems = Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
    const nestedItems: Record<string, unknown>[] = parsedBudgets.flatMap((budget) => Array.isArray(budget.transactions)
      ? budget.transactions.map((item): Record<string, unknown> => ({ ...(item as Record<string, unknown>), accountId: text((item as Record<string, unknown>).accountId, text(budget.id)) }))
      : []);
    const standaloneIds = new Set(standaloneItems.map((item) => text(item.id)).filter(Boolean));
    legacyItems = [...standaloneItems, ...nestedItems.filter((item) => !standaloneIds.has(text(item.id)))];
  } catch {
    legacyItems = [];
  }
  const defaultAccountId = text(legacyActiveId, state.accounts[0]?.id ?? 'personal');
  state.transactions = legacyItems.map((item, index) => normalizeTransaction({
    id: text(item.id, `legacy-${index}`),
    accountId: text(item.accountId, defaultAccountId),
    kind: item.kind === 'income' ? 'income' : 'expense',
    amount: number(item.amount),
    currency: text(item.currency, state.accounts.find((account) => account.id === text(item.accountId, defaultAccountId))?.currency ?? 'USD').trim().toUpperCase(),
    date: text(item.date, new Date().toISOString()),
    payee: text(item.title),
    description: text(item.title),
    category: text(item.category, 'other'),
    paymentMethod: 'cash',
    status: 'cleared',
    reference: '',
  }, defaultAccountId));

  for (const account of state.accounts) {
    const budget = parsedBudgets.find((item) => text(item.id) === account.id);
    const limit = number(budget?.limit, number(legacyLimit));
    if (limit > 0 && limit !== LEGACY_DEFAULT_LIMIT) {
      state.budgets.push({
        id: `budget-${account.id}-total`,
        accountId: account.id,
        category: 'all',
        period: 'monthly',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
        limit,
        rollover: false,
        rolloverAmount: 0,
      });
    }
  }
  state.settings.preferredCurrency = state.accounts[0]?.currency ?? 'USD';
  state.settings.activeAccountId = state.accounts.some((account) => account.id === legacyActiveId)
    ? legacyActiveId ?? undefined
    : state.accounts[0]?.id;
  return state;
}

function mergeById<T extends { id: string }>(preferred: T[], fallback: T[]) {
  const ids = new Set(preferred.map((item) => item.id));
  return [...preferred, ...fallback.filter((item) => !ids.has(item.id))];
}

export async function loadFinanceState() {
  const [savedV7, savedV6, savedV5, savedV3, savedV2, budgets, activeId, transactions, limit] = await Promise.all([
    AsyncStorage.getItem(FINANCE_STATE_KEY),
    AsyncStorage.getItem(FINANCE_STATE_V6_KEY),
    AsyncStorage.getItem(FINANCE_STATE_V5_KEY),
    AsyncStorage.getItem(FINANCE_STATE_V3_KEY),
    AsyncStorage.getItem(FINANCE_STATE_V2_KEY),
    AsyncStorage.getItem(LEGACY_BUDGETS_KEY),
    AsyncStorage.getItem(LEGACY_ACTIVE_KEY),
    AsyncStorage.getItem(LEGACY_TRANSACTIONS_KEY),
    AsyncStorage.getItem(LEGACY_BUDGET_KEY),
  ]);
  const parseSaved = (saved: string | null) => {
    if (!saved) return null;
    try {
      return normalizeFinanceState(JSON.parse(saved) as Partial<FinanceState>);
    } catch {
      return null;
    }
  };
  const v7State = parseSaved(savedV7);
  const v6State = parseSaved(savedV6);
  const v5State = parseSaved(savedV5);
  const v3State = parseSaved(savedV3);
  const v2State = parseSaved(savedV2);
  const legacyState = migrateLegacy(budgets, activeId, transactions, limit);
  const savedState = v7State ?? v6State ?? v5State ?? v3State ?? v2State;
  if (!savedState) return legacyState;
  const olderState = savedState === v7State ? v6State ?? v5State ?? v3State ?? v2State ?? legacyState : savedState === v6State ? v5State ?? v3State ?? v2State ?? legacyState : savedState === v5State ? v3State ?? v2State ?? legacyState : savedState === v3State ? v2State ?? legacyState : legacyState;
  const merged = {
    ...savedState,
    schemaVersion: 7 as const,
    accounts: mergeById(savedState.accounts, mergeById(olderState.accounts, legacyState.accounts)),
    transactions: mergeById(savedState.transactions, mergeById(olderState.transactions, legacyState.transactions)),
    transfers: mergeById(savedState.transfers, olderState.transfers),
    budgets: mergeById(savedState.budgets, mergeById(olderState.budgets, legacyState.budgets)),
    recurring: mergeById(savedState.recurring, olderState.recurring),
    debts: mergeById(savedState.debts, olderState.debts),
    savingsGoals: mergeById(savedState.savingsGoals, olderState.savingsGoals),
    reminders: mergeById(savedState.reminders, olderState.reminders),
    notes: mergeById(savedState.notes, olderState.notes),
    noteFolders: mergeById(savedState.noteFolders, olderState.noteFolders),
    store: savedState.store ?? olderState.store ?? emptyStoreState(),
  };
  if (!merged.settings.activeAccountId && legacyState.settings.activeAccountId) merged.settings.activeAccountId = legacyState.settings.activeAccountId;
  return normalizeFinanceState(merged);
}

export async function saveFinanceState(state: FinanceState) {
  const serialized = JSON.stringify(normalizeFinanceState(state));
  await AsyncStorage.setItem(FINANCE_STATE_KEY, serialized);
  const verified = await AsyncStorage.getItem(FINANCE_STATE_KEY);
  if (verified !== serialized) throw new Error('Local data verification failed.');
  await AsyncStorage.multiRemove([FINANCE_STATE_V6_KEY, FINANCE_STATE_V5_KEY, FINANCE_STATE_V3_KEY, FINANCE_STATE_V2_KEY, LEGACY_BUDGETS_KEY, LEGACY_ACTIVE_KEY, LEGACY_TRANSACTIONS_KEY, LEGACY_BUDGET_KEY]);
}

export function exportJson(state: FinanceState) {
  return JSON.stringify(state, null, 2);
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const pushCell = () => { row.push(cell.trim()); cell = ''; };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value !== '')) records.push(row);
    row = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = false;
      } else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') pushCell();
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      pushRow();
    } else cell += character;
  }
  if (quoted) throw new Error('invalid-csv');
  if (cell !== '' || row.length) pushRow();
  return records;
}

export function importCsv(csv: string, accountId: string, fallbackCurrency: string) {
  let records: string[][];
  try {
    records = parseCsvRecords(csv);
  } catch {
    return { items: [] as Transaction[], errors: ['header'] };
  }
  if (records.length < 2) return { items: [] as Transaction[], errors: ['header'] };
  const [headers, ...rows] = records;
  const normalizedHeaders = headers.map((header, headerIndex) => (headerIndex === 0 ? header.replace(/^\uFEFF/, '') : header).trim());
  const index = (name: string) => normalizedHeaders.indexOf(name);
  if (index('date') < 0 || index('kind') < 0 || index('amount') < 0 || index('currency') < 0) return { items: [] as Transaction[], errors: ['header'] };
  const errors: string[] = [];
  const items: Transaction[] = [];
  for (const [rowIndex, cells] of rows.entries()) {
    const amountValue = cells[index('amount')];
    const amount = number(amountValue);
    if (!amountValue?.trim() || !Number.isFinite(Number(amountValue)) || amount <= 0) {
      errors.push(`row:${rowIndex + 2}:amount`);
      continue;
    }
    const kind = cells[index('kind')] === 'income' ? 'income' : 'expense';
    items.push(normalizeTransaction({
      id: `csv-${Date.now()}-${rowIndex}`,
      accountId,
      kind,
      amount,
      currency: (cells[index('currency')] || fallbackCurrency).trim().toUpperCase(),
      date: cells[index('date')] || new Date().toISOString(),
      payee: cells[index('payee')],
      category: cells[index('category')] || 'other',
      paymentMethod: cells[index('paymentMethod')] as PaymentMethod,
      status: cells[index('status')] as TransactionStatus,
      reference: cells[index('reference')],
      description: cells[index('description')],
      baseAmount: index('baseAmount') >= 0 && cells[index('baseAmount')]?.trim() && Number.isFinite(Number(cells[index('baseAmount')])) && Number(cells[index('baseAmount')]) >= 0 ? Number(cells[index('baseAmount')]) : undefined,
      baseCurrency: index('baseCurrency') >= 0 ? cells[index('baseCurrency')]?.trim().toUpperCase() : undefined,
    }, accountId));
  }
  return { items, errors };
}
