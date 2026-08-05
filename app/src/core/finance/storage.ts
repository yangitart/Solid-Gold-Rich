import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  FinanceState,
  PaymentMethod,
  Transaction,
  TransactionKind,
  TransactionStatus,
} from './types';

export const FINANCE_STATE_KEY = '@solid-gold/finance-state-v2';
const LEGACY_BUDGETS_KEY = '@solid-gold/budget-accounts-v1';
const LEGACY_ACTIVE_KEY = '@solid-gold/active-budget-v1';
const LEGACY_TRANSACTIONS_KEY = '@solid-gold/transactions';
const LEGACY_BUDGET_KEY = '@solid-gold/monthly-budget';

export const DEFAULT_COLORS = ['#E9C877', '#7DD9B2', '#80B9FF', '#D99BEF', '#F08B88'];

export const emptyFinanceState = (): FinanceState => ({
  schemaVersion: 2,
  accounts: [],
  transactions: [],
  transfers: [],
  budgets: [],
  recurring: [],
  debts: [],
  savingsGoals: [],
  reminders: [],
  notes: [],
  settings: { preferredCurrency: 'USD', firstDayOfWeek: 1, dateFormat: 'system' },
});

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
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

function normalizeState(value: Partial<FinanceState>): FinanceState {
  const state = emptyFinanceState();
  state.accounts = Array.isArray(value.accounts) ? value.accounts.map((account, index) => ({
    id: text(account.id, `account-${index}`),
    name: text(account.name, `Account ${index + 1}`),
    type: ['cash', 'bank', 'card', 'savings', 'debt'].includes(account.type ?? '') ? account.type! : 'other',
    currency: text(account.currency, 'USD'),
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
  state.notes = Array.isArray(value.notes) ? value.notes : [];
  state.settings = {
    ...state.settings,
    ...(value.settings ?? {}),
    preferredCurrency: text(value.settings?.preferredCurrency, 'USD'),
  };
  return state;
}

function migrateLegacy(
  legacyBudgets: string | null,
  legacyActiveId: string | null,
  legacyTransactions: string | null,
  legacyLimit: string | null,
): FinanceState {
  const state = emptyFinanceState();
  let parsedBudgets: Record<string, unknown>[] = [];
  try {
    const parsed = legacyBudgets ? JSON.parse(legacyBudgets) : [];
    if (Array.isArray(parsed)) parsedBudgets = parsed;
  } catch {
    parsedBudgets = [];
  }

  if (parsedBudgets.length === 0) {
    parsedBudgets = [{ id: 'personal', name: 'Personal', openingBalance: 0, limit: number(legacyLimit, 2500), color: DEFAULT_COLORS[0], transactions: [] }];
  }

  state.accounts = parsedBudgets.map((budget, index) => ({
    id: text(budget.id, `account-${index}`),
    name: text(budget.name, index === 0 ? 'Personal' : `Personal ${index + 1}`),
    type: 'cash',
    currency: 'USD',
    openingBalance: number(budget.openingBalance),
    color: text(budget.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
    archived: false,
  }));

  let legacyItems: Record<string, unknown>[] = [];
  try {
    const parsed = legacyTransactions ? JSON.parse(legacyTransactions) : parsedBudgets[0]?.transactions;
    if (Array.isArray(parsed)) legacyItems = parsed;
  } catch {
    legacyItems = [];
  }
  const defaultAccountId = text(legacyActiveId, state.accounts[0]?.id ?? 'personal');
  state.transactions = legacyItems.map((item, index) => normalizeTransaction({
    id: text(item.id, `legacy-${index}`),
    accountId: text(item.accountId, defaultAccountId),
    kind: item.kind === 'income' ? 'income' : 'expense',
    amount: number(item.amount),
    currency: 'USD',
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
    const limit = number(budget?.limit, number(legacyLimit, 2500));
    state.budgets.push({
      id: `budget-${account.id}-total`,
      accountId: account.id,
      category: 'all',
      period: 'monthly',
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
      limit: limit || 2500,
      rollover: false,
      rolloverAmount: 0,
    });
  }
  state.settings.preferredCurrency = state.accounts[0]?.currency ?? 'USD';
  return state;
}

export async function loadFinanceState() {
  const saved = await AsyncStorage.getItem(FINANCE_STATE_KEY);
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved) as Partial<FinanceState>);
    } catch {
      // Fall through to the legacy migration.
    }
  }

  const [budgets, activeId, transactions, limit] = await Promise.all([
    AsyncStorage.getItem(LEGACY_BUDGETS_KEY),
    AsyncStorage.getItem(LEGACY_ACTIVE_KEY),
    AsyncStorage.getItem(LEGACY_TRANSACTIONS_KEY),
    AsyncStorage.getItem(LEGACY_BUDGET_KEY),
  ]);
  return migrateLegacy(budgets, activeId, transactions, limit);
}

export async function saveFinanceState(state: FinanceState) {
  await AsyncStorage.setItem(FINANCE_STATE_KEY, JSON.stringify(state));
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
