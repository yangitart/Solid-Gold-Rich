const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const storage = new Map();
const fileContents = new Map();
const asyncStorage = {
  getItem: async (key) => storage.get(key) ?? null,
  setItem: async (key, value) => storage.set(key, value),
  multiRemove: async (keys) => keys.forEach((key) => storage.delete(key)),
};
class MockFile {
  constructor(uri) {
    this.uri = String(uri);
  }

  async base64() {
    if (!fileContents.has(this.uri)) throw new Error('file-not-found');
    return fileContents.get(this.uri);
  }
}
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return asyncStorage;
  if (request === 'expo-file-system') return { File: MockFile };
  return originalLoad.call(this, request, parent, isMain);
};

const {
  accountBalance,
  advanceRecurringDate,
  budgetSpent,
  generateDueRecurring,
  recordDebtPayment,
  recordSavingsContribution,
  removeTransfer,
} = require('../src/domain/finance/financeDomain.ts');
const {
  completeSale,
  productStock,
  storeReportData,
  voidSale,
} = require('../src/domain/store/storeDomain.ts');
const { currencyRate } = require('../src/core/finance/currency.ts');
const {
  createStoreBackup,
  parseStoreBackup,
  restoreStoreBackup,
} = require('../src/domain/store/storeBackup.ts');
const {
  emptyFinanceState,
  loadFinanceState,
  normalizeFinanceState,
  saveFinanceState,
} = require('../src/stores/financeStorage.ts');

function account(id, currency = 'USD', openingBalance = 0) {
  return { id, name: id, type: 'cash', currency, openingBalance, color: '#fff', archived: false };
}

async function run() {
  assert.equal(currencyRate('EUR', 'CUP', { USD: 1, EUR: 1.1, CUP: 0.04 }), 27.5);
  assert.equal(currencyRate('EUR', 'CUP', { USD: 1, EUR: 1.1 }), undefined);

  const balances = emptyFinanceState();
  balances.accounts = [account('a', 'USD', 100)];
  balances.transactions = [
    { id: 'income', accountId: 'a', kind: 'income', amount: 25, currency: 'USD', date: '2026-01-01', payee: '', category: 'other', paymentMethod: 'cash', status: 'cleared', reference: '', description: '' },
    { id: 'void', accountId: 'a', kind: 'expense', amount: 999, currency: 'USD', date: '2026-01-01', payee: '', category: 'other', paymentMethod: 'cash', status: 'void', reference: '', description: '' },
  ];
  assert.equal(accountBalance(balances, 'a'), 125);
  const spent = budgetSpent({ id: 'b', accountId: 'a', category: 'food', period: 'monthly', startDate: '', endDate: '', limit: 100, rollover: false, rolloverAmount: 0 }, [
    { ...balances.transactions[0], id: 'expense', kind: 'expense', category: 'food', amount: 10, date: '2026-01-10T12:00:00.000Z' },
    { ...balances.transactions[0], id: 'transfer', kind: 'transfer', category: 'food', amount: 99, date: '2026-01-10T12:00:00.000Z', transferId: 'x' },
  ], 'USD', { start: new Date('2026-01-01'), end: new Date('2026-02-01') }, () => 1);
  assert.equal(spent, 10);
  const generalSpent = budgetSpent({ id: 'all', accountId: 'a', category: 'all', period: 'monthly', startDate: '', endDate: '', limit: 100, rollover: false, rolloverAmount: 0 }, [
    { ...balances.transactions[0], id: 'food', kind: 'expense', category: 'food', amount: 10, date: '2026-01-10T12:00:00.000Z' },
    { ...balances.transactions[0], id: 'housing', kind: 'expense', category: 'housing', amount: 20, date: '2026-01-11T12:00:00.000Z' },
    { ...balances.transactions[0], id: 'other-account', accountId: 'b', kind: 'expense', category: 'food', amount: 30, date: '2026-01-12T12:00:00.000Z' },
  ], 'USD', { start: new Date('2026-01-01'), end: new Date('2026-02-01') }, () => 1);
  assert.equal(generalSpent, 30);

  const jan31 = '2025-01-31T12:00:00.000Z';
  assert.equal(new Date(advanceRecurringDate(jan31, 'monthly')).getUTCDate(), 28);
  const recurring = [{ id: 'r', accountId: 'a', kind: 'expense', amount: 10, currency: 'USD', payee: 'Rent', category: 'housing', paymentMethod: 'bank', frequency: 'monthly', nextDate: jan31, description: '', active: true }];
  const generated = generateDueRecurring(recurring, [], new Date('2025-03-31T23:00:00.000Z'), (() => { let id = 0; return () => `g-${++id}`; })());
  assert.equal(generated.generated.length, 3);
  assert.equal(new Set(generated.generated.map((item) => `${item.recurringId}|${item.date}`)).size, 3);
  assert.equal(generateDueRecurring(generated.recurring, generated.transactions, new Date('2025-03-31T23:00:00.000Z'), () => 'duplicate').generated.length, 0);
  for (const day of [29, 30, 31]) {
    const first = `2025-01-${day}T12:00:00.000Z`;
    const sequence = generateDueRecurring([{ ...recurring[0], id: `r-${day}`, nextDate: first, dayOfMonth: day }], [], new Date('2025-03-31T23:00:00.000Z'), (() => { let id = 0; return () => `d-${day}-${++id}`; })());
    assert.deepEqual(sequence.generated.map((item) => new Date(item.date).getUTCDate()), [day, 28, day]);
  }

  const linked = emptyFinanceState();
  linked.accounts = [account('from'), account('to')];
  linked.transfers = [{ id: 'tr', fromAccountId: 'from', toAccountId: 'to', fromAmount: 50, toAmount: 50, fromCurrency: 'USD', toCurrency: 'USD', rate: 1, fee: 0, date: jan31, note: '', status: 'cleared' }];
  linked.transactions = [
    { id: 'out', accountId: 'from', kind: 'transfer', amount: 50, currency: 'USD', date: jan31, payee: '', category: 'transfer', paymentMethod: 'transfer', status: 'cleared', reference: '', description: '', transferId: 'tr' },
    { id: 'in', accountId: 'to', kind: 'income', amount: 50, currency: 'USD', date: jan31, payee: '', category: 'transfer', paymentMethod: 'transfer', status: 'cleared', reference: '', description: '', transferId: 'tr' },
  ];
  linked.savingsGoals = [{ id: 'goal', name: 'Goal', currency: 'USD', targetAmount: 100, balance: 50, deadline: jan31, accountId: 'to', contributions: [{ id: 'c', amount: 50, date: jan31, note: '', fromAccountId: 'from', transferId: 'tr' }], active: true }];
  const unlinked = removeTransfer(linked, 'tr');
  assert.equal(unlinked.transactions.length, 0);
  assert.equal(unlinked.savingsGoals[0].balance, 0);

  const obligations = emptyFinanceState();
  obligations.accounts = [account('cash', 'USD', 200), account('savings', 'USD', 0)];
  obligations.debts = [{ id: 'debt', name: 'Debt', creditor: 'Bank', currency: 'USD', originalAmount: 100, balance: 100, interestRate: 0, dueDate: jan31, payments: [], active: true }];
  obligations.savingsGoals = [{ id: 'save', name: 'Reserve', currency: 'USD', targetAmount: 100, balance: 0, deadline: jan31, accountId: 'savings', contributions: [], active: true }];
  const paid = recordDebtPayment(obligations, { debtId: 'debt', accountId: 'cash', amount: 30, accountAmount: 30, date: jan31, transactionId: 'debt-tx', paymentId: 'debt-pay' });
  assert.equal(paid.debts[0].balance, 70);
  assert.equal(recordDebtPayment(paid, { debtId: 'debt', accountId: 'cash', amount: 30, accountAmount: 30, date: jan31, transactionId: 'debt-tx', paymentId: 'debt-pay' }).transactions.length, 1);
  const contributed = recordSavingsContribution(paid, { goalId: 'save', sourceAccountId: 'cash', destinationAccountId: 'savings', amount: 40, sourceAmount: 40, date: jan31, transferId: 'save-tr', contributionId: 'save-c' });
  assert.equal(contributed.savingsGoals[0].balance, 40);
  assert.equal(contributed.transfers.length, 1);
  assert.equal(recordSavingsContribution(contributed, { goalId: 'save', sourceAccountId: 'cash', destinationAccountId: 'savings', amount: 40, sourceAmount: 40, date: jan31, transferId: 'save-tr', contributionId: 'save-c' }).transfers.length, 1);

  let storeState = emptyFinanceState();
  storeState.store.products = [{ id: 'p', key: 'P1', name: 'Product', type: 'product', unit: 'unit', categoryId: 'general', salePrice: 12, purchasePrice: 5, additionalSalePrices: [], initialStock: 0, reservedQuantity: 0, stockMinimum: 1, active: true }];
  storeState.store.stockMovements = [{ id: 'opening', productId: 'p', type: 'initial', quantity: 5, date: jan31, note: '' }];
  const sale = { id: 'sale', date: jan31, items: [{ productId: 'p', name: 'Product', type: 'product', quantity: 2, unitPrice: 12, total: 24 }], total: 24, status: 'completed', note: '', clientId: 'client' };
  const sold = completeSale(storeState, sale, (prefix) => `${prefix}-1`, 'sale', 'income');
  assert.equal(sold.error, undefined);
  assert.equal(productStock(sold.state, 'p'), 3);
  assert.equal(sold.state.store.businessAccount.balance, 24);
  assert.equal(completeSale(sold.state, sale, () => 'duplicate', '', '').error, 'duplicate');
  const voided = voidSale(sold.state, 'sale', (prefix) => `${prefix}-2`, 'reversal', 'reversal');
  assert.equal(productStock(voided.state, 'p'), 5);
  assert.equal(voided.state.store.businessAccount.balance, 0);
  assert.equal(voidSale(voided.state, 'sale', () => 'again', '', '').error, 'already-void');
  const report = storeReportData(sold.state);
  assert.equal(report.topProducts[0][1].quantity, 2);
  assert.equal(report.topClients[0][0], 'client');

  const emptyStoreBackup = await createStoreBackup(emptyFinanceState().store);
  assert.equal(emptyStoreBackup.kind, 'solid-gold-rich-store');
  assert.deepEqual(emptyStoreBackup.store.products, []);

  const productTemplate = { id: 'photo-product', key: 'PHOTO', name: 'Photo product', type: 'product', unit: 'unit', categoryId: 'general', salePrice: 10, purchasePrice: 4, additionalSalePrices: [], initialStock: 0, reservedQuantity: 0, stockMinimum: 0, active: true };
  fileContents.set('file:///product.jpg', 'aW1hZ2U=');
  const storeWithPictures = emptyFinanceState().store;
  storeWithPictures.products = [
    { ...productTemplate, picture: 'file:///product.jpg' },
    { ...productTemplate, id: 'embedded-product', key: 'EMBEDDED', picture: 'data:image/png;base64,cG5n' },
    { ...productTemplate, id: 'no-picture-product', key: 'PLAIN', picture: undefined },
  ];
  const pictureBackup = await createStoreBackup(storeWithPictures);
  assert.deepEqual(pictureBackup.store.products.map((product) => product.picture), [
    { mimeType: 'image/jpeg', data: 'aW1hZ2U=' },
    { mimeType: 'image/png', data: 'cG5n' },
    undefined,
  ]);
  const restoredStore = restoreStoreBackup(parseStoreBackup(JSON.stringify(pictureBackup)));
  assert.deepEqual(restoredStore.products.map((product) => product.picture), [
    'data:image/jpeg;base64,aW1hZ2U=',
    'data:image/png;base64,cG5n',
    undefined,
  ]);
  assert.throws(() => parseStoreBackup('{"kind":"wrong"}'), /invalid-store-backup/);
  await assert.rejects(() => createStoreBackup({ ...storeWithPictures, products: [{ ...productTemplate, picture: 'file:///missing.jpg' }] }), /file-not-found/);

  const normalized = normalizeFinanceState({
    schemaVersion: 5,
    accounts: [account('safe'), null],
    transactions: [null, { id: 'valid', accountId: 'safe', kind: 'income', amount: 3, currency: 'USD' }],
    budgets: [
      { id: 'budget-safe-total', accountId: 'safe', category: 'all', period: 'monthly', limit: 2500 },
      { id: 'account-budget-safe', accountId: 'safe', category: 'all', period: 'monthly', limit: 900 },
    ],
    store: { categories: ['General', 'Food'], products: [null, { id: 'old', sku: 'OLD', name: 'Old', category: 'Food', salePrice: 2, costPrice: 1, initialStock: 4, type: 'product' }] },
  });
  assert.equal(normalized.schemaVersion, 6);
  assert.equal(normalized.transactions.length, 1);
  assert.deepEqual(normalized.budgets.map((item) => item.id), ['account-budget-safe']);
  assert.equal(normalized.store.products[0].categoryId, normalized.store.categories.find((item) => item.name === 'Food').id);

  storage.clear();
  storage.set('@solid-gold/finance-state-v5', JSON.stringify({ ...normalized, schemaVersion: 5 }));
  const migrated = await loadFinanceState();
  assert.equal(migrated.schemaVersion, 6);
  await saveFinanceState(migrated);
  assert.ok(storage.has('@solid-gold/finance-state-v6'));
  assert.equal(storage.has('@solid-gold/finance-state-v5'), false);

  console.log('Domain tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
