import type { AppState as FinanceState } from '@/domain/AppState';

export type FinanceCategoryType = 'expense' | 'income';

export function removeCategory(
  state: FinanceState,
  type: FinanceCategoryType,
  categoryId: string,
): FinanceState {
  const category = state.categories[type].find((item) => item.id === categoryId);
  if (!category || category.builtIn) return state;
  return {
    ...state,
    categories: {
      ...state.categories,
      [type]: state.categories[type].filter((item) => item.id !== categoryId),
    },
    transactions: state.transactions.map((item) =>
      item.category === categoryId && item.kind === type ? { ...item, category: 'other' } : item,
    ),
    recurring: state.recurring.map((item) =>
      item.category === categoryId && item.kind === type ? { ...item, category: 'other' } : item,
    ),
    budgets: state.budgets.filter((item) => item.category !== categoryId),
  };
}
