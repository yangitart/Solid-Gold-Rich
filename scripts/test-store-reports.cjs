const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createStoreReportPdf, createStoreReportXlsx, filterStoreReportState } = require('../src/features/store/infrastructure/reports/reportExports.ts');
const { storeReportData, storeReportHasMissingRates } = require('../src/features/store/domain/services/storeDomain.ts');

module.exports = function testStoreReports(emptyFinanceState) {
  const state = emptyFinanceState();
  state.store.name = 'Café São José – Geschäft';
  state.store.currency = 'USD';
  state.settings.exchangeRates = { USD: 1, EUR: 1.2 };
  state.store.products = [{ id: 'p', key: 'P1', name: 'Café', type: 'product', currency: 'USD', initialStock: 20, reservedQuantity: 2, salePrice: 3 }];
  state.store.stockMovements = [];
  state.store.clients = [{ id: 'client', name: 'Ana García', active: true }];
  state.store.providers = [];
  state.store.employees = [{ id: 'e', name: 'Luís', salary: 50, salaryCurrency: 'EUR', active: true }];
  const date = new Date(2026, 8, 5, 12).toISOString();
  const longNote = 'Información de la operación y descripción detallada. '.repeat(20) + 'FINDELANOTA';
  state.store.cashMovements = [
    { id: 'opening', type: 'opening', amount: 100, date: new Date(2026, 7, 1, 12).toISOString(), note: '' },
    { id: 'sale', type: 'sale', amount: 10, currency: 'EUR', date, note: longNote },
  ];
  const sale = (id, status, saleDate = date) => ({ id, status, date: saleDate, clientId: 'client', currency: 'EUR', total: 10, items: [{ productId: 'p', name: longNote, quantity: 2, total: 10, type: 'product' }] });
  state.store.sales = [sale('valid', 'completed'), sale('void', 'void'), sale('outside', 'completed', new Date(2026, 8, 6, 0).toISOString())];
  const range = { start: date, end: date, label: '5 septiembre 2026' };
  const filtered = filterStoreReportState(state, range);
  assert.equal(storeReportData(filtered).sales.length, 1);
  assert.equal(storeReportData(filtered).total, 12);
  assert.equal(storeReportData(filtered).topClients[0][1].total, 12);
  assert.equal(filtered.store.cashMovements.length, 1);
  assert.equal(filtered.store.products, state.store.products);
  assert.throws(() => filterStoreReportState(state, { ...range, start: 'bad' }), /invalid-report-range/);
  assert.throws(() => filterStoreReportState(state, { ...range, start: '', end: date }), /invalid-report-range/);
  assert.throws(() => filterStoreReportState(state, { ...range, start: new Date(2026, 9, 1).toISOString() }), /invalid-report-range/);
  assert.equal(storeReportHasMissingRates(state), false);
  const missing = { ...state, settings: { exchangeRates: { USD: 1 } } };
  assert.equal(storeReportHasMissingRates(missing), true);
  const labels = Object.fromEntries(['title', 'generated', 'period', 'summary', 'sales', 'topProducts', 'topClients', 'moneyMovements', 'inventory', 'employees', 'clients', 'providers', 'date', 'name', 'type', 'quantity', 'amount', 'balance', 'role', 'contact', 'status', 'active', 'inactive', 'transactions', 'salePrice', 'available', 'stock', 'currency'].map((key) => [key, key]));
  Object.assign(labels, { title: 'Informe de la tienda', summary: 'Resumen', sales: 'Ventas', topProducts: 'Productos / servicios más vendidos', topClients: 'Clientes destacados', moneyMovements: 'Movimientos de dinero', inventory: 'Inventario actual', employees: 'Empleados', clients: 'Clientes', providers: 'Proveedores', balance: 'Saldo actual', amount: 'Importe', quantity: 'Cantidad', movementTypes: { sale: 'Venta', opening: 'Saldo inicial' } });
  assert.throws(() => createStoreReportPdf(missing, 'USD', 'es', labels, range), /missing-report-rate/);
  assert.throws(() => createStoreReportXlsx(missing, 'USD', 'es', labels, range), /missing-report-rate/);
  const pdf = Buffer.from(createStoreReportPdf(state, 'USD', 'es', labels, range));
  const text = pdf.toString('ascii');
  assert.ok(text.includes('FINDELANOTA'));
  assert.ok(text.includes('Caf\\351'));
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
  for (const match of text.matchAll(/^(\d{10}) 00000 n /gm)) {
    assert.match(text.slice(Number(match[1])), /^\d+ 0 obj/);
  }
  const xlsx = Buffer.from(createStoreReportXlsx(state, 'USD', 'es', labels, range));
  const xml = xlsx.toString('utf8');
  assert.ok(xml.includes('FINDELANOTA'));
  assert.ok(xml.includes('<v>112</v>')); // Current balance includes the earlier opening.
  assert.ok(xml.includes('<v>12</v>'));
  assert.ok(xml.includes('>EUR</t>')); // Salary keeps its original currency.
  assert.ok(xml.includes('>Venta</t>'));
  for (const match of xml.matchAll(/<sheet name="([^"]+)"/g)) assert.ok(match[1].length <= 31 && !/[\\/\[\]:*?]/.test(match[1]));
  const repeated = { ...labels, summary: 'Same', sales: 'Same', inventory: 'Same' };
  const repeatedXml = Buffer.from(createStoreReportXlsx(state, 'USD', 'en', repeated, range)).toString('utf8');
  assert.ok(repeatedXml.includes('name="Same (2)"'));
  const paginatedState = { ...state, store: { ...state.store, cashMovements: Array.from({ length: 8 }, (_, index) => ({ ...state.store.cashMovements[1], id: `long-${index}` })) } };
  const paginatedPdf = Buffer.from(createStoreReportPdf(paginatedState, 'USD', 'es', labels, range));
  assert.ok((paginatedPdf.toString('ascii').match(/\/Type \/Page /g) ?? []).length > 1);
  if (process.env.SOLID_GOLD_REPORT_QA_DIR) {
    const directory = process.env.SOLID_GOLD_REPORT_QA_DIR;
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'reports-qa.pdf'), pdf);
    fs.writeFileSync(path.join(directory, 'reports-qa.xlsx'), xlsx);
    fs.writeFileSync(path.join(directory, 'reports-pages-qa.pdf'), paginatedPdf);
  }
};
