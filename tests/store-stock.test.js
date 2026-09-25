import assert from 'node:assert/strict';
import { test } from 'vitest';
import { emptyFinanceState } from '../src/features/app-state/infrastructure/storage/appStateStorage';
import {
  completeSale,
  filterStoreProducts,
  productStockIndex,
  voidSale,
} from '../src/features/store/domain/services/storeDomain';

const product = (id, overrides = {}) => ({
  id,
  key: id,
  name: id,
  type: 'product',
  categoryId: 'general',
  initialStock: 10,
  reservedQuantity: 2,
  stockMinimum: 3,
  purchasePrice: 1,
  salePrice: 2,
  additionalSalePrices: [],
  active: true,
  ...overrides,
});
const filters = { type: 'product', query: '', categoryId: '', status: 'active', stock: 'low' };

test('stock snapshots preserve initial movements, reservations, services and sale reversals', () => {
  const state = emptyFinanceState();
  state.store.products = [
    product('initial'),
    product('legacy'),
    product('reserved', { reservedQuantity: 20 }),
    product('service', { type: 'service' }),
  ];
  state.store.stockMovements = [
    { productId: 'initial', type: 'initial', quantity: 5 },
    { productId: 'legacy', type: 'exit', quantity: -1 },
    { productId: 'service', type: 'entry', quantity: 50 },
    { productId: 'missing', type: 'entry', quantity: 50 },
  ];
  const before = productStockIndex(state);
  assert.deepEqual(
    [...before],
    [
      ['initial', 5],
      ['legacy', 9],
      ['reserved', 10],
      ['service', 0],
    ],
  );
  assert.deepEqual(
    filterStoreProducts(state, filters, before).map((item) => item.id),
    ['initial'],
  );
  assert.deepEqual(
    filterStoreProducts(state, { ...filters, stock: 'out' }, before).map((item) => item.id),
    ['reserved'],
  );
  const sale = {
    id: 'sale',
    date: '2026-09-21T12:00:00.000Z',
    items: [
      {
        productId: 'initial',
        name: 'initial',
        type: 'product',
        quantity: 2,
        unitPrice: 2,
        total: 4,
      },
    ],
    total: 4,
    status: 'completed',
    note: '',
  };
  const sold = completeSale(state, sale, (prefix) => `${prefix}-1`, '', '');
  assert.equal(sold.error, undefined);
  assert.equal(productStockIndex(sold.state).get('initial'), 3);
  assert.equal(before.get('initial'), 5);
  const restored = voidSale(sold.state, sale.id, (prefix) => `${prefix}-2`, '', '');
  assert.equal(restored.error, undefined);
  assert.equal(productStockIndex(restored.state).get('initial'), 5);
});

test('text and expiration searches do not scan stock movements; stock filters reuse the snapshot', () => {
  const state = emptyFinanceState();
  state.store.products = [product('initial', { expirationDate: '2026-09-20T12:00:00.000Z' })];
  const stock = productStockIndex(state);
  Object.defineProperty(state.store, 'stockMovements', {
    get() {
      assert.fail('Search must not rescan stock movements');
    },
  });
  const today = new Date(2026, 8, 21);
  for (const filter of ['', 'expired', 'expiring']) {
    const result = filterStoreProducts(state, { ...filters, stock: filter, today });
    assert.equal(result.length, filter === 'expiring' ? 0 : 1);
  }
  assert.equal(filterStoreProducts(state, filters, stock).length, 0);
  assert.equal(filterStoreProducts(state, { ...filters, stock: 'out' }, stock).length, 0);
});
