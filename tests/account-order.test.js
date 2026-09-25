import { test } from 'vitest';
import assert from 'node:assert/strict';
import { reorderAccounts } from '../src/features/finance/application/commands/financeCommands';

test('reordering active accounts preserves archives and makes the first account primary', () => {
  const state = {
    accounts: [
      { id: 'a', archived: false },
      { id: 'archived-a', archived: true },
      { id: 'b', archived: false },
      { id: 'archived-b', archived: true },
      { id: 'c', archived: false },
    ],
    settings: { preferredCurrency: 'USD', activeAccountId: 'a' },
  };
  const moved = reorderAccounts(state, 'c', 0);
  assert.deepEqual(
    moved.accounts.map((account) => account.id),
    ['c', 'archived-a', 'a', 'archived-b', 'b'],
  );
  assert.equal(moved.settings.activeAccountId, 'c');
  assert.deepEqual(
    state.accounts.map((account) => account.id),
    ['a', 'archived-a', 'b', 'archived-b', 'c'],
  );
  assert.equal(reorderAccounts(moved, 'missing', 0), moved);
  assert.equal(reorderAccounts(moved, 'c', 0), moved);
});
