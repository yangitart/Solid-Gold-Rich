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
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return 1;

  const fromRate = from === 'USD' ? 1 : rates[from];
  const toRate = to === 'USD' ? 1 : rates[to];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || !fromRate || !toRate) return undefined;
  return fromRate / toRate;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: CurrencyRates,
): number | undefined {
  const rate = currencyRate(fromCurrency, toCurrency, rates);
  return rate === undefined ? undefined : amount * rate;
}

export function captureCurrencySnapshot(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  rates: CurrencyRates,
): CurrencySnapshot {
  if (!Number.isFinite(amount)) return {};
  const rate = currencyRate(fromCurrency, baseCurrency, rates);
  return rate === undefined ? {} : { baseAmount: amount * rate, baseCurrency: baseCurrency.toUpperCase() };
}

export function historicalAmountInCurrency(
  transaction: { amount: number; currency: string; baseAmount?: number; baseCurrency?: string },
  targetCurrency: string,
  rates: CurrencyRates,
): number | undefined {
  const target = targetCurrency.toUpperCase();
  if (transaction.currency.toUpperCase() === target) return transaction.amount;
  if (Number.isFinite(transaction.baseAmount) && transaction.baseCurrency) {
    if (transaction.baseCurrency.toUpperCase() === target) return transaction.baseAmount;
    const historicalRate = currencyRate(transaction.baseCurrency, target, rates);
    if (historicalRate !== undefined) return (transaction.baseAmount as number) * historicalRate;
  }
  return convertCurrency(transaction.amount, transaction.currency, target, rates);
}
