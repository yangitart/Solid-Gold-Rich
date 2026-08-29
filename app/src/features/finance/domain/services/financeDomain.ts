import type { Account, Budget, FinanceState, RecurringFrequency, RecurringTransaction, Transaction, Transfer } from '@/features/finance/domain/entities/financeTypes';
import { captureCurrencySnapshot, type CurrencyRates } from '@/shared/finance/currency';

export type DateRange = { start: Date; end: Date };
export type FinanceActivityFilter = 'all' | 'expense' | 'income' | 'transfer';

function normalizedSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

export function accountBalance(state: Pick<FinanceState, 'accounts' | 'transactions'>, accountId: string) {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) return 0;
  return state.transactions
    .filter((item) => item.accountId === accountId && item.status !== 'void')
    .reduce((total, item) => item.kind === 'income' || item.kind === 'adjustment' ? total + item.amount : total - item.amount, account.openingBalance);
}

export function accountHasHistory(state: Pick<FinanceState, 'transactions' | 'transfers'>, accountId: string) {
  return state.transactions.some((item) => item.accountId === accountId)
    || state.transfers.some((item) => item.fromAccountId === accountId || item.toAccountId === accountId);
}

export function isTransferTransaction(item: Transaction) {
  return Boolean(item.transferId) || item.kind === 'transfer';
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

export function withStoreBalance(state: FinanceState): FinanceState {
  const balance = state.store.cashMovements.reduce((total, item) => total + item.amount, 0);
  return { ...state, store: { ...state.store, businessAccount: { ...state.store.businessAccount, balance } } };
}

export function removeTransfer(state: FinanceState, transferId: string) {
  const transfer = state.transfers.find((item) => item.id === transferId);
  if (!transfer) return state;
  const goals = state.savingsGoals.map((goal) => {
    const removed = goal.contributions.filter((item) => item.transferId === transferId);
    if (!removed.length) return goal;
    const balance = Math.max(0, goal.balance - removed.reduce((total, item) => total + item.amount, 0));
    return {
      ...goal,
      balance,
      active: balance < goal.targetAmount,
      contributions: goal.contributions.filter((item) => item.transferId !== transferId),
    };
  });
  return withStoreBalance({
    ...state,
    transfers: state.transfers.filter((item) => item.id !== transferId),
    transactions: state.transactions.filter((item) => item.transferId !== transferId),
    savingsGoals: goals,
    store: { ...state.store, cashMovements: state.store.cashMovements.filter((item) => item.transferId !== transferId) },
  });
}

export function removeTransaction(state: FinanceState, transactionId: string) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) return state;
  if (transaction.transferId) return removeTransfer(state, transaction.transferId);
  const debts = state.debts.map((debt) => {
    const payment = debt.payments.find((item) => item.transactionId === transactionId);
    if (!payment) return debt;
    const balance = Math.min(debt.originalAmount, debt.balance + payment.amount);
    return {
      ...debt,
      balance,
      active: balance > 0,
      payments: debt.payments.filter((item) => item.transactionId !== transactionId),
    };
  });
  return { ...state, transactions: state.transactions.filter((item) => item.id !== transactionId), debts };
}

export function accountById(accounts: Account[], accountId?: string) {
  return accounts.find((item) => item.id === accountId);
}

export function transferTouchesStore(transfer: Transfer) {
  return transfer.fromAccountId === 'store-business' || transfer.toAccountId === 'store-business';
}

export function recordDebtPayment(state: FinanceState, input: { debtId: string; accountId: string; amount: number; accountAmount: number; date: string; transactionId: string; paymentId: string }) {
  const debt = state.debts.find((item) => item.id === input.debtId);
  const account = state.accounts.find((item) => item.id === input.accountId && !item.archived);
  if (!debt || !account || account.type === 'debt' || !Number.isFinite(input.amount) || !Number.isFinite(input.accountAmount) || input.amount <= 0 || input.accountAmount <= 0 || input.amount > debt.balance) return state;
  if (state.transactions.some((item) => item.id === input.transactionId) || debt.payments.some((item) => item.id === input.paymentId)) return state;
  const transaction: Transaction = {
    id: input.transactionId, accountId: account.id, kind: 'expense', amount: input.accountAmount, currency: account.currency,
    date: input.date, payee: debt.name, category: 'other', paymentMethod: account.type === 'cash' || account.type === 'card' || account.type === 'bank' ? account.type : 'other', status: 'cleared', reference: debt.id,
    description: debt.creditor, debtId: debt.id,
    ...captureCurrencySnapshot(input.accountAmount, account.currency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 }),
  };
  return {
    ...state,
    transactions: [transaction, ...state.transactions],
    debts: state.debts.map((item) => item.id === debt.id ? {
      ...item, accountId: account.id, balance: Math.max(0, item.balance - input.amount), active: item.balance - input.amount > 0,
      payments: [...item.payments, { id: input.paymentId, amount: input.amount, date: input.date, note: '', accountId: account.id, transactionId: input.transactionId }],
    } : item),
  };
}

export function recordSavingsContribution(state: FinanceState, input: { goalId: string; sourceAccountId: string; destinationAccountId: string; amount: number; sourceAmount: number; date: string; transferId: string; contributionId: string }) {
  const goal = state.savingsGoals.find((item) => item.id === input.goalId);
  const source = state.accounts.find((item) => item.id === input.sourceAccountId && !item.archived);
  const destination = state.accounts.find((item) => item.id === input.destinationAccountId && !item.archived);
  if (!goal || !source || !destination || source.type === 'debt' || destination.type === 'debt' || source.id === destination.id || !Number.isFinite(input.amount) || !Number.isFinite(input.sourceAmount) || input.amount <= 0 || input.sourceAmount <= 0 || input.amount > goal.targetAmount - goal.balance) return state;
  if (state.transfers.some((item) => item.id === input.transferId) || goal.contributions.some((item) => item.id === input.contributionId)) return state;
  const transfer: Transfer = {
    id: input.transferId, fromAccountId: source.id, toAccountId: destination.id, fromAmount: input.sourceAmount, toAmount: input.amount,
    fromCurrency: source.currency, toCurrency: destination.currency, rate: input.amount / input.sourceAmount, fee: 0, date: input.date, note: goal.name, status: 'cleared',
  };
  const outgoing: Transaction = { id: `${input.transferId}-out`, accountId: source.id, kind: 'transfer', amount: input.sourceAmount, currency: source.currency, date: input.date, payee: goal.name, category: 'transfer', paymentMethod: 'transfer', status: 'cleared', reference: input.transferId, description: goal.name, transferId: input.transferId, savingsGoalId: goal.id, ...captureCurrencySnapshot(input.sourceAmount, source.currency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 }) };
  const incoming: Transaction = { id: `${input.transferId}-in`, accountId: destination.id, kind: 'income', amount: input.amount, currency: destination.currency, date: input.date, payee: goal.name, category: 'transfer', paymentMethod: 'transfer', status: 'cleared', reference: input.transferId, description: goal.name, transferId: input.transferId, savingsGoalId: goal.id, ...captureCurrencySnapshot(input.amount, destination.currency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 }) };
  const balance = goal.balance + input.amount;
  return {
    ...state,
    transfers: [...state.transfers, transfer],
    transactions: [incoming, outgoing, ...state.transactions],
    savingsGoals: state.savingsGoals.map((item) => item.id === goal.id ? {
      ...item, accountId: destination.id, currency: destination.currency, balance, active: balance < item.targetAmount,
      contributions: [...item.contributions, { id: input.contributionId, amount: input.amount, date: input.date, note: '', fromAccountId: source.id, transferId: input.transferId }],
    } : item),
  };
}
