import type { StoreCashMovement, StoreProduct, StoreProductType, StoreSale, StoreState, StoreStockMovement } from '@/features/store/domain/entities/Store';
import { currencyRate, type CurrencyRates } from '@/shared/domain/finance/currency';

type StoreStateContainer = { store: StoreState };

export type StoreActionResult<T extends StoreStateContainer = StoreStateContainer> = { state: T; error?: 'duplicate' | 'missing-product' | 'insufficient-stock' | 'already-void' };
export type StoreCurrencyChangeResult<T extends StoreStateContainer = StoreStateContainer> = { state: T; rate?: number; error?: 'missing-rate' };
export type StoreStatisticsRange = { start: Date; end: Date };
export type StoreStockFilter = '' | 'low' | 'out' | 'expired' | 'expiring';
export type StoreSalePeriod = 'all' | 'today' | 'week' | 'month';

function normalizedSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

function localDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function firstById<T extends { id: string }>(items: readonly T[]) {
  const index = new Map<string, T>();
  items.forEach((item) => {
    if (!index.has(item.id)) index.set(item.id, item);
  });
  return index;
}

function productStockIndex(state: StoreStateContainer) {
  const productsById = firstById(state.store.products);
  const movementTotals = new Map<string, { total: number; hasInitial: boolean }>();
  state.store.stockMovements.forEach((movement) => {
    const current = movementTotals.get(movement.productId) ?? { total: 0, hasInitial: false };
    current.total += movement.quantity;
    current.hasInitial ||= movement.type === 'initial';
    movementTotals.set(movement.productId, current);
  });
  const stockByProductId = new Map<string, number>();
  productsById.forEach((product, productId) => {
    if (product.type === 'service') {
      stockByProductId.set(productId, 0);
      return;
    }
    const movements = movementTotals.get(productId);
    stockByProductId.set(productId, (movements?.hasInitial ? 0 : product.initialStock) + (movements?.total ?? 0));
  });
  return stockByProductId;
}

function availableStockFromIndex(stockByProductId: ReadonlyMap<string, number>, product: StoreProduct) {
  return Math.max(0, (stockByProductId.get(product.id) ?? 0) - product.reservedQuantity);
}

export function storeBalance(state: StoreStateContainer) {
  return state.store.cashMovements.reduce((total, item) => total + item.amount, 0);
}

export function withStoreBalance<T extends StoreStateContainer>(state: T): T {
  const balance = storeBalance(state);
  return { ...state, store: { ...state.store, businessAccount: { ...state.store.businessAccount, balance } } };
}

export function changeStoreCurrency<T extends StoreStateContainer>(state: T, targetCurrency: string, rates: CurrencyRates): StoreCurrencyChangeResult<T> {
  const sourceCurrency = state.store.currency.toUpperCase();
  const target = targetCurrency.trim().toUpperCase();
  const rate = currencyRate(sourceCurrency, target, rates);
  if (rate === undefined) return { state, error: 'missing-rate' };
  if (sourceCurrency === target) return { state, rate };

  const convert = (amount: number) => amount * rate;
  return {
    rate,
    state: withStoreBalance({
      ...state,
      store: {
        ...state.store,
        currency: target,
        businessAccount: { ...state.store.businessAccount, currency: target },
        products: state.store.products.map((product) => ({
          ...product,
          purchasePrice: convert(product.purchasePrice),
          salePrice: convert(product.salePrice),
          additionalSalePrices: product.additionalSalePrices.map(convert),
        })),
        sales: state.store.sales.map((sale) => ({
          ...sale,
          total: convert(sale.total),
          items: sale.items.map((item) => ({ ...item, unitPrice: convert(item.unitPrice), total: convert(item.total) })),
        })),
        cashMovements: state.store.cashMovements.map((movement) => ({ ...movement, amount: convert(movement.amount) })),
        employees: state.store.employees.map((employee) => ({ ...employee, salary: convert(employee.salary) })),
      },
    }),
  };
}

export function productStock(state: StoreStateContainer, productId: string) {
  return productStockIndex(state).get(productId) ?? 0;
}

export function storeReportData(state: StoreStateContainer) {
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
  }, new Map<string, { name: string; quantity: number; total: number }>())).sort(([, left], [, right]) => right.quantity - left.quantity || right.total - left.total).slice(0, 10);
  const topClients = Array.from(sales.reduce((map, sale) => {
    if (!sale.clientId) return map;
    const value = map.get(sale.clientId) ?? { count: 0, total: 0 };
    map.set(sale.clientId, { count: value.count + 1, total: value.total + sale.total });
    return map;
  }, new Map<string, { count: number; total: number }>())).sort(([, left], [, right]) => right.total - left.total).slice(0, 10);
  return { sales, daily, topProducts, topClients, total: sales.reduce((sum, sale) => sum + sale.total, 0) };
}

export function storeStatistics(state: StoreStateContainer, range: StoreStatisticsRange) {
  const inRange = (value: string) => {
    const timestamp = new Date(value).getTime();
    return timestamp >= range.start.getTime() && timestamp < range.end.getTime();
  };
  const sales = state.store.sales.filter((sale) => sale.status === 'completed' && inRange(sale.date));
  const movements = state.store.cashMovements.filter((movement) => inRange(movement.date));
  const salesRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const cashOutflow = movements.reduce((sum, movement) => sum + (movement.amount < 0 ? -movement.amount : 0), 0);
  const netFlow = movements.reduce((sum, movement) => sum + movement.amount, 0);
  const itemsSold = sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const topProductsMap = sales.reduce((map, sale) => {
    sale.items.forEach((item) => {
      const current = map.get(item.productId) ?? { productId: item.productId, name: item.name, quantity: 0, total: 0 };
      map.set(item.productId, { ...current, quantity: current.quantity + item.quantity, total: current.total + item.total });
    });
    return map;
  }, new Map<string, { productId: string; name: string; quantity: number; total: number }>());
  const topProducts = Array.from(topProductsMap.values()).sort((left, right) => right.total - left.total || right.quantity - left.quantity).slice(0, 5);
  const stockByProductId = productStockIndex(state);
  const activeProducts = state.store.products.filter((product) => product.active).length;
  const lowStock = state.store.products.filter((product) => product.active && product.type === 'product' && availableStockFromIndex(stockByProductId, product) <= product.stockMinimum).length;
  const inventoryValue = state.store.products.reduce((sum, product) => sum + (product.type === 'product' ? (stockByProductId.get(product.id) ?? 0) * product.purchasePrice : 0), 0);
  return {
    sales,
    movements,
    salesRevenue,
    cashOutflow,
    netFlow,
    saleCount: sales.length,
    averageSale: sales.length ? salesRevenue / sales.length : 0,
    itemsSold,
    topProducts,
    activeProducts,
    lowStock,
    inventoryValue,
  };
}

export function availableStock(state: StoreStateContainer, product: StoreProduct) {
  return Math.max(0, productStock(state, product.id) - product.reservedQuantity);
}

export function filterStoreProducts(
  state: StoreStateContainer,
  filters: { type: StoreProductType; query: string; categoryId: string; status: string; stock: StoreStockFilter; today?: Date },
) {
  const query = normalizedSearch(filters.query);
  const today = localDate(filters.today ?? new Date());
  const expiringLimit = new Date(today);
  expiringLimit.setDate(expiringLimit.getDate() + 30);
  const stockByProductId = productStockIndex(state);
  const categoriesById = firstById(state.store.categories);
  return state.store.products.filter((product) => {
    if (product.type !== filters.type) return false;
    const category = categoriesById.get(product.categoryId)?.name ?? '';
    const matchesQuery = !query || normalizedSearch(`${product.name} ${product.key} ${product.sku ?? ''} ${category}`).includes(query);
    const matchesCategory = !filters.categoryId || product.categoryId === filters.categoryId;
    const matchesStatus = !filters.status || (filters.status === 'active' ? product.active : !product.active);
    if (!matchesQuery || !matchesCategory || !matchesStatus) return false;
    if (!filters.stock) return true;
    if (product.type === 'service') return false;
    const available = availableStockFromIndex(stockByProductId, product);
    const expiration = product.expirationDate ? localDate(product.expirationDate) : null;
    if (filters.stock === 'low') return available > 0 && available <= product.stockMinimum;
    if (filters.stock === 'out') return available <= 0;
    if (filters.stock === 'expired') return Boolean(expiration && expiration < today);
    return Boolean(expiration && expiration >= today && expiration <= expiringLimit);
  });
}

export function filterStoreSales(
  state: StoreStateContainer,
  filters: { query: string; period: StoreSalePeriod; firstDayOfWeek: 0 | 1; today?: Date },
) {
  const query = normalizedSearch(filters.query);
  const today = localDate(filters.today ?? new Date());
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() - filters.firstDayOfWeek + 7) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const clientsById = firstById(state.store.clients);
  const employeesById = firstById(state.store.employees);
  const productsById = firstById(state.store.products);
  return state.store.sales.filter((sale) => {
    const client = sale.clientId === undefined ? '' : clientsById.get(sale.clientId)?.name ?? '';
    const employee = sale.employeeId === undefined ? '' : employeesById.get(sale.employeeId)?.name ?? '';
    const searchable = normalizedSearch(`${client} ${employee} ${sale.note} ${sale.paymentMethod ?? ''} ${sale.status} ${sale.items.map((item) => { const product = productsById.get(item.productId); return `${item.name} ${product?.key ?? ''} ${product?.sku ?? ''}`; }).join(' ')}`);
    if (query && !searchable.includes(query)) return false;
    if (filters.period === 'all') return true;
    const date = localDate(sale.date);
    if (filters.period === 'today') return date.getTime() === today.getTime();
    if (filters.period === 'week') return date >= weekStart && date < weekEnd;
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  });
}

export function appendCashMovement<T extends StoreStateContainer>(state: T, movement: StoreCashMovement): T {
  if (state.store.cashMovements.some((item) => item.id === movement.id)) return state;
  return withStoreBalance({ ...state, store: { ...state.store, cashMovements: [...state.store.cashMovements, movement] } });
}

export function validateSale(state: StoreStateContainer, sale: StoreSale): StoreActionResult['error'] {
  if (state.store.sales.some((item) => item.id === sale.id)) return 'duplicate';
  const productsById = firstById(state.store.products.filter((product) => product.active));
  const stockByProductId = productStockIndex(state);
  for (const line of sale.items) {
    const product = productsById.get(line.productId);
    if (!product) return 'missing-product';
    if (product.type === 'product' && line.quantity > availableStockFromIndex(stockByProductId, product)) return 'insufficient-stock';
  }
  return undefined;
}

export function completeSale<T extends StoreStateContainer>(
  state: T,
  sale: StoreSale,
  createId: (prefix: string) => string,
  stockNote: string,
  cashNote: string,
): StoreActionResult<T> {
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

export function voidSale<T extends StoreStateContainer>(
  state: T,
  saleId: string,
  createId: (prefix: string) => string,
  stockNote: string,
  cashNote: string,
): StoreActionResult<T> {
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
