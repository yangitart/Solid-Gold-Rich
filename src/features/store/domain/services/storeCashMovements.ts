import type { StoreCashMovement } from '@/features/store/domain/entities/Store';
import { inDateRange, type DateRange } from '@/features/finance/domain/services/financeDomain';

export type CashFlowFilter = 'all' | 'income' | 'expense';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

export function filterCashMovements(movements: StoreCashMovement[], options: {
  query: string;
  flow: CashFlowFilter;
  currency: string;
  range?: DateRange;
  labels: Record<string, string>;
  context?: Record<string, string>;
}) {
  const normalizedQuery = normalize(options.query);
  const query = /^-?\d+(?:[.,]\d+)?$/.test(normalizedQuery) ? String(Number(normalizedQuery.replace(',', '.'))) : normalizedQuery;
  return movements.filter((movement) => {
    if (options.range && !inDateRange(movement.date, options.range)) return false;
    if (options.flow === 'income' && movement.amount <= 0) return false;
    if (options.flow === 'expense' && movement.amount >= 0) return false;
    const text = `${movement.note} ${options.labels[movement.type] ?? movement.type} ${movement.amount} ${movement.currency ?? options.currency} ${options.context?.[movement.id] ?? ''}`;
    return !query || normalize(text).includes(query);
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Keep currencies separate: a missing rate must never turn EUR into USD 1:1.
export function cashMovementTotals(movements: StoreCashMovement[], defaultCurrency: string) {
  const totals = new Map<string, { currency: string; income: number; expense: number; net: number }>();
  movements.forEach((movement) => {
    const currency = (movement.currency ?? defaultCurrency).toUpperCase();
    const total = totals.get(currency) ?? { currency, income: 0, expense: 0, net: 0 };
    total.income += Math.max(0, movement.amount);
    total.expense += Math.max(0, -movement.amount);
    total.net += movement.amount;
    totals.set(currency, total);
  });
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
