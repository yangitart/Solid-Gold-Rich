import React from 'react';
import type {
  Account,
  Budget,
  Debt,
  FinanceState,
  Note,
  NoteFolder,
  Reminder,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
  Transfer,
} from '../core/finance/types';
import { emptyFinanceState, importCsv, loadFinanceState, normalizeFinanceState, saveFinanceState } from './financeStorage';
import { generateDueRecurring, removeTransaction, removeTransfer, withStoreBalance } from '../domain/finance/financeDomain';

export type PersistenceStatus = 'loading' | 'ready' | 'saving' | 'error';
export type PersistenceErrorPhase = 'load' | 'save' | null;

type FinanceContextValue = {
  state: FinanceState;
  loaded: boolean;
  persistenceStatus: PersistenceStatus;
  persistenceError: string | null;
  persistenceErrorPhase: PersistenceErrorPhase;
  retryLoad: () => void;
  retryPersistence: () => void;
  updateState: (updater: (state: FinanceState) => FinanceState) => void;
  addAccount: (account: Account) => void;
  updateAccount: (account: Account) => void;
  archiveAccount: (id: string) => void;
  restoreAccount: (id: string) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addTransfer: (transfer: Transfer) => void;
  deleteTransfer: (id: string) => void;
  addBudget: (budget: Budget) => void;
  updateBudget: (budget: Budget) => void;
  deleteBudget: (id: string) => void;
  addRecurring: (item: RecurringTransaction) => void;
  updateRecurring: (item: RecurringTransaction) => void;
  addDebt: (item: Debt) => void;
  updateDebt: (item: Debt) => void;
  addSavingsGoal: (item: SavingsGoal) => void;
  updateSavingsGoal: (item: SavingsGoal) => void;
  addReminder: (item: Reminder) => void;
  updateReminder: (item: Reminder) => void;
  addNote: (item: Note) => void;
  updateNote: (item: Note) => void;
  addNoteFolder: (folder: NoteFolder) => void;
  updateNoteFolder: (folder: NoteFolder) => void;
  deleteNoteFolder: (id: string) => void;
  updateCategories: (categories: FinanceState['categories']) => void;
  importJson: (json: string) => boolean;
  importCsvText: (csv: string, accountId: string) => string[];
  resetData: () => void;
};

const FinanceContext = React.createContext<FinanceContextValue | null>(null);

function replaceById<T extends { id: string }>(items: T[], value: T) {
  return items.some((item) => item.id === value.id)
    ? items.map((item) => item.id === value.id ? value : item)
    : [...items, value];
}
function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<FinanceState>(emptyFinanceState);
  const [loaded, setLoaded] = React.useState(false);
  const [persistenceStatus, setPersistenceStatus] = React.useState<PersistenceStatus>('loading');
  const [persistenceError, setPersistenceError] = React.useState<string | null>(null);
  const [persistenceErrorPhase, setPersistenceErrorPhase] = React.useState<PersistenceErrorPhase>(null);
  const loadedSuccessfully = React.useRef(false);
  const saveSequence = React.useRef(Promise.resolve());

  const retryLoad = React.useCallback(() => {
    let active = true;
    setLoaded(false);
    setPersistenceStatus('loading');
    setPersistenceError(null);
    setPersistenceErrorPhase(null);
    void loadFinanceState()
      .then((loadedState) => {
        if (!active) return;
        loadedSuccessfully.current = true;
        setState(loadedState);
        setPersistenceStatus('ready');
        setPersistenceErrorPhase(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        loadedSuccessfully.current = false;
        setPersistenceError(error instanceof Error ? error.message : 'Unable to load local data.');
        setPersistenceErrorPhase('load');
        setPersistenceStatus('error');
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const cleanup = retryLoad();
    return cleanup;
  }, [retryLoad]);

  React.useEffect(() => {
    if (!loaded || !loadedSuccessfully.current) return;
    setPersistenceStatus('saving');
    saveSequence.current = saveSequence.current
      .catch(() => undefined)
      .then(() => saveFinanceState(state))
      .then(() => {
        setPersistenceError(null);
        setPersistenceErrorPhase(null);
        setPersistenceStatus('ready');
      })
      .catch((error: unknown) => {
        setPersistenceError(error instanceof Error ? error.message : 'Unable to save local data.');
        setPersistenceErrorPhase('save');
        setPersistenceStatus('error');
      });
  }, [loaded, state]);

  React.useEffect(() => {
    if (!loaded) return;
    const due = state.recurring.filter((item) => item.active && new Date(item.nextDate).getTime() <= Date.now());
    if (!due.length) return;
    setState((current) => {
      const generated = generateDueRecurring(current.recurring, current.transactions, new Date(), () => newId('recurring'));
      return { ...current, recurring: generated.recurring, transactions: generated.transactions };
    });
  }, [loaded, state.recurring]);

  const updateState = React.useCallback((updater: (current: FinanceState) => FinanceState) => {
    setState((current) => updater(current));
  }, []);

  const addAccount = React.useCallback((account: Account) => updateState((current) => ({ ...current, accounts: [...current.accounts, account], settings: { ...current.settings, activeAccountId: current.settings.activeAccountId ?? account.id } })), [updateState]);
  const updateAccount = React.useCallback((account: Account) => updateState((current) => ({ ...current, accounts: replaceById(current.accounts, account) })), [updateState]);
  const archiveAccount = React.useCallback((id: string) => updateState((current) => {
    const accounts = current.accounts.map((item) => item.id === id ? { ...item, archived: true } : item);
    const nextActive = current.settings.activeAccountId === id ? accounts.find((item) => !item.archived)?.id : current.settings.activeAccountId;
    return { ...current, accounts, settings: { ...current.settings, activeAccountId: nextActive } };
  }), [updateState]);
  const restoreAccount = React.useCallback((id: string) => updateState((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? { ...item, archived: false } : item), settings: { ...current.settings, activeAccountId: current.accounts.some((item) => item.id === current.settings.activeAccountId && !item.archived) ? current.settings.activeAccountId : id } })), [updateState]);
  const addTransaction = React.useCallback((transaction: Transaction) => updateState((current) => ({ ...current, transactions: [transaction, ...current.transactions] })), [updateState]);
  const updateTransaction = React.useCallback((transaction: Transaction) => updateState((current) => ({ ...current, transactions: replaceById(current.transactions, transaction) })), [updateState]);
  const deleteTransaction = React.useCallback((id: string) => updateState((current) => removeTransaction(current, id)), [updateState]);
  const addTransfer = React.useCallback((transfer: Transfer) => {
    updateState((current) => {
      const isStoreSource = transfer.fromAccountId === 'store-business';
      const isStoreTarget = transfer.toAccountId === 'store-business';
      const fromTransaction: Transaction | null = isStoreSource ? null : {
        id: `${transfer.id}-out`, accountId: transfer.fromAccountId, kind: 'transfer', amount: transfer.fromAmount + transfer.fee,
        currency: transfer.fromCurrency, date: transfer.date, payee: '', category: 'transfer',
        paymentMethod: 'transfer', status: transfer.status, reference: transfer.id, description: transfer.note, transferId: transfer.id,
      };
      const toTransaction: Transaction | null = isStoreTarget ? null : {
        id: `${transfer.id}-in`, accountId: transfer.toAccountId, kind: 'income', amount: transfer.toAmount,
        currency: transfer.toCurrency, date: transfer.date, payee: '', category: 'transfer',
        paymentMethod: 'transfer', status: transfer.status, reference: transfer.id, description: transfer.note, transferId: transfer.id,
      };
      const cashMovement = isStoreTarget || isStoreSource ? {
        id: `${transfer.id}-store-cash`,
        type: isStoreTarget ? 'funding' as const : 'withdrawal' as const,
        amount: isStoreTarget ? transfer.toAmount : -(transfer.fromAmount + transfer.fee),
        date: transfer.date,
        note: transfer.note,
        transferId: transfer.id,
      } : null;
      return withStoreBalance({
        ...current,
        transfers: [...current.transfers, transfer],
        transactions: [toTransaction, fromTransaction, ...current.transactions].filter((item): item is Transaction => Boolean(item)),
        store: { ...current.store, cashMovements: cashMovement ? [...current.store.cashMovements, cashMovement] : current.store.cashMovements },
      });
    });
  }, [updateState]);
  const deleteTransfer = React.useCallback((id: string) => updateState((current) => removeTransfer(current, id)), [updateState]);
  const addBudget = React.useCallback((budget: Budget) => updateState((current) => ({ ...current, budgets: [...current.budgets, budget] })), [updateState]);
  const updateBudget = React.useCallback((budget: Budget) => updateState((current) => ({ ...current, budgets: replaceById(current.budgets, budget) })), [updateState]);
  const deleteBudget = React.useCallback((id: string) => updateState((current) => ({ ...current, budgets: current.budgets.filter((item) => item.id !== id) })), [updateState]);
  const addRecurring = React.useCallback((item: RecurringTransaction) => updateState((current) => ({ ...current, recurring: [...current.recurring, item] })), [updateState]);
  const updateRecurring = React.useCallback((item: RecurringTransaction) => updateState((current) => ({ ...current, recurring: replaceById(current.recurring, item) })), [updateState]);
  const addDebt = React.useCallback((item: Debt) => updateState((current) => ({ ...current, debts: [...current.debts, item] })), [updateState]);
  const updateDebt = React.useCallback((item: Debt) => updateState((current) => ({ ...current, debts: replaceById(current.debts, item) })), [updateState]);
  const addSavingsGoal = React.useCallback((item: SavingsGoal) => updateState((current) => ({ ...current, savingsGoals: [...current.savingsGoals, item] })), [updateState]);
  const updateSavingsGoal = React.useCallback((item: SavingsGoal) => updateState((current) => ({ ...current, savingsGoals: replaceById(current.savingsGoals, item) })), [updateState]);
  const addReminder = React.useCallback((item: Reminder) => updateState((current) => ({ ...current, reminders: [...current.reminders, item] })), [updateState]);
  const updateReminder = React.useCallback((item: Reminder) => updateState((current) => ({ ...current, reminders: replaceById(current.reminders, item) })), [updateState]);
  const addNote = React.useCallback((item: Note) => updateState((current) => ({ ...current, notes: [...current.notes, item] })), [updateState]);
  const updateNote = React.useCallback((item: Note) => updateState((current) => ({ ...current, notes: replaceById(current.notes, item) })), [updateState]);
  const addNoteFolder = React.useCallback((folder: NoteFolder) => updateState((current) => ({ ...current, noteFolders: [...current.noteFolders, folder] })), [updateState]);
  const updateNoteFolder = React.useCallback((folder: NoteFolder) => updateState((current) => ({ ...current, noteFolders: replaceById(current.noteFolders, folder) })), [updateState]);
  const deleteNoteFolder = React.useCallback((id: string) => updateState((current) => ({ ...current, noteFolders: current.noteFolders.filter((folder) => folder.id !== id), notes: current.notes.map((note) => note.folderId === id ? { ...note, folderId: undefined } : note) })), [updateState]);
  const updateCategories = React.useCallback((categories: FinanceState['categories']) => updateState((current) => ({ ...current, categories })), [updateState]);

  const retryPersistence = React.useCallback(() => {
    if (!loadedSuccessfully.current) {
      retryLoad();
      return;
    }
    setPersistenceStatus('saving');
    setPersistenceError(null);
    setPersistenceErrorPhase(null);
    saveSequence.current = saveSequence.current
      .catch(() => undefined)
      .then(() => saveFinanceState(state))
      .then(() => { setPersistenceStatus('ready'); setPersistenceErrorPhase(null); })
      .catch((error: unknown) => {
        setPersistenceError(error instanceof Error ? error.message : 'Unable to save local data.');
        setPersistenceErrorPhase('save');
        setPersistenceStatus('error');
      });
  }, [retryLoad, state]);

  const importJson = React.useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as FinanceState;
      if (!parsed || ![2, 3, 4, 5].includes(Number(parsed.schemaVersion)) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions)) return false;
      setState(normalizeFinanceState(parsed));
      return true;
    } catch {
      return false;
    }
  }, []);

  const importCsvText = React.useCallback((csv: string, accountId: string) => {
    const account = state.accounts.find((item) => item.id === accountId);
    const result = importCsv(csv, accountId, account?.currency ?? state.settings.preferredCurrency);
    if (result.items.length) updateState((current) => ({ ...current, transactions: [...result.items, ...current.transactions] }));
    return result.errors;
  }, [state.accounts, state.settings.preferredCurrency, updateState]);

  const resetData = React.useCallback(() => setState(emptyFinanceState()), []);

  const value = React.useMemo(() => ({
    state, loaded, persistenceStatus, persistenceError, persistenceErrorPhase, retryLoad, retryPersistence, updateState, addAccount, updateAccount, archiveAccount, restoreAccount, addTransaction, updateTransaction,
    deleteTransaction, addTransfer, deleteTransfer, addBudget, updateBudget, deleteBudget, addRecurring,
    updateRecurring, addDebt, updateDebt, addSavingsGoal, updateSavingsGoal, addReminder, updateReminder,
    addNote, updateNote, addNoteFolder, updateNoteFolder, deleteNoteFolder, updateCategories, importJson, importCsvText, resetData,
  }), [state, loaded, persistenceStatus, persistenceError, persistenceErrorPhase, retryLoad, retryPersistence, updateState, addAccount, updateAccount, archiveAccount, restoreAccount, addTransaction, updateTransaction, deleteTransaction, addTransfer, deleteTransfer, addBudget, updateBudget, deleteBudget, addRecurring, updateRecurring, addDebt, updateDebt, addSavingsGoal, updateSavingsGoal, addReminder, updateReminder, addNote, updateNote, addNoteFolder, updateNoteFolder, deleteNoteFolder, updateCategories, importJson, importCsvText, resetData]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = React.useContext(FinanceContext);
  if (!context) throw new Error('useFinance must be used inside FinanceProvider');
  return context;
}
