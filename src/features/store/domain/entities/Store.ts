import type { Currency, PaymentMethod } from '@/shared/domain/finance/types';
export type { PaymentMethod } from '@/shared/domain/finance/types';

export type StoreProductType = 'product' | 'service';
export type StoreStockMovementType =
  'initial' | 'entry' | 'exit' | 'adjustment' | 'sale' | 'saleReversal';
export type StoreSaleStatus = 'completed' | 'void';
export type StoreCashMovementType =
  | 'opening'
  | 'funding'
  | 'withdrawal'
  | 'sale'
  | 'saleReversal'
  | 'purchase'
  | 'purchaseReversal'
  | 'salary';
export type StorePayFrequency = 'weekly' | 'biweekly' | 'monthly';
export type StorePayMode = 'manual' | 'automatic';

export type StoreCategory = { id: string; name: string; icon?: string; builtIn?: boolean };

export type StoreDefaultOperation = { id: string; productId: string; quantity: number };

export type StoreProvider = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  defaultOperations?: StoreDefaultOperation[];
  active: boolean;
  createdAt: string;
};

export type StoreProduct = {
  id: string;
  key: string;
  name: string;
  type: StoreProductType;
  unit: string;
  unitAbbreviation?: string;
  categoryId: string;
  providerId?: string;
  currency?: Currency;
  sku?: string;
  salePrice: number;
  purchasePrice: number;
  additionalSalePrices: number[];
  picture?: string;
  icon?: string;
  initialStock: number;
  reservedQuantity: number;
  stockMinimum: number;
  expirationDate?: string;
  additionalInfo?: string;
  active: boolean;
};

export type StoreStockMovement = {
  id: string;
  productId: string;
  type: StoreStockMovementType;
  quantity: number;
  date: string;
  note: string;
  providerId?: string;
  clientId?: string;
  saleId?: string;
  cashMovementId?: string;
  personalTransactionId?: string;
};

export type StoreSaleItem = {
  productId: string;
  name: string;
  type: StoreProductType;
  quantity: number;
  unitPrice: number;
  total: number;
};
export type StoreSale = {
  id: string;
  date: string;
  items: StoreSaleItem[];
  total: number;
  currency?: Currency;
  paymentMethod?: PaymentMethod;
  status: StoreSaleStatus;
  note: string;
  clientId?: string;
  employeeId?: string;
};
export type StoreCashMovement = {
  id: string;
  type: StoreCashMovementType;
  amount: number;
  currency?: Currency;
  date: string;
  note: string;
  transferId?: string;
  saleId?: string;
  productId?: string;
  personalTransactionId?: string;
};
export type StoreAccount = {
  id: 'store-business';
  name: string;
  currency: Currency;
  balance: number;
};
export type StoreEmployee = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  salary: number;
  salaryCurrency?: Currency;
  payFrequency: StorePayFrequency;
  payMode: StorePayMode;
  nextPayDate?: string;
  lastPaidDate?: string;
  active: boolean;
  createdAt: string;
};
export type StoreClient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  defaultOperations?: StoreDefaultOperation[];
  active: boolean;
  createdAt: string;
};
export type StoreState = {
  name: string;
  currency: Currency;
  categories: StoreCategory[];
  businessAccount: StoreAccount;
  cashMovements: StoreCashMovement[];
  employees: StoreEmployee[];
  clients: StoreClient[];
  providers: StoreProvider[];
  products: StoreProduct[];
  stockMovements: StoreStockMovement[];
  sales: StoreSale[];
};
