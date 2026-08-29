import type { FinanceState } from '@/features/finance/domain/entities/financeTypes';

export type ReportExportLabels = {
  title: string; generated: string; period: string; summary: string; salesByDay: string; topProducts: string; topClients: string; moneyMovements: string; inventory: string; employees: string; clients: string; date: string; name: string; type: string; quantity: string; amount: string; balance: string; role: string; contact: string; status: string; active: string; inactive: string; transactions: string; salePrice: string; available: string; stock: string;
};

export type StoreReportRange = { start: string; end: string; label: string };

export type ReportRepository = {
  filterState: (state: FinanceState, range?: StoreReportRange) => FinanceState;
  createPdf: (state: FinanceState, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) => Uint8Array;
  createXlsx: (state: FinanceState, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) => Uint8Array;
};
