import type { ReportRepository } from '@/features/store/application/ports/ReportRepository';
import { createStoreReportPdf, createStoreReportXlsx, filterStoreReportState } from '@/features/store/infrastructure/reports/reportExports';

export const reportRepository: ReportRepository = {
  filterState: filterStoreReportState,
  createPdf: createStoreReportPdf,
  createXlsx: createStoreReportXlsx,
};
