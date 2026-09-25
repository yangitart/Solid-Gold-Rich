import type { AppState as FinanceState } from '@/domain/AppState';
import type { StoreProduct, StoreState } from '@/features/store/domain/entities/Store';
import type { CurrencyRates } from '@/shared/domain/finance/currency';

export type EmbeddedPicture = { mimeType: string; data: string };
export type StoreProductBackup = Omit<StoreProduct, 'picture'> & { picture?: EmbeddedPicture };
export type StoreBackup = {
  kind: 'solid-gold-rich-store';
  version: 1;
  exportedAt: string;
  store: Omit<StoreState, 'products'> & { products: StoreProductBackup[] };
  exchangeRates?: CurrencyRates;
};
export type AppBackup = {
  kind: 'solid-gold-rich-full';
  version: 1;
  exportedAt: string;
  state: Omit<FinanceState, 'store'> & { store: StoreBackup['store'] };
};
