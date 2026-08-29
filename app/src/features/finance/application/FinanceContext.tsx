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
} from '@/features/finance/domain/entities/financeTypes';
import type { FinanceRepository } from '@/features/finance/application/ports/FinanceRepository';
import { generateDueRecurring } from '@/features/finance/domain/services/financeDomain';
import { addAccount as createAccount, addTransaction as createTransaction, addTransfer as createTransfer, archiveAccount as archiveAccountState, removeTransaction, removeTransfer, restoreAccount as restoreAccountState, updateAccount as updateAccountState, updateTransaction as updateTransactionState } from '@/features/finance/application/commands/financeCommands';
import { removeNoteFolder } from '@/features/notes/domain/useCases/removeNoteFolder';
import { captureCurrencySnapshot } from '@/shared/finance/currency';

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

export function FinanceProvider({ children, repository }: { children: React.ReactNode; repository: FinanceRepository }) {
  const [state, setState] = React.useState<FinanceState>(() => repository.reset());
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
    void repository.load()
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
  }, [repository]);

  React.useEffect(() => {
    const cleanup = retryLoad();
    return cleanup;
  }, [retryLoad]);

  React.useEffect(() => {
    if (!loaded || !loadedSuccessfully.current) return;
    setPersistenceStatus('saving');
    saveSequence.current = saveSequence.current
      .catch(() => undefined)
      .then(() => repository.save(state))
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
  }, [loaded, repository, state]);

  React.useEffect(() => {
    if (!loaded) return;
    const due = state.recurring.filter((item) => item.active && new Date(item.nextDate).getTime() <= Date.now());
    if (!due.length) return;
    setState((current) => {
      const generated = generateDueRecurring(current.recurring, current.transactions, new Date(), () => newId('recurring'), current.settings.preferredCurrency, current.settings.exchangeRates ?? { USD: 1 });
      return { ...current, recurring: generated.recurring, transactions: generated.transactions };
    });
  }, [loaded, state.recurring]);

  const updateState = React.useCallback((updater: (current: FinanceState) => FinanceState) => {
    setState((current) => updater(current));
  }, []);

  const addAccount = React.useCallback((account: Account) => updateState((current) => createAccount(current, account)), [updateState]);
  const updateAccount = React.useCallback((account: Account) => updateState((current) => updateAccountState(current, account)), [updateState]);
  const archiveAccount = React.useCallback((id: string) => updateState((current) => archiveAccountState(current, id)), [updateState]);
  const restoreAccount = React.useCallback((id: string) => updateState((current) => restoreAccountState(current, id)), [updateState]);
  const addTransaction = React.useCallback((transaction: Transaction) => updateState((current) => createTransaction(current, transaction)), [updateState]);
  const updateTransaction = React.useCallback((transaction: Transaction) => updateState((current) => updateTransactionState(current, transaction)), [updateState]);
  const deleteTransaction = React.useCallback((id: string) => updateState((current) => removeTransaction(current, id)), [updateState]);
  const addTransfer = React.useCallback((transfer: Transfer) => {
    updateState((current) => createTransfer(current, transfer));
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
  const deleteNoteFolder = React.useCallback((id: string) => updateState((current) => removeNoteFolder(current, id)), [updateState]);
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
      .then(() => repository.save(state))
      .then(() => { setPersistenceStatus('ready'); setPersistenceErrorPhase(null); })
      .catch((error: unknown) => {
        setPersistenceError(error instanceof Error ? error.message : 'Unable to save local data.');
        setPersistenceErrorPhase('save');
        setPersistenceStatus('error');
      });
  }, [repository, retryLoad, state]);

  const importJson = React.useCallback((json: string) => {
    const parsed = repository.parseJson(json);
    if (!parsed) return false;
    setState(parsed);
    return true;
  }, [repository]);

  const importCsvText = React.useCallback((csv: string, accountId: string) => {
    const account = state.accounts.find((item) => item.id === accountId);
    const result = repository.importCsv(csv, accountId, account?.currency ?? state.settings.preferredCurrency);
    if (result.items.length) updateState((current) => ({ ...current, transactions: [...result.items.map((item) => ({ ...item, ...captureCurrencySnapshot(item.amount, item.currency, current.settings.preferredCurrency, current.settings.exchangeRates ?? { USD: 1 }) })), ...current.transactions] }));
    return result.errors;
  }, [repository, state.accounts, state.settings.preferredCurrency, updateState]);

  const resetData = React.useCallback(() => setState(repository.reset()), [repository]);

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
