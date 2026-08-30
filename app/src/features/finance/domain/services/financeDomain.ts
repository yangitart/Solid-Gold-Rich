import type { Account, Budget, RecurringFrequency, RecurringTransaction, Transaction, Transfer } from '@/features/finance/domain/entities/financeTypes';
import { captureCurrencySnapshot, type CurrencyRates } from '@/shared/domain/finance/currency';

export type DateRange = { start: Date; end: Date };
export type FinanceActivityFilter = 'all' | 'expense' | 'income' | 'transfer';

function normalizedSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

export function accountBalance(state: { accounts: Account[]; transactions: Transaction[] }, accountId: string) {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) return 0;
  return state.transactions
    .filter((item) => item.accountId === accountId && item.status !== 'void')
    .reduce((total, item) => item.kind === 'income' || item.kind === 'adjustment' ? total + item.amount : total - item.amount, account.openingBalance);
}

export function accountHasHistory(state: { transactions: Transaction[]; transfers: Transfer[] }, accountId: string) {
  return state.transactions.some((item) => item.accountId === accountId)
    || state.transfers.some((item) => item.fromAccountId === accountId || item.toAccountId === accountId);
}

export function isTransferTransaction(item: { transferId?: string; kind: string }) {
  return Boolean(item.transferId) || item.kind === 'transfer';
}

export function transactionImportKey(item: Pick<Transaction, 'accountId' | 'kind' | 'amount' | 'currency' | 'date' | 'payee' | 'category' | 'paymentMethod' | 'status' | 'reference' | 'description'>) {
  return [item.accountId, item.kind, item.amount, item.currency, item.date, item.payee, item.category, item.paymentMethod, item.status, item.reference, item.description]
    .map((value) => String(value ?? '').trim().toLocaleLowerCase())
    .join('\u001f');
}

export function isCashFlowTransaction(item: Transaction) {
  return item.status !== 'void' && !isTransferTransaction(item) && (item.kind === 'expense' || item.kind === 'income');
}

export function transactionMatchesActivityFilter(item: Transaction, filter: FinanceActivityFilter) {
  if (filter === 'all') return true;
  if (filter === 'transfer') return isTransferTransaction(item);
  return !isTransferTransaction(item) && item.kind === filter;
}

export function filterActivityTransactions(
  transactions: Transaction[],
  options: { filter: FinanceActivityFilter; category: string; query: string; categoryLabels?: Record<string, string>; accountNames?: Record<string, string> },
) {
  const query = normalizedSearch(options.query);
  return transactions.filter((item) => {
    if (item.status === 'void' || !transactionMatchesActivityFilter(item, options.filter) || (options.category !== 'all' && item.category !== options.category)) return false;
    if (!query) return true;
    const searchable = normalizedSearch(`${item.payee} ${item.description} ${item.category} ${options.categoryLabels?.[item.category] ?? ''} ${options.accountNames?.[item.accountId] ?? ''} ${item.amount} ${item.currency} ${item.paymentMethod} ${item.reference} ${item.date}`);
    return searchable.includes(query);
  });
}

export function periodBounds(period: 'today' | 'week' | 'month' | 'year', reference = new Date(), firstDayOfWeek: 0 | 1 = 1): DateRange {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  if (period === 'week') {
    const delta = (start.getDay() - firstDayOfWeek + 7) % 7;
    start.setDate(start.getDate() - delta);
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'year') {
    start.setMonth(0, 1);
  }
  const end = new Date(start);
  if (period === 'today') end.setDate(end.getDate() + 1);
  if (period === 'week') end.setDate(end.getDate() + 7);
  if (period === 'month') end.setMonth(end.getMonth() + 1);
  if (period === 'year') end.setFullYear(end.getFullYear() + 1);
  return { start, end };
}

export function previousPeriodBounds(period: 'today' | 'week' | 'month' | 'year', current: DateRange): DateRange {
  if (period === 'month') return { start: new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1), end: new Date(current.start) };
  if (period === 'year') return { start: new Date(current.start.getFullYear() - 1, 0, 1), end: new Date(current.start) };
  const duration = current.end.getTime() - current.start.getTime();
  return { start: new Date(current.start.getTime() - duration), end: new Date(current.start) };
}

export function inDateRange(date: string, range: DateRange) {
  const timestamp = new Date(date).getTime();
  return timestamp >= range.start.getTime() && timestamp < range.end.getTime();
}

export function budgetSpent(budget: Budget, transactions: Transaction[], currency: string, range: DateRange, rateFor: (from: string, to: string) => number | undefined) {
  return transactions
    .filter((item) => item.status !== 'void' && !isTransferTransaction(item) && item.kind === 'expense' && item.accountId === budget.accountId && (budget.category === 'all' || item.category === budget.category) && inDateRange(item.date, range))
    .reduce((total, item) => {
      const rate = rateFor(item.currency, currency);
      return rate ? total + item.amount * rate : total;
    }, 0);
}

export function advanceRecurringDate(date: string, frequency: RecurringFrequency, preferredDay?: number) {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') {
    const intendedDay = Math.min(31, Math.max(1, preferredDay ?? next.getDate()));
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const nextLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(intendedDay, nextLastDay));
  }
  if (frequency === 'yearly') {
    const intendedMonth = next.getMonth();
    const intendedDay = Math.min(31, Math.max(1, preferredDay ?? next.getDate()));
    next.setDate(1);
    next.setFullYear(next.getFullYear() + 1);
    next.setMonth(intendedMonth);
    next.setDate(Math.min(intendedDay, new Date(next.getFullYear(), intendedMonth + 1, 0).getDate()));
  }
  return next.toISOString();
}

function generatedTransaction(item: RecurringTransaction, occurrence: string, id: string, baseCurrency?: string, rates?: CurrencyRates): Transaction {
  return {
    id,
    accountId: item.accountId,
    kind: item.kind,
    amount: item.amount,
    currency: item.currency,
    date: occurrence,
    payee: item.payee,
    category: item.category,
    paymentMethod: item.paymentMethod,
    status: 'cleared',
    reference: item.id,
    description: item.description,
    recurringId: item.id,
    ...(baseCurrency && rates ? captureCurrencySnapshot(item.amount, item.currency, baseCurrency, rates) : {}),
  };
}

export function generateDueRecurring(
  recurring: RecurringTransaction[],
  transactions: Transaction[],
  now: Date,
  createId: () => string,
  baseCurrency?: string,
  rates?: CurrencyRates,
) {
  const existing = new Set(transactions.filter((item) => item.recurringId).map((item) => `${item.recurringId}|${item.date}`));
  const generated: Transaction[] = [];
  const nextRecurring = recurring.map((item) => {
    if (!item.active || new Date(item.nextDate).getTime() > now.getTime()) return item;
    let occurrence = item.nextDate;
    const dayOfMonth = item.dayOfMonth ?? new Date(item.nextDate).getDate();
    let lastGeneratedDate = item.lastGeneratedDate;
    let safety = 0;
    while (new Date(occurrence).getTime() <= now.getTime() && safety < 3660) {
      const key = `${item.id}|${occurrence}`;
      if (!existing.has(key)) {
        generated.push(generatedTransaction(item, occurrence, createId(), baseCurrency, rates));
        existing.add(key);
      }
      lastGeneratedDate = occurrence;
      occurrence = advanceRecurringDate(occurrence, item.frequency, dayOfMonth);
      safety += 1;
    }
    return { ...item, dayOfMonth, lastGeneratedDate, nextDate: occurrence };
  });
  return { recurring: nextRecurring, transactions: [...generated, ...transactions], generated };
}

export function accountById(accounts: Account[], accountId?: string) {
  return accounts.find((item) => item.id === accountId);
}

export function transferTouchesStore(transfer: Transfer) {
  return transfer.fromAccountId === 'store-business' || transfer.toAccountId === 'store-business';
}
