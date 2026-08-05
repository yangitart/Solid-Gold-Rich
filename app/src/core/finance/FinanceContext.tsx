import React from 'react';
import { Alert } from 'react-native';
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
import { emptyFinanceState, importCsv, loadFinanceState, saveFinanceState } from './storage';

type FinanceContextValue = {
  state: FinanceState;
  loaded: boolean;
  updateState: (updater: (state: FinanceState) => FinanceState) => void;
  addAccount: (account: Account) => void;
  updateAccount: (account: Account) => void;
  archiveAccount: (id: string) => void;
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
  if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return next.toISOString();
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<FinanceState>(emptyFinanceState);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void loadFinanceState()
      .then((loadedState) => {
        if (active) setState(loadedState);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (loaded) void saveFinanceState(state);
  }, [loaded, state]);

  React.useEffect(() => {
    if (!loaded) return;
    const due = state.recurring.filter((item) => item.active && new Date(item.nextDate).getTime() <= Date.now() && item.lastGeneratedDate !== item.nextDate);
    if (!due.length) return;
    setState((current) => {
      const generated: Transaction[] = [];
      const recurring = current.recurring.map((item) => {
        const rule = due.find((candidate) => candidate.id === item.id);
        if (!rule) return item;
        generated.push({
          id: newId('recurring'), accountId: item.accountId, kind: item.kind, amount: item.amount, currency: item.currency,
          date: item.nextDate, payee: item.payee, category: item.category, paymentMethod: item.paymentMethod, status: 'cleared',
          reference: item.id, description: item.description, recurringId: item.id,
        });
        return { ...item, lastGeneratedDate: item.nextDate, nextDate: nextRecurringDate(item.nextDate, item.frequency) };
      });
      return { ...current, recurring, transactions: [...generated, ...current.transactions] };
    });
  }, [loaded, state.recurring]);

  const updateState = React.useCallback((updater: (current: FinanceState) => FinanceState) => {
    setState((current) => updater(current));
  }, []);

  const addAccount = React.useCallback((account: Account) => updateState((current) => ({ ...current, accounts: [...current.accounts, account] })), [updateState]);
  const updateAccount = React.useCallback((account: Account) => updateState((current) => ({ ...current, accounts: replaceById(current.accounts, account) })), [updateState]);
  const archiveAccount = React.useCallback((id: string) => updateState((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? { ...item, archived: true } : item) })), [updateState]);
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

  const importJson = React.useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as FinanceState;
      if (!parsed || parsed.schemaVersion !== 2 || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions)) return false;
      setState({ ...emptyFinanceState(), ...parsed, schemaVersion: 2 });
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

  const resetData = React.useCallback(() => {
    Alert.alert('Reset data', 'This removes all local financial data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setState(emptyFinanceState()) },
    ]);
  }, []);

  const value = React.useMemo(() => ({
    state, loaded, updateState, addAccount, updateAccount, archiveAccount, addTransaction, updateTransaction,
    deleteTransaction, addTransfer, deleteTransfer, addBudget, updateBudget, deleteBudget, addRecurring,
    updateRecurring, addDebt, updateDebt, addSavingsGoal, updateSavingsGoal, addReminder, updateReminder,
    addNote, updateNote, addNoteFolder, updateNoteFolder, deleteNoteFolder, updateCategories, importJson, importCsvText, resetData,
  }), [state, loaded, updateState, addAccount, updateAccount, archiveAccount, addTransaction, updateTransaction, deleteTransaction, addTransfer, deleteTransfer, addBudget, updateBudget, deleteBudget, addRecurring, updateRecurring, addDebt, updateDebt, addSavingsGoal, updateSavingsGoal, addReminder, updateReminder, addNote, updateNote, addNoteFolder, updateNoteFolder, deleteNoteFolder, updateCategories, importJson, importCsvText, resetData]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = React.useContext(FinanceContext);
  if (!context) throw new Error('useFinance must be used inside FinanceProvider');
  return context;
}
