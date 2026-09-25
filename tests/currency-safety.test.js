import { test, expect } from 'vitest';
import {
  emptyFinanceState,
  normalizeFinanceState,
} from '../src/features/app-state/infrastructure/storage/appStateStorage';
import {
  currencyRate,
  captureCurrencySnapshot,
  historicalAmountInCurrency,
} from '../src/shared/domain/finance/currency';
import {
  addTransfer,
  updateTransaction,
  updateAccount,
} from '../src/features/finance/application/commands/financeCommands';
import { changeStoreCurrency } from '../src/features/store/domain/services/storeDomain';
import { reconcileCurrencySettings } from '../src/features/app-state/application/useCases/reconcileCurrencySettings';
import { hasFinanceImportIntegrity } from '../src/features/backup/application/services/backupIntegrity';
import { recordSavingsContribution } from '../src/features/finance/application/services/financeStateOperations';
import { descriptionSuggestions } from '../src/shared/domain/finance/descriptionSuggestions';
import {
  createStoreBackup,
  parseStoreBackup,
} from '../src/features/backup/infrastructure/backups/backupSerialization';
import { resolveImportedFinanceState } from '../src/features/finance/application/services/financeStateOperations';

const account = (id, currency) => ({
  id,
  currency,
  name: id,
  type: 'cash',
  openingBalance: 0,
  archived: false,
  color: '#fff',
});
const fixture = () => {
  const state = emptyFinanceState();
  state.accounts = [account('usd', 'USD'), account('eur', 'EUR'), account('jpy', 'JPY')];
  state.settings.exchangeRates = { USD: 1, EUR: 1.2, CUP: 1 / 500 };
  return state;
};

test('currency rates reject invalid codes and values and keep USD anchored', () => {
  expect(currencyRate('', '', {})).toBeUndefined();
  expect(currencyRate('EUR', 'USD', { EUR: Infinity })).toBeUndefined();
  expect(currencyRate('EUR', 'USD', { EUR: 0 })).toBeUndefined();
  expect(currencyRate('EUR', 'USD', { EUR: -1 })).toBeUndefined();
  expect(currencyRate('EUR', 'JPY', { EUR: 1e308, JPY: 1e-308 })).toBeUndefined();
  expect(currencyRate(' usd ', 'cup', { USD: 123, CUP: 1 / 500 })).toBe(500);
  expect(captureCurrencySnapshot(10, 'eur', ' usd ', { EUR: 1.2 })).toEqual({
    baseAmount: 12,
    baseCurrency: 'USD',
  });
  expect(captureCurrencySnapshot(Infinity, 'USD', 'USD', {})).toEqual({});
  const state = fixture();
  state.settings.exchangeRates = { USD: 8, ' eur ': 1.2, BAD: Infinity };
  expect(normalizeFinanceState(state).settings.exchangeRates).toEqual({ USD: 1, EUR: 1.2 });
});

test('editing descriptions keeps history; moving to a different currency discards the previous snapshot', () => {
  const state = fixture();
  const transaction = {
    id: 't',
    accountId: 'eur',
    currency: 'EUR',
    amount: 10,
    baseAmount: 12,
    baseCurrency: 'USD',
    kind: 'expense',
    status: 'cleared',
    date: '2026-09-21',
    description: 'Lunch',
  };
  state.transactions = [transaction];
  state.settings.exchangeRates.EUR = 2;
  const edited = updateTransaction(state, { ...transaction, description: 'Dinner' });
  expect(edited.transactions[0].baseAmount).toBe(12);
  expect(updateTransaction(state, { ...transaction, amount: 20 }).transactions[0].baseAmount).toBe(
    24,
  );
  const moved = updateTransaction(state, { ...transaction, accountId: 'jpy', currency: 'JPY' });
  expect(moved.transactions[0].baseAmount).toBeUndefined();
  expect(moved.transactions[0].baseCurrency).toBeUndefined();
  expect(
    historicalAmountInCurrency(moved.transactions[0], 'USD', state.settings.exchangeRates),
  ).toBeUndefined();
  expect(updateTransaction(state, { ...transaction, amount: Infinity })).toBe(state);
  expect(updateTransaction(state, { ...transaction, currency: 'USD' })).toBe(state);
  expect(updateAccount(state, { ...state.accounts[1], currency: 'USD' })).toBe(state);
  expect(
    hasFinanceImportIntegrity({ ...state, transactions: [{ ...transaction, currency: 'USD' }] }),
  ).toBe(false);
});

test('transfers validate amounts, rates and accounts and retain their original store currency', () => {
  const state = fixture();
  const transfer = {
    id: 'transfer',
    fromAccountId: 'usd',
    toAccountId: 'eur',
    fromAmount: 12,
    toAmount: 10,
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    rate: 10 / 12,
    fee: 0,
    date: '2026-09-21',
    note: '',
    status: 'cleared',
  };
  const result = addTransfer(state, transfer);
  expect(result.transactions).toHaveLength(2);
  expect(addTransfer(result, transfer)).toBe(result);
  for (const overrides of [
    { rate: Infinity },
    { toAmount: Infinity },
    { fromAmount: NaN },
    { fee: -1 },
    { toAmount: 13 },
    { toAccountId: 'missing' },
    { toCurrency: 'CUP' },
    { toAccountId: 'usd', toCurrency: 'USD' },
  ]) {
    expect(addTransfer(state, { ...transfer, ...overrides })).toBe(state);
  }
  const funded = addTransfer(state, {
    ...transfer,
    toAccountId: 'store-business',
    toCurrency: 'USD',
    toAmount: 12,
    rate: 1,
  });
  expect(funded.store.cashMovements[0].currency).toBe('USD');
  const changed = changeStoreCurrency(funded, 'CUP', state.settings.exchangeRates, false);
  expect(changed.state.store.businessAccount.balance).toBe(6000);
  expect(changed.state.store.cashMovements[0].amount).toBe(12);
  expect(changed.state.transfers[0]).toEqual(funded.transfers[0]);
  const restored = changeStoreCurrency(changed.state, 'USD', state.settings.exchangeRates, false);
  expect(restored.state.store.businessAccount.balance).toBe(12);
  expect(
    changeStoreCurrency(restored.state, 'USD', state.settings.exchangeRates, false).state,
  ).toBe(restored.state);
});

test('rate changes refresh derived balances without rewriting history and reject overflow atomically', () => {
  const state = fixture();
  state.store.cashMovements = [
    { id: 'cash', amount: 10, currency: 'EUR', type: 'funding', date: '2026-09-21', note: '' },
  ];
  const next = reconcileCurrencySettings(state, {
    ...state,
    settings: { ...state.settings, exchangeRates: { ...state.settings.exchangeRates, EUR: 2 } },
  });
  expect(next.store.businessAccount.balance).toBe(20);
  expect(next.accounts[1].exchangeRate).toBe(2);
  expect(next.store.cashMovements).toBe(state.store.cashMovements);
  expect(next.transactions).toBe(state.transactions);
  const overflowing = {
    ...state,
    store: {
      ...state.store,
      cashMovements: [1, 2].map((id) => ({ id, amount: 1e308, currency: 'USD', type: 'funding' })),
    },
  };
  const failed = changeStoreCurrency(overflowing, 'EUR', { USD: 1, EUR: 1 });
  expect(failed.error).toBe('missing-rate');
  expect(failed.state).toBe(overflowing);
});

test('savings cannot be silently relabeled into another destination currency', () => {
  const state = fixture();
  state.savingsGoals = [
    {
      id: 'goal',
      accountId: 'eur',
      currency: 'EUR',
      targetAmount: 100,
      balance: 0,
      contributions: [],
    },
  ];
  const result = recordSavingsContribution(state, {
    goalId: 'goal',
    sourceAccountId: 'eur',
    destinationAccountId: 'usd',
    amount: 10,
    sourceAmount: 12,
    date: '2026-09-21',
    transferId: 't',
    contributionId: 'c',
  });
  expect(result).toBe(state);
  expect(updateAccount(state, { ...state.accounts[1], currency: 'USD' })).toBe(state);
});

test('saved descriptions autocomplete without duplicates, respecting accents and prefix priority', () => {
  const history = ['Café central', 'CAFÉ CENTRAL', 'Compra de café', 'Cafetería', '', 'Gasolina'];
  expect(descriptionSuggestions(history, 'cafe')).toEqual([
    'Café central',
    'Cafetería',
    'Compra de café',
  ]);
  expect(descriptionSuggestions(history, 'Café central')).toEqual([]);
  expect(descriptionSuggestions(history, '')).toEqual([]);
  expect(descriptionSuggestions(history, 'cafe', 2)).toEqual(['Café central', 'Cafetería']);
});

test('store backups keep exchange rates and finance-only imports retain rates needed by the local store', async () => {
  const current = fixture();
  current.store.currency = 'CUP';
  const backup = await createStoreBackup(current.store, current.settings.exchangeRates);
  expect(parseStoreBackup(JSON.stringify(backup)).exchangeRates).toEqual(
    current.settings.exchangeRates,
  );
  expect(
    parseStoreBackup(JSON.stringify(await createStoreBackup(current.store))).exchangeRates,
  ).toBeUndefined();
  expect(() =>
    parseStoreBackup(JSON.stringify({ ...backup, exchangeRates: { USD: 2 } })),
  ).toThrow();
  const imported = emptyFinanceState();
  const merged = resolveImportedFinanceState(current, imported, true);
  expect(merged.settings.exchangeRates.CUP).toBe(1 / 500);
  expect(merged.store.currency).toBe('CUP');
});
