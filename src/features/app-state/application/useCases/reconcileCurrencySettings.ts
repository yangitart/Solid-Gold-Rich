import type { AppState } from '@/domain/AppState';
import { currencyRate } from '@/shared/domain/finance/currency';
import { withStoreBalance } from '@/features/store/domain/services/storeDomain';

// Rates affect derived balances and account fallbacks, never recorded amounts.
export function reconcileCurrencySettings(previous: AppState, next: AppState): AppState {
  if (
    previous.settings.exchangeRates === next.settings.exchangeRates &&
    previous.settings.preferredCurrency === next.settings.preferredCurrency
  )
    return next;
  const rates = next.settings.exchangeRates ?? { USD: 1 };
  return withStoreBalance({
    ...next,
    accounts: next.accounts.map((account) => ({
      ...account,
      exchangeRate:
        currencyRate(account.currency, next.settings.preferredCurrency, rates) ??
        (previous.settings.preferredCurrency === next.settings.preferredCurrency ||
        !previous.accounts.some((item) => item.id === account.id)
          ? account.exchangeRate
          : undefined),
    })),
  });
}
