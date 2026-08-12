import type { FinanceState, StoreCashMovement, StoreProduct, StoreSale, StoreStockMovement } from '../../core/finance/types';
import { withStoreBalance } from '../finance/financeDomain';

export type StoreActionResult = { state: FinanceState; error?: 'duplicate' | 'missing-product' | 'insufficient-stock' | 'already-void' };

export function storeBalance(state: Pick<FinanceState, 'store'>) {
  return state.store.cashMovements.reduce((total, item) => total + item.amount, 0);
}

export function productStock(state: Pick<FinanceState, 'store'>, productId: string) {
  const product = state.store.products.find((item) => item.id === productId);
  if (!product || product.type === 'service') return 0;
  const movements = state.store.stockMovements.filter((item) => item.productId === productId);
  const legacyOpening = movements.some((item) => item.type === 'initial') ? 0 : product.initialStock;
  return legacyOpening + movements
    .reduce((total, movement) => total + movement.quantity, 0);
}

export function storeReportData(state: Pick<FinanceState, 'store'>) {
  const sales = state.store.sales.filter((item) => item.status === 'completed');
  const daily = Array.from(sales.reduce((map, sale) => {
    const date = new Date(sale.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const value = map.get(key) ?? { count: 0, total: 0 };
    map.set(key, { count: value.count + 1, total: value.total + sale.total });
    return map;
  }, new Map<string, { count: number; total: number }>())).sort(([left], [right]) => right.localeCompare(left));
  const topProducts = Array.from(sales.reduce((map, sale) => {
    sale.items.forEach((item) => {
      const value = map.get(item.productId) ?? { name: item.name, quantity: 0, total: 0 };
      map.set(item.productId, { name: value.name, quantity: value.quantity + item.quantity, total: value.total + item.total });
    });
    return map;
  }, new Map<string, { name: string; quantity: number; total: number }>())).sort(([, left], [, right]) => right.total - left.total).slice(0, 10);
  const topClients = Array.from(sales.reduce((map, sale) => {
    if (!sale.clientId) return map;
    const value = map.get(sale.clientId) ?? { count: 0, total: 0 };
    map.set(sale.clientId, { count: value.count + 1, total: value.total + sale.total });
    return map;
  }, new Map<string, { count: number; total: number }>())).sort(([, left], [, right]) => right.total - left.total).slice(0, 10);
  return { sales, daily, topProducts, topClients, total: sales.reduce((sum, sale) => sum + sale.total, 0) };
}

export function availableStock(state: Pick<FinanceState, 'store'>, product: StoreProduct) {
  return Math.max(0, productStock(state, product.id) - product.reservedQuantity);
}

export function appendCashMovement(state: FinanceState, movement: StoreCashMovement) {
  if (state.store.cashMovements.some((item) => item.id === movement.id)) return state;
  return withStoreBalance({ ...state, store: { ...state.store, cashMovements: [...state.store.cashMovements, movement] } });
}

export function validateSale(state: FinanceState, sale: StoreSale): StoreActionResult['error'] {
  if (state.store.sales.some((item) => item.id === sale.id)) return 'duplicate';
  for (const line of sale.items) {
    const product = state.store.products.find((item) => item.id === line.productId && item.active);
    if (!product) return 'missing-product';
    if (product.type === 'product' && line.quantity > availableStock(state, product)) return 'insufficient-stock';
  }
  return undefined;
}

export function completeSale(
  state: FinanceState,
  sale: StoreSale,
  createId: (prefix: string) => string,
  stockNote: string,
  cashNote: string,
): StoreActionResult {
  const validationError = validateSale(state, sale);
  if (validationError) return { state, error: validationError };
  const stockMovements: StoreStockMovement[] = sale.items
    .filter((item) => item.type === 'product')
    .map((item) => ({
      id: createId('store-stock'),
      productId: item.productId,
      type: 'sale',
      quantity: -item.quantity,
      date: sale.date,
      note: stockNote,
      saleId: sale.id,
    }));
  const cashMovement: StoreCashMovement = {
    id: `${sale.id}-cash`,
    type: 'sale',
    amount: sale.total,
    date: sale.date,
    note: cashNote,
    saleId: sale.id,
  };
  return {
    state: withStoreBalance({
      ...state,
      store: {
        ...state.store,
        sales: [sale, ...state.store.sales],
        stockMovements: [...state.store.stockMovements, ...stockMovements],
        cashMovements: [...state.store.cashMovements, cashMovement],
      },
    }),
  };
}

export function voidSale(
  state: FinanceState,
  saleId: string,
  createId: (prefix: string) => string,
  stockNote: string,
  cashNote: string,
): StoreActionResult {
  const sale = state.store.sales.find((item) => item.id === saleId);
  if (!sale) return { state, error: 'missing-product' };
  if (sale.status === 'void') return { state, error: 'already-void' };
  const reversals: StoreStockMovement[] = sale.items
    .filter((item) => item.type === 'product')
    .map((item) => ({
      id: createId('store-stock'),
      productId: item.productId,
      type: 'saleReversal',
      quantity: item.quantity,
      date: new Date().toISOString(),
      note: stockNote,
      saleId,
    }));
  const cashMovement: StoreCashMovement = {
    id: `${sale.id}-cash-reversal`,
    type: 'saleReversal',
    amount: -sale.total,
    date: new Date().toISOString(),
    note: cashNote,
    saleId,
  };
  return {
    state: withStoreBalance({
      ...state,
      store: {
        ...state.store,
        sales: state.store.sales.map((item) => item.id === saleId ? { ...item, status: 'void' } : item),
        stockMovements: [...state.store.stockMovements, ...reversals],
        cashMovements: [...state.store.cashMovements, cashMovement],
      },
    }),
  };
}
