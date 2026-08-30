import type { AppState as FinanceState } from '@/domain/AppState';

function csvCell(value: string | number) {
  const textValue = String(value ?? '');
  return /[",\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
}

export function exportFinanceCsv(state: FinanceState) {
  const headers = ['date', 'kind', 'amount', 'currency', 'account', 'payee', 'category', 'paymentMethod', 'status', 'reference', 'description', 'baseAmount', 'baseCurrency'];
  const rows = state.transactions.map((transaction) => {
    const account = state.accounts.find((item) => item.id === transaction.accountId);
    return [transaction.date, transaction.kind, transaction.amount, transaction.currency, account?.name ?? '', transaction.payee, transaction.category, transaction.paymentMethod, transaction.status, transaction.reference, transaction.description, transaction.baseAmount ?? '', transaction.baseCurrency ?? '']
      .map(csvCell)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
