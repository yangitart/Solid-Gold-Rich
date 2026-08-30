import type { StoreState } from '@/features/store/domain/entities/Store';

export type StoreReportSource = { store: StoreState };

export type ReportExportLabels = {
  title: string; generated: string; period: string; summary: string; sales: string; topProducts: string; topClients: string; moneyMovements: string; inventory: string; employees: string; clients: string; providers: string; date: string; name: string; type: string; quantity: string; amount: string; balance: string; role: string; contact: string; status: string; active: string; inactive: string; transactions: string; salePrice: string; available: string; stock: string;
};

export type StoreReportRange = { start: string; end: string; label: string };

export type ReportRepository = {
  filterState: (state: StoreReportSource, range?: StoreReportRange) => StoreReportSource;
  createPdf: (state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) => Uint8Array;
  createXlsx: (state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) => Uint8Array;
};
