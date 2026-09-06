import type { AppState } from '@/domain/AppState';
import { generateDueRecurring } from '../../domain/services/financeDomain';

/** Time and ID generation are supplied by the caller for deterministic execution. */
export function applyDueRecurring(state: AppState, now: Date, createId: () => string): AppState {
  if (
    !state.recurring.some(
      (item) => item.active && new Date(item.nextDate).getTime() <= now.getTime(),
    )
  )
    return state;
  const generated = generateDueRecurring(
    state.recurring,
    state.transactions,
    now,
    createId,
    state.settings.preferredCurrency,
    state.settings.exchangeRates ?? { USD: 1 },
  );
  return { ...state, recurring: generated.recurring, transactions: generated.transactions };
}
