export type CurrencyRates = Record<string, number>;

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
