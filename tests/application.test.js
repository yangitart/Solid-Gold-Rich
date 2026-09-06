import { test } from 'vitest';
import { emptyFinanceState } from '../src/features/app-state/infrastructure/storage/appStateStorage';
import assert from 'node:assert/strict';
import {
  prepareJsonImport,
  importCsvIntoState,
} from '../src/features/app-state/application/useCases/importFinanceState.ts';
import { applyDueRecurring } from '../src/features/finance/application/useCases/applyDueRecurring.ts';

test('imports preserve current state and recurring operations are idempotent', () => {
  const current = emptyFinanceState();
  current.accounts = [{ id: 'a', name: 'Cash', currency: 'EUR', openingBalance: 0 }];
  assert.equal(prepareJsonImport({ parseJson: () => null }, 'invalid'), null);
  const imported = emptyFinanceState();
  const applyImport = prepareJsonImport({ parseJson: () => imported }, '{}', true);
  const latest = { ...current, store: { ...current.store, name: 'Latest local store' } };
  assert.equal(applyImport(latest).store.name, 'Latest local store');
  assert.equal(latest.store.name, 'Latest local store');

  const transaction = {
    id: 't',
    accountId: 'a',
    kind: 'income',
    amount: 10,
    currency: 'EUR',
    date: '2026-01-01',
    payee: '',
    category: 'other',
    paymentMethod: 'cash',
    status: 'completed',
    reference: '',
    description: '',
  };
  let parserArguments;
  const parser = {
    importCsv: (...args) => {
      parserArguments = args;
      return { items: [transaction], errors: ['row:3:invalid'] };
    },
  };
  const first = importCsvIntoState(current, parser, 'csv', 'a');
  assert.deepEqual(parserArguments, ['csv', 'a', 'EUR', current.accounts]);
  assert.equal(current.transactions.length, 0);
  assert.equal(first.state.transactions.length, 1);
  const second = importCsvIntoState(first.state, parser, 'csv', 'a');
  assert.equal(second.state, first.state);
  assert.deepEqual(second.errors, ['row:3:invalid', 'duplicates:1']);

  const now = new Date('2026-01-15T12:00:00Z');
  assert.equal(
    applyDueRecurring(current, now, () => {
      throw new Error('Unexpected ID allocation');
    }),
    current,
  );
  const recurringState = {
    ...current,
    recurring: [
      {
        id: 'r',
        accountId: 'a',
        kind: 'expense',
        amount: 10,
        currency: 'EUR',
        payee: 'Rent',
        category: 'housing',
        paymentMethod: 'bank',
        frequency: 'monthly',
        nextDate: now.toISOString(),
        description: '',
        active: true,
      },
    ],
  };
  const generated = applyDueRecurring(recurringState, now, () => 'generated');
  assert.equal(generated.transactions.length, 1);
  assert.equal(generated.transactions[0].id, 'generated');
  assert.equal(recurringState.transactions.length, 0);
  assert.equal(
    applyDueRecurring(generated, now, () => {
      throw new Error('Duplicate generation');
    }),
    generated,
  );
});
