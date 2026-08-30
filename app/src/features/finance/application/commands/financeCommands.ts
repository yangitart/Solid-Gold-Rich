import type { AppState as FinanceState } from '@/domain/AppState';
import type { Account, Transaction, Transfer } from '@/features/finance/domain/entities/financeTypes';
import { captureCurrencySnapshot } from '@/shared/domain/finance/currency';
import { removeTransaction, removeTransfer } from '@/features/finance/application/services/financeStateOperations';
import { withStoreBalance } from '@/features/store/domain/services/storeDomain';

export function addAccount(state: FinanceState, account: Account): FinanceState {
  return { ...state, accounts: [...state.accounts, account], settings: { ...state.settings, activeAccountId: state.settings.activeAccountId ?? account.id } };
}

export function updateAccount(state: FinanceState, account: Account): FinanceState {
  return { ...state, accounts: state.accounts.some((item) => item.id === account.id) ? state.accounts.map((item) => item.id === account.id ? account : item) : [...state.accounts, account] };
}

export function archiveAccount(state: FinanceState, id: string): FinanceState {
  const accounts = state.accounts.map((item) => item.id === id ? { ...item, archived: true } : item);
  const nextActive = state.settings.activeAccountId === id ? accounts.find((item) => !item.archived)?.id : state.settings.activeAccountId;
  return { ...state, accounts, settings: { ...state.settings, activeAccountId: nextActive } };
}

export function restoreAccount(state: FinanceState, id: string): FinanceState {
  return { ...state, accounts: state.accounts.map((item) => item.id === id ? { ...item, archived: false } : item), settings: { ...state.settings, activeAccountId: state.accounts.some((item) => item.id === state.settings.activeAccountId && !item.archived) ? state.settings.activeAccountId : id } };
}

export function addTransaction(state: FinanceState, transaction: Transaction): FinanceState {
  return { ...state, transactions: [{ ...transaction, ...captureCurrencySnapshot(transaction.amount, transaction.currency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 }) }, ...state.transactions] };
}

export function updateTransaction(state: FinanceState, transaction: Transaction): FinanceState {
  const previous = state.transactions.find((item) => item.id === transaction.id);
  const previousHistoricalRate = previous && previous.currency === transaction.currency && previous.amount > 0 && Number.isFinite(previous.baseAmount) && previous.baseCurrency
    ? (previous.baseAmount as number) / previous.amount
    : undefined;
  const snapshot = previousHistoricalRate !== undefined
    ? { baseAmount: transaction.amount * previousHistoricalRate, baseCurrency: previous?.baseCurrency }
    : captureCurrencySnapshot(transaction.amount, transaction.currency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 });
  return { ...state, transactions: state.transactions.some((item) => item.id === transaction.id) ? state.transactions.map((item) => item.id === transaction.id ? { ...transaction, ...snapshot } : item) : [...state.transactions, { ...transaction, ...snapshot }] };
}

export function addTransfer(state: FinanceState, transfer: Transfer): FinanceState {
  const isStoreSource = transfer.fromAccountId === 'store-business';
  const isStoreTarget = transfer.toAccountId === 'store-business';
  const fromTransaction: Transaction | null = isStoreSource ? null : {
    id: `${transfer.id}-out`, accountId: transfer.fromAccountId, kind: 'transfer', amount: transfer.fromAmount + transfer.fee,
    currency: transfer.fromCurrency, date: transfer.date, payee: '', category: 'transfer', paymentMethod: 'transfer', status: transfer.status, reference: transfer.id, description: transfer.note, transferId: transfer.id,
    ...captureCurrencySnapshot(transfer.fromAmount + transfer.fee, transfer.fromCurrency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 }),
  };
  const toTransaction: Transaction | null = isStoreTarget ? null : {
    id: `${transfer.id}-in`, accountId: transfer.toAccountId, kind: 'income', amount: transfer.toAmount,
    currency: transfer.toCurrency, date: transfer.date, payee: '', category: 'transfer', paymentMethod: 'transfer', status: transfer.status, reference: transfer.id, description: transfer.note, transferId: transfer.id,
    ...captureCurrencySnapshot(transfer.toAmount, transfer.toCurrency, state.settings.preferredCurrency, state.settings.exchangeRates ?? { USD: 1 }),
  };
  const cashMovement = isStoreTarget || isStoreSource ? {
    id: `${transfer.id}-store-cash`, type: isStoreTarget ? 'funding' as const : 'withdrawal' as const,
    amount: isStoreTarget ? transfer.toAmount : -(transfer.fromAmount + transfer.fee), date: transfer.date, note: transfer.note, transferId: transfer.id,
  } : null;
  return withStoreBalance({
    ...state,
    transfers: [...state.transfers, transfer],
    transactions: [toTransaction, fromTransaction, ...state.transactions].filter((item): item is Transaction => Boolean(item)),
    store: { ...state.store, cashMovements: cashMovement ? [...state.store.cashMovements, cashMovement] : state.store.cashMovements },
  });
}

export { removeTransaction, removeTransfer };
