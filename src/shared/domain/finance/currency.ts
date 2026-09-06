export type CurrencyRates = Record<string, number>;

export type CurrencySnapshot = {
  baseAmount?: number;
  baseCurrency?: string;
};

export function currencyRate(
  fromCurrency: string,
  toCurrency: string,
  rates: CurrencyRates,
): number | undefined {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  const fromRate = from === 'USD' ? 1 : rates[from];
  const toRate = to === 'USD' ? 1 : rates[to];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) return undefined;
  const rate = fromRate / toRate;
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: CurrencyRates,
): number | undefined {
  const rate = currencyRate(fromCurrency, toCurrency, rates);
  const converted = rate === undefined ? undefined : amount * rate;
  return converted !== undefined && Number.isFinite(converted) ? converted : undefined;
}

export function captureCurrencySnapshot(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  rates: CurrencyRates,
): CurrencySnapshot {
  if (!Number.isFinite(amount)) return {};
  const rate = currencyRate(fromCurrency, baseCurrency, rates);
  const converted = rate === undefined ? undefined : amount * rate;
  return converted !== undefined && Number.isFinite(converted) ? { baseAmount: converted, baseCurrency: baseCurrency.toUpperCase() } : {};
}

export function historicalAmountInCurrency(
  transaction: { amount: number; currency: string; baseAmount?: number; baseCurrency?: string },
  targetCurrency: string,
  rates: CurrencyRates,
): number | undefined {
  if (!Number.isFinite(transaction.amount)) return undefined;
  const target = targetCurrency.trim().toUpperCase();
  if (transaction.currency.toUpperCase() === target) return transaction.amount;
  if (Number.isFinite(transaction.baseAmount) && transaction.baseCurrency) {
    if (transaction.baseCurrency.toUpperCase() === target) return transaction.baseAmount;
    const historicalRate = currencyRate(transaction.baseCurrency, target, rates);
    if (historicalRate !== undefined) {
      const converted = (transaction.baseAmount as number) * historicalRate;
      return Number.isFinite(converted) ? converted : undefined;
    }
  }
  return convertCurrency(transaction.amount, transaction.currency, target, rates);
}
