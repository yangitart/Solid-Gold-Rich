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
} from './types';
import { emptyFinanceState, importCsv, loadFinanceState, normalizeFinanceState, saveFinanceState } from './storage';

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

function nextRecurringDate(date: string, frequency: RecurringTransaction['frequency']) {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') {
    const intendedDay = next.getDate();
    const wasLastDay = intendedDay === new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(wasLastDay ? lastDay : Math.min(intendedDay, lastDay));
  }
  if (frequency === 'yearly') {
    const intendedMonth = next.getMonth();
    const intendedDay = next.getDate();
    next.setDate(1);
    next.setFullYear(next.getFullYear() + 1);
    next.setMonth(intendedMonth);
    const lastDay = new Date(next.getFullYear(), intendedMonth + 1, 0).getDate();
    next.setDate(Math.min(intendedDay, lastDay));
  }
  return next.toISOString();
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
      const generated: Transaction[] = [];
      const existingOccurrences = new Set(current.transactions.filter((item) => item.recurringId).map((item) => `${item.recurringId}|${item.date}`));
      const recurring = current.recurring.map((item) => {
        const rule = due.find((candidate) => candidate.id === item.id);
        if (!rule) return item;
        let occurrence = item.nextDate;
        let lastGeneratedDate = item.lastGeneratedDate;
        let safety = 0;
        while (new Date(occurrence).getTime() <= Date.now() && safety < 3660) {
          const occurrenceKey = `${item.id}|${occurrence}`;
          if (!existingOccurrences.has(occurrenceKey)) {
            generated.push({
              id: newId('recurring'), accountId: item.accountId, kind: item.kind, amount: item.amount, currency: item.currency,
              date: occurrence, payee: item.payee, category: item.category, paymentMethod: item.paymentMethod, status: 'cleared',
              reference: item.id, description: item.description, recurringId: item.id,
            });
            existingOccurrences.add(occurrenceKey);
          }
          lastGeneratedDate = occurrence;
          occurrence = nextRecurringDate(occurrence, item.frequency);
          safety += 1;
        }
        return { ...item, lastGeneratedDate, nextDate: occurrence };
      });
      return { ...current, recurring, transactions: [...generated, ...current.transactions] };
    });
  }, [loaded, state.recurring]);

  const updateState = React.useCallback((updater: (current: FinanceState) => FinanceState) => {
    setState((current) => updater(current));
  }, []);

  const addAccount = React.useCallback((account: Account) => updateState((current) => ({ ...current, accounts: [...current.accounts, account] })), [updateState]);
  const updateAccount = React.useCallback((account: Account) => updateState((current) => ({ ...current, accounts: replaceById(current.accounts, account) })), [updateState]);
  const archiveAccount = React.useCallback((id: string) => updateState((current) => {
    const accounts = current.accounts.map((item) => item.id === id ? { ...item, archived: true } : item);
    const nextActive = current.settings.activeAccountId === id ? accounts.find((item) => !item.archived)?.id : current.settings.activeAccountId;
    return { ...current, accounts, settings: { ...current.settings, activeAccountId: nextActive } };
  }), [updateState]);
  const restoreAccount = React.useCallback((id: string) => updateState((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? { ...item, archived: false } : item) })), [updateState]);
  const addTransaction = React.useCallback((transaction: Transaction) => updateState((current) => ({ ...current, transactions: [transaction, ...current.transactions] })), [updateState]);
  const updateTransaction = React.useCallback((transaction: Transaction) => updateState((current) => ({ ...current, transactions: replaceById(current.transactions, transaction) })), [updateState]);
  const deleteTransaction = React.useCallback((id: string) => updateState((current) => ({ ...current, transactions: current.transactions.filter((item) => item.id !== id) })), [updateState]);
  const addTransfer = React.useCallback((transfer: Transfer) => {
    updateState((current) => {
      const fromTransaction: Transaction = {
        id: `${transfer.id}-out`, accountId: transfer.fromAccountId, kind: 'transfer', amount: transfer.fromAmount + transfer.fee,
        currency: transfer.fromCurrency, date: transfer.date, payee: 'Transfer', category: 'transfer',
        paymentMethod: 'transfer', status: transfer.status, reference: transfer.id, description: transfer.note, transferId: transfer.id,
      };
      const toTransaction: Transaction = {
        id: `${transfer.id}-in`, accountId: transfer.toAccountId, kind: 'income', amount: transfer.toAmount,
        currency: transfer.toCurrency, date: transfer.date, payee: 'Transfer', category: 'transfer',
        paymentMethod: 'transfer', status: transfer.status, reference: transfer.id, description: transfer.note, transferId: transfer.id,
      };
      return { ...current, transfers: [...current.transfers, transfer], transactions: [toTransaction, fromTransaction, ...current.transactions] };
    });
  }, [updateState]);
  const deleteTransfer = React.useCallback((id: string) => updateState((current) => ({ ...current, transfers: current.transfers.filter((item) => item.id !== id), transactions: current.transactions.filter((item) => item.transferId !== id) })), [updateState]);
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
      if (!parsed || ![2, 3].includes(Number(parsed.schemaVersion)) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions)) return false;
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
