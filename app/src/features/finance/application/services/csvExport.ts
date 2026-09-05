import type { AppState as FinanceState } from '@/domain/AppState';
import { currencyRate } from '@/shared/domain/finance/currency';

function csvCell(value: string | number) {
  const textValue = String(value ?? '');
  return /[",\r\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
}

function normalizedNumber(value: number) {
  return Number(value.toPrecision(12));
}

export function exportFinanceCsv(state: FinanceState) {
  const baseCurrency = state.settings.preferredCurrency || 'USD';
  const rates = state.settings.exchangeRates ?? { USD: 1 };
  const headers = ['date', 'kind', 'amount', 'currency', 'account', 'payee', 'category', 'paymentMethod', 'status', 'reference', 'description', 'baseAmount', 'baseCurrency', 'rateToBase', 'rateSource', 'accountId', 'transferId', 'debtId', 'savingsGoalId'];
  const rows = state.transactions.map((transaction) => {
    const account = state.accounts.find((item) => item.id === transaction.accountId);
    const snapshotAmount = Number.isFinite(transaction.baseAmount) && transaction.baseCurrency
      ? transaction.baseAmount as number
      : undefined;
    const snapshotRate = snapshotAmount !== undefined && transaction.baseCurrency
      ? currencyRate(transaction.baseCurrency, baseCurrency, rates)
      : undefined;
    const currentRate = currencyRate(transaction.currency, baseCurrency, rates);
    const convertedAmount = snapshotAmount !== undefined && snapshotRate !== undefined
      ? snapshotAmount * snapshotRate
      : currentRate !== undefined
        ? transaction.amount * currentRate
        : undefined;
    const rateToBase = convertedAmount !== undefined && transaction.amount !== 0 ? convertedAmount / transaction.amount : currentRate;
    return [transaction.date, transaction.kind, transaction.amount, transaction.currency, account?.name ?? '', transaction.payee, transaction.category, transaction.paymentMethod, transaction.status, transaction.reference, transaction.description, convertedAmount === undefined ? '' : normalizedNumber(convertedAmount), baseCurrency, rateToBase === undefined ? '' : normalizedNumber(rateToBase), snapshotAmount !== undefined && snapshotRate !== undefined ? 'snapshot' : currentRate !== undefined ? 'configured' : 'missing', transaction.accountId, transaction.transferId ?? '', transaction.debtId ?? '', transaction.savingsGoalId ?? '']
      .map(csvCell)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
