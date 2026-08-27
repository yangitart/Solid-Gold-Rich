import React from 'react';
import { Alert, BackHandler, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeIn, FadeOut, SlideInLeft, useReducedMotion } from 'react-native-reanimated';
import { useFinance } from '../stores/FinanceContext';
import type { PaymentMethod, StoreCategory, StoreClient, StoreEmployee, StorePayFrequency, StorePayMode, StoreProduct, StoreProductType, StoreSale, StoreSaleItem, StoreStockMovementType } from '../core/finance/types';
import { captureCurrencySnapshot, currencyRate } from '../core/finance/currency';
import { accountBalance, withStoreBalance } from '../domain/finance/financeDomain';
import { availableStock, completeSale as completeStoreSale, filterStoreProducts, filterStoreSales, productStock, storeReportData, validateSale, voidSale as voidStoreSale, type StoreSalePeriod, type StoreStockFilter } from '../domain/store/storeDomain';
import { createStoreBackup, isolateStoreBackupForImport, parseStoreBackup, restoreStoreBackupToDevice } from '../domain/store/storeBackup';
import { normalizeFinanceState } from '../stores/financeStorage';
import { FormActions, FormField, ResponsiveSheet, SearchableSelect, SegmentedControl, type SelectOption } from '../components/FormKit';
import DateSelect from '../components/DateSelect';
import { C, SANS, SERIF, createThemeStyles } from '../theme/luxury';
import { createStoreReportPdf, createStoreReportXlsx, type ReportExportLabels } from '../domain/store/reportExports';

type StoreView = 'inventory' | 'sales' | 'employees' | 'clients' | 'services' | 'reports' | 'movements' | 'settings';
type DirectoryKind = 'employees' | 'clients';
type StoreReportKind = 'transactionsPerDay' | 'totalTransactions' | 'topProductsServices' | 'topClients';
type StockFilter = StoreStockFilter;
type StockAction = 'entry' | 'exit' | 'adjustment';
type SalePeriod = StoreSalePeriod;
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ProductDraft = {
  key: string;
  name: string;
  type: StoreProductType;
  unit: string;
  categoryId: string;
  purchasePrice: string;
  salePrice: string;
  additionalSalePrices: string[];
  picture?: string;
  icon: IconName;
  stock: string;
  reservedQuantity: string;
  stockMinimum: string;
  expirationDate: string;
  additionalInfo: string;
};

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const numeric = (value: string) => Number(value.trim().replace(',', '.'));
const normalizedSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
const COMMON_CURRENCIES = ['USD', 'EUR', 'CUP', 'MXN', 'CAD', 'GBP', 'BRL', 'ARS', 'CLP', 'COP', 'JPY', 'CHF'];
const UNIT_OPTIONS = ['unit', 'piece', 'kg', 'g', 'liter', 'hour', 'box'] as const;
const PRODUCT_ICON_OPTIONS: IconName[] = ['cube-outline', 'restaurant-outline', 'cafe-outline', 'cart-outline', 'shirt-outline', 'home-outline', 'construct-outline', 'phone-portrait-outline', 'laptop-outline', 'book-outline', 'gift-outline', 'pricetag-outline'];

function money(value: number, currency: string) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function localDay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultDraft(type: StoreProductType, categoryId: string): ProductDraft {
  return { key: '', name: '', type, unit: 'unit', categoryId, purchasePrice: '', salePrice: '', additionalSalePrices: [], picture: undefined, icon: type === 'service' ? 'construct-outline' : 'cube-outline', stock: '', reservedQuantity: '0', stockMinimum: '0', expirationDate: '', additionalInfo: '' };
}

function MenuGlyph() {
  return <View style={styles.menuGlyph}><View style={styles.menuLineWide} /><View style={styles.menuLine} /><View style={styles.menuLineWide} /></View>;
}

function ProductPicture({ product }: { product: StoreProduct }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [product.picture]);
  if (!product.picture || failed) return <Ionicons name={(product.icon || (product.type === 'service' ? 'construct-outline' : 'cube-outline')) as IconName} size={20} color={C.gold} />;
  return <Image source={{ uri: product.picture }} style={styles.productImage} onError={() => setFailed(true)} />;
}

export default function StoreScreen() {
  const { t } = useTranslation();
  const finance = useFinance();
  const { state } = finance;
  const store = state.store;
  const currency = store.currency || state.settings.preferredCurrency || 'USD';
  const reduceMotion = useReducedMotion();
  const [view, setView] = React.useState<StoreView>('inventory');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [productQuery, setProductQuery] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState<StockFilter>('');
  const [addOpen, setAddOpen] = React.useState(false);
  const [productOpen, setProductOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<StoreProduct | null>(null);
  const [productDraft, setProductDraft] = React.useState<ProductDraft>(() => defaultDraft('product', 'general'));
  const [productMoreOpen, setProductMoreOpen] = React.useState(false);
  const [customUnitOpen, setCustomUnitOpen] = React.useState(false);
  const [productErrors, setProductErrors] = React.useState<Record<string, string>>({});
  const [purchaseAccountId, setPurchaseAccountId] = React.useState('store-business');
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState('');
  const [categoryError, setCategoryError] = React.useState('');
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [stockProduct, setStockProduct] = React.useState<StoreProduct | null>(null);
  const [stockAction, setStockAction] = React.useState<StockAction>('entry');
  const [stockQuantity, setStockQuantity] = React.useState('');
  const [stockNote, setStockNote] = React.useState('');
  const [stockError, setStockError] = React.useState('');
  const [saleOpen, setSaleOpen] = React.useState(false);
  const [saleQuery, setSaleQuery] = React.useState('');
  const [cart, setCart] = React.useState<StoreSaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [saleClientId, setSaleClientId] = React.useState('');
  const [saleEmployeeId, setSaleEmployeeId] = React.useState('');
  const [saleNote, setSaleNote] = React.useState('');
  const [saleError, setSaleError] = React.useState('');
  const [saleSubmitting, setSaleSubmitting] = React.useState(false);
  const saleSubmittingRef = React.useRef(false);
  const [selectedSaleId, setSelectedSaleId] = React.useState<string | null>(null);
  const [saleHistoryQuery, setSaleHistoryQuery] = React.useState('');
  const [salePeriod, setSalePeriod] = React.useState<SalePeriod>('all');
  const [directoryQuery, setDirectoryQuery] = React.useState('');
  const [directoryOpen, setDirectoryOpen] = React.useState(false);
  const [directoryKind, setDirectoryKind] = React.useState<DirectoryKind>('employees');
  const [directoryId, setDirectoryId] = React.useState<string | null>(null);
  const [directoryName, setDirectoryName] = React.useState('');
  const [directoryRole, setDirectoryRole] = React.useState('');
  const [directoryPhone, setDirectoryPhone] = React.useState('');
  const [directorySalary, setDirectorySalary] = React.useState('');
  const [directoryPayFrequency, setDirectoryPayFrequency] = React.useState<StorePayFrequency>('monthly');
  const [directoryPayMode, setDirectoryPayMode] = React.useState<StorePayMode>('manual');
  const [directoryNextPayDate, setDirectoryNextPayDate] = React.useState('');
  const [directoryEmail, setDirectoryEmail] = React.useState('');
  const [directoryNote, setDirectoryNote] = React.useState('');
  const [directoryActive, setDirectoryActive] = React.useState(true);
  const [directoryError, setDirectoryError] = React.useState('');
  const [storeName, setStoreName] = React.useState(store.name);
  const [storeCurrency, setStoreCurrency] = React.useState(currency);
  const [movementQuery, setMovementQuery] = React.useState('');
  const [reportKind, setReportKind] = React.useState<StoreReportKind | null>(null);
  const [fundingAccountId, setFundingAccountId] = React.useState('none');
  const [fundingAmount, setFundingAmount] = React.useState('');
  const [fundingNote, setFundingNote] = React.useState('');
  const [fundingError, setFundingError] = React.useState('');
  const [backupBusy, setBackupBusy] = React.useState(false);

  const nextPayDate = (value: string, frequency: StorePayFrequency) => { const date = new Date(value); if (frequency === 'weekly') date.setDate(date.getDate() + 7); else if (frequency === 'biweekly') date.setDate(date.getDate() + 14); else date.setMonth(date.getMonth() + 1); return date.toISOString(); };

  const payEmployee = React.useCallback((employeeId: string, allowNegative = false) => {
    const employee = state.store.employees.find((item) => item.id === employeeId);
    if (!employee || !employee.active || employee.salary <= 0) return;
    if (!allowNegative && store.businessAccount.balance < employee.salary) {
      Alert.alert(t('finance.payroll.insufficientTitle'), t('finance.payroll.insufficientBody'), [{ text: t('finance.cancel'), style: 'cancel' }, { text: t('finance.payroll.payAnyway'), onPress: () => payEmployee(employeeId, true) }]);
      return;
    }
    const date = new Date().toISOString();
    finance.updateState((current) => {
      const currentEmployee = current.store.employees.find((item) => item.id === employeeId);
      if (!currentEmployee) return current;
      const paidEmployee = { ...currentEmployee, lastPaidDate: date, nextPayDate: nextPayDate(date, currentEmployee.payFrequency) };
      return withStoreBalance({ ...current, store: { ...current.store, employees: current.store.employees.map((item) => item.id === employeeId ? paidEmployee : item), cashMovements: [...current.store.cashMovements, { id: uid('store-salary'), type: 'salary', amount: -currentEmployee.salary, date, note: `${t('finance.payroll.salaryFor')} ${currentEmployee.name}` }] } });
    });
  }, [finance, state.store.employees, store.businessAccount.balance, t]);

  React.useEffect(() => {
    const due = state.store.employees.filter((employee) => employee.active && employee.payMode === 'automatic' && employee.salary > 0 && employee.nextPayDate && new Date(employee.nextPayDate).getTime() <= Date.now());
    due.forEach((employee) => payEmployee(employee.id));
  }, [payEmployee, state.store.employees]);

  const categoryNameFor = React.useCallback((id: string) => {
    const category = store.categories.find((item) => item.id === id);
    return category?.builtIn
      ? t(`finance.storeCategories.${id}`, { defaultValue: category.name })
      : category?.name ?? t('finance.store.generalCategory');
  }, [store.categories, t]);
  const stockFor = React.useCallback((productId: string) => productStock(state, productId), [state]);
  const inventoryValue = React.useMemo(() => store.products.reduce((total, product) => total + (product.type === 'product' ? stockFor(product.id) * product.purchasePrice : 0), 0), [store.products, stockFor]);
  const hasStoreHistory = store.cashMovements.length > 0
    || store.sales.length > 0
    || store.stockMovements.length > 0
    || store.products.some((item) => item.purchasePrice > 0 || item.salePrice > 0 || item.additionalSalePrices.some((price) => price > 0));
  const availableFor = React.useCallback((product: StoreProduct) => availableStock(state, product), [state]);
  const selectedSale = store.sales.find((sale) => sale.id === selectedSaleId) ?? null;
  const filtersActive = Boolean(categoryFilter || statusFilter || stockFilter);
  const today = localDay(new Date());

  React.useEffect(() => setDirectoryQuery(''), [view]);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (addOpen || productOpen || filterOpen || categoryManagerOpen || stockProduct || saleOpen || selectedSaleId || directoryOpen || reportKind) {
        setAddOpen(false);
        setProductOpen(false);
        setFilterOpen(false);
        setCategoryManagerOpen(false);
        setStockProduct(null);
        setSaleOpen(false);
        setSelectedSaleId(null);
        setDirectoryOpen(false);
        setReportKind(null);
        return true;
      }
      if (view !== 'inventory') {
        setView('inventory');
        setMovementQuery('');
        return true;
      }
      Alert.alert(t('finance.exit.title'), t('finance.exit.copy'), [
        { text: t('finance.cancel'), style: 'cancel' },
        { text: t('finance.exit.confirm'), style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });
    return () => subscription.remove();
  }, [addOpen, categoryManagerOpen, directoryOpen, drawerOpen, filterOpen, productOpen, reportKind, saleOpen, selectedSaleId, stockProduct, t, view]);

  const categoryOptions: SelectOption[] = store.categories.map((item) => ({ value: item.id, label: categoryNameFor(item.id), icon: 'pricetag-outline' }));
  const accountOptions: SelectOption[] = [
    { value: 'none', label: t('finance.storePurchase.none'), icon: 'remove-circle-outline' },
    { value: 'store-business', label: t('finance.storeAccount.name'), description: money(store.businessAccount.balance, currency), icon: 'storefront-outline' },
    ...state.accounts.filter((item) => !item.archived && item.type !== 'debt').map((item) => ({ value: item.id, label: item.name, description: money(accountBalance(state, item.id), item.currency), icon: 'wallet-outline' as const })),
  ];
  const personOptions = (kind: DirectoryKind): SelectOption[] => [
    { value: '', label: t('finance.store.noneSelected'), icon: 'remove-circle-outline' },
    ...(kind === 'clients' ? store.clients : store.employees).filter((item) => item.active).map((item) => ({ value: item.id, label: item.name, icon: kind === 'clients' ? 'person-outline' : 'people-outline' } as SelectOption)),
  ];
  const currencyOptions = Array.from(new Set([currency, state.settings.preferredCurrency, ...state.accounts.map((item) => item.currency), ...COMMON_CURRENCIES])).sort().map((item) => ({ value: item, label: item }));

  const visibleProducts = filterStoreProducts(state, { type: view === 'services' ? 'service' : 'product', query: productQuery, categoryId: categoryFilter, status: statusFilter, stock: view === 'inventory' ? stockFilter : '', today });

  const normalizedSaleQuery = normalizedSearch(saleQuery);
  const saleProducts = store.products.filter((product) => product.active && (!normalizedSaleQuery || normalizedSearch(`${product.name} ${product.key} ${product.sku ?? ''} ${categoryNameFor(product.categoryId)}`).includes(normalizedSaleQuery)));
  const saleTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const visibleSales = filterStoreSales(state, { query: saleHistoryQuery, period: salePeriod, firstDayOfWeek: state.settings.firstDayOfWeek, today });

  const switchView = (next: StoreView) => {
    setView(next);
    setDrawerOpen(false);
    setReportKind(null);
    setProductQuery('');
    setSaleHistoryQuery('');
    setSalePeriod('all');
    setDirectoryQuery('');
    setMovementQuery('');
    setCategoryFilter('');
    setStatusFilter('');
    setStockFilter('');
  };
  const switchWorkspace = () => finance.updateState((current) => ({ ...current, settings: { ...current.settings, activeWorkspace: 'personal' } }));

  const openSale = () => {
    setSaleQuery('');
    setCart([]);
    setPaymentMethod('');
    setSaleClientId('');
    setSaleEmployeeId('');
    setSaleNote('');
    setSaleError('');
    saleSubmittingRef.current = false;
    setSaleSubmitting(false);
    setSaleOpen(true);
  };

  const openProduct = (product?: StoreProduct) => {
    setEditingProduct(product ?? null);
    setProductErrors({});
    setCustomUnitOpen(Boolean(product && !(UNIT_OPTIONS as readonly string[]).includes(product.unit)));
    setProductMoreOpen(Boolean(product?.expirationDate || product?.additionalInfo || product?.picture || product?.additionalSalePrices.length));
    setPurchaseAccountId('none');
    setProductDraft(product ? {
      key: product.key, name: product.name, type: product.type, unit: product.unit, categoryId: product.categoryId,
      purchasePrice: product.purchasePrice ? String(product.purchasePrice) : '', salePrice: String(product.salePrice),
      additionalSalePrices: product.additionalSalePrices.map(String), picture: product.picture, icon: (product.icon as IconName | undefined) ?? (product.type === 'service' ? 'construct-outline' : 'cube-outline'), stock: '', reservedQuantity: String(product.reservedQuantity),
      stockMinimum: String(product.stockMinimum), expirationDate: product.expirationDate ?? '', additionalInfo: product.additionalInfo ?? '',
    } : defaultDraft(view === 'services' ? 'service' : 'product', store.categories[0]?.id ?? 'general'));
    setProductOpen(true);
  };

  const choosePicture = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    try {
      const source = new File(result.assets[0].uri);
      const directory = new Directory(Paths.document, 'product-images');
      directory.create({ idempotent: true, intermediates: true });
      const extension = result.assets[0].name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const destination = new File(directory, `${uid('product')}.${extension}`);
      source.copy(destination);
      setProductDraft((current) => ({ ...current, picture: destination.uri }));
    } catch {
      setProductErrors((current) => ({ ...current, picture: t('finance.store.errors.picture') }));
    }
  };

  const productValidation = () => {
    const errors: Record<string, string> = {};
    const key = productDraft.key.trim();
    if (!key) errors.key = t('finance.store.errors.key');
    else if (store.products.some((item) => item.id !== editingProduct?.id && item.key.toLocaleLowerCase() === key.toLocaleLowerCase())) errors.key = t('finance.store.errors.duplicateKey');
    if (!productDraft.name.trim()) errors.name = t('finance.store.errors.name');
    if (!productDraft.unit.trim()) errors.unit = t('finance.storeUnits.required');
    const salePrice = numeric(productDraft.salePrice);
    if (!Number.isFinite(salePrice) || salePrice < 0) errors.salePrice = t('finance.store.errors.price');
    const numberFields = [productDraft.purchasePrice || '0', productDraft.stock || '0', productDraft.reservedQuantity || '0', productDraft.stockMinimum || '0', ...productDraft.additionalSalePrices.filter((value) => value.trim())];
    if (numberFields.some((value) => !Number.isFinite(numeric(value)) || numeric(value) < 0)) errors.numbers = t('finance.store.errors.stock');
    const available = editingProduct ? stockFor(editingProduct.id) : numeric(productDraft.stock || '0');
    if (numeric(productDraft.reservedQuantity || '0') > available) errors.reserve = t('finance.store.errors.reserve');
    if (!store.categories.some((item) => item.id === productDraft.categoryId)) errors.category = t('finance.store.errors.category');
    return errors;
  };

  const commitProduct = (allowNegative: boolean) => {
    const errors = productValidation();
    if (Object.keys(errors).length) { setProductErrors(errors); return; }
    const initialStock = productDraft.type === 'product' && !editingProduct ? numeric(productDraft.stock || '0') : 0;
    const purchasePrice = numeric(productDraft.purchasePrice || '0');
    const purchaseTotal = initialStock * purchasePrice;
    const sourceAccount = state.accounts.find((item) => item.id === purchaseAccountId && !item.archived && item.type !== 'debt');
    if (purchaseTotal > 0 && purchaseAccountId !== 'none' && purchaseAccountId !== 'store-business' && !sourceAccount) {
      setProductErrors({ purchase: t('finance.storePurchase.sourceRequired') });
      return;
    }
    const rate = sourceAccount ? currencyRate(currency, sourceAccount.currency, state.settings.exchangeRates ?? { USD: 1 }) : 1;
    const sourceAmount = purchaseTotal * (rate ?? 0);
    if (purchaseTotal > 0 && sourceAccount && !rate) { setProductErrors({ purchase: t('finance.releaseErrors.missingRate') }); return; }
    const sourceBalance = sourceAccount ? accountBalance(state, sourceAccount.id) : purchaseAccountId === 'store-business' ? store.businessAccount.balance : Infinity;
    const required = sourceAccount ? sourceAmount : purchaseTotal;
    if (!allowNegative && purchaseAccountId !== 'none' && sourceBalance < required) {
      Alert.alert(t('finance.negativeBalance.title'), t('finance.negativeBalance.body'), [
        { text: t('finance.cancel'), style: 'cancel' },
        { text: t('finance.negativeBalance.confirm'), onPress: () => commitProduct(true) },
      ]);
      return;
    }
    const now = new Date().toISOString();
    const id = editingProduct?.id ?? uid('store-product');
    const product: StoreProduct = {
      id,
      key: productDraft.key.trim(),
      name: productDraft.name.trim(),
      type: productDraft.type,
      unit: productDraft.unit.trim() || 'unit',
      categoryId: productDraft.categoryId,
      sku: editingProduct?.sku ?? productDraft.key.trim(),
      salePrice: numeric(productDraft.salePrice),
      purchasePrice,
      additionalSalePrices: productDraft.additionalSalePrices.filter((value) => value.trim()).map(numeric),
      picture: productDraft.picture,
      icon: productDraft.icon,
      initialStock: editingProduct?.initialStock ?? 0,
      reservedQuantity: productDraft.type === 'service' ? 0 : numeric(productDraft.reservedQuantity || '0'),
      stockMinimum: productDraft.type === 'service' ? 0 : numeric(productDraft.stockMinimum || '0'),
      expirationDate: productDraft.type === 'service' ? undefined : productDraft.expirationDate || undefined,
      additionalInfo: productDraft.additionalInfo.trim() || undefined,
      active: editingProduct?.active ?? true,
    };
    finance.updateState((current) => {
      const products = editingProduct ? current.store.products.map((item) => item.id === id ? product : item) : [...current.store.products, product];
      const purchaseTransactionId = purchaseTotal > 0 && sourceAccount ? uid('store-purchase') : undefined;
      const cashMovementId = purchaseTotal > 0 && purchaseAccountId === 'store-business' ? uid('store-cash') : undefined;
      const stockMovement = initialStock > 0 ? {
        id: uid('store-stock'), productId: id, type: 'initial' as const, quantity: initialStock, date: now,
        note: t('finance.store.initialStock'), cashMovementId, personalTransactionId: purchaseTransactionId,
      } : null;
      const purchaseTransaction = purchaseTransactionId && sourceAccount ? {
        id: purchaseTransactionId, accountId: sourceAccount.id, kind: 'expense' as const, amount: sourceAmount, currency: sourceAccount.currency,
        date: now, payee: product.name, category: 'other', paymentMethod: (sourceAccount.type === 'cash' || sourceAccount.type === 'card' || sourceAccount.type === 'bank' ? sourceAccount.type : 'other') as PaymentMethod, status: 'cleared' as const,
        reference: id, description: t('finance.storePurchase.inventoryPurchase'),
        ...captureCurrencySnapshot(sourceAmount, sourceAccount.currency, current.settings.preferredCurrency, current.settings.exchangeRates ?? { USD: 1 }),
      } : null;
      const cashMovement = cashMovementId ? {
        id: cashMovementId, type: 'purchase' as const, amount: -purchaseTotal, date: now,
        note: t('finance.storePurchase.inventoryPurchase'), productId: id,
      } : null;
      return withStoreBalance({
        ...current,
        transactions: purchaseTransaction ? [purchaseTransaction, ...current.transactions] : current.transactions,
        store: {
          ...current.store,
          products,
          stockMovements: stockMovement ? [...current.store.stockMovements, stockMovement] : current.store.stockMovements,
          cashMovements: cashMovement ? [...current.store.cashMovements, cashMovement] : current.store.cashMovements,
        },
      });
    });
    setProductOpen(false);
  };

  const saveCategory = () => {
    const name = categoryName.trim();
    if (!name) { setCategoryError(t('finance.storeUnits.categoryRequired')); return; }
    if (store.categories.some((item) => item.id !== editingCategoryId && normalizedSearch(item.name) === normalizedSearch(name))) { setCategoryError(t('finance.storeUnits.categoryDuplicate')); return; }
    const categoryId = editingCategoryId ?? uid('category');
    finance.updateState((current) => ({
      ...current,
      store: {
        ...current.store,
        categories: editingCategoryId
          ? current.store.categories.map((item) => item.id === editingCategoryId ? { ...item, name } : item)
          : [...current.store.categories, { id: categoryId, name }],
      },
    }));
    if (!editingCategoryId) setProductDraft((current) => ({ ...current, categoryId }));
    setCategoryName(''); setCategoryError(''); setEditingCategoryId(null); setCategoryManagerOpen(false);
  };

  const deleteCategory = (category: StoreCategory) => {
    if (category.builtIn || category.id === 'general') return;
    Alert.alert(t('finance.store.deleteCategory'), t('finance.store.deleteCategoryConfirm'), [
      { text: t('finance.cancel'), style: 'cancel' },
      { text: t('finance.deleteAction'), style: 'destructive', onPress: () => {
        finance.updateState((current) => ({
          ...current,
          store: {
            ...current.store,
            categories: current.store.categories.filter((item) => item.id !== category.id),
            products: current.store.products.map((item) => item.categoryId === category.id ? { ...item, categoryId: 'general' } : item),
          },
        }));
        if (categoryFilter === category.id) setCategoryFilter('');
      } },
    ]);
  };

  const saveStock = () => {
    if (!stockProduct) return;
    const value = numeric(stockQuantity);
    if (!stockNote.trim()) { setStockError(t('finance.store.errors.stockReason')); return; }
    if (!Number.isFinite(value) || value < 0 || (stockAction !== 'adjustment' && value === 0)) { setStockError(t('finance.store.errors.stock')); return; }
    const currentStock = stockFor(stockProduct.id);
    const delta = stockAction === 'entry' ? value : stockAction === 'exit' ? -value : value - currentStock;
    if (currentStock + delta < stockProduct.reservedQuantity) { setStockError(t('finance.store.errors.reserve')); return; }
    finance.updateState((current) => ({ ...current, store: { ...current.store, stockMovements: [...current.store.stockMovements, { id: uid('store-stock'), productId: stockProduct.id, type: stockAction as StoreStockMovementType, quantity: delta, date: new Date().toISOString(), note: stockNote.trim() }] } }));
    setStockProduct(null); setStockQuantity(''); setStockNote(''); setStockError('');
  };

  const addToCart = (product: StoreProduct) => {
    const current = cart.find((item) => item.productId === product.id);
    const quantity = (current?.quantity ?? 0) + 1;
    if (product.type === 'product' && quantity > availableFor(product)) { setSaleError(t('finance.store.errors.insufficientStock')); return; }
    const item: StoreSaleItem = { productId: product.id, name: product.name, type: product.type, quantity, unitPrice: current?.unitPrice ?? product.salePrice, total: quantity * (current?.unitPrice ?? product.salePrice) };
    setCart((items) => current ? items.map((entry) => entry.productId === product.id ? item : entry) : [...items, item]);
    setSaleError('');
  };

  const changeCart = (productId: string, quantityDelta: number) => {
    const line = cart.find((item) => item.productId === productId);
    const product = store.products.find((item) => item.id === productId);
    if (!line || !product) return;
    const quantity = line.quantity + quantityDelta;
    if (quantity <= 0) { setCart((items) => items.filter((item) => item.productId !== productId)); return; }
    if (product.type === 'product' && quantity > availableFor(product)) { setSaleError(t('finance.store.errors.insufficientStock')); return; }
    setCart((items) => items.map((item) => item.productId === productId ? { ...item, quantity, total: quantity * item.unitPrice } : item));
  };

  const cyclePrice = (productId: string) => {
    const product = store.products.find((item) => item.id === productId);
    const line = cart.find((item) => item.productId === productId);
    if (!product || !line) return;
    const prices = [product.salePrice, ...product.additionalSalePrices];
    if (prices.length < 2) return;
    const index = prices.findIndex((price) => price === line.unitPrice);
    const unitPrice = prices[(index + 1) % prices.length];
    setCart((items) => items.map((item) => item.productId === productId ? { ...item, unitPrice, total: item.quantity * unitPrice } : item));
  };

  const submitSale = () => {
    if (saleSubmittingRef.current || !cart.length) return;
    saleSubmittingRef.current = true;
    setSaleSubmitting(true);
    const sale: StoreSale = { id: uid('store-sale'), date: new Date().toISOString(), items: cart, total: saleTotal, paymentMethod: paymentMethod as PaymentMethod || undefined, status: 'completed', note: saleNote.trim(), clientId: saleClientId || undefined, employeeId: saleEmployeeId || undefined };
    const error = validateSale(state, sale);
    if (!error) finance.updateState((current) => completeStoreSale(current, sale, uid, t('finance.store.saleStock'), t('finance.store.saleIncome')).state);
    saleSubmittingRef.current = false;
    setSaleSubmitting(false);
    if (error) { setSaleError(t(`finance.store.errors.${error}`)); return; }
    setSaleOpen(false); setCart([]); setSaleNote(''); setSaleClientId(''); setSaleEmployeeId(''); setPaymentMethod('');
  };

  const confirmVoidSale = (saleId: string) => Alert.alert(t('finance.store.voidSale'), t('finance.store.voidSaleConfirm'), [
    { text: t('finance.cancel'), style: 'cancel' },
    { text: t('finance.deleteAction'), style: 'destructive', onPress: () => {
      const result = voidStoreSale(state, saleId, uid, t('finance.store.saleReversal'), t('finance.store.saleReversal'));
      if (result.error) { setSaleError(t(`finance.store.errors.${result.error}`)); return; }
      finance.updateState((current) => voidStoreSale(current, saleId, uid, t('finance.store.saleReversal'), t('finance.store.saleReversal')).state);
      setSelectedSaleId(null);
    } },
  ]);

  const openDirectory = (kind: DirectoryKind, item?: StoreEmployee | StoreClient) => {
    setDirectoryKind(kind); setDirectoryId(item?.id ?? null); setDirectoryName(item?.name ?? ''); setDirectoryPhone(item?.phone ?? '');
    setDirectorySalary(item && 'salary' in item ? String(item.salary || '') : ''); setDirectoryPayFrequency(item && 'payFrequency' in item ? item.payFrequency : 'monthly'); setDirectoryPayMode(item && 'payMode' in item ? item.payMode : 'manual'); setDirectoryNextPayDate(item && 'nextPayDate' in item ? item.nextPayDate ?? '' : '');
    setDirectoryRole(item && 'role' in item ? item.role ?? '' : ''); setDirectoryEmail(item && 'email' in item ? item.email ?? '' : '');
    setDirectoryNote(item && 'note' in item ? item.note ?? '' : ''); setDirectoryActive(item?.active ?? true); setDirectoryError(''); setDirectoryOpen(true);
  };

  const saveDirectory = () => {
    const name = directoryName.trim();
    if (!name) { setDirectoryError(t('finance.store.errors.name')); return; }
    const now = new Date().toISOString();
    finance.updateState((current) => {
      if (directoryKind === 'employees') {
        const old = current.store.employees.find((item) => item.id === directoryId);
        const salary = numeric(directorySalary);
        const item: StoreEmployee = { id: directoryId ?? uid('employee'), name, role: directoryRole.trim() || undefined, phone: directoryPhone.trim() || undefined, salary: Number.isFinite(salary) && salary > 0 ? salary : 0, payFrequency: directoryPayFrequency, payMode: directoryPayMode, nextPayDate: directoryNextPayDate || now, lastPaidDate: old?.lastPaidDate, active: directoryActive, createdAt: old?.createdAt ?? now };
        return { ...current, store: { ...current.store, employees: old ? current.store.employees.map((entry) => entry.id === item.id ? item : entry) : [item, ...current.store.employees] } };
      }
      const old = current.store.clients.find((item) => item.id === directoryId);
      const item: StoreClient = { id: directoryId ?? uid('client'), name, phone: directoryPhone.trim() || undefined, email: directoryEmail.trim() || undefined, note: directoryNote.trim() || undefined, active: directoryActive, createdAt: old?.createdAt ?? now };
      return { ...current, store: { ...current.store, clients: old ? current.store.clients.map((entry) => entry.id === item.id ? item : entry) : [item, ...current.store.clients] } };
    });
    setDirectoryOpen(false);
  };

  const commitFunding = (allowNegative: boolean) => {
    const amount = numeric(fundingAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setFundingError(t('finance.storeFunding.invalid')); return; }
    const source = state.accounts.find((item) => item.id === fundingAccountId && !item.archived && item.type !== 'debt');
    if (fundingAccountId !== 'none' && !source) {
      setFundingError(t('finance.storePurchase.sourceRequired'));
      return;
    }
    if (!source) {
      finance.updateState((current) => withStoreBalance({ ...current, store: { ...current.store, cashMovements: [...current.store.cashMovements, { id: uid('store-cash'), type: 'funding', amount, date: new Date().toISOString(), note: fundingNote.trim() }] } }));
      setAddOpen(false); return;
    }
    const rate = currencyRate(currency, source.currency, state.settings.exchangeRates ?? { USD: 1 });
    if (!rate) { setFundingError(t('finance.storeFunding.missingRate')); return; }
    const sourceAmount = amount * rate;
    if (!allowNegative && accountBalance(state, source.id) < sourceAmount) {
      Alert.alert(t('finance.negativeBalance.title'), t('finance.negativeBalance.body'), [{ text: t('finance.cancel'), style: 'cancel' }, { text: t('finance.negativeBalance.confirm'), onPress: () => commitFunding(true) }]);
      return;
    }
    finance.addTransfer({ id: uid('store-funding'), fromAccountId: source.id, toAccountId: 'store-business', fromAmount: sourceAmount, toAmount: amount, fromCurrency: source.currency, toCurrency: currency, rate: amount / sourceAmount, fee: 0, date: new Date().toISOString(), note: fundingNote.trim(), status: 'cleared' });
    setAddOpen(false);
  };

  const saveSettings = () => {
    if (hasStoreHistory && storeCurrency !== currency) return;
    finance.updateState((current) => ({ ...current, store: { ...current.store, name: storeName.trim(), currency: storeCurrency, businessAccount: { ...current.store.businessAccount, name: storeName.trim() || current.store.businessAccount.name, currency: storeCurrency } } }));
  };

  const openSettings = () => {
    setStoreName(store.name);
    setStoreCurrency(currency);
    switchView('settings');
  };

  const reportExportLabels: ReportExportLabels = {
    title: t('finance.store.reports'), generated: t('finance.date'), summary: t('finance.store.reports'),
    salesByDay: t('finance.store.reportTransactionsPerDay'), topProducts: t('finance.store.reportTopProductsServices'), topClients: t('finance.store.reportTopClients'),
    moneyMovements: t('finance.store.businessMovements'), inventory: t('finance.store.inventory'), employees: t('finance.store.employees'), clients: t('finance.store.clients'),
    date: t('finance.date'), name: t('finance.name'), type: t('finance.store.type'), quantity: t('finance.store.units'), amount: t('finance.store.total'),
    balance: t('finance.storeBackup.businessBalance'), role: t('finance.store.employeeRole'), contact: t('finance.phone'), status: t('finance.storeFilters.status'),
    active: t('finance.storeFilters.active'), inactive: t('finance.storeFilters.inactive'), transactions: t('finance.store.reportTransactions'), salePrice: t('finance.store.salePrice'),
    available: t('finance.store.currentStock'), stock: t('finance.store.stock'),
  };

  const exportReport = async (format: 'pdf' | 'xlsx') => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('sharing-unavailable');
      const file = new File(Paths.cache, `solid-gold-rich-report-${new Date().toISOString().slice(0, 10)}.${format}`);
      file.create({ overwrite: true, intermediates: true });
      file.write(format === 'pdf' ? createStoreReportPdf(state, currency, state.settings.language ?? 'en', reportExportLabels) : createStoreReportXlsx(state, currency, state.settings.language ?? 'en', reportExportLabels));
      await Sharing.shareAsync(file.uri, { mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: format === 'pdf' ? t('finance.store.reportExportPdf') : t('finance.store.reportExportExcel') });
    } catch {
      Alert.alert(t('finance.store.reportExportFailed'), t('finance.store.reportExportFailedCopy'));
    } finally {
      setBackupBusy(false);
    }
  };

  const exportStore = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('sharing-unavailable');
      const backup = await createStoreBackup(store);
      const file = new File(Paths.cache, `solid-gold-rich-store-${new Date().toISOString().slice(0, 10)}.json`);
      file.create({ overwrite: true, intermediates: true });
      file.write(JSON.stringify(backup, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t('finance.storeBackup.exportStore') });
    } catch {
      Alert.alert(t('finance.storeBackup.backupFailed'), t('finance.storeBackup.backupFailedCopy'));
    } finally {
      setBackupBusy(false);
    }
  };

  const importStore = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const backup = parseStoreBackup(await new File(result.assets[0].uri).text());
      Alert.alert(t('finance.storeBackup.importStore'), t('finance.storeBackup.importConfirmCopy'), [
        { text: t('finance.cancel'), style: 'cancel' },
        { text: t('finance.storeBackup.importStore'), style: 'destructive', onPress: () => { void (async () => {
          setBackupBusy(true);
          try {
            const restoredStore = isolateStoreBackupForImport(await restoreStoreBackupToDevice(backup));
            finance.updateState((current) => ({ ...current, store: normalizeFinanceState({ ...current, store: restoredStore }).store }));
            setView('inventory');
            setProductQuery('');
            setSaleHistoryQuery('');
            setDirectoryQuery('');
            setCategoryFilter('');
            setStatusFilter('');
            setStockFilter('');
            setReportKind(null);
            setSelectedSaleId(null);
            Alert.alert(t('finance.storeBackup.backupImported'), t('finance.storeBackup.backupImportedCopy'));
            setSettingsOpen(false);
          } catch {
            Alert.alert(t('finance.storeBackup.backupFailed'), t('finance.storeBackup.backupInvalid'));
          } finally {
            setBackupBusy(false);
          }
        })(); } },
      ]);
    } catch {
      Alert.alert(t('finance.storeBackup.backupFailed'), t('finance.storeBackup.backupInvalid'));
    } finally {
      setBackupBusy(false);
    }
  };

  const renderProduct = ({ item }: { item: StoreProduct }) => {
    const stock = stockFor(item.id); const available = availableFor(item); const low = item.type === 'product' && stock <= item.stockMinimum;
    const expired = Boolean(item.expirationDate && localDay(item.expirationDate) < today);
    return <View style={[styles.productRow, !item.active && styles.inactive]}><Pressable style={styles.productMain} onPress={() => openProduct(item)} accessibilityRole="button"><View style={styles.productIcon}><ProductPicture product={item} /></View><View style={styles.rowMain}><Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text><Text style={styles.rowMeta} numberOfLines={1}>{item.key} · {categoryNameFor(item.categoryId)} · {money(item.salePrice, currency)}</Text>{expired ? <Text style={styles.dangerMeta} numberOfLines={1}>{t('finance.storeFilters.expired')}</Text> : null}</View></Pressable>{item.type === 'product' ? <View style={styles.stockSide}><Text style={[styles.stockValue, low && styles.dangerMeta]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{available}/{stock}</Text><Pressable style={styles.iconButton} onPress={() => { setStockProduct(item); setStockAction('entry'); setStockQuantity(''); setStockNote(''); setStockError(''); }} accessibilityRole="button" accessibilityLabel={t('finance.store.adjustStock')}><Ionicons name="swap-vertical-outline" size={18} color={C.gold} /></Pressable></View> : <Text style={styles.rowMeta} numberOfLines={1}>{t('finance.store.service')}</Text>}</View>;
  };

  const renderProducts = () => <View style={styles.flex}><View style={styles.toolbar}><View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={productQuery} onChangeText={setProductQuery} placeholder={t('finance.storeFilters.search')} placeholderTextColor={C.textSubtle} style={styles.searchInput} accessibilityLabel={t('finance.storeFilters.search')} /><Pressable style={[styles.filterButton, filtersActive && styles.filterButtonActive]} onPress={() => setFilterOpen(true)} accessibilityRole="button" accessibilityLabel={t('finance.storeFilters.filters')}><Ionicons name="options-outline" size={19} color={filtersActive ? C.void : C.gold} /></Pressable>{view === 'inventory' ? <Pressable style={styles.filterButton} onPress={() => { setFundingAccountId('none'); setFundingAmount(''); setFundingNote(''); setFundingError(''); setAddOpen(true); }} accessibilityRole="button" accessibilityLabel={t('finance.storeFunding.tab')}><Ionicons name="add-circle-outline" size={19} color={C.gold} /></Pressable> : null}</View></View><FlatList data={visibleProducts} keyExtractor={(item) => item.id} renderItem={renderProduct} contentContainerStyle={[styles.list, !visibleProducts.length && styles.listEmpty]} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Empty title={t('finance.store.noProducts')} copy={filtersActive || productQuery ? t('finance.storeFilters.noResults') : t('finance.store.noProductsCopy')} icon="cube-outline" />} /></View>;

  const renderSales = () => <View style={styles.flex}><View style={styles.toolbar}><View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={saleHistoryQuery} onChangeText={setSaleHistoryQuery} placeholder={t('finance.store.searchSales')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /></View><SegmentedControl options={(['all', 'today', 'week', 'month'] as SalePeriod[]).map((item) => ({ value: item, label: t(`finance.store.salePeriod.${item}`) }))} value={salePeriod} onChange={(value) => setSalePeriod(value as SalePeriod)} /></View><FlatList data={visibleSales} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, !visibleSales.length && styles.listEmpty]} renderItem={({ item }) => <Pressable style={styles.saleRow} onPress={() => setSelectedSaleId(item.id)}><View style={styles.saleIcon}><Ionicons name="receipt-outline" size={19} color={item.status === 'void' ? C.textSubtle : C.gold} /></View><View style={styles.rowMain}><Text style={[styles.rowTitle, item.status === 'void' && styles.inactiveText]}>{item.items.length} {t('finance.store.items')} · {new Date(item.date).toLocaleDateString()}</Text><Text style={styles.rowMeta}>{store.clients.find((client) => client.id === item.clientId)?.name ?? t('finance.store.noneSelected')}</Text></View><Text style={[styles.amount, item.status === 'void' && styles.inactiveText]}>{money(item.total, currency)}</Text></Pressable>} ListEmptyComponent={<Empty title={t('finance.store.noSales')} copy={saleHistoryQuery || salePeriod !== 'all' ? t('finance.storeFilters.noResults') : t('finance.store.noSalesCopy')} icon="receipt-outline" />} /></View>;

  const renderDirectory = (kind: DirectoryKind) => {
    const all = kind === 'clients' ? store.clients : store.employees;
    const query = normalizedSearch(directoryQuery);
    const items = all.filter((item) => normalizedSearch(`${item.name} ${item.phone ?? ''} ${'role' in item ? item.role ?? '' : ''} ${'email' in item ? item.email ?? '' : ''} ${'note' in item ? item.note ?? '' : ''}`).includes(query));
    return <View style={styles.flex}><View style={styles.toolbar}><View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={directoryQuery} onChangeText={setDirectoryQuery} placeholder={t('finance.store.directorySearch')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /><Pressable style={styles.addSmall} onPress={() => openDirectory(kind)} accessibilityLabel={t('finance.store.addDirectory')}><Ionicons name="add" size={20} color={C.gold} /></Pressable></View></View><FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, !items.length && styles.listEmpty]} renderItem={({ item }) => <View style={[styles.directoryRow, !item.active && styles.inactive]}><Pressable style={styles.directoryMain} onPress={() => openDirectory(kind, item)}><View style={styles.avatar}><Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{kind === 'employees' ? [('role' in item && item.role) || t('finance.store.employeeRoleEmpty'), 'salary' in item && item.salary > 0 ? `${money(item.salary, currency)} · ${t(`finance.payroll.frequency.${item.payFrequency}`)}` : t('finance.payroll.notConfigured')].join(' · ') : [item.phone, 'email' in item ? item.email : ''].filter(Boolean).join(' · ') || t('finance.store.clientContactEmpty')}</Text></View></Pressable>{kind === 'employees' && item.active && 'salary' in item && item.salary > 0 ? <Pressable style={styles.payButton} onPress={() => payEmployee(item.id)}><Ionicons name="cash-outline" size={15} color={C.void} /><Text style={styles.payButtonText}>{t('finance.payroll.pay')}</Text></Pressable> : null}<Ionicons name="chevron-forward" size={17} color={C.textSubtle} /></View>} ListEmptyComponent={<Empty title={t(kind === 'clients' ? 'finance.store.noClients' : 'finance.store.noEmployees')} copy={all.length ? t('finance.storeFilters.noResults') : t(kind === 'clients' ? 'finance.store.clientsCopy' : 'finance.store.employeesCopy')} icon={kind === 'clients' ? 'person-outline' : 'people-outline'} />} /></View>;
  };

  const renderMovements = () => {
    const movements = store.cashMovements.slice().sort((left, right) => right.date.localeCompare(left.date)).filter((movement) => normalizedSearch(`${movement.note} ${movement.type}`).includes(normalizedSearch(movementQuery)));
    const income = store.cashMovements.filter((movement) => movement.amount > 0).reduce((sum, movement) => sum + movement.amount, 0);
    const expenses = store.cashMovements.filter((movement) => movement.amount < 0).reduce((sum, movement) => sum + Math.abs(movement.amount), 0);
    return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={() => switchView('inventory')}><Ionicons name="arrow-back" size={18} color={C.gold} /><Text style={styles.link}>{t('finance.back')}</Text></Pressable>
      <View style={styles.viewIntro}><View style={styles.viewIntroIcon}><Ionicons name="wallet-outline" size={22} color={C.gold} /></View><View style={styles.rowMain}><Text style={styles.viewIntroTitle}>{t('finance.store.businessMovements')}</Text><Text style={styles.viewIntroCopy}>{t('finance.store.noBusinessMovementsCopy')}</Text></View></View>
      <View style={styles.movementSummary}><View style={styles.movementMetric}><Text style={styles.movementMetricLabel}>{t('finance.income')}</Text><Text style={styles.movementMetricValue}>{money(income, currency)}</Text></View><View style={styles.movementMetricDivider} /><View style={styles.movementMetric}><Text style={styles.movementMetricLabel}>{t('finance.expenses')}</Text><Text style={styles.movementMetricValueNegative}>{money(expenses, currency)}</Text></View><View style={styles.movementMetricDivider} /><View style={styles.movementMetric}><Text style={styles.movementMetricLabel}>{t('finance.storeBackup.businessBalance')}</Text><Text style={styles.movementMetricValue}>{money(store.businessAccount.balance, currency)}</Text></View></View>
      <View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={movementQuery} onChangeText={setMovementQuery} placeholder={t('finance.modules.searchActivity')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /></View>
      <View style={styles.movementList}>{movements.map((movement) => <View key={movement.id} style={styles.movementRow}><View style={[styles.movementIcon, movement.amount >= 0 ? styles.movementIconIncome : styles.movementIconExpense]}><Ionicons name={movement.amount >= 0 ? 'arrow-down-outline' : 'arrow-up-outline'} size={17} color={movement.amount >= 0 ? C.gold : C.red} /></View><View style={styles.rowMain}><Text style={styles.rowTitle} numberOfLines={2}>{movement.note || t(`finance.store.cashMovement.${movement.type}`)}</Text><Text style={styles.rowMeta}>{t(`finance.store.cashMovement.${movement.type}`)} · {new Date(movement.date).toLocaleString()}</Text></View><Text style={movement.amount >= 0 ? styles.positive : styles.negative} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{movement.amount >= 0 ? '+' : ''}{money(movement.amount, currency)}</Text></View>)}{!movements.length ? <Empty title={t('finance.store.noBusinessMovements')} copy={movementQuery ? t('finance.storeFilters.noResults') : t('finance.store.noBusinessMovementsCopy')} icon="wallet-outline" /> : null}</View>
    </ScrollView>;
  };

  const renderReports = () => {
    const { sales, daily, topProducts, topClients, total } = storeReportData(state);
    const options: { kind: StoreReportKind; icon: IconName; title: string; copy: string }[] = [
      { kind: 'transactionsPerDay', icon: 'calendar-outline', title: t('finance.store.reportTransactionsPerDay'), copy: t('finance.store.reportTransactionsPerDayCopy') },
      { kind: 'totalTransactions', icon: 'receipt-outline', title: t('finance.store.reportTotalTransactions'), copy: t('finance.store.reportTotalTransactionsCopy') },
      { kind: 'topProductsServices', icon: 'trending-up-outline', title: t('finance.store.reportTopProductsServices'), copy: t('finance.store.reportTopProductsServicesCopy') },
      { kind: 'topClients', icon: 'people-outline', title: t('finance.store.reportTopClients'), copy: t('finance.store.reportTopClientsCopy') },
    ];
    return <ScrollView contentContainerStyle={styles.content}>{reportKind ? <Pressable style={styles.backRow} onPress={() => setReportKind(null)}><Ionicons name="arrow-back" size={18} color={C.gold} /><Text style={styles.link}>{t('finance.store.reportBack')}</Text></Pressable> : null}<View style={styles.reportExportCard}><View style={styles.reportExportHeader}><View style={styles.reportIcon}><Ionicons name="download-outline" size={20} color={C.gold} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{t('finance.store.reportExportTitle')}</Text><Text style={styles.rowMeta}>{t('finance.store.reportExportCopy')}</Text></View></View><View style={styles.reportExportActions}><Pressable style={styles.exportButton} onPress={() => void exportReport('pdf')} disabled={backupBusy}><Ionicons name="document-text-outline" size={17} color={C.void} /><Text style={styles.exportButtonText}>{t('finance.store.reportExportPdf')}</Text></Pressable><Pressable style={styles.exportButtonSecondary} onPress={() => void exportReport('xlsx')} disabled={backupBusy}><Ionicons name="grid-outline" size={17} color={C.gold} /><Text style={styles.exportButtonSecondaryText}>{t('finance.store.reportExportExcel')}</Text></Pressable></View></View>{!reportKind ? options.map((option) => <Pressable key={option.kind} style={styles.reportOption} onPress={() => setReportKind(option.kind)}><View style={styles.reportIcon}><Ionicons name={option.icon} size={20} color={C.gold} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{option.title}</Text><Text style={styles.rowMeta}>{option.copy}</Text></View><Ionicons name="chevron-forward" size={17} color="rgba(255,244,208,0.28)" /></Pressable>) : null}{reportKind === 'totalTransactions' && sales.length ? <View style={styles.metric}><Text style={styles.metricNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{sales.length}</Text><Text style={styles.rowMeta}>{t('finance.store.reportTransactions')}</Text><Text style={styles.metricAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{money(total, currency)}</Text></View> : null}{reportKind === 'transactionsPerDay' ? daily.map(([date, value]) => <ReportRow key={date} title={new Date(`${date}T12:00:00`).toLocaleDateString()} copy={`${value.count} ${t('finance.store.reportTransactions')}`} amount={money(value.total, currency)} />) : null}{reportKind === 'topProductsServices' ? topProducts.map(([id, value]) => <ReportRow key={id} title={value.name} copy={`${value.quantity} ${t('finance.store.reportUnits')}`} amount={money(value.total, currency)} />) : null}{reportKind === 'topClients' ? topClients.map(([id, value]) => <ReportRow key={id} title={store.clients.find((item) => item.id === id)?.name ?? t('finance.store.inactiveClient')} copy={`${value.count} ${t('finance.store.reportTransactions')}`} amount={money(value.total, currency)} />) : null}{reportKind && ((reportKind === 'totalTransactions' && !sales.length) || (reportKind === 'transactionsPerDay' && !daily.length) || (reportKind === 'topProductsServices' && !topProducts.length) || (reportKind === 'topClients' && !topClients.length)) ? <Empty title={t('finance.store.reportNoData')} copy={t('finance.store.reportNoDataCopy')} icon="bar-chart-outline" /> : null}</ScrollView>;
  };

  const renderSettings = () => <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Pressable style={styles.backRow} onPress={() => switchView('inventory')}><Ionicons name="arrow-back" size={18} color={C.gold} /><Text style={styles.link}>{t('finance.back')}</Text></Pressable><View style={styles.settingsHero}><View style={styles.settingsHeroIcon}><Ionicons name="settings-outline" size={24} color={C.gold} /></View><View style={styles.rowMain}><Text style={styles.settingsHeroTitle}>{store.name || t('finance.store.business')}</Text><Text style={styles.settingsHeroCopy}>{t('finance.storeBackup.businessBalance')}: {money(store.businessAccount.balance, currency)}</Text></View></View><Text style={styles.sectionTitle}>{t('finance.store.sectionIdentity')}</Text><View style={styles.settingsCard}><FormField label={t('finance.store.businessName')} value={storeName} onChangeText={setStoreName} placeholder={t('finance.store.storeNamePlaceholder')} required /><SearchableSelect label={t('finance.store.currency')} value={storeCurrency} options={currencyOptions} onChange={setStoreCurrency} placeholder={currency} searchPlaceholder={t('finance.searchCurrency')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} disabled={hasStoreHistory} />{hasStoreHistory ? <Text style={styles.helper}>{t('finance.store.currencyLocked')}</Text> : null}<Pressable style={[styles.primaryButton, (!storeName.trim() || backupBusy) && styles.buttonDisabled]} onPress={saveSettings} disabled={!storeName.trim() || backupBusy}><Text style={styles.primaryButtonText}>{t('finance.store.saveSettings')}</Text></Pressable></View><Text style={styles.sectionTitle}>{t('finance.storeBackup.backupTitle')}</Text><Text style={styles.helper}>{t('finance.storeBackup.backupCopy')}</Text><View style={styles.settingsActionRow}><Pressable style={styles.settingsAction} onPress={() => void exportStore()} disabled={backupBusy}><Ionicons name="cloud-download-outline" size={18} color={C.gold} /><Text style={styles.settingsActionText}>{t('finance.storeBackup.exportStore')}</Text></Pressable><Pressable style={styles.settingsAction} onPress={() => void importStore()} disabled={backupBusy}><Ionicons name="cloud-upload-outline" size={18} color={C.gold} /><Text style={styles.settingsActionText}>{t('finance.storeBackup.importStore')}</Text></Pressable></View></ScrollView>;

  const title = view === 'movements' ? t('finance.store.viewMovements') : view === 'settings' ? t('finance.store.settings') : t(`finance.store.${view}`);
  const content = view === 'inventory' || view === 'services' ? renderProducts() : view === 'sales' ? renderSales() : view === 'reports' ? renderReports() : view === 'movements' ? renderMovements() : view === 'settings' ? renderSettings() : renderDirectory(view);
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><View style={styles.root}>
    <View style={styles.header}><Pressable style={styles.headerButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button" accessibilityLabel={t('finance.menu')}><MenuGlyph /></Pressable><Text style={styles.headerTitle} numberOfLines={1}>{title}</Text><View style={styles.headerSpacer} /></View>
    <Animated.View key={view} entering={FadeIn.duration(reduceMotion ? 0 : 190).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(reduceMotion ? 0 : 120)} style={styles.flex}>{content}</Animated.View>
    <Pressable style={[styles.workspaceFab, view === 'inventory' || view === 'services' || view === 'sales' ? styles.workspaceFabStacked : styles.workspaceFabSolo]} onPress={switchWorkspace} accessibilityRole="button" accessibilityLabel={t('finance.workspace.personal')}><Ionicons name="wallet-outline" size={20} color={C.gold} /></Pressable>
    {(view === 'inventory' || view === 'services' || view === 'sales') ? <Pressable style={styles.fab} onPress={view === 'sales' ? openSale : () => openProduct()} accessibilityRole="button" accessibilityLabel={view === 'sales' ? t('finance.store.newSale') : t('finance.store.addProduct')}><Ionicons name="add" size={25} color={C.gold} /></Pressable> : null}

    <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
      <View style={styles.drawerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
        <Animated.View style={styles.drawerPanel} entering={SlideInLeft.duration(reduceMotion ? 0 : 220).easing(Easing.out(Easing.cubic))}>
          <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerTitle} numberOfLines={1}>{store.name || t('finance.store.business')}</Text>
              <View style={styles.balanceCard}><Text style={styles.eyebrow}>{t('finance.storeDrawer.inventoryValue')}</Text><Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>{money(inventoryValue, currency)}</Text><Text style={styles.rowMeta}>{t('finance.storeBackup.businessBalance')}: {money(store.businessAccount.balance, currency)}</Text></View>
              <Pressable style={[styles.drawerItem, view === 'movements' && styles.drawerItemActive]} onPress={() => switchView('movements')} accessibilityRole="button" accessibilityLabel={t('finance.store.viewMovements')}><Ionicons name="wallet-outline" size={20} color={view === 'movements' ? C.goldLight : C.gold} /><Text style={styles.drawerText}>{t('finance.store.viewMovements')}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></Pressable>
              {([['inventory', 'cube-outline'], ['employees', 'people-outline'], ['clients', 'person-outline'], ['services', 'construct-outline'], ['sales', 'cart-outline'], ['reports', 'bar-chart-outline']] as [StoreView, IconName][]).map(([item, icon]) => <Pressable key={item} style={[styles.drawerItem, view === item && styles.drawerItemActive]} onPress={() => switchView(item)} accessibilityRole="button" accessibilityLabel={t(`finance.store.${item}`)}><Ionicons name={icon} size={20} color={view === item ? C.goldLight : C.gold} /><Text style={styles.drawerText}>{t(`finance.store.${item}`)}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></Pressable>)}
              <Pressable style={[styles.drawerItem, view === 'settings' && styles.drawerItemActive]} onPress={openSettings} accessibilityRole="button" accessibilityLabel={t('finance.store.settings')}><Ionicons name="settings-outline" size={20} color={view === 'settings' ? C.goldLight : C.gold} /><Text style={styles.drawerText}>{t('finance.store.settings')}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></Pressable>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>

    <ResponsiveSheet visible={filterOpen} title={t('finance.storeFilters.filters')} onClose={() => setFilterOpen(false)} closeLabel={t('finance.close')}>
      <SearchableSelect label={t('finance.store.category')} value={categoryFilter} options={[{ value: '', label: t('finance.filters.all'), icon: 'apps-outline' }, ...categoryOptions]} onChange={setCategoryFilter} placeholder={t('finance.filters.all')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <SegmentedControl label={t('finance.storeFilters.status')} options={['', 'active', 'inactive'].map((item) => ({ value: item, label: item ? t(`finance.storeFilters.${item}`) : t('finance.filters.all') }))} value={statusFilter} onChange={setStatusFilter} />
      {view === 'inventory' ? <View style={styles.filterRows}>{(['', 'low', 'out', 'expired', 'expiring'] as StockFilter[]).map((item) => <Pressable key={item || 'all'} style={styles.filterRow} onPress={() => setStockFilter(item)} accessibilityRole="radio" accessibilityState={{ selected: stockFilter === item }}><Text style={styles.drawerText}>{item ? t(`finance.storeFilters.${item}`) : t('finance.filters.all')}</Text>{stockFilter === item ? <Ionicons name="checkmark-circle" size={20} color={C.gold} /> : <Ionicons name="ellipse-outline" size={20} color="rgba(255,244,208,0.25)" />}</Pressable>)}</View> : null}
      {filtersActive ? <Pressable style={styles.textAction} onPress={() => { setCategoryFilter(''); setStatusFilter(''); setStockFilter(''); }}><Text style={styles.link}>{t('finance.storeFilters.clear')}</Text></Pressable> : null}
    </ResponsiveSheet>

    <ResponsiveSheet visible={addOpen} title={t('finance.storeFunding.title')} onClose={() => setAddOpen(false)} closeLabel={t('finance.close')} footer={<FormActions saveLabel={t('finance.storeFunding.save')} onSave={() => commitFunding(false)} compact disabled={!(numeric(fundingAmount) > 0)} />}>
      <Text style={styles.helper}>{t('finance.storeFunding.copy')}</Text><SearchableSelect label={t('finance.storeFunding.account')} value={fundingAccountId} options={accountOptions.filter((item) => item.value !== 'store-business')} onChange={(value) => { setFundingAccountId(value); setFundingError(''); }} placeholder={t('finance.storePurchase.none')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} /><FormField label={t('finance.storeFunding.amount')} value={fundingAmount} onChangeText={(value) => { setFundingAmount(value); setFundingError(''); }} numeric required error={fundingError} /><FormField label={t('finance.storeFunding.note')} value={fundingNote} onChangeText={setFundingNote} />
    </ResponsiveSheet>

    <ResponsiveSheet visible={productOpen} title={editingProduct ? (productDraft.type === 'service' ? t('finance.store.service') : t('finance.store.editProduct')) : (productDraft.type === 'service' ? t('finance.store.service') : t('finance.store.newProduct'))} onClose={() => setProductOpen(false)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.store.saveProduct')} onCancel={() => setProductOpen(false)} onSave={() => commitProduct(false)} disabled={Object.keys(productValidation()).length > 0} destructiveLabel={editingProduct ? (editingProduct.active ? t('finance.store.deactivate') : t('finance.store.activate')) : undefined} onDestructive={editingProduct ? () => { finance.updateState((current) => ({ ...current, store: { ...current.store, products: current.store.products.map((item) => item.id === editingProduct.id ? { ...item, active: !item.active } : item) } })); setProductOpen(false); } : undefined} />}>
      <Text style={styles.sectionTitle}>{view === 'services' ? t('finance.store.service') : t('finance.store.sectionIdentity')}</Text>
      <FormField label={view === 'services' ? t('finance.store.service') : t('finance.store.productKey')} value={productDraft.key} onChangeText={(value) => { setProductDraft((current) => ({ ...current, key: value })); setProductErrors((current) => ({ ...current, key: '' })); }} required error={productErrors.key} />
      <FormField label={view === 'services' ? t('finance.store.service') : t('finance.store.productName')} value={productDraft.name} onChangeText={(value) => { setProductDraft((current) => ({ ...current, name: value })); setProductErrors((current) => ({ ...current, name: '' })); }} required error={productErrors.name} />
      <SearchableSelect label={t('finance.store.unit')} value={customUnitOpen ? '__custom__' : productDraft.unit} options={[...UNIT_OPTIONS.map((unit) => ({ value: unit, label: t(`finance.unitOptions.${unit}`), icon: 'cube-outline' as const })), { value: '__custom__', label: t('finance.storeUnits.custom'), icon: 'create-outline' as const }]} onChange={(value) => { if (value === '__custom__') { setCustomUnitOpen(true); setProductDraft((current) => ({ ...current, unit: '' })); } else { setCustomUnitOpen(false); setProductDraft((current) => ({ ...current, unit: value })); } setProductErrors((current) => ({ ...current, unit: '' })); }} placeholder={t('finance.store.unit')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} required error={productErrors.unit} />
      {customUnitOpen ? <FormField label={t('finance.storeUnits.customLabel')} value={productDraft.unit} onChangeText={(value) => { setProductDraft((current) => ({ ...current, unit: value })); setProductErrors((current) => ({ ...current, unit: '' })); }} placeholder={t('finance.storeUnits.customPlaceholder')} required error={productErrors.unit} /> : null}
      <SearchableSelect label={t('finance.store.category')} value={productDraft.categoryId} options={categoryOptions} onChange={(value) => setProductDraft((current) => ({ ...current, categoryId: value }))} placeholder={t('finance.store.generalCategory')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} required error={productErrors.category} />
      <Pressable style={styles.textAction} onPress={() => setCategoryManagerOpen(true)}><Ionicons name="settings-outline" size={16} color={C.gold} /><Text style={styles.link}>{t('finance.store.manageCategories')}</Text></Pressable>
      <Text style={styles.sectionTitle}>{t('finance.chooseIcon')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productIconChoices} accessibilityLabel={t('finance.chooseIcon')}>
        {PRODUCT_ICON_OPTIONS.map((icon) => <Pressable key={icon} style={[styles.productIconChoice, productDraft.icon === icon && styles.productIconChoiceActive]} onPress={() => setProductDraft((current) => ({ ...current, icon }))} accessibilityRole="radio" accessibilityState={{ selected: productDraft.icon === icon }} accessibilityLabel={t('finance.chooseIcon')}><Ionicons name={icon} size={20} color={productDraft.icon === icon ? C.void : C.gold} /></Pressable>)}
      </ScrollView>
      <Text style={styles.sectionTitle}>{t('finance.store.sectionPrices')}</Text>
      <View style={styles.priceRow}>
        <View style={styles.priceColumn}><FormField label={t('finance.store.purchasePrice')} value={productDraft.purchasePrice} onChangeText={(value) => setProductDraft((current) => ({ ...current, purchasePrice: value }))} numeric error={productErrors.numbers} /></View>
        <View style={styles.priceColumn}><FormField label={t('finance.store.salePrice')} value={productDraft.salePrice} onChangeText={(value) => setProductDraft((current) => ({ ...current, salePrice: value }))} numeric required error={productErrors.salePrice} /></View>
      </View>
      {productDraft.additionalSalePrices.map((price, index) => <View key={index} style={styles.inline}><View style={styles.inlineMain}><FormField label={`${t('finance.store.additionalSalePrice')} ${index + 1}`} value={price} onChangeText={(value) => setProductDraft((current) => ({ ...current, additionalSalePrices: current.additionalSalePrices.map((item, itemIndex) => itemIndex === index ? value : item) }))} numeric /></View><Pressable style={styles.iconButton} onPress={() => setProductDraft((current) => ({ ...current, additionalSalePrices: current.additionalSalePrices.filter((_, itemIndex) => itemIndex !== index) }))} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={18} color="#F08B88" /></Pressable></View>)}
      <Pressable style={styles.textAction} onPress={() => setProductDraft((current) => ({ ...current, additionalSalePrices: [...current.additionalSalePrices, ''] }))}><Ionicons name="add" size={17} color={C.gold} /><Text style={styles.link}>{t('finance.store.addSalePrice')}</Text></Pressable>
      {productDraft.type === 'product' ? <><Text style={styles.sectionTitle}>{t('finance.store.sectionInventory')}</Text>{!editingProduct ? <FormField label={t('finance.store.quantity')} value={productDraft.stock} onChangeText={(value) => setProductDraft((current) => ({ ...current, stock: value }))} numeric error={productErrors.numbers} /> : null}<FormField label={t('finance.store.quantityReserve')} value={productDraft.reservedQuantity} onChangeText={(value) => setProductDraft((current) => ({ ...current, reservedQuantity: value }))} numeric error={productErrors.reserve} /><FormField label={t('finance.store.stockMinimum')} value={productDraft.stockMinimum} onChangeText={(value) => setProductDraft((current) => ({ ...current, stockMinimum: value }))} numeric />{!editingProduct ? <SearchableSelect label={t('finance.storePurchase.purchaseFrom')} value={purchaseAccountId} options={accountOptions} onChange={setPurchaseAccountId} placeholder={t('finance.storePurchase.none')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} error={productErrors.purchase} /> : null}</> : null}
      <Pressable style={styles.moreHeader} onPress={() => setProductMoreOpen((value) => !value)}><Text style={styles.sectionTitle}>{t('finance.store.moreDetails')}</Text><Ionicons name={productMoreOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.gold} /></Pressable>
      {productMoreOpen ? <><Pressable style={styles.picturePicker} onPress={choosePicture}><View style={styles.pictureBox}>{productDraft.picture ? <Image source={{ uri: productDraft.picture }} style={styles.productImage} /> : <Ionicons name="image-outline" size={24} color={C.gold} />}</View><View style={styles.rowMain}><Text style={styles.rowTitle}>{t('finance.store.picture')}</Text><Text style={styles.rowMeta}>{t('finance.store.picturePickerCopy')}</Text></View><Ionicons name="chevron-forward" size={17} color="rgba(255,244,208,0.3)" /></Pressable>{productDraft.picture ? <Pressable style={styles.textAction} onPress={() => setProductDraft((current) => ({ ...current, picture: undefined }))}><Text style={styles.dangerLink}>{t('finance.store.removePicture')}</Text></Pressable> : null}{productDraft.type === 'product' ? <><DateSelect label={t('finance.store.expiration')} value={productDraft.expirationDate} emptyLabel={t('finance.store.noExpiration')} onChange={(value) => setProductDraft((current) => ({ ...current, expirationDate: value }))} /><Pressable style={styles.textAction} onPress={() => setProductDraft((current) => ({ ...current, expirationDate: '' }))}><Text style={styles.link}>{t('finance.store.clearExpiration')}</Text></Pressable></> : null}<FormField label={t('finance.store.additionalInfo')} value={productDraft.additionalInfo} onChangeText={(value) => setProductDraft((current) => ({ ...current, additionalInfo: value }))} multiline error={productErrors.picture} /></> : null}
    </ResponsiveSheet>

    <ResponsiveSheet visible={categoryManagerOpen} title={t('finance.store.manageCategories')} onClose={() => { setCategoryManagerOpen(false); setEditingCategoryId(null); setCategoryName(''); setCategoryError(''); }} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.save')} onCancel={() => { setCategoryManagerOpen(false); setEditingCategoryId(null); setCategoryName(''); setCategoryError(''); }} onSave={saveCategory} disabled={!categoryName.trim()} />}>
      <View style={styles.inline}><View style={styles.inlineMain}><FormField label={editingCategoryId ? t('finance.store.renameCategory') : t('finance.store.newCategoryPlaceholder')} value={categoryName} onChangeText={(value) => { setCategoryName(value); setCategoryError(''); }} error={categoryError} /></View></View>
      {store.categories.map((category) => <View key={category.id} style={styles.categoryRow}><Text style={[styles.rowTitle, styles.categoryRowText]} numberOfLines={1}>{categoryNameFor(category.id)}</Text>{!category.builtIn ? <><Pressable style={styles.iconButton} onPress={() => { setEditingCategoryId(category.id); setCategoryName(category.name); }} accessibilityLabel={t('finance.editAction')}><Ionicons name="pencil-outline" size={17} color={C.gold} /></Pressable><Pressable style={styles.iconButton} onPress={() => deleteCategory(category)} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></> : null}</View>)}
    </ResponsiveSheet>

    <ResponsiveSheet visible={Boolean(stockProduct)} title={stockProduct?.name ?? t('finance.store.adjustStock')} onClose={() => setStockProduct(null)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.save')} onCancel={() => setStockProduct(null)} onSave={saveStock} disabled={!stockNote.trim() || !(numeric(stockQuantity) >= 0)} />}>
      <Text style={styles.helper}>{t('finance.store.currentStock')}: {stockProduct ? stockFor(stockProduct.id) : 0}</Text>
      <SegmentedControl options={(['entry', 'exit', 'adjustment'] as StockAction[]).map((item) => ({ value: item, label: t(`finance.store.stockAction.${item}`) }))} value={stockAction} onChange={(value) => setStockAction(value as StockAction)} />
      <FormField label={stockAction === 'adjustment' ? t('finance.store.newQuantity') : t('finance.store.quantity')} value={stockQuantity} onChangeText={(value) => { setStockQuantity(value); setStockError(''); }} numeric required error={stockError} />
      <FormField label={t('finance.store.stockReason')} value={stockNote} onChangeText={(value) => { setStockNote(value); setStockError(''); }} required />
      <Text style={styles.sectionTitle}>{t('finance.store.stockHistory')}</Text>
      {store.stockMovements.filter((item) => item.productId === stockProduct?.id).slice().sort((a, b) => b.date.localeCompare(a.date)).map((movement) => <View key={movement.id} style={styles.historyRow}><View style={styles.rowMain}><Text style={styles.rowTitle}>{movement.note || t(`finance.store.stockAction.${movement.type}`)}</Text><Text style={styles.rowMeta}>{new Date(movement.date).toLocaleString()}</Text></View><Text style={movement.quantity >= 0 ? styles.positive : styles.negative}>{movement.quantity >= 0 ? '+' : ''}{movement.quantity}</Text></View>)}
    </ResponsiveSheet>

    <ResponsiveSheet visible={saleOpen} title={t('finance.store.newSale')} onClose={() => setSaleOpen(false)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.store.completeSale')} onCancel={() => setSaleOpen(false)} onSave={submitSale} disabled={!cart.length || saleSubmitting} />}>
      <View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={saleQuery} onChangeText={setSaleQuery} placeholder={t('finance.store.searchProducts')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /></View>
      {saleProducts.slice(0, 12).map((product) => <Pressable key={product.id} style={styles.saleProduct} onPress={() => addToCart(product)}><View style={styles.rowMain}><Text style={styles.rowTitle}>{product.name}</Text><Text style={styles.rowMeta}>{product.type === 'service' ? t('finance.store.service') : `${availableFor(product)} ${t('finance.store.units')}`}</Text></View><Text style={styles.amount}>{money(product.salePrice, currency)}</Text><Ionicons name="add-circle-outline" size={22} color={C.gold} /></Pressable>)}
      {cart.length ? <Text style={styles.sectionTitle}>{t('finance.store.cart')}</Text> : null}
      {cart.map((item) => <View key={item.productId} style={styles.cartRow}><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Pressable onPress={() => cyclePrice(item.productId)} disabled={(store.products.find((product) => product.id === item.productId)?.additionalSalePrices.length ?? 0) === 0}><Text style={styles.priceLink}>{money(item.unitPrice, currency)}{(store.products.find((product) => product.id === item.productId)?.additionalSalePrices.length ?? 0) > 0 ? ` · ${t('finance.store.changePrice')}` : ''}</Text></Pressable></View><Pressable style={styles.quantityButton} onPress={() => changeCart(item.productId, -1)}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityValue}>{item.quantity}</Text><Pressable style={styles.quantityButton} onPress={() => changeCart(item.productId, 1)}><Text style={styles.quantityText}>+</Text></Pressable></View>)}
      {cart.length ? <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('finance.store.total')}</Text><Text style={styles.totalValue}>{money(saleTotal, currency)}</Text></View> : null}
      <SearchableSelect label={t('finance.store.client')} value={saleClientId} options={personOptions('clients')} onChange={setSaleClientId} placeholder={t('finance.store.noneSelected')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <SearchableSelect label={t('finance.store.employee')} value={saleEmployeeId} options={personOptions('employees')} onChange={setSaleEmployeeId} placeholder={t('finance.store.noneSelected')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <SearchableSelect label={t('finance.store.paymentMethod')} value={paymentMethod} options={['', 'cash', 'card', 'bank', 'other'].map((item) => ({ value: item, label: item ? t(`finance.accountTypes.${item}`) : t('finance.store.noPaymentMethod'), icon: 'card-outline' }))} onChange={setPaymentMethod} placeholder={t('finance.store.noPaymentMethod')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <FormField label={t('finance.store.saleNote')} value={saleNote} onChangeText={setSaleNote} multiline />
      {saleError ? <Text style={styles.error}>{saleError}</Text> : null}
    </ResponsiveSheet>

    <ResponsiveSheet visible={Boolean(selectedSale)} title={t('finance.store.saleDetails')} onClose={() => setSelectedSaleId(null)} closeLabel={t('finance.close')}>
      {selectedSale ? <><Text style={styles.helper}>{new Date(selectedSale.date).toLocaleString()}</Text>{selectedSale.items.map((item) => <ReportRow key={item.productId} title={`${item.name} × ${item.quantity}`} copy={money(item.unitPrice, currency)} amount={money(item.total, currency)} />)}<View style={styles.totalRow}><Text style={styles.totalLabel}>{t('finance.store.total')}</Text><Text style={styles.totalValue}>{money(selectedSale.total, currency)}</Text></View><Detail label={t('finance.store.client')} value={store.clients.find((item) => item.id === selectedSale.clientId)?.name ?? t('finance.store.noneSelected')} /><Detail label={t('finance.store.employee')} value={store.employees.find((item) => item.id === selectedSale.employeeId)?.name ?? t('finance.store.noneSelected')} /><Detail label={t('finance.store.paymentMethod')} value={selectedSale.paymentMethod ? t(`finance.accountTypes.${selectedSale.paymentMethod}`) : t('finance.store.noPaymentMethod')} />{selectedSale.note ? <Detail label={t('finance.store.saleNote')} value={selectedSale.note} /> : null}<Text style={selectedSale.status === 'void' ? styles.negative : styles.positive}>{t(`finance.store.${selectedSale.status === 'void' ? 'voided' : 'completed'}`)}</Text>{selectedSale.status === 'completed' ? <Pressable style={styles.dangerButton} onPress={() => confirmVoidSale(selectedSale.id)}><Text style={styles.dangerLink}>{t('finance.store.voidSale')}</Text></Pressable> : null}</> : null}
    </ResponsiveSheet>

    <ResponsiveSheet visible={directoryOpen} title={`${t(directoryId ? 'finance.store.editDirectory' : 'finance.store.addDirectory')} ${t(directoryKind === 'clients' ? 'finance.store.client' : 'finance.store.employee')}`} onClose={() => setDirectoryOpen(false)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.save')} onCancel={() => setDirectoryOpen(false)} onSave={saveDirectory} disabled={!directoryName.trim()} />}>
      <View style={styles.directoryHero}><View style={styles.directoryHeroAvatar}><Text style={styles.directoryHeroAvatarText}>{directoryName.trim().charAt(0).toUpperCase() || '?'}</Text></View><View style={styles.rowMain}><Text style={styles.directoryHeroTitle}>{directoryName.trim() || t('finance.store.directoryNamePlaceholder')}</Text><Text style={styles.helper}>{t(directoryKind === 'clients' ? 'finance.store.clientsCopy' : 'finance.store.employeesCopy')}</Text></View></View>
      <Text style={styles.formSectionTitle}>{t('finance.store.sectionIdentity')}</Text>
      <FormField label={t('finance.name')} value={directoryName} onChangeText={(value) => { setDirectoryName(value); setDirectoryError(''); }} placeholder={t('finance.store.directoryNamePlaceholder')} required error={directoryError} />
      {directoryKind === 'employees' ? <FormField label={t('finance.store.employeeRole')} value={directoryRole} onChangeText={setDirectoryRole} placeholder={t('finance.store.employeeRolePlaceholder')} /> : null}
      {directoryKind === 'employees' ? <><FormField label={t('finance.payroll.salary')} value={directorySalary} onChangeText={setDirectorySalary} numeric /><SegmentedControl label={t('finance.payroll.frequencyLabel')} options={(['weekly', 'biweekly', 'monthly'] as StorePayFrequency[]).map((value) => ({ value, label: t(`finance.payroll.frequency.${value}`) }))} value={directoryPayFrequency} onChange={(value) => setDirectoryPayFrequency(value as StorePayFrequency)} /><SegmentedControl label={t('finance.payroll.modeLabel')} options={[{ value: 'manual', label: t('finance.payroll.manual') }, { value: 'automatic', label: t('finance.payroll.automatic') }]} value={directoryPayMode} onChange={(value) => setDirectoryPayMode(value as StorePayMode)} /><DateSelect label={t('finance.payroll.nextDate')} value={directoryNextPayDate} emptyLabel={t('finance.payroll.nextDateEmpty')} onChange={setDirectoryNextPayDate} /><Text style={styles.helper}>{t('finance.payroll.accountHint')}</Text></> : null}
      <Text style={styles.formSectionTitle}>{t('finance.store.moreDetails')}</Text>
      <FormField label={t('finance.phone')} value={directoryPhone} onChangeText={setDirectoryPhone} />
      {directoryKind === 'clients' ? <><FormField label={t('finance.email')} value={directoryEmail} onChangeText={setDirectoryEmail} /><FormField label={t('finance.notes')} value={directoryNote} onChangeText={setDirectoryNote} multiline /></> : null}
      <SegmentedControl label={t('finance.storeFilters.status')} options={[{ value: 'active', label: t('finance.storeFilters.active') }, { value: 'inactive', label: t('finance.storeFilters.inactive') }]} value={directoryActive ? 'active' : 'inactive'} onChange={(value) => setDirectoryActive(value === 'active')} />
    </ResponsiveSheet>

  </View></SafeAreaView>;
}

function Empty({ title, copy, icon }: { title: string; copy: string; icon: IconName }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={25} color={C.gold} /></View><Text style={styles.emptyTitle} numberOfLines={2}>{title}</Text><Text style={styles.emptyCopy} numberOfLines={4}>{copy}</Text></View>;
}

function ReportRow({ title, copy, amount }: { title: string; copy: string; amount: string }) {
  return <View style={styles.reportRow}><View style={styles.rowMain}><Text style={styles.rowTitle} numberOfLines={2}>{title}</Text><Text style={styles.rowMeta} numberOfLines={2}>{copy}</Text></View><Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{amount}</Text></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.rowMeta} numberOfLines={1}>{label}</Text><Text style={styles.rowTitle} numberOfLines={3}>{value}</Text></View>;
}

const styles = createThemeStyles((C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background }, root: { flex: 1, minHeight: 0, backgroundColor: C.background }, flex: { flex: 1, minHeight: 0 },
  header: { height: 78, paddingTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  headerButton: { width: 44, height: 44, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, textAlign: 'center', color: C.goldLight, fontFamily: SANS, fontSize: 15, fontWeight: '600' }, headerSpacer: { width: 44 },
  menuGlyph: { width: 18, gap: 3.5 }, menuLineWide: { width: 18, height: 1.5, borderRadius: 2, backgroundColor: C.gold }, menuLine: { width: 12, height: 1.5, borderRadius: 2, backgroundColor: C.gold },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 5 }, search: { minHeight: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, color: C.goldLight, fontFamily: SANS, fontSize: 13 }, filterButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, filterButtonActive: { backgroundColor: C.gold }, addSmall: { width: 44, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 136 }, listEmpty: { flexGrow: 1 }, content: { padding: 16, paddingBottom: 136 },
  productRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }, productIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, productImage: { width: '100%', height: '100%' }, productIconChoices: { gap: 8, paddingVertical: 7 }, productIconChoice: { width: 44, height: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center' }, productIconChoiceActive: { backgroundColor: C.gold, borderColor: C.gold }, rowMain: { flex: 1, minWidth: 0 }, rowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13 }, rowMeta: { color: 'rgba(255,244,208,0.46)', fontFamily: SANS, fontSize: 10, lineHeight: 15, marginTop: 3 }, dangerMeta: { color: '#F08B88', fontFamily: SANS, fontSize: 10, marginTop: 3 }, stockSide: { flexDirection: 'row', alignItems: 'center' }, stockValue: { minWidth: 34, textAlign: 'right', color: C.goldLight, fontFamily: SERIF, fontSize: 15 }, iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, inactive: { opacity: 0.48 }, inactiveText: { color: 'rgba(255,244,208,0.28)' },
  saleRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, saleIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' }, amount: { color: C.goldLight, fontFamily: SERIF, fontSize: 14, maxWidth: '38%' },
  directoryRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, directoryMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }, payButton: { minHeight: 32, borderRadius: 10, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold }, payButtonText: { color: C.void, fontFamily: SANS, fontSize: 9, fontWeight: '700' }, avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.goldLight, fontFamily: SERIF, fontSize: 17 },
  directoryHero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 13, marginBottom: 5 }, directoryHeroAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(233,200,119,0.14)', alignItems: 'center', justifyContent: 'center' }, directoryHeroAvatarText: { color: C.goldLight, fontFamily: SERIF, fontSize: 21 }, directoryHeroTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 17 }, formSectionTitle: { color: 'rgba(233,200,119,0.62)', fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1.3, marginTop: 17, marginBottom: 1, textTransform: 'uppercase' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  drawerPanel: { width: '84%', height: '100%', backgroundColor: '#090B12', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.line, paddingHorizontal: 18 },
  drawerScroll: { flex: 1 },
  drawerContent: { paddingTop: 14, paddingBottom: 20 },
  drawerTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 22, marginBottom: 14 },
  balanceCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 16, marginBottom: 14 }, eyebrow: { color: 'rgba(233,200,119,0.64)', fontFamily: SANS, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' }, balance: { color: C.goldLight, fontFamily: SERIF, fontSize: 26, marginTop: 7 }, drawerItem: { minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 }, drawerItemActive: { backgroundColor: C.glass }, drawerText: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 14 },
  filterRows: { marginTop: 14 }, filterRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 3 }, secondaryButton: { minHeight: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, link: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' }, dangerLink: { color: '#F08B88', fontFamily: SANS, fontSize: 11, fontWeight: '700' }, helper: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, marginTop: 8 }, sectionTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 17, marginTop: 20, marginBottom: 2 },
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, inlineMain: { flex: 1, minWidth: 0 }, priceRow: { flexDirection: 'row', gap: 10 }, priceColumn: { flex: 1, minWidth: 0 }, moreHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, picturePicker: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, pictureBox: { width: 52, height: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, categoryRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, categoryRowText: { flex: 1, minWidth: 0 },
  historyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, positive: { color: C.gold, fontFamily: SERIF, fontSize: 14 }, negative: { color: '#F08B88', fontFamily: SERIF, fontSize: 14 },
  saleProduct: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, cartRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, quantityButton: { width: 44, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, quantityText: { color: C.gold, fontSize: 20 }, quantityValue: { minWidth: 22, color: C.goldLight, fontFamily: SANS, fontSize: 12, textAlign: 'center' }, priceLink: { color: C.gold, fontFamily: SANS, fontSize: 10, marginTop: 4 }, totalRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 8 }, totalLabel: { color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '700' }, totalValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 22 }, error: { color: '#F08B88', fontFamily: SANS, fontSize: 11, marginTop: 10 },
  reportOption: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, reportIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.09)', alignItems: 'center', justifyContent: 'center' }, reportRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, backRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, metric: { minHeight: 220, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, metricNumber: { color: C.goldLight, fontFamily: SERIF, fontSize: 44 }, metricAmount: { color: C.gold, fontFamily: SERIF, fontSize: 22, marginTop: 10 }, detail: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, dangerButton: { minHeight: 48, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: '#F08B88', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  reportExportCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 14, marginBottom: 8 }, reportExportHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, reportExportActions: { flexDirection: 'row', gap: 8, marginTop: 13 }, exportButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, exportButtonText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '800' }, exportButtonSecondary: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, exportButtonSecondaryText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '800' },
  viewIntro: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }, viewIntroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' }, viewIntroTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 18 }, viewIntroCopy: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 10, lineHeight: 15, marginTop: 3 }, movementSummary: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 12, marginBottom: 12 }, movementMetric: { flex: 1, minWidth: 0 }, movementMetricLabel: { color: 'rgba(233,200,119,0.55)', fontFamily: SANS, fontSize: 8, letterSpacing: 0.6, marginBottom: 4 }, movementMetricValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 13 }, movementMetricValueNegative: { color: C.red, fontFamily: SERIF, fontSize: 13 }, movementMetricDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: C.line, marginHorizontal: 7 }, movementList: { marginTop: 16 }, movementRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, movementIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, movementIconIncome: { backgroundColor: 'rgba(233,200,119,0.1)' }, movementIconExpense: { backgroundColor: 'rgba(240,139,136,0.1)' },
  settingsHero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 15, marginBottom: 8 }, settingsHeroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(233,200,119,0.12)', alignItems: 'center', justifyContent: 'center' }, settingsHeroTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 20 }, settingsHeroCopy: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 10, marginTop: 4 }, settingsCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 14 }, primaryButton: { minHeight: 48, borderRadius: 13, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, primaryButtonText: { color: C.void, fontFamily: SANS, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }, buttonDisabled: { opacity: 0.38 }, settingsActionRow: { flexDirection: 'row', gap: 9, marginTop: 12 }, settingsAction: { flex: 1, minHeight: 76, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, gap: 7 }, settingsActionText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  empty: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, emptyIcon: { width: 50, height: 50, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13, textAlign: 'center' }, emptyCopy: { maxWidth: 280, color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  fab: { position: 'absolute', right: 31, bottom: 25, width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, workspaceFab: { position: 'absolute', right: 32, width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, workspaceFabStacked: { bottom: 81 }, workspaceFabSolo: { bottom: 25 },
}));
