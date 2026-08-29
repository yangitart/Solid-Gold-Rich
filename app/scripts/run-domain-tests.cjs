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
  constructor(...parts) {
    const values = parts.map((part) => typeof part === 'string' ? part : part.uri);
    this.uri = values.length === 1 ? values[0] : `${values[0].replace(/\/$/, '')}/${values.slice(1).map((value) => value.replace(/^\//, '')).join('/')}`;
  }

  async base64() {
    if (!fileContents.has(this.uri)) throw new Error('file-not-found');
    return fileContents.get(this.uri);
  }

  create() {}

  write(content) {
    fileContents.set(this.uri, content);
  }
}
class MockDirectory {
  constructor(...parts) {
    const values = parts.map((part) => typeof part === 'string' ? part : part.uri);
    this.uri = values.length === 1 ? values[0] : `${values[0].replace(/\/$/, '')}/${values.slice(1).map((value) => value.replace(/^\//, '')).join('/')}`;
  }

  create() {}
}
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return asyncStorage;
  if (request === 'expo-file-system') return { Directory: MockDirectory, File: MockFile, Paths: { document: 'file:///documents', cache: 'file:///cache' } };
  return originalLoad.call(this, request, parent, isMain);
};

const {
  accountBalance,
  advanceRecurringDate,
  budgetSpent,
  filterActivityTransactions,
  generateDueRecurring,
  inDateRange,
  periodBounds,
  previousPeriodBounds,
  recordDebtPayment,
  recordSavingsContribution,
  removeTransfer,
} = require('../src/domain/finance/financeDomain.ts');
const {
  changeStoreCurrency,
  completeSale,
  filterStoreProducts,
  filterStoreSales,
  productStock,
  storeReportData,
  storeStatistics,
  voidSale,
} = require('../src/domain/store/storeDomain.ts');
const { captureCurrencySnapshot, currencyRate, historicalAmountInCurrency } = require('../src/core/finance/currency.ts');
const {
  createStoreBackup,
  createAppBackup,
  isolateStoreBackupForImport,
  parseAppBackup,
  parseStoreBackup,
  restoreAppBackupToDevice,
  restoreStoreBackup,
  restoreStoreBackupToDevice,
} = require('../src/domain/store/storeBackup.ts');
const {
  DEFAULT_CATEGORIES,
  DEFAULT_STORE_CATEGORIES,
  emptyFinanceState,
  loadFinanceState,
  normalizeFinanceState,
  saveFinanceState,
} = require('../src/stores/financeStorage.ts');
const {
  FUTURE_CAPABILITIES,
  DEVELOPER_SUPPORT_CONFIG,
  PREMIUM_CONFIG,
  GOOGLE_IDENTITY_CONFIG,
  CLOUD_BACKUP_CONFIG,
  US_BANK_CONNECTION_CONFIG,
  areAllFutureCapabilitiesHidden,
} = require('../src/core/future/config.ts');

function account(id, currency = 'USD', openingBalance = 0) {
  return { id, name: id, type: 'cash', currency, openingBalance, color: '#fff', archived: false };
}

async function run() {
  assert.equal(areAllFutureCapabilitiesHidden(), true);
  assert.equal(Object.values(FUTURE_CAPABILITIES).some(Boolean), false);
  assert.equal(DEVELOPER_SUPPORT_CONFIG.destination, null);
  assert.equal(PREMIUM_CONFIG.billingProvider, null);
  assert.equal(GOOGLE_IDENTITY_CONFIG.backendBaseUrl, null);
  assert.equal(CLOUD_BACKUP_CONFIG.backendBaseUrl, null);
  assert.equal(US_BANK_CONNECTION_CONFIG.provider, null);
  assert.equal(US_BANK_CONNECTION_CONFIG.readOnly, true);
  assert.equal(US_BANK_CONNECTION_CONFIG.allowMoneyMovement, false);

  const emptyStateCategories = emptyFinanceState();
  assert.deepEqual(emptyStateCategories.categories.expense.map((item) => item.id), DEFAULT_CATEGORIES.expense.map((item) => item.id));
  assert.deepEqual(emptyStateCategories.categories.income.map((item) => item.id), DEFAULT_CATEGORIES.income.map((item) => item.id));
  assert.deepEqual(emptyStateCategories.store.categories.map((item) => item.id), DEFAULT_STORE_CATEGORIES.map((item) => item.id));
  assert.equal(currencyRate('EUR', 'CUP', { USD: 1, EUR: 1.1, CUP: 0.04 }), 27.5);
  assert.equal(currencyRate('EUR', 'CUP', { USD: 1, EUR: 1.1 }), undefined);
  const cupRates = { USD: 1, CUP: 1 / 670 };
  const cupSnapshot = captureCurrencySnapshot(100, 'CUP', 'USD', cupRates);
  assert.ok(Math.abs(cupSnapshot.baseAmount - (100 / 670)) < 1e-12);
  assert.equal(cupSnapshot.baseCurrency, 'USD');
  assert.equal(historicalAmountInCurrency({ amount: 100, currency: 'CUP', ...cupSnapshot }, 'USD', { USD: 1, CUP: 1 / 500 }), cupSnapshot.baseAmount);

  const marchRange = periodBounds('month', new Date(2026, 2, 15, 12), 1);
  const februaryRange = previousPeriodBounds('month', marchRange);
  assert.deepEqual([februaryRange.start.getFullYear(), februaryRange.start.getMonth(), februaryRange.start.getDate()], [2026, 1, 1]);
  assert.deepEqual([februaryRange.end.getFullYear(), februaryRange.end.getMonth(), februaryRange.end.getDate()], [2026, 2, 1]);
  const januaryRange = periodBounds('month', new Date(2026, 0, 8, 12), 1);
  const decemberRange = previousPeriodBounds('month', januaryRange);
  assert.deepEqual([decemberRange.start.getFullYear(), decemberRange.start.getMonth(), decemberRange.start.getDate()], [2025, 11, 1]);
  const yearRange = previousPeriodBounds('year', periodBounds('year', new Date(2026, 6, 1, 12), 1));
  assert.deepEqual([yearRange.start.getFullYear(), yearRange.end.getFullYear()], [2025, 2026]);
  const weekRange = periodBounds('week', new Date(2026, 7, 28, 12), 1);
  const previousWeekRange = previousPeriodBounds('week', weekRange);
  assert.equal(previousWeekRange.end.getTime(), weekRange.start.getTime());
  assert.equal(previousWeekRange.end.getTime() - previousWeekRange.start.getTime(), weekRange.end.getTime() - weekRange.start.getTime());
  assert.equal(inDateRange(weekRange.end.toISOString(), weekRange), false);

  const balances = emptyFinanceState();
  balances.accounts = [account('a', 'USD', 100)];
  balances.transactions = [
    { id: 'income', accountId: 'a', kind: 'income', amount: 25, currency: 'USD', date: '2026-01-01', payee: '', category: 'other', paymentMethod: 'cash', status: 'cleared', reference: '', description: '' },
    { id: 'void', accountId: 'a', kind: 'expense', amount: 999, currency: 'USD', date: '2026-01-01', payee: '', category: 'other', paymentMethod: 'cash', status: 'void', reference: '', description: '' },
  ];
  assert.equal(accountBalance(balances, 'a'), 125);
  const activityItems = [
    { ...balances.transactions[0], id: 'accented', payee: 'José', description: 'Café', amount: 25, currency: 'USD', reference: 'REF-25' },
    { ...balances.transactions[0], id: 'standalone-transfer', kind: 'transfer', amount: 12, category: 'transfer' },
    balances.transactions[1],
  ];
  assert.deepEqual(filterActivityTransactions(activityItems, { filter: 'transfer', category: 'all', query: '' }).map((item) => item.id), ['standalone-transfer']);
  assert.deepEqual(filterActivityTransactions(activityItems, { filter: 'income', category: 'all', query: 'cafe' }).map((item) => item.id), ['accented']);
  assert.deepEqual(filterActivityTransactions(activityItems, { filter: 'all', category: 'all', query: 'ref-25' }).map((item) => item.id), ['accented']);
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
  const generated = generateDueRecurring(recurring, [], new Date('2025-03-31T23:00:00.000Z'), (() => { let id = 0; return () => `g-${++id}`; })(), 'USD', { USD: 1 });
  assert.equal(generated.generated.length, 3);
  assert.equal(generated.generated[0].baseAmount, 10);
  assert.equal(generated.generated[0].baseCurrency, 'USD');
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
  assert.equal(paid.transactions[0].paymentMethod, 'cash');
  assert.equal(recordDebtPayment(paid, { debtId: 'debt', accountId: 'cash', amount: 30, accountAmount: 30, date: jan31, transactionId: 'debt-tx', paymentId: 'debt-pay' }).transactions.length, 1);
  const debtAccountState = { ...paid, accounts: [...paid.accounts, { ...account('debt-account'), type: 'debt' }] };
  assert.equal(recordDebtPayment(debtAccountState, { debtId: 'debt', accountId: 'debt-account', amount: 10, accountAmount: 10, date: jan31, transactionId: 'invalid-debt-tx', paymentId: 'invalid-debt-pay' }).transactions.length, paid.transactions.length);
  assert.equal(recordDebtPayment(paid, { debtId: 'debt', accountId: 'cash', amount: Number.NaN, accountAmount: Number.NaN, date: jan31, transactionId: 'invalid-nan-tx', paymentId: 'invalid-nan-pay' }).transactions.length, paid.transactions.length);
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
  assert.equal(storeReportData(voided.state).sales.length, 0);
  assert.equal(storeReportData(voided.state).total, 0);
  const report = storeReportData(sold.state);
  assert.equal(report.topProducts[0][1].quantity, 2);
  assert.equal(report.topClients[0][0], 'client');

  const filterState = emptyFinanceState();
  filterState.store.categories.push({ id: 'cafe', name: 'Café' });
  filterState.store.products = [
    { id: 'reserved-low', key: 'LOW', sku: 'SKU-LOW', name: 'Coffee', type: 'product', unit: 'unit', categoryId: 'cafe', salePrice: 2, purchasePrice: 1, additionalSalePrices: [], initialStock: 0, reservedQuantity: 9, stockMinimum: 2, active: true },
    { id: 'reserved-out', key: 'OUT', name: 'Milk', type: 'product', unit: 'unit', categoryId: 'general', salePrice: 2, purchasePrice: 1, additionalSalePrices: [], initialStock: 0, reservedQuantity: 5, stockMinimum: 1, active: true },
    { id: 'expired', key: 'EXP', name: 'Old', type: 'product', unit: 'unit', categoryId: 'general', salePrice: 2, purchasePrice: 1, additionalSalePrices: [], initialStock: 0, reservedQuantity: 0, stockMinimum: 0, expirationDate: '2025-01-30T12:00:00.000Z', active: false },
    { id: 'expiring', key: 'SOON', name: 'Fresh', type: 'product', unit: 'unit', categoryId: 'general', salePrice: 3, purchasePrice: 1, additionalSalePrices: [], initialStock: 0, reservedQuantity: 0, stockMinimum: 0, expirationDate: '2025-02-15T12:00:00.000Z', active: true },
    { id: 'service', key: 'SERV', name: 'Repair', type: 'service', unit: 'hour', categoryId: 'general', salePrice: 5, purchasePrice: 0, additionalSalePrices: [], initialStock: 0, reservedQuantity: 0, stockMinimum: 0, active: true },
  ];
  filterState.store.stockMovements = [
    { id: 'low-stock', productId: 'reserved-low', type: 'entry', quantity: 10, date: jan31, note: '' },
    { id: 'out-stock', productId: 'reserved-out', type: 'entry', quantity: 5, date: jan31, note: '' },
    { id: 'expiring-stock', productId: 'expiring', type: 'entry', quantity: 1, date: jan31, note: '' },
  ];
  const filterToday = new Date(jan31);
  assert.deepEqual(filterStoreProducts(filterState, { type: 'product', query: 'cafe', categoryId: '', status: '', stock: '', today: filterToday }).map((item) => item.id), ['reserved-low']);
  assert.deepEqual(filterStoreProducts(filterState, { type: 'product', query: '', categoryId: '', status: '', stock: 'low', today: filterToday }).map((item) => item.id), ['reserved-low']);
  assert.deepEqual(filterStoreProducts(filterState, { type: 'product', query: '', categoryId: '', status: '', stock: 'out', today: filterToday }).map((item) => item.id), ['reserved-out', 'expired']);
  assert.deepEqual(filterStoreProducts(filterState, { type: 'product', query: '', categoryId: '', status: 'inactive', stock: 'expired', today: filterToday }).map((item) => item.id), ['expired']);
  assert.deepEqual(filterStoreProducts(filterState, { type: 'product', query: '', categoryId: 'general', status: 'active', stock: 'expiring', today: filterToday }).map((item) => item.id), ['expiring']);
  assert.deepEqual(filterStoreProducts(filterState, { type: 'service', query: '', categoryId: '', status: '', stock: 'out', today: filterToday }), []);
  filterState.store.clients = [{ id: 'filter-client', name: 'José', active: true, createdAt: jan31 }];
  filterState.store.employees = [{ id: 'filter-employee', name: 'María', salary: 0, payFrequency: 'monthly', payMode: 'manual', active: true, createdAt: jan31 }];
  const saleTemplate = { items: [{ productId: 'reserved-low', name: 'Coffee', type: 'product', quantity: 1, unitPrice: 2, total: 2 }], total: 2, paymentMethod: 'cash', status: 'completed', note: 'Entrega rápida', clientId: 'filter-client', employeeId: 'filter-employee' };
  filterState.store.sales = [
    { ...saleTemplate, id: 'week-sale', date: jan31 },
    { ...saleTemplate, id: 'future-sale', date: '2025-02-03T12:00:00.000Z' },
  ];
  assert.deepEqual(filterStoreSales(filterState, { query: 'maria', period: 'all', firstDayOfWeek: 1, today: filterToday }).map((item) => item.id), ['week-sale', 'future-sale']);
  assert.deepEqual(filterStoreSales(filterState, { query: 'rapida', period: 'week', firstDayOfWeek: 1, today: filterToday }).map((item) => item.id), ['week-sale']);
  assert.deepEqual(filterStoreSales(filterState, { query: '', period: 'today', firstDayOfWeek: 1, today: filterToday }).map((item) => item.id), ['week-sale']);
  assert.deepEqual(filterStoreSales(filterState, { query: '', period: 'month', firstDayOfWeek: 1, today: filterToday }).map((item) => item.id), ['week-sale']);

  const currencyState = emptyFinanceState();
  currencyState.store.currency = 'USD';
  currencyState.store.businessAccount = { id: 'store-business', name: 'Business', currency: 'USD', balance: 10 };
  currencyState.store.products = [{ id: 'currency-product', key: 'MONEY', name: 'Money product', type: 'product', unit: 'unit', categoryId: 'general', salePrice: 10, purchasePrice: 4, additionalSalePrices: [9, 8], initialStock: 0, reservedQuantity: 0, stockMinimum: 1, active: true }];
  currencyState.store.stockMovements = [{ id: 'currency-stock', productId: 'currency-product', type: 'entry', quantity: 3, date: jan31, note: 'Keep stock', personalTransactionId: 'linked-purchase' }];
  currencyState.store.sales = [{ id: 'currency-sale', date: jan31, items: [{ productId: 'currency-product', name: 'Money product', type: 'product', quantity: 1, unitPrice: 10, total: 10 }], total: 10, status: 'completed', note: 'Keep sale' }, { id: 'void-sale', date: jan31, items: [{ productId: 'currency-product', name: 'Money product', type: 'product', quantity: 4, unitPrice: 10, total: 40 }], total: 40, status: 'void', note: 'Ignore void sale' }, { id: 'next-period-sale', date: '2025-02-01T00:00:00.000Z', items: [{ productId: 'currency-product', name: 'Money product', type: 'product', quantity: 1, unitPrice: 99, total: 99 }], total: 99, status: 'completed', note: 'Next period' }];
  currencyState.store.cashMovements = [{ id: 'currency-cash', type: 'funding', amount: 10, date: jan31, note: 'Keep cash', transferId: 'linked-transfer' }, { id: 'currency-outflow', type: 'purchase', amount: -4, date: jan31, note: 'Purchase' }];
  currencyState.store.employees = [{ id: 'currency-employee', name: 'Employee', salary: 20, payFrequency: 'monthly', payMode: 'manual', active: true, createdAt: jan31 }];
  const storeStats = storeStatistics(currencyState, { start: new Date('2025-01-01T00:00:00.000Z'), end: new Date('2025-02-01T00:00:00.000Z') });
  assert.equal(storeStats.saleCount, 1);
  assert.equal(storeStats.salesRevenue, 10);
  assert.equal(storeStats.cashOutflow, 4);
  assert.equal(storeStats.netFlow, 6);
  assert.equal(storeStats.averageSale, 10);
  assert.equal(storeStats.itemsSold, 1);
  assert.equal(storeStats.inventoryValue, 12);
  assert.equal(storeStats.activeProducts, 1);
  assert.equal(storeStats.lowStock, 0);
  assert.deepEqual(storeStats.topProducts.map((product) => [product.productId, product.quantity, product.total]), [['currency-product', 1, 10]]);
  const currencyChange = changeStoreCurrency(currencyState, 'CUP', { USD: 1, CUP: 0.04 });
  assert.equal(currencyChange.error, undefined);
  assert.equal(currencyChange.rate, 25);
  assert.equal(currencyChange.state.store.currency, 'CUP');
  assert.equal(currencyChange.state.store.businessAccount.currency, 'CUP');
  assert.equal(currencyChange.state.store.businessAccount.balance, 150);
  assert.equal(currencyChange.state.store.products[0].salePrice, 250);
  assert.equal(currencyChange.state.store.products[0].purchasePrice, 100);
  assert.deepEqual(currencyChange.state.store.products[0].additionalSalePrices, [225, 200]);
  assert.equal(currencyChange.state.store.sales[0].items[0].unitPrice, 250);
  assert.equal(currencyChange.state.store.sales[0].items[0].total, 250);
  assert.equal(currencyChange.state.store.sales[0].total, 250);
  assert.equal(currencyChange.state.store.cashMovements[0].amount, 250);
  assert.equal(currencyChange.state.store.employees[0].salary, 500);
  assert.equal(currencyChange.state.store.stockMovements[0].quantity, 3);
  assert.equal(currencyChange.state.store.stockMovements[0].date, jan31);
  assert.equal(currencyChange.state.store.stockMovements[0].personalTransactionId, 'linked-purchase');
  assert.equal(currencyChange.state.store.cashMovements[0].transferId, 'linked-transfer');
  const currencyRoundTrip = changeStoreCurrency(currencyChange.state, 'USD', { USD: 1, CUP: 0.04 }).state;
  assert.equal(currencyRoundTrip.store.products[0].salePrice, 10);
  assert.equal(currencyRoundTrip.store.sales[0].total, 10);
  assert.equal(currencyRoundTrip.store.businessAccount.balance, 6);
  assert.strictEqual(changeStoreCurrency(currencyState, 'EUR', { USD: 1 }).state, currencyState);
  assert.equal(changeStoreCurrency(currencyState, 'EUR', { USD: 1 }).error, 'missing-rate');

  const emptyStoreBackup = await createStoreBackup(emptyFinanceState().store);
  assert.equal(emptyStoreBackup.kind, 'solid-gold-rich-store');
  assert.deepEqual(emptyStoreBackup.store.products, []);

  const productTemplate = { id: 'photo-product', key: 'PHOTO', name: 'Photo product', type: 'product', unit: 'box', categoryId: 'custom', sku: 'PHOTO-SKU', salePrice: 10, purchasePrice: 4, additionalSalePrices: [9, 8], initialStock: 0, reservedQuantity: 1, stockMinimum: 2, expirationDate: jan31, additionalInfo: 'Complete product data', active: true };
  fileContents.set('file:///product.jpg', 'aW1hZ2U=');
  const storeWithPictures = emptyFinanceState().store;
  storeWithPictures.products = [
    { ...productTemplate, picture: 'file:///product.jpg' },
    { ...productTemplate, id: 'embedded-product', key: 'EMBEDDED', picture: 'data:image/png;base64,cG5n' },
    { ...productTemplate, id: 'no-picture-product', key: 'PLAIN', picture: undefined },
  ];
  storeWithPictures.name = 'Complete store';
  storeWithPictures.currency = 'CUP';
  storeWithPictures.categories.push({ id: 'custom', name: 'Custom' });
  storeWithPictures.stockMovements = [{ id: 'stock-all', productId: 'photo-product', type: 'entry', quantity: 4, date: jan31, note: 'Stock record' }];
  storeWithPictures.clients = [{ id: 'client-all', name: 'Client', phone: '123', email: 'client@example.com', note: 'Client note', active: true, createdAt: jan31 }];
  storeWithPictures.employees = [{ id: 'employee-all', name: 'Employee', role: 'Seller', phone: '456', salary: 25, payFrequency: 'weekly', payMode: 'manual', nextPayDate: jan31, active: true, createdAt: jan31 }];
  storeWithPictures.sales = [{ id: 'sale-all', date: jan31, items: [{ productId: 'photo-product', name: 'Photo product', type: 'product', quantity: 1, unitPrice: 10, total: 10 }], total: 10, paymentMethod: 'cash', status: 'completed', note: 'Sale note', clientId: 'client-all', employeeId: 'employee-all' }];
  storeWithPictures.cashMovements = [{ id: 'cash-all', type: 'sale', amount: 10, date: jan31, note: 'Cash record', saleId: 'sale-all' }];
  storeWithPictures.businessAccount = { id: 'store-business', name: 'Complete store', currency: 'CUP', balance: 10 };
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
  assert.deepEqual({ ...restoredStore, products: restoredStore.products.map(({ picture, ...product }) => product) }, { ...storeWithPictures, products: storeWithPictures.products.map(({ picture, ...product }) => product) });
  const materializedStore = await restoreStoreBackupToDevice(parseStoreBackup(JSON.stringify(pictureBackup)));
  assert.ok(materializedStore.products[0].picture.startsWith('file:///documents/product-images/photo-product-'));
  assert.equal(fileContents.get(materializedStore.products[0].picture), 'aW1hZ2U=');
  assert.ok(materializedStore.products[1].picture.startsWith('file:///documents/product-images/embedded-product-'));
  assert.equal(fileContents.get(materializedStore.products[1].picture), 'cG5n');
  assert.equal(materializedStore.products[2].picture, undefined);
  const isolatedStore = isolateStoreBackupForImport({
    ...materializedStore,
    stockMovements: materializedStore.stockMovements.map((movement) => ({ ...movement, personalTransactionId: 'foreign-transaction' })),
    cashMovements: materializedStore.cashMovements.map((movement) => ({ ...movement, transferId: 'foreign-transfer', personalTransactionId: 'foreign-transaction' })),
  });
  assert.equal(isolatedStore.stockMovements.some((movement) => movement.personalTransactionId), false);
  assert.equal(isolatedStore.cashMovements.some((movement) => movement.transferId || movement.personalTransactionId), false);
  assert.equal(isolatedStore.sales[0].id, 'sale-all');
  const personalState = emptyFinanceState();
  personalState.accounts = [account('personal-safe', 'USD', 99)];
  personalState.transactions = [{ id: 'personal-operation', accountId: 'personal-safe', kind: 'income', amount: 5, currency: 'USD', date: jan31, payee: 'Personal', category: 'other', paymentMethod: 'cash', status: 'cleared', reference: '', description: 'Keep me' }];
  personalState.budgets = [{ id: 'personal-budget', accountId: 'personal-safe', category: 'all', period: 'monthly', startDate: jan31, endDate: '2025-02-28T12:00:00.000Z', limit: 50, rollover: false, rolloverAmount: 0 }];
  personalState.debts = [{ id: 'personal-debt', name: 'Debt', creditor: 'Bank', currency: 'USD', originalAmount: 20, balance: 20, interestRate: 0, dueDate: jan31, payments: [], active: true }];
  personalState.savingsGoals = [{ id: 'personal-goal', name: 'Goal', currency: 'USD', targetAmount: 30, balance: 0, deadline: jan31, accountId: 'personal-safe', contributions: [], active: true }];
  personalState.reminders = [{ id: 'personal-reminder', title: 'Reminder', date: jan31, note: 'Remember', completed: false }];
  personalState.notes = [{ id: 'personal-note', title: 'Note', body: 'Body', tags: ['tag'], createdAt: jan31, updatedAt: jan31, pinned: true }];
  const importedStoreOnly = normalizeFinanceState({ ...personalState, store: materializedStore });
  assert.equal(importedStoreOnly.accounts[0].id, 'personal-safe');
  assert.equal(importedStoreOnly.accounts[0].openingBalance, 99);
  assert.equal(importedStoreOnly.transactions[0].id, 'personal-operation');
  assert.equal(importedStoreOnly.store.products.length, 3);
  const completeState = { ...personalState, store: storeWithPictures };
  const appBackup = await createAppBackup(completeState);
  const serializedAppBackup = JSON.stringify(appBackup);
  assert.equal(serializedAppBackup.includes('file:///product.jpg'), false);
  assert.equal(serializedAppBackup.includes('aW1hZ2U='), true);
  const restoredApp = await restoreAppBackupToDevice(parseAppBackup(serializedAppBackup));
  const { store: expectedStore, ...expectedPersonalData } = completeState;
  const { store: restoredAppStore, ...restoredPersonalData } = restoredApp;
  assert.deepEqual(restoredPersonalData, expectedPersonalData);
  assert.equal(restoredApp.accounts[0].id, 'personal-safe');
  assert.equal(restoredApp.transactions[0].id, 'personal-operation');
  assert.equal(restoredApp.store.sales[0].id, 'sale-all');
  assert.ok(restoredApp.store.products[0].picture.startsWith('file:///documents/product-images/photo-product-'));
  assert.deepEqual({ ...restoredAppStore, products: restoredAppStore.products.map(({ picture, ...product }) => product) }, { ...expectedStore, products: expectedStore.products.map(({ picture, ...product }) => product) });
  assert.throws(() => parseAppBackup('{"kind":"solid-gold-rich-full","version":1}'), /invalid-app-backup/);
  assert.throws(() => parseStoreBackup('{"kind":"wrong"}'), /invalid-store-backup/);
  await assert.rejects(() => createStoreBackup({ ...storeWithPictures, products: [{ ...productTemplate, picture: 'file:///missing.jpg' }] }), /file-not-found/);

  const normalized = normalizeFinanceState({
    schemaVersion: 5,
    accounts: [account('safe'), null],
    transactions: [null, { id: 'valid', accountId: 'safe', kind: 'income', amount: 3, currency: 'USD' }, { id: 'orphan-category-operation', accountId: 'safe', kind: 'expense', amount: 2, currency: 'USD', category: 'legacy-expense' }],
    recurring: [{ id: 'orphan-category-recurring', accountId: 'safe', kind: 'income', amount: 1, currency: 'USD', category: 'legacy-income', frequency: 'monthly', nextDate: jan31, active: true }],
    budgets: [
      { id: 'budget-safe-total', accountId: 'safe', category: 'all', period: 'monthly', limit: 2500 },
      { id: 'account-budget-safe', accountId: 'safe', category: 'all', period: 'monthly', limit: 900 },
    ],
    categories: { expense: [{ id: 'subscriptions', icon: 'repeat-outline', name: 'Subscriptions' }], income: [{ id: 'commission', icon: 'cash-outline', name: 'Commission' }], tag: [] },
    store: { categories: ['General', 'Food', { id: 'custom-imported', name: 'Custom imported' }, { id: 'duplicate-food', name: 'Food' }], products: [null, { id: 'old', sku: 'OLD', name: 'Old', category: 'Food', salePrice: 2, costPrice: 1, initialStock: 4, type: 'product' }] },
  });
  assert.equal(normalized.schemaVersion, 7);
  assert.equal(normalized.transactions.length, 2);
  assert.equal(normalized.transactions[0].baseAmount, 3);
  assert.equal(normalized.transactions[0].baseCurrency, 'USD');
  assert.deepEqual(normalized.budgets.map((item) => item.id), ['account-budget-safe']);
  assert.equal(normalized.categories.expense.some((item) => item.id === 'food' && item.builtIn), true);
  assert.equal(normalized.categories.expense.some((item) => item.id === 'subscriptions' && !item.builtIn), true);
  assert.equal(normalized.categories.income.some((item) => item.id === 'salary' && item.builtIn), true);
  assert.equal(normalized.categories.income.some((item) => item.id === 'commission' && !item.builtIn), true);
  assert.equal(normalized.categories.expense.some((item) => item.id === 'legacy-expense' && !item.builtIn), true);
  assert.equal(normalized.categories.income.some((item) => item.id === 'legacy-income' && !item.builtIn), true);
  assert.equal(normalized.store.categories.filter((item) => item.name === 'Food').length, 1);
  assert.equal(normalized.store.categories.some((item) => item.id === 'custom-imported' && !item.builtIn), true);
  assert.equal(normalized.store.products[0].categoryId, normalized.store.categories.find((item) => item.name === 'Food').id);

  storage.clear();
  const legacyV6Transactions = normalized.transactions.map(({ baseAmount, baseCurrency, ...transaction }) => transaction);
  storage.set('@solid-gold/finance-state-v6', JSON.stringify({ ...normalized, schemaVersion: 6, transactions: legacyV6Transactions }));
  const migrated = await loadFinanceState();
  assert.equal(migrated.schemaVersion, 7);
  assert.equal(migrated.transactions[0].baseAmount, 3);
  await saveFinanceState(migrated);
  assert.ok(storage.has('@solid-gold/finance-state-v7'));
  assert.equal(storage.has('@solid-gold/finance-state-v6'), false);

  console.log('Domain tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
