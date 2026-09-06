import type { AppState } from '@/domain/AppState';
import type { Transaction, Transfer } from '@/features/finance/domain/entities/financeTypes';
import { transactionImportKey } from '@/features/finance/domain/services/financeDomain';
import { withStoreBalance } from '@/features/store/domain/services/storeDomain';
import { captureCurrencySnapshot } from '@/shared/domain/finance/currency';

export function resolveImportedFinanceState(current: AppState, imported: AppState, preserveStore: boolean) {
  return preserveStore ? { ...imported, store: {
    ...current.store,
    stockMovements: current.store.stockMovements.map(({ personalTransactionId: _personalTransactionId, ...movement }) => movement),
    cashMovements: current.store.cashMovements.map(({ personalTransactionId: _personalTransactionId, transferId: _transferId, ...movement }) => movement),
  } } : imported;
}

// Match multiplicities so two legitimate identical payments survive the first import,
// while importing the same file again does not add either payment a second time.
export function mergeImportedTransactions(state: AppState, items: Transaction[]) {
  const counts = new Map<string, number>();
  state.transactions.forEach((item) => {
    const key = transactionImportKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  let duplicateCount = 0;
  const incoming = items.filter((item) => {
    const key = transactionImportKey(item);
    const count = counts.get(key) ?? 0;
    if (!count) return true;
    counts.set(key, count - 1);
    duplicateCount += 1;
    return false;
  }).map((item) => Number.isFinite(item.baseAmount) && item.baseCurrency ? item : {
    ...item,
    ...captureCurrencySnapshot(item.amount, item.currency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 }),
  });
  return { state: incoming.length ? { ...state, transactions: [...incoming, ...state.transactions] } : state, duplicateCount };
}

export function removeTransfer(state: AppState, transferId: string) {
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

export function removeTransaction(state: AppState, transactionId: string) {
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

export function recordDebtPayment(state: AppState, input: { debtId: string; accountId: string; amount: number; accountAmount: number; date: string; transactionId: string; paymentId: string }) {
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

export function recordSavingsContribution(state: AppState, input: { goalId: string; sourceAccountId: string; destinationAccountId: string; amount: number; sourceAmount: number; date: string; transferId: string; contributionId: string }) {
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
