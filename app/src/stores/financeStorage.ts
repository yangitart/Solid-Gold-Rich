import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppLanguage,
  FinanceCategory,
  FinanceCategories,
  FinanceState,
  NoteFolder,
  PaymentMethod,
  StoreClient,
  StoreEmployee,
  StoreProduct,
  StoreSale,
  StoreSaleItem,
  StoreState,
  StoreStockMovement,
  Transaction,
  TransactionKind,
  TransactionStatus,
} from '../core/finance/types';

export const FINANCE_STATE_KEY = '@solid-gold/finance-state-v3';
const FINANCE_STATE_V2_KEY = '@solid-gold/finance-state-v2';
const LEGACY_BUDGETS_KEY = '@solid-gold/budget-accounts-v1';
const LEGACY_ACTIVE_KEY = '@solid-gold/active-budget-v1';
const LEGACY_TRANSACTIONS_KEY = '@solid-gold/transactions';
const LEGACY_BUDGET_KEY = '@solid-gold/monthly-budget';

export const DEFAULT_COLORS = ['#E9C877', '#B7AD84', '#80B9FF', '#D99BEF', '#F08B88'];
export const DEFAULT_CATEGORIES: FinanceCategories = {
  expense: [
    { id: 'food', icon: 'restaurant-outline' },
    { id: 'housing', icon: 'home-outline' },
    { id: 'transport', icon: 'car-outline' },
    { id: 'shopping', icon: 'cart-outline' },
    { id: 'health', icon: 'medkit-outline' },
    { id: 'other', icon: 'pricetag-outline' },
  ],
  income: [
    { id: 'salary', icon: 'cash-outline' },
    { id: 'business', icon: 'briefcase-outline' },
    { id: 'gift', icon: 'gift-outline' },
    { id: 'refund', icon: 'refresh-outline' },
    { id: 'other', icon: 'pricetag-outline' },
  ],
  tag: [],
};

export const emptyStoreState = (): StoreState => ({
  setupCompleted: false,
  name: '',
  currency: 'USD',
  categories: [],
  businessAccount: { id: 'store-business', name: 'Business', currency: 'USD', balance: 0 },
  employees: [],
  clients: [],
  products: [],
  stockMovements: [],
  sales: [],
});

export const emptyFinanceState = (): FinanceState => ({
  schemaVersion: 4,
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
  settings: { preferredCurrency: 'USD', exchangeRates: { USD: 1 }, firstDayOfWeek: 1, dateFormat: 'system', activeWorkspace: 'personal' },
});

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
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
  return { id, icon: text(record.icon, DEFAULT_CATEGORY_ICONS[id] ?? 'pricetag-outline') };
}

function normalizeCategories(value: unknown, fallback: FinanceCategory[]) {
  const normalized = Array.isArray(value) ? value.map(normalizeCategory).filter((item): item is FinanceCategory => Boolean(item)) : [];
  return normalized.length ? normalized : fallback.map((category) => ({ ...category }));
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
    currency: text(value.currency, 'USD'),
    date: text(value.date, new Date().toISOString()),
    payee: text(value.payee),
    category: text(value.category, 'other'),
    subcategory: text(value.subcategory),
    paymentMethod,
    status,
    reference: text(value.reference),
    description: text(value.description || value.payee),
    splits: Array.isArray(value.splits) ? value.splits : undefined,
    transferId: text(value.transferId) || undefined,
    recurringId: text(value.recurringId) || undefined,
    debtId: text(value.debtId) || undefined,
    savingsGoalId: text(value.savingsGoalId) || undefined,
  };
}

function normalizeStoreState(value: Partial<StoreState> | undefined): StoreState {
  const source = value && typeof value === 'object' ? value : {};
  const products = Array.isArray(source.products) ? source.products.map((product, index) => {
    const item = product as Partial<StoreProduct>;
    const type = item.type === 'service' ? 'service' : 'product';
    const key = text(item.key, text(item.sku, `product-${index + 1}`)).trim();
    const purchasePrice = number((item as Partial<StoreProduct> & { costPrice?: unknown }).purchasePrice, number((item as Partial<StoreProduct> & { costPrice?: unknown }).costPrice));
    const rawAdditionalPrices = (item as Partial<StoreProduct> & { additionalPrices?: unknown }).additionalSalePrices ?? (item as Partial<StoreProduct> & { additionalPrices?: unknown }).additionalPrices;
    return {
      id: text(item.id, `store-product-${index}`),
      key,
      name: text(item.name, `Product ${index + 1}`),
      type,
      unit: text(item.unit, 'unit'),
      category: text(item.category, 'other'),
      sku: text(item.sku) || undefined,
      salePrice: number(item.salePrice),
      purchasePrice,
      additionalSalePrices: Array.isArray(rawAdditionalPrices) ? rawAdditionalPrices.map((price) => number(price)).filter((price) => price >= 0) : [],
      picture: text(item.picture) || undefined,
      initialStock: Math.max(0, number(item.initialStock)),
      reservedQuantity: Math.max(0, number(item.reservedQuantity)),
      stockMinimum: Math.max(0, number(item.stockMinimum)),
      expirationDate: text(item.expirationDate) || undefined,
      additionalInfo: text(item.additionalInfo) || undefined,
      active: item.active !== false,
    } satisfies StoreProduct;
  }) : [];
  const productIds = new Set(products.map((product) => product.id));
  const stockMovements = Array.isArray(source.stockMovements) ? source.stockMovements.map((movement, index) => {
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
      saleId: text(item.saleId) || undefined,
    } satisfies StoreStockMovement;
  }).filter((movement) => productIds.has(movement.productId)) : [];
  const sales = Array.isArray(source.sales) ? source.sales.map((sale, index) => {
    const item = sale as Partial<StoreSale>;
    const items: StoreSaleItem[] = Array.isArray(item.items) ? item.items.map((line) => ({
      productId: text(line.productId),
      name: text(line.name, 'Product'),
      type: (line.type === 'service' ? 'service' : 'product') as StoreSaleItem['type'],
      quantity: Math.max(0, number(line.quantity)),
      unitPrice: Math.max(0, number(line.unitPrice)),
      total: Math.max(0, number(line.total, number(line.quantity) * number(line.unitPrice))),
    })) : [];
    const paymentMethod = ['cash', 'card', 'bank', 'transfer', 'other'].includes(item.paymentMethod ?? '')
      ? item.paymentMethod as PaymentMethod : undefined;
    return {
      id: text(item.id, `store-sale-${index}`),
      date: text(item.date, new Date().toISOString()),
      items,
      total: Math.max(0, number(item.total, items.reduce((sum, line) => sum + line.total, 0))),
      paymentMethod,
      status: item.status === 'void' ? 'void' : 'completed',
      note: text(item.note),
    } satisfies StoreSale;
  }) : [];
  const employees = Array.isArray(source.employees) ? source.employees.map((employee, index) => {
    const item = employee as Partial<StoreEmployee>;
    return {
      id: text(item.id, `store-employee-${index}`),
      name: text(item.name, `Employee ${index + 1}`),
      role: text(item.role) || undefined,
      phone: text(item.phone) || undefined,
      active: item.active !== false,
      createdAt: text(item.createdAt, new Date().toISOString()),
    } satisfies StoreEmployee;
  }) : [];
  const clients = Array.isArray(source.clients) ? source.clients.map((client, index) => {
    const item = client as Partial<StoreClient>;
    return {
      id: text(item.id, `store-client-${index}`),
      name: text(item.name, `Client ${index + 1}`),
      phone: text(item.phone) || undefined,
      email: text(item.email) || undefined,
      note: text(item.note) || undefined,
      active: item.active !== false,
      createdAt: text(item.createdAt, new Date().toISOString()),
    } satisfies StoreClient;
  }) : [];
  return {
    setupCompleted: Boolean(source.setupCompleted),
    name: text(source.name),
    currency: text(source.currency, 'USD').toUpperCase(),
    categories: Array.isArray(source.categories) ? source.categories.map((category) => text(category).trim()).filter(Boolean) : [],
    businessAccount: {
      id: 'store-business',
      name: text(source.businessAccount?.name, 'Business'),
      currency: text(source.businessAccount?.currency, text(source.currency, 'USD')).toUpperCase(),
      balance: number(source.businessAccount?.balance),
    },
    employees,
    clients,
    products,
    stockMovements,
    sales,
  };
}

export function normalizeFinanceState(value: Partial<FinanceState>): FinanceState {
  const state = emptyFinanceState();
  state.accounts = Array.isArray(value.accounts) ? value.accounts.map((account, index) => ({
    id: text(account.id, `account-${index}`),
    name: text(account.name, `Account ${index + 1}`),
    type: ['cash', 'bank', 'card', 'savings', 'debt'].includes(account.type ?? '') ? account.type! : 'other',
    currency: text(account.currency, 'USD'),
    exchangeRate: typeof account.exchangeRate === 'number' && Number.isFinite(account.exchangeRate) && account.exchangeRate > 0 ? account.exchangeRate : undefined,
    openingBalance: number(account.openingBalance),
    color: text(account.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
    archived: Boolean(account.archived),
  })) : [];
  const firstAccountId = state.accounts[0]?.id ?? 'personal';
  state.transactions = Array.isArray(value.transactions)
    ? value.transactions.map((item) => normalizeTransaction(item, firstAccountId))
    : [];
  state.transfers = Array.isArray(value.transfers) ? value.transfers : [];
  state.budgets = Array.isArray(value.budgets) ? value.budgets : [];
  state.recurring = Array.isArray(value.recurring) ? value.recurring : [];
  state.debts = Array.isArray(value.debts) ? value.debts : [];
  state.savingsGoals = Array.isArray(value.savingsGoals) ? value.savingsGoals : [];
  state.reminders = Array.isArray(value.reminders) ? value.reminders : [];
  state.notes = Array.isArray(value.notes) ? value.notes.map((note) => ({ ...note, folderId: typeof note.folderId === 'string' ? note.folderId : undefined })) : [];
  state.noteFolders = Array.isArray(value.noteFolders)
    ? value.noteFolders.filter((folder): folder is NoteFolder => Boolean(folder && typeof folder.id === 'string' && typeof folder.name === 'string')).map((folder) => ({ ...folder, createdAt: text(folder.createdAt, new Date().toISOString()), updatedAt: text(folder.updatedAt, new Date().toISOString()) }))
    : [];
  state.categories = {
    expense: normalizeCategories(value.categories?.expense, DEFAULT_CATEGORIES.expense),
    income: normalizeCategories(value.categories?.income, DEFAULT_CATEGORIES.income),
    tag: normalizeCategories(value.categories?.tag, DEFAULT_CATEGORIES.tag),
  };
  state.store = normalizeStoreState(value.store);
  const exchangeRates = Object.entries(value.settings?.exchangeRates ?? {}).reduce<Record<string, number>>((all, [currency, rate]) => {
    if (Number.isFinite(rate) && rate > 0) all[currency.toUpperCase()] = rate;
    return all;
  }, { USD: 1 });
  state.settings = {
    ...state.settings,
    ...(value.settings ?? {}),
    preferredCurrency: text(value.settings?.preferredCurrency, 'USD'),
    exchangeRates,
    language: SUPPORTED_LANGUAGES.includes(value.settings?.language as AppLanguage) ? value.settings?.language as AppLanguage : undefined,
    pinHash: text(value.settings?.pinHash) || undefined,
    activeAccountId: state.accounts.some((account) => account.id === value.settings?.activeAccountId)
      ? value.settings?.activeAccountId
      : state.accounts.find((account) => !account.archived)?.id,
    activeWorkspace: value.settings?.activeWorkspace === 'store' ? 'store' : 'personal',
  };
  if (!value.store?.currency) state.store.currency = state.settings.preferredCurrency;
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
    currency: text(budget.currency, 'USD'),
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
    currency: text(item.currency, state.accounts.find((account) => account.id === text(item.accountId, defaultAccountId))?.currency ?? 'USD'),
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
  const [savedV3, savedV2, budgets, activeId, transactions, limit] = await Promise.all([
    AsyncStorage.getItem(FINANCE_STATE_KEY),
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
  const v3State = parseSaved(savedV3);
  const v2State = parseSaved(savedV2);
  const legacyState = migrateLegacy(budgets, activeId, transactions, limit);
  const savedState = v3State ?? v2State;
  if (!savedState) return legacyState;
  const olderState = v3State && v2State ? v2State : legacyState;
  const merged = {
    ...savedState,
    schemaVersion: 4 as const,
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
  await AsyncStorage.setItem(FINANCE_STATE_KEY, JSON.stringify(state));
  await AsyncStorage.multiRemove([FINANCE_STATE_V2_KEY, LEGACY_BUDGETS_KEY, LEGACY_ACTIVE_KEY, LEGACY_TRANSACTIONS_KEY, LEGACY_BUDGET_KEY]);
}

export function exportJson(state: FinanceState) {
  return JSON.stringify(state, null, 2);
}

function csvCell(value: string | number) {
  const textValue = String(value ?? '');
  return /[",\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
}

export function exportCsv(state: FinanceState) {
  const headers = ['date', 'kind', 'amount', 'currency', 'account', 'payee', 'category', 'paymentMethod', 'status', 'reference', 'description'];
  const rows = state.transactions.map((transaction) => {
    const account = state.accounts.find((item) => item.id === transaction.accountId);
    return [transaction.date, transaction.kind, transaction.amount, transaction.currency, account?.name ?? '', transaction.payee, transaction.category, transaction.paymentMethod, transaction.status, transaction.reference, transaction.description]
      .map(csvCell)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function importCsv(csv: string, accountId: string, fallbackCurrency: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { items: [] as Transaction[], errors: ['CSV must contain a header and at least one row.'] };
  const headers = parseCsvLine(lines[0]);
  const index = (name: string) => headers.indexOf(name);
  const errors: string[] = [];
  const items: Transaction[] = [];
  for (const [rowIndex, line] of lines.slice(1).entries()) {
    const cells = parseCsvLine(line);
    const amount = number(cells[index('amount')]);
    if (!amount) {
      errors.push(`Row ${rowIndex + 2}: amount is invalid.`);
      continue;
    }
    const kind = cells[index('kind')] === 'income' ? 'income' : 'expense';
    items.push(normalizeTransaction({
      id: `csv-${Date.now()}-${rowIndex}`,
      accountId,
      kind,
      amount,
      currency: cells[index('currency')] || fallbackCurrency,
      date: cells[index('date')] || new Date().toISOString(),
      payee: cells[index('payee')],
      category: cells[index('category')] || 'other',
      paymentMethod: cells[index('paymentMethod')] as PaymentMethod,
      status: cells[index('status')] as TransactionStatus,
      reference: cells[index('reference')],
      description: cells[index('description')],
    }, accountId));
  }
  return { items, errors };
}
