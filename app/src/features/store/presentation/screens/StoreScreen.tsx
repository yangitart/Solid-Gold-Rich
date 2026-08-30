import React from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeIn, FadeOut, SlideInLeft, useReducedMotion } from 'react-native-reanimated';
import { useFinance } from '@/features/app-state/presentation/components/AppStateContext';
import type { PaymentMethod, StoreCategory, StoreClient, StoreDefaultOperation, StoreEmployee, StorePayFrequency, StorePayMode, StoreProduct, StoreProductType, StoreProvider, StoreSale, StoreSaleItem, StoreStockMovementType } from '@/features/store/domain/entities/Store';
import { captureCurrencySnapshot, currencyRate } from '@/shared/domain/finance/currency';
import { accountBalance, periodBounds, previousPeriodBounds } from '@/features/finance/domain/services/financeDomain';
import { availableStock, changeStoreCurrency, completeSale as completeStoreSale, filterStoreProducts, filterStoreSales, productStock, storeReportData, storeStatistics, validateSale, voidSale as voidStoreSale, withStoreBalance, type StoreSalePeriod, type StoreStockFilter } from '@/features/store/domain/services/storeDomain';
import type { AppStateRepository } from '@/features/app-state/application/ports/AppStateRepository';
import type { BackupRepository } from '@/features/backup/application/ports/BackupRepository';
import type { StoreBackup } from '@/features/backup/application/ports/BackupTypes';
import type { ImageStorage } from '@/features/store/application/ports/ImageStorage';
import type { ReportExportLabels, ReportRepository, StoreReportRange } from '@/features/store/application/ports/ReportRepository';
import type { FileService } from '@/shared/application/ports/FileService';
import { ConfirmDialog, FormActions, FormField, ResponsiveSheet, SearchableSelect, SegmentedControl, type SelectOption } from '@/shared/ui/FormKit';
import StoreProductForm, { PRODUCT_ICON_OPTIONS, type ProductFormDraft, type ProductFormTextField } from '../components/StoreProductForm';
import DateSelect from '@/shared/ui/DateSelect';
import { C, SANS, SERIF, createThemeStyles } from '@/shared/theme/luxury';

type StoreView = 'inventory' | 'archived' | 'sales' | 'employees' | 'clients' | 'providers' | 'services' | 'reports' | 'movements' | 'statistics' | 'settings';
type DirectoryKind = 'employees' | 'clients' | 'providers';
type StoreReportKind = 'export' | 'topProductsServices' | 'topClients';
type StockFilter = StoreStockFilter;
type StockAction = 'entry' | 'exit' | 'adjustment';
type SalePeriod = StoreSalePeriod;
type ReportRangeMode = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
type StoreStatsRange = 'today' | 'week' | 'month' | 'year';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const numeric = (value: string) => Number(value.trim().replace(',', '.'));
const normalizedSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
const COMMON_CURRENCIES = ['USD', 'EUR', 'CUP', 'MXN', 'CAD', 'GBP', 'BRL', 'ARS', 'CLP', 'COP', 'JPY', 'CHF'];
const UNIT_OPTIONS = ['unit', 'piece', 'kg', 'g', 'liter', 'hour', 'box'] as const;

function money(value: number, currency: string) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function localDay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoAtNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();
}

function validReportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function defaultDraft(type: StoreProductType, categoryId: string): ProductFormDraft {
  return { key: '', name: '', type, unit: 'unit', unitAbbreviation: '', categoryId, providerId: '', purchasePrice: '', salePrice: '', additionalSalePrices: [], picture: undefined, icon: type === 'service' ? 'construct-outline' : 'cube-outline', stock: '', reservedQuantity: '0', stockMinimum: '0', expirationDate: '', additionalInfo: '' };
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

export default function StoreScreen({ backupRepository, fileService, imageStorage, appStateRepository, reportRepository }: { backupRepository: BackupRepository; fileService: FileService; imageStorage: ImageStorage; appStateRepository: AppStateRepository; reportRepository: ReportRepository }) {
  const { t } = useTranslation();
  const finance = useFinance();
  const { state } = finance;
  const store = state.store;
  const currency = store.currency || state.settings.preferredCurrency || 'USD';
  const reduceMotion = useReducedMotion();
  const compactStoreStats = useWindowDimensions().width < 360;
  const [view, setView] = React.useState<StoreView>('inventory');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [exitPromptOpen, setExitPromptOpen] = React.useState(false);
  const [productQuery, setProductQuery] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState<StockFilter>('');
  const [addOpen, setAddOpen] = React.useState(false);
  const [productOpen, setProductOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<StoreProduct | null>(null);
  const [productDraft, setProductDraft] = React.useState<ProductFormDraft>(() => defaultDraft('product', 'general'));
  const [productMoreOpen, setProductMoreOpen] = React.useState(false);
  const [customUnitOpen, setCustomUnitOpen] = React.useState(false);
  const [productErrors, setProductErrors] = React.useState<Record<string, string>>({});
  const [purchaseAccountId, setPurchaseAccountId] = React.useState('store-business');
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState('');
  const [categoryIcon, setCategoryIcon] = React.useState<IconName>('pricetag-outline');
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
  const [salePeriod, setSalePeriod] = React.useState<SalePeriod>('today');
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
  const [directoryOperations, setDirectoryOperations] = React.useState<StoreDefaultOperation[]>([]);
  const [directoryActive, setDirectoryActive] = React.useState(true);
  const [directoryError, setDirectoryError] = React.useState('');
  const [storeCurrency, setStoreCurrency] = React.useState(currency);
  const [movementQuery, setMovementQuery] = React.useState('');
  const [movementType, setMovementType] = React.useState<'all' | 'income' | 'expense'>('all');
  const [reportKind, setReportKind] = React.useState<StoreReportKind | null>(null);
  const [reportRangeMode, setReportRangeMode] = React.useState<ReportRangeMode>('today');
  const [storeStatsRange, setStoreStatsRange] = React.useState<StoreStatsRange>('today');
  const [reportStartDate, setReportStartDate] = React.useState(() => isoAtNoon(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [reportEndDate, setReportEndDate] = React.useState(() => isoAtNoon(new Date()));
  const [fundingAccountId, setFundingAccountId] = React.useState('none');
  const [fundingAmount, setFundingAmount] = React.useState('');
  const [fundingNote, setFundingNote] = React.useState('');
  const [fundingError, setFundingError] = React.useState('');
  const [backupBusy, setBackupBusy] = React.useState(false);
  const [importBusy, setImportBusy] = React.useState(false);
  const [pendingStoreBackup, setPendingStoreBackup] = React.useState<StoreBackup | null>(null);

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
  const availableFor = React.useCallback((product: StoreProduct) => availableStock(state, product), [state]);
  const selectedSale = React.useMemo(() => store.sales.find((sale) => sale.id === selectedSaleId) ?? null, [selectedSaleId, store.sales]);
  const filtersActive = Boolean(categoryFilter || stockFilter);
  const [today] = React.useState(() => localDay(new Date()));
  const [statsReference] = React.useState(() => new Date());
  const storeStatsBounds = React.useMemo(() => {
    const bounds = periodBounds(storeStatsRange, statsReference, state.settings.firstDayOfWeek);
    return { start: bounds.start, end: statsReference };
  }, [state.settings.firstDayOfWeek, statsReference, storeStatsRange]);
  const storeStatsData = React.useMemo(() => storeStatistics(state, storeStatsBounds), [state, storeStatsBounds]);
  const storeStatsPreviousBounds = React.useMemo(() => {
    const fullCurrentBounds = periodBounds(storeStatsRange, statsReference, state.settings.firstDayOfWeek);
    const previous = previousPeriodBounds(storeStatsRange, fullCurrentBounds);
    const elapsed = statsReference.getTime() - fullCurrentBounds.start.getTime();
    return { start: previous.start, end: new Date(Math.min(previous.end.getTime(), previous.start.getTime() + elapsed)) };
  }, [state.settings.firstDayOfWeek, statsReference, storeStatsRange]);
  const storePreviousStatsData = React.useMemo(() => storeStatistics(state, storeStatsPreviousBounds), [state, storeStatsPreviousBounds]);
  const storeStatsSalesChange = storePreviousStatsData.salesRevenue > 0 ? (storeStatsData.salesRevenue - storePreviousStatsData.salesRevenue) / storePreviousStatsData.salesRevenue * 100 : null;
  const storeStatsNetChange = storePreviousStatsData.netFlow !== 0 ? (storeStatsData.netFlow - storePreviousStatsData.netFlow) / Math.abs(storePreviousStatsData.netFlow) * 100 : null;
  const storeStatsRangeLabel = React.useMemo(() => {
    const end = new Date(storeStatsBounds.end.getTime() - 1);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...(storeStatsBounds.start.getFullYear() !== end.getFullYear() ? { year: 'numeric' } : {}) };
    return `${storeStatsBounds.start.toLocaleDateString(state.settings.language, options)} – ${end.toLocaleDateString(state.settings.language, options)}`;
  }, [state.settings.language, storeStatsBounds]);
  const storeStatsFlowBuckets = React.useMemo(() => {
    const language = state.settings.language;
    const buckets: { key: string; label: string; sales: number; outflow: number }[] = [];
    const pushBucket = (key: string, label: string, start: Date, end: Date) => {
      const includes = (date: string) => { const value = new Date(date).getTime(); return value >= start.getTime() && value < end.getTime(); };
      buckets.push({
        key,
        label,
        sales: storeStatsData.sales.filter((sale) => includes(sale.date)).reduce((sum, sale) => sum + sale.total, 0),
        outflow: storeStatsData.movements.filter((movement) => movement.amount < 0 && includes(movement.date)).reduce((sum, movement) => sum - movement.amount, 0),
      });
    };
    if (storeStatsRange === 'today') {
      const finalHour = Math.floor(statsReference.getHours() / 6) * 6;
      for (let hour = 0; hour <= finalHour; hour += 6) {
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour + 6);
        pushBucket(String(hour), String(hour).padStart(2, '0'), start, end);
      }
    } else if (storeStatsRange === 'year') {
      const year = storeStatsBounds.start.getFullYear();
      const finalMonth = storeStatsBounds.end.getFullYear() === year ? storeStatsBounds.end.getMonth() : 11;
      for (let month = 0; month <= finalMonth; month += 1) {
        pushBucket(String(month), new Date(year, month, 1).toLocaleDateString(language, { month: 'narrow' }), new Date(year, month, 1), new Date(year, month + 1, 1));
      }
    } else {
      const step = storeStatsRange === 'week' ? 1 : 7;
      const cursor = new Date(storeStatsBounds.start);
      while (cursor < storeStatsBounds.end) {
        const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + step);
        const boundedEnd = end > storeStatsBounds.end ? storeStatsBounds.end : end;
        const lastIncluded = new Date(boundedEnd.getTime() - 1);
        const label = storeStatsRange === 'week' ? start.toLocaleDateString(language, { weekday: 'narrow' }) : `${start.getDate()}–${lastIncluded.getDate()}`;
        pushBucket(start.toISOString(), label, start, boundedEnd);
        cursor.setDate(cursor.getDate() + step);
      }
    }
    return buckets;
  }, [state.settings.language, statsReference, storeStatsBounds, storeStatsData.movements, storeStatsData.sales, storeStatsRange, today]);
  const storeStatsFlowMax = Math.max(1, ...storeStatsFlowBuckets.flatMap((bucket) => [bucket.sales, bucket.outflow]));
  const storeStatsTopMax = Math.max(1, ...storeStatsData.topProducts.map((product) => product.total));

  React.useEffect(() => setDirectoryQuery(''), [view]);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitPromptOpen) {
        setExitPromptOpen(false);
        return true;
      }
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
      setExitPromptOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [addOpen, categoryManagerOpen, directoryOpen, drawerOpen, exitPromptOpen, filterOpen, productOpen, reportKind, saleOpen, selectedSaleId, stockProduct, t, view]);

  const categoryOptions = React.useMemo<SelectOption[]>(() => store.categories.map((item) => ({ value: item.id, label: categoryNameFor(item.id), icon: (item.icon as IconName | undefined) ?? (item.builtIn ? 'grid-outline' : 'pricetag-outline') })), [categoryNameFor, store.categories]);
  const providerOptions = React.useMemo<SelectOption[]>(() => [{ value: '', label: t('finance.store.noneSelected'), icon: 'remove-circle-outline' }, ...store.providers.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name, icon: 'business-outline' as const }))], [store.providers, t]);
  const productOperationOptions = React.useMemo<SelectOption[]>(() => store.products.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name, description: item.type === 'service' ? t('finance.store.service') : `${item.unitAbbreviation || item.unit} · ${money(item.salePrice, currency)}`, icon: item.type === 'service' ? 'construct-outline' as const : 'cube-outline' as const })), [currency, store.products, t]);
  const directoryOperationProductOptions = React.useMemo(() => productOperationOptions.filter((item) => directoryKind === 'clients' || store.products.find((product) => product.id === item.value)?.type === 'product'), [directoryKind, productOperationOptions, store.products]);
  const accountOptions = React.useMemo<SelectOption[]>(() => [
    { value: 'none', label: t('finance.storePurchase.none'), icon: 'remove-circle-outline' },
    { value: 'store-business', label: t('finance.storeAccount.name'), description: money(store.businessAccount.balance, currency), icon: 'storefront-outline' },
    ...state.accounts.filter((item) => !item.archived && item.type !== 'debt').map((item) => ({ value: item.id, label: item.name, description: money(accountBalance(state, item.id), item.currency), icon: 'wallet-outline' as const })),
  ], [currency, state, store.businessAccount.balance, t]);
  const productUnitOptions = React.useMemo<SelectOption[]>(() => [
    ...UNIT_OPTIONS.map((unit) => ({ value: unit, label: t(`finance.unitOptions.${unit}`), icon: 'cube-outline' as const })),
    { value: '__custom__', label: t('finance.storeUnits.custom'), icon: 'create-outline' as const },
  ], [t]);
  const clientOptions = React.useMemo<SelectOption[]>(() => [{ value: '', label: t('finance.store.noneSelected'), icon: 'remove-circle-outline' }, ...store.clients.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name, icon: 'person-outline' as const }))], [store.clients, t]);
  const employeeOptions = React.useMemo<SelectOption[]>(() => [{ value: '', label: t('finance.store.noneSelected'), icon: 'remove-circle-outline' }, ...store.employees.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name, icon: 'people-outline' as const }))], [store.employees, t]);
  const selectedFundingAccount = React.useMemo(() => accountOptions.find((item) => item.value === fundingAccountId), [accountOptions, fundingAccountId]);
  const saleItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const visibleMovements = React.useMemo(() => {
    const query = normalizedSearch(movementQuery);
    return store.cashMovements.slice().sort((left, right) => right.date.localeCompare(left.date)).filter((movement) => normalizedSearch(`${movement.note} ${movement.type}`).includes(query)).filter((movement) => movementType === 'all' || (movementType === 'income' ? movement.amount >= 0 : movement.amount < 0));
  }, [movementQuery, movementType, store.cashMovements]);
  const currencyOptions = React.useMemo(() => Array.from(new Set([currency, state.settings.preferredCurrency, ...state.accounts.map((item) => item.currency), ...COMMON_CURRENCIES])).sort().map((item) => ({ value: item, label: item })), [currency, state.accounts, state.settings.preferredCurrency]);
  const visibleDirectoryItems = React.useMemo<(StoreEmployee | StoreClient | StoreProvider)[]>(() => {
    const all: (StoreEmployee | StoreClient | StoreProvider)[] = view === 'clients' ? store.clients : view === 'employees' ? store.employees : view === 'providers' ? store.providers : [];
    const query = normalizedSearch(directoryQuery);
    return all.filter((item) => normalizedSearch(`${item.name} ${item.phone ?? ''} ${'role' in item ? item.role ?? '' : ''} ${'email' in item ? item.email ?? '' : ''} ${'note' in item ? item.note ?? '' : ''}`).includes(query));
  }, [directoryQuery, store.clients, store.employees, store.providers, view]);
  const visibleProducts = React.useMemo(() => filterStoreProducts(state, { type: view === 'services' ? 'service' : 'product', query: productQuery, categoryId: categoryFilter, status: 'active', stock: view === 'inventory' ? stockFilter : '', today }), [categoryFilter, productQuery, state, stockFilter, today, view]);
  const visibleArchivedProducts = React.useMemo(() => {
    const query = normalizedSearch(productQuery);
    return store.products.filter((product) => !product.active && (!query || normalizedSearch(`${product.name} ${product.key} ${product.sku ?? ''} ${categoryNameFor(product.categoryId)}`).includes(query))).sort((left, right) => left.name.localeCompare(right.name));
  }, [categoryNameFor, productQuery, store.products]);
  const normalizedSaleQuery = normalizedSearch(saleQuery);
  const saleProducts = React.useMemo(() => store.products.filter((product) => product.active && (!normalizedSaleQuery || normalizedSearch(`${product.name} ${product.key} ${product.sku ?? ''} ${categoryNameFor(product.categoryId)}`).includes(normalizedSaleQuery))), [categoryNameFor, normalizedSaleQuery, store.products]);
  const saleTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const visibleSales = React.useMemo(() => filterStoreSales(state, { query: saleHistoryQuery, period: salePeriod, firstDayOfWeek: state.settings.firstDayOfWeek, today }), [saleHistoryQuery, salePeriod, state, today]);
  const switchView = (next: StoreView) => {
    setView(next);
    setDrawerOpen(false);
    setReportKind(null);
    setProductQuery('');
    setSaleHistoryQuery('');
    setSalePeriod('today');
    setDirectoryQuery('');
    setMovementQuery('');
    setMovementType('all');
    setCategoryFilter('');
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
      key: product.key, name: product.name, type: product.type, unit: product.unit, unitAbbreviation: product.unitAbbreviation ?? '', categoryId: product.categoryId, providerId: product.providerId ?? '',
      purchasePrice: product.purchasePrice ? String(product.purchasePrice) : '', salePrice: String(product.salePrice),
      additionalSalePrices: product.additionalSalePrices.map(String), picture: product.picture, icon: (product.icon as IconName | undefined) ?? (product.type === 'service' ? 'construct-outline' : 'cube-outline'), stock: '', reservedQuantity: String(product.reservedQuantity),
      stockMinimum: String(product.stockMinimum), expirationDate: product.expirationDate ?? '', additionalInfo: product.additionalInfo ?? '',
    } : defaultDraft(view === 'services' ? 'service' : 'product', store.categories[0]?.id ?? 'general'));
    setProductOpen(true);
  };

  const choosePicture = async () => {
    const result = await imageStorage.pick();
    if (!result) return;
    try {
      const extension = result.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const uri = await imageStorage.copyToProductImages(result.uri, extension);
      setProductDraft((current) => ({ ...current, picture: uri }));
    } catch {
      setProductErrors((current) => ({ ...current, picture: t('finance.store.errors.picture') }));
    }
  };

  const productValidation = () => {
    const errors: Record<string, string> = {};
    const key = productDraft.key.trim();
    if (productDraft.type === 'product' && !key) errors.key = t('finance.store.errors.key');
    else if (key && store.products.some((item) => item.id !== editingProduct?.id && item.key.toLocaleLowerCase() === key.toLocaleLowerCase())) errors.key = t('finance.store.errors.duplicateKey');
    if (!productDraft.name.trim()) errors.name = t('finance.store.errors.name');
    if (customUnitOpen) {
      if (!productDraft.unit.trim()) errors.unitName = t('finance.storeUnits.fullNameRequired');
      const abbreviation = productDraft.unitAbbreviation.trim();
      if (!abbreviation) errors.unitAbbreviation = t('finance.storeUnits.abbreviationRequired');
      else if (Array.from(abbreviation).length > 4) errors.unitAbbreviation = t('finance.storeUnits.abbreviationTooLong');
    } else if (!productDraft.unit.trim()) errors.unit = t('finance.storeUnits.required');
    const salePrice = numeric(productDraft.salePrice);
    if (!productDraft.salePrice.trim() || !Number.isFinite(salePrice) || salePrice < 0) errors.salePrice = t('finance.store.errors.price');
    const numberFields = [productDraft.purchasePrice || '0', productDraft.stock || '0', productDraft.reservedQuantity || '0', productDraft.stockMinimum || '0', ...productDraft.additionalSalePrices.filter((value) => value.trim())];
    if (numberFields.some((value) => !Number.isFinite(numeric(value)) || numeric(value) < 0)) errors.numbers = t('finance.store.errors.stock');
    const available = editingProduct ? stockFor(editingProduct.id) : numeric(productDraft.stock || '0');
    if (numeric(productDraft.reservedQuantity || '0') > available) errors.reserve = t('finance.store.errors.reserve');
    if (!store.categories.some((item) => item.id === productDraft.categoryId)) errors.category = t('finance.store.errors.category');
    return errors;
  };

  const updateProductText = (field: ProductFormTextField, value: string, clearErrors: string[] = [field]) => {
    setProductDraft((current) => ({ ...current, [field]: value }));
    if (clearErrors.length) setProductErrors((current) => {
      const next = { ...current };
      clearErrors.forEach((key) => { next[key] = ''; });
      return next;
    });
  };

  const handleProductUnitChange = (value: string) => {
    setCustomUnitOpen(value === '__custom__');
    setProductDraft((current) => ({ ...current, unit: value === '__custom__' ? '' : value, unitAbbreviation: '' }));
    setProductErrors((current) => ({ ...current, unit: '', unitName: '', unitAbbreviation: '' }));
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
    const productKey = productDraft.type === 'service' ? editingProduct?.key || id : productDraft.key.trim();
    const product: StoreProduct = {
      id,
      key: productKey,
      name: productDraft.name.trim(),
      type: productDraft.type,
      unit: productDraft.unit.trim() || 'unit',
      unitAbbreviation: customUnitOpen ? productDraft.unitAbbreviation.trim() : undefined,
      categoryId: productDraft.categoryId,
      providerId: productDraft.providerId || undefined,
      sku: editingProduct?.sku ?? productKey,
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

  const openCategoryManager = (name = '') => {
    setEditingCategoryId(null);
    setCategoryName(name);
    setCategoryIcon('pricetag-outline');
    setCategoryError('');
    setCategoryManagerOpen(true);
  };

  const addCategoryFromSearch = (value: string) => {
    const name = value.trim();
    if (!name) return;
    const existing = store.categories.find((item) => normalizedSearch(categoryNameFor(item.id)) === normalizedSearch(name));
    if (existing) {
      setProductDraft((current) => ({ ...current, categoryId: existing.id }));
      return;
    }
    const categoryId = uid('category');
    finance.updateState((current) => ({ ...current, store: { ...current.store, categories: [...current.store.categories, { id: categoryId, name, icon: 'pricetag-outline' }] } }));
    setProductDraft((current) => ({ ...current, categoryId }));
    setProductErrors((current) => ({ ...current, category: '' }));
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
          ? current.store.categories.map((item) => item.id === editingCategoryId ? { ...item, name, icon: categoryIcon } : item)
          : [...current.store.categories, { id: categoryId, name, icon: categoryIcon }],
      },
    }));
    if (!editingCategoryId) setProductDraft((current) => ({ ...current, categoryId }));
    setCategoryName(''); setCategoryIcon('pricetag-outline'); setCategoryError(''); setEditingCategoryId(null); setCategoryManagerOpen(false);
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
    if (!Number.isFinite(value) || value < 0 || (stockAction !== 'adjustment' && value === 0)) { setStockError(t('finance.store.errors.stock')); return; }
    const currentStock = stockFor(stockProduct.id);
    const delta = stockAction === 'entry' ? value : stockAction === 'exit' ? -value : value - currentStock;
    if (currentStock + delta < stockProduct.reservedQuantity) { setStockError(t('finance.store.errors.reserve')); return; }
    finance.updateState((current) => ({ ...current, store: { ...current.store, stockMovements: [...current.store.stockMovements, { id: uid('store-stock'), productId: stockProduct.id, type: stockAction as StoreStockMovementType, quantity: delta, date: new Date().toISOString(), note: stockNote.trim() || t(`finance.store.stockAction.${stockAction}`) }] } }));
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

  const openDirectory = (kind: DirectoryKind, item?: StoreEmployee | StoreClient | StoreProvider) => {
    setDirectoryKind(kind); setDirectoryId(item?.id ?? null); setDirectoryName(item?.name ?? ''); setDirectoryPhone(item?.phone ?? '');
    setDirectorySalary(item && 'salary' in item ? String(item.salary || '') : ''); setDirectoryPayFrequency(item && 'payFrequency' in item ? item.payFrequency : 'monthly'); setDirectoryPayMode(item && 'payMode' in item ? item.payMode : 'manual'); setDirectoryNextPayDate(item && 'nextPayDate' in item ? item.nextPayDate ?? '' : '');
    setDirectoryRole(item && 'role' in item ? item.role ?? '' : ''); setDirectoryEmail(item && 'email' in item ? item.email ?? '' : '');
    setDirectoryNote(item && 'note' in item ? item.note ?? '' : ''); setDirectoryOperations(item && 'defaultOperations' in item ? (item.defaultOperations ?? []).map((operation) => ({ ...operation })) : []); setDirectoryActive(item?.active ?? true); setDirectoryError(''); setDirectoryOpen(true);
  };

  const saveDirectory = () => {
    const name = directoryName.trim();
    if (!name) { setDirectoryError(t('finance.store.errors.name')); return; }
    if ((directoryKind === 'clients' || directoryKind === 'providers') && directoryEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directoryEmail.trim())) { setDirectoryError(t('finance.workspace.invalidEmail')); return; }
    if (directoryKind === 'employees' && directorySalary.trim() && (!Number.isFinite(numeric(directorySalary)) || numeric(directorySalary) < 0)) { setDirectoryError(t('finance.workspace.invalidSalary')); return; }
    const now = new Date().toISOString();
    finance.updateState((current) => {
      if (directoryKind === 'employees') {
        const old = current.store.employees.find((item) => item.id === directoryId);
        const salary = numeric(directorySalary);
        const item: StoreEmployee = { id: directoryId ?? uid('employee'), name, role: directoryRole.trim() || undefined, phone: directoryPhone.trim() || undefined, salary: Number.isFinite(salary) && salary > 0 ? salary : 0, payFrequency: directoryPayFrequency, payMode: directoryPayMode, nextPayDate: directoryNextPayDate || now, lastPaidDate: old?.lastPaidDate, active: directoryActive, createdAt: old?.createdAt ?? now };
        return { ...current, store: { ...current.store, employees: old ? current.store.employees.map((entry) => entry.id === item.id ? item : entry) : [item, ...current.store.employees] } };
      }
      if (directoryKind === 'providers') {
        const old = current.store.providers.find((item) => item.id === directoryId);
        const item: StoreProvider = { id: directoryId ?? uid('provider'), name, phone: directoryPhone.trim() || undefined, email: directoryEmail.trim() || undefined, note: directoryNote.trim() || undefined, defaultOperations: directoryOperations.filter((operation) => operation.productId && operation.quantity > 0), active: directoryActive, createdAt: old?.createdAt ?? now };
        return { ...current, store: { ...current.store, providers: old ? current.store.providers.map((entry) => entry.id === item.id ? item : entry) : [item, ...current.store.providers] } };
      }
      const old = current.store.clients.find((item) => item.id === directoryId);
      const item: StoreClient = { id: directoryId ?? uid('client'), name, phone: directoryPhone.trim() || undefined, email: directoryEmail.trim() || undefined, note: directoryNote.trim() || undefined, defaultOperations: directoryOperations.filter((operation) => operation.productId && operation.quantity > 0), active: directoryActive, createdAt: old?.createdAt ?? now };
      return { ...current, store: { ...current.store, clients: old ? current.store.clients.map((entry) => entry.id === item.id ? item : entry) : [item, ...current.store.clients] } };
    });
    setDirectoryOpen(false);
  };

  const executeDefaultOperations = (kind: DirectoryKind, id: string) => {
    const directory = kind === 'providers' ? store.providers.find((item) => item.id === id) : store.clients.find((item) => item.id === id);
    const operations = directory?.defaultOperations ?? [];
    if (!directory || !operations.length) return;
    const now = new Date().toISOString();
    if (kind === 'providers') {
      const provider = directory as StoreProvider;
      finance.updateState((current) => ({
        ...current,
        store: {
          ...current.store,
          stockMovements: [...current.store.stockMovements, ...operations.filter((operation) => current.store.products.some((product) => product.id === operation.productId && product.type === 'product')).map((operation) => ({ id: uid('store-stock'), productId: operation.productId, type: 'entry' as const, quantity: operation.quantity, date: now, note: `${t('finance.store.defaultOperations')} · ${provider.name}` }))],
        },
      }));
      return;
    }
    const client = directory as StoreClient;
    const productsById = new Map(store.products.map((product) => [product.id, product]));
    const items = operations.map((operation) => {
      const product = productsById.get(operation.productId);
      return product ? { productId: product.id, name: product.name, type: product.type, quantity: operation.quantity, unitPrice: product.salePrice, total: product.salePrice * operation.quantity } : null;
    }).filter((item): item is StoreSaleItem => Boolean(item));
    if (!items.length) return;
    const sale: StoreSale = { id: uid('store-sale'), date: now, items, total: items.reduce((sum, item) => sum + item.total, 0), status: 'completed', note: t('finance.store.defaultOperations'), clientId: client.id };
    const result = completeStoreSale(state, sale, uid, t('finance.store.saleStock'), t('finance.store.cashMovement.sale'));
    if (result.error) { Alert.alert(t(`finance.store.errors.${result.error}`)); return; }
    finance.updateState((current) => completeStoreSale(current, sale, uid, t('finance.store.saleStock'), t('finance.store.cashMovement.sale')).state);
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

  const openSettings = () => {
    setStoreCurrency(currency);
    switchView('settings');
  };

  const requestStoreCurrencyChange = (nextCurrency: string) => {
    const target = nextCurrency.trim().toUpperCase();
    if (!target || target === currency) { setStoreCurrency(currency); return; }
    const rates = state.settings.exchangeRates ?? { USD: 1 };
    if (currencyRate(currency, target, rates) === undefined) {
      setStoreCurrency(currency);
      Alert.alert(t('finance.storeCurrency.changeTitle'), t('finance.releaseErrors.missingRate'));
      return;
    }
    setStoreCurrency(target);
    Alert.alert(t('finance.storeCurrency.changeTitle'), t('finance.storeCurrency.confirmCopy', { from: currency, to: target }), [
      { text: t('finance.cancel'), style: 'cancel', onPress: () => setStoreCurrency(currency) },
      { text: t('finance.storeCurrency.confirm'), onPress: () => finance.updateState((current) => changeStoreCurrency(current, target, current.settings.exchangeRates ?? { USD: 1 }).state) },
    ], { cancelable: false });
  };

  const reportLanguage = state.settings.language ?? 'en';
  const reportRangeError = reportRangeMode === 'custom' && localDay(validReportDate(reportEndDate)).getTime() < localDay(validReportDate(reportStartDate)).getTime()
    ? t('finance.workspace.reportRangeInvalid')
    : '';
  const reportRange = React.useMemo<StoreReportRange | undefined>(() => {
    if (reportRangeMode === 'all') return { start: '', end: '', label: t('finance.workspace.reportRangeAll') };
    if (reportRangeMode === 'today' || reportRangeMode === 'week' || reportRangeMode === 'month' || reportRangeMode === 'year') {
      const bounds = periodBounds(reportRangeMode, today, state.settings.firstDayOfWeek);
      const start = localDay(bounds.start);
      const end = localDay(today);
      const label = reportRangeMode === 'today' ? t('finance.today') : reportRangeMode === 'week' ? t('finance.thisWeek') : reportRangeMode === 'month' ? t('finance.thisMonth') : t('finance.yearToDate');
      const dates = start.getTime() === end.getTime() ? start.toLocaleDateString(reportLanguage) : `${start.toLocaleDateString(reportLanguage)} – ${end.toLocaleDateString(reportLanguage)}`;
      return { start: isoAtNoon(start), end: isoAtNoon(end), label: `${label}: ${dates}` };
    }
    if (reportRangeError) return undefined;
    const start = validReportDate(reportStartDate);
    const end = validReportDate(reportEndDate);
    return { start: isoAtNoon(start), end: isoAtNoon(end), label: `${start.toLocaleDateString(reportLanguage)} – ${end.toLocaleDateString(reportLanguage)}` };
  }, [reportEndDate, reportLanguage, reportRangeError, reportRangeMode, reportStartDate, state.settings.firstDayOfWeek, t, today]);

  const reportState = React.useMemo(() => reportRepository.filterState(state, reportRange), [reportRange, reportRepository, state]);
  const reportData = React.useMemo(() => storeReportData(reportState), [reportState]);
  const reportExportLabels = React.useMemo<ReportExportLabels>(() => ({
    title: t('finance.store.reports'), generated: t('finance.date'), period: t('finance.workspace.reportPeriod'), summary: t('finance.store.reports'), sales: t('finance.store.sales'),
    topProducts: t('finance.store.reportTopProductsServices'), topClients: t('finance.store.reportTopClients'),
    moneyMovements: t('finance.store.businessMovements'), inventory: t('finance.store.inventory'), employees: t('finance.store.employees'), clients: t('finance.store.clients'),
    date: t('finance.date'), name: t('finance.name'), type: t('finance.store.type'), quantity: t('finance.store.units'), amount: t('finance.store.total'),
    balance: t('finance.storeBackup.businessBalance'), role: t('finance.store.employeeRole'), contact: t('finance.phone'), status: t('finance.storeFilters.status'), providers: t('finance.store.providers'),
    active: t('finance.storeFilters.active'), inactive: t('finance.storeFilters.inactive'), transactions: t('finance.store.reportTransactions'), salePrice: t('finance.store.salePrice'),
    available: t('finance.store.currentStock'), stock: t('finance.store.stock'),
  }), [t]);

  const exportReport = async (format: 'pdf' | 'xlsx') => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const fileName = `solid-gold-rich-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const content = format === 'pdf' ? reportRepository.createPdf(state, currency, reportLanguage, reportExportLabels, reportRange) : reportRepository.createXlsx(state, currency, reportLanguage, reportExportLabels, reportRange);
      const uri = await fileService.writeBytes(fileName, content);
      await fileService.share(uri, mimeType, format === 'pdf' ? t('finance.store.reportExportPdf') : t('finance.store.reportExportExcel'));
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
      const backup = await backupRepository.createStoreJson(store);
      const uri = await fileService.writeText(`solid-gold-rich-store-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
      await fileService.share(uri, 'application/json', t('finance.storeBackup.exportStore'));
    } catch {
      Alert.alert(t('finance.storeBackup.backupFailed'), t('finance.storeBackup.backupFailedCopy'));
    } finally {
      setBackupBusy(false);
    }
  };

  const importStore = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setImportBusy(true);
    try {
      const result = await fileService.pick(['application/json', 'text/json', 'text/plain', 'application/octet-stream']);
      if (!result) return;
      setPendingStoreBackup(backupRepository.parseStoreJson(await fileService.readText(result.uri)));
    } catch {
      Alert.alert(t('finance.storeBackup.backupFailed'), t('finance.storeBackup.backupInvalid'));
    } finally {
      setBackupBusy(false);
      setImportBusy(false);
    }
  };

  const confirmStoreImport = async () => {
    const backup = pendingStoreBackup;
    if (!backup) return;
    setPendingStoreBackup(null);
    setBackupBusy(true);
    setImportBusy(true);
    try {
      const restoredStore = backupRepository.isolateStore(await backupRepository.restoreStore(backup));
      finance.updateState((current) => ({ ...current, store: appStateRepository.normalize({ ...current, store: restoredStore }).store }));
      setSelectedSaleId(null);
      switchView('inventory');
      Alert.alert(t('finance.storeBackup.backupImported'), t('finance.storeBackup.backupImportedCopy'));
    } catch {
      Alert.alert(t('finance.storeBackup.backupFailed'), t('finance.storeBackup.backupInvalid'));
    } finally {
      setBackupBusy(false);
      setImportBusy(false);
    }
  };

  const renderProduct = ({ item }: { item: StoreProduct }) => {
    const stock = stockFor(item.id); const available = availableFor(item); const low = item.type === 'product' && stock <= item.stockMinimum;
    const expired = Boolean(item.expirationDate && localDay(item.expirationDate) < today);
    return <View style={[styles.productRow, !item.active && styles.inactive]}><Pressable style={styles.productMain} onPress={() => openProduct(item)} accessibilityRole="button"><View style={styles.productIcon}><ProductPicture product={item} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta} numberOfLines={1}>{item.key} · {categoryNameFor(item.categoryId)} · {money(item.salePrice, currency)}</Text>{expired ? <Text style={styles.dangerMeta} numberOfLines={1}>{t('finance.storeFilters.expired')}</Text> : null}</View></Pressable>{item.type === 'product' ? <View style={styles.stockSide}><Text style={[styles.stockValue, low && styles.dangerMeta]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{available}</Text><Pressable style={styles.iconButton} onPress={() => { setStockProduct(item); setStockAction('entry'); setStockQuantity(''); setStockNote(''); setStockError(''); }} accessibilityRole="button" accessibilityLabel={t('finance.store.adjustStock')}><Ionicons name="swap-vertical-outline" size={18} color={C.gold} /></Pressable></View> : <Text style={styles.rowMeta} numberOfLines={1}>{t('finance.store.service')}</Text>}</View>;
  };

  const renderProducts = () => <View style={styles.flex}><View style={styles.toolbar}><View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={productQuery} onChangeText={setProductQuery} placeholder={t('finance.storeFilters.search')} placeholderTextColor={C.textSubtle} style={styles.searchInput} accessibilityLabel={t('finance.storeFilters.search')} /><Pressable style={[styles.filterButton, filtersActive && styles.filterButtonActive]} onPress={() => setFilterOpen(true)} accessibilityRole="button" accessibilityLabel={t('finance.storeFilters.filters')}><Ionicons name="options-outline" size={19} color={filtersActive ? C.void : C.gold} /></Pressable>{view === 'inventory' ? <Pressable style={styles.filterButton} onPress={() => { setFundingAccountId('none'); setFundingAmount(''); setFundingNote(''); setFundingError(''); setAddOpen(true); }} accessibilityRole="button" accessibilityLabel={t('finance.storeFunding.tab')}><Ionicons name="add-circle-outline" size={19} color={C.gold} /></Pressable> : null}</View></View><FlatList data={visibleProducts} keyExtractor={(item) => item.id} renderItem={renderProduct} contentContainerStyle={[styles.list, !visibleProducts.length && styles.listEmpty]} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Empty title={t('finance.store.noProducts')} copy={filtersActive || productQuery ? t('finance.storeFilters.noResults') : t('finance.store.noProductsCopy')} icon="cube-outline" />} /></View>;

  const renderArchivedProducts = () => <View style={styles.flex}><View style={styles.toolbar}><View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={productQuery} onChangeText={setProductQuery} placeholder={t('finance.storeFilters.search')} placeholderTextColor={C.textSubtle} style={styles.searchInput} accessibilityLabel={t('finance.storeFilters.search')} /></View></View><FlatList data={visibleArchivedProducts} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, !visibleArchivedProducts.length && styles.listEmpty]} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <View style={styles.productRow}><Pressable style={styles.productMain} onPress={() => openProduct(item)} accessibilityRole="button"><View style={styles.productIcon}><ProductPicture product={item} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta} numberOfLines={1}>{item.type === 'service' ? t('finance.store.service') : t('finance.store.product')} · {categoryNameFor(item.categoryId)}</Text></View></Pressable><Pressable style={styles.archiveRestoreButton} onPress={() => finance.updateState((current) => ({ ...current, store: { ...current.store, products: current.store.products.map((product) => product.id === item.id ? { ...product, active: true } : product) } }))} accessibilityRole="button" accessibilityLabel={t('finance.store.restoreProduct')}><Ionicons name="refresh-outline" size={16} color={C.void} /><Text style={styles.archiveRestoreText} numberOfLines={1}>{t('finance.store.restoreProduct')}</Text></Pressable></View>} ListEmptyComponent={<Empty title={t('finance.store.noArchivedProducts')} copy={productQuery ? t('finance.storeFilters.noResults') : t('finance.store.archivedProductsCopy')} icon="archive-outline" />} /></View>;

  const renderSales = () => <View style={styles.flex}><View style={styles.toolbar}><View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={saleHistoryQuery} onChangeText={setSaleHistoryQuery} placeholder={t('finance.store.searchSales')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /></View><SegmentedControl options={(['all', 'today', 'week', 'month'] as SalePeriod[]).map((item) => ({ value: item, label: t(`finance.store.salePeriod.${item}`) }))} value={salePeriod} onChange={(value) => setSalePeriod(value as SalePeriod)} /></View><FlatList data={visibleSales} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, !visibleSales.length && styles.listEmpty]} renderItem={({ item }) => <Pressable style={[styles.saleRow, item.status === 'void' && styles.inactive]} onPress={() => setSelectedSaleId(item.id)}><View style={[styles.saleIcon, item.status === 'void' && styles.saleIconVoided]}><Ionicons name={item.status === 'void' ? 'close-circle-outline' : 'receipt-outline'} size={20} color={item.status === 'void' ? C.textSubtle : C.gold} /></View><View style={styles.saleRowContent}><View style={styles.saleRowTop}><Text style={[styles.rowTitle, item.status === 'void' && styles.inactiveText]} numberOfLines={1}>{item.items.length} {t('finance.store.items')}</Text><Text style={[styles.saleStatusText, item.status === 'void' && styles.saleStatusVoided]}>{t(item.status === 'void' ? 'finance.store.voided' : 'finance.store.completed')}</Text></View><Text style={styles.saleMetaLine} numberOfLines={1}>{new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {store.clients.find((client) => client.id === item.clientId)?.name ?? t('finance.store.noneSelected')}</Text></View><View style={styles.saleAmountSide}><Text style={[styles.amount, item.status === 'void' && styles.inactiveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{money(item.total, currency)}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></View></Pressable>} ListEmptyComponent={<Empty title={t('finance.store.noSales')} copy={saleHistoryQuery || salePeriod !== 'all' ? t('finance.storeFilters.noResults') : t('finance.store.noSalesCopy')} icon="receipt-outline" />} /></View>;

  const renderDirectory = (kind: DirectoryKind) => {
    const all = kind === 'clients' ? store.clients : kind === 'providers' ? store.providers : store.employees;
    const items = visibleDirectoryItems;
    const directoryLabel = kind === 'clients' ? 'finance.store.client' : kind === 'providers' ? 'finance.store.provider' : 'finance.store.employee';
    const emptyTitle = kind === 'clients' ? 'finance.store.noClients' : kind === 'providers' ? 'finance.store.noProviders' : 'finance.store.noEmployees';
    const emptyCopy = kind === 'clients' ? 'finance.store.clientsCopy' : kind === 'providers' ? 'finance.store.providersCopy' : 'finance.store.employeesCopy';
    const directoryIcon = kind === 'clients' ? 'person-outline' : kind === 'providers' ? 'business-outline' : 'people-outline';
    return <View style={styles.flex}><View style={styles.toolbar}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={[styles.search, { flex: 1 }]}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={directoryQuery} onChangeText={setDirectoryQuery} placeholder={t('finance.store.directorySearch')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /></View><Pressable style={styles.addSmall} onPress={() => openDirectory(kind)} accessibilityLabel={`${t('finance.store.addDirectory')} ${t(directoryLabel)}`}><Ionicons name="add" size={20} color={C.gold} /></Pressable></View></View><FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, !items.length && styles.listEmpty]} renderItem={({ item }) => <View style={[styles.directoryRow, !item.active && styles.inactive]}><Pressable style={styles.directoryMain} onPress={() => openDirectory(kind, item)}><View style={styles.avatar}><Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{kind === 'employees' ? [('role' in item && item.role) || t('finance.store.employeeRoleEmpty'), 'salary' in item && item.salary > 0 ? `${money(item.salary, currency)} · ${t(`finance.payroll.frequency.${item.payFrequency}`)}` : t('finance.payroll.notConfigured')].join(' · ') : [item.phone, 'email' in item ? item.email : ''].filter(Boolean).join(' · ') || t('finance.store.clientContactEmpty')}</Text></View></Pressable>{(kind === 'providers' || kind === 'clients') && 'defaultOperations' in item && item.defaultOperations?.length ? <Pressable style={styles.operationButton} onPress={() => executeDefaultOperations(kind, item.id)}><Ionicons name="play-outline" size={15} color={C.void} /><Text style={styles.payButtonText}>{t('finance.store.executeOperations')}</Text></Pressable> : null}{kind === 'employees' && item.active && 'salary' in item && item.salary > 0 ? <Pressable style={styles.payButton} onPress={() => payEmployee(item.id)}><Ionicons name="cash-outline" size={15} color={C.void} /><Text style={styles.payButtonText}>{t('finance.payroll.pay')}</Text></Pressable> : null}<Ionicons name="chevron-forward" size={17} color={C.textSubtle} /></View>} ListEmptyComponent={<Empty title={t(emptyTitle)} copy={all.length ? t('finance.storeFilters.noResults') : t(emptyCopy)} icon={directoryIcon as IconName} />} /></View>;
  };

  const renderMovements = () => {
    return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.viewIntro}><View style={styles.viewIntroIcon}><Ionicons name="wallet-outline" size={22} color={C.gold} /></View><View style={styles.rowMain}><Text style={styles.viewIntroTitle}>{t('finance.store.businessMovements')}</Text></View></View>
      <View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={movementQuery} onChangeText={setMovementQuery} placeholder={t('finance.modules.searchActivity')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /></View>
      <SegmentedControl label={t('finance.workspace.resourceFlow')} options={[{ value: 'all', label: t('finance.filters.all') }, { value: 'income', label: t('finance.income') }, { value: 'expense', label: t('finance.expenses') }]} value={movementType} onChange={(value) => setMovementType(value as 'all' | 'income' | 'expense')} />
      <View style={styles.movementList}>{visibleMovements.map((movement) => <View key={movement.id} style={styles.movementRow}><View style={[styles.movementIcon, movement.amount >= 0 ? styles.movementIconIncome : styles.movementIconExpense]}><Ionicons name={movement.amount >= 0 ? 'arrow-down-outline' : 'arrow-up-outline'} size={17} color={movement.amount >= 0 ? C.gold : C.red} /></View><View style={styles.rowMain}><Text style={styles.rowTitle} numberOfLines={2}>{movement.note || t(`finance.store.cashMovement.${movement.type}`)}</Text><Text style={styles.rowMeta}>{t(`finance.store.cashMovement.${movement.type}`)} · {new Date(movement.date).toLocaleString()}</Text></View><Text style={movement.amount >= 0 ? styles.positive : styles.negative} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{movement.amount >= 0 ? '+' : ''}{money(movement.amount, currency)}</Text></View>)}{!visibleMovements.length ? <Empty title={t('finance.store.noBusinessMovements')} copy={movementQuery || movementType !== 'all' ? t('finance.storeFilters.noResults') : t('finance.store.noBusinessMovementsCopy')} icon="wallet-outline" /> : null}</View>
    </ScrollView>;
  };

  const renderReports = () => {
    const { topProducts, topClients } = reportData;
    const options: { kind: StoreReportKind; icon: IconName; title: string; copy: string }[] = [
      { kind: 'export', icon: 'download-outline', title: t('finance.store.reportExportTitle'), copy: t('finance.store.reportExportCopy') },
      { kind: 'topProductsServices', icon: 'trending-up-outline', title: t('finance.store.reportTopProductsServices'), copy: t('finance.store.reportTopProductsServicesCopy') },
      { kind: 'topClients', icon: 'people-outline', title: t('finance.store.reportTopClients'), copy: t('finance.store.reportTopClientsCopy') },
    ];
    const rangeOptions = [
      { value: 'today', label: t('finance.today') },
      { value: 'week', label: t('finance.thisWeek') },
      { value: 'month', label: t('finance.thisMonth') },
      { value: 'year', label: t('finance.yearToDate') },
      { value: 'custom', label: t('finance.workspace.reportRangeCustom') },
      { value: 'all', label: t('finance.workspace.reportRangeAll') },
    ];
    return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{reportKind ? <Pressable style={styles.backRow} onPress={() => setReportKind(null)}><Ionicons name="arrow-back" size={18} color={C.gold} /><Text style={styles.link}>{t('finance.store.reportBack')}</Text></Pressable> : null}<View style={styles.reportPeriodCard}><Text style={styles.reportPeriodTitle}>{t('finance.workspace.reportPeriod')}</Text><View style={styles.reportRangeOptions}>{rangeOptions.map((option) => <Pressable key={option.value} style={[styles.reportRangeOption, reportRangeMode === option.value && styles.reportRangeOptionActive]} onPress={() => setReportRangeMode(option.value as ReportRangeMode)} accessibilityRole="radio" accessibilityState={{ selected: reportRangeMode === option.value }}><Text style={[styles.reportRangeOptionText, reportRangeMode === option.value && styles.reportRangeOptionTextActive]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{option.label}</Text></Pressable>)}</View>{reportRangeMode === 'custom' ? <View style={styles.reportDateRow}><View style={styles.reportDateColumn}><DateSelect label={t('finance.workspace.reportStartDate')} value={reportStartDate} onChange={setReportStartDate} firstDayOfWeek={state.settings.firstDayOfWeek} /></View><View style={styles.reportDateColumn}><DateSelect label={t('finance.workspace.reportEndDate')} value={reportEndDate} onChange={setReportEndDate} firstDayOfWeek={state.settings.firstDayOfWeek} /></View></View> : null}{reportRangeError ? <Text style={styles.error}>{reportRangeError}</Text> : reportRange ? <Text style={styles.reportRangeLabel}>{reportRange.label}</Text> : null}</View>{reportKind === 'export' ? <View style={styles.reportExportCard}><View style={styles.reportExportHeader}><View style={styles.reportIcon}><Ionicons name="download-outline" size={20} color={C.gold} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{t('finance.store.reportExportTitle')}</Text><Text style={styles.rowMeta}>{t('finance.store.reportExportCopy')}</Text></View></View><View style={styles.reportExportActions}><Pressable style={styles.exportButton} onPress={() => void exportReport('pdf')} disabled={backupBusy || Boolean(reportRangeError)}><Ionicons name="document-text-outline" size={17} color={C.void} /><Text style={styles.exportButtonText}>{t('finance.store.reportExportPdf')}</Text></Pressable><Pressable style={styles.exportButtonSecondary} onPress={() => void exportReport('xlsx')} disabled={backupBusy || Boolean(reportRangeError)}><Ionicons name="grid-outline" size={17} color={C.gold} /><Text style={styles.exportButtonSecondaryText}>{t('finance.store.reportExportExcel')}</Text></Pressable></View></View> : null}{!reportKind ? options.map((option) => <Pressable key={option.kind} style={styles.reportOption} onPress={() => setReportKind(option.kind)}><View style={styles.reportIcon}><Ionicons name={option.icon} size={20} color={C.gold} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{option.title}</Text><Text style={styles.rowMeta}>{option.copy}</Text></View><Ionicons name="chevron-forward" size={17} color="rgba(255,244,208,0.28)" /></Pressable>) : null}{reportKind === 'topProductsServices' ? topProducts.map(([id, value]) => <ReportRow key={id} title={value.name} copy={`${value.quantity} ${t('finance.store.reportUnits')}`} amount={money(value.total, currency)} />) : null}{reportKind === 'topClients' ? topClients.map(([id, value]) => <ReportRow key={id} title={store.clients.find((item) => item.id === id)?.name ?? t('finance.store.inactiveClient')} copy={`${value.count} ${t('finance.store.reportTransactions')}`} amount={money(value.total, currency)} />) : null}{reportKind && ((reportKind === 'topProductsServices' && !topProducts.length) || (reportKind === 'topClients' && !topClients.length)) ? <Empty title={t('finance.store.reportNoData')} copy={t('finance.store.reportNoDataCopy')} icon="bar-chart-outline" /> : null}</ScrollView>;
  };

  const renderStatistics = () => <ScrollView contentContainerStyle={[styles.content, styles.storeStatsContent]} showsVerticalScrollIndicator={false}>
    <View style={styles.storeStatsRange}>{(['today', 'week', 'month', 'year'] as StoreStatsRange[]).map((range) => { const selected = storeStatsRange === range; const label = range === 'today' ? t('finance.today') : range === 'week' ? t('finance.thisWeek') : range === 'month' ? t('finance.thisMonth') : t('finance.yearToDate'); return <Pressable key={range} style={[styles.storeStatsRangeOption, selected && styles.storeStatsRangeOptionActive]} onPress={() => setStoreStatsRange(range)} accessibilityRole="radio" accessibilityState={{ selected }}><Text style={[styles.storeStatsRangeText, selected && styles.storeStatsRangeTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{label}</Text></Pressable>; })}</View>
    <Text style={styles.storeStatsRangeLabel}>{storeStatsRangeLabel}</Text>

    <LinearGradient colors={['rgba(233,200,119,0.15)', 'rgba(10,12,20,0.78)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storeStatsHero}>
      <View style={styles.storeStatsHeroTop}><View style={styles.rowMain}><Text style={styles.storeStatsLabel}>{t('finance.storeStats.netFlow')}</Text><Text style={[styles.storeStatsNet, storeStatsData.netFlow < 0 ? styles.negative : styles.positive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{money(storeStatsData.netFlow, currency)}</Text></View><View style={styles.storeStatsBadge}><Ionicons name="receipt-outline" size={15} color={C.gold} /><Text style={styles.storeStatsBadgeValue}>{storeStatsData.saleCount}</Text><Text style={styles.storeStatsBadgeLabel}>{t('finance.store.reportTransactions')}</Text></View></View>
      <Text style={styles.storeStatsComparisonTitle}>{t('finance.storeStats.vsPrevious')}</Text>
      <View style={[styles.storeStatsComparisonRow, compactStoreStats && styles.storeStatsComparisonRowNarrow]}>
        <View style={[styles.storeStatsComparison, compactStoreStats && styles.storeStatsComparisonNarrow]}><Ionicons name={storeStatsSalesChange !== null && storeStatsSalesChange < 0 ? 'trending-down-outline' : 'trending-up-outline'} size={15} color={storeStatsSalesChange !== null && storeStatsSalesChange < 0 ? C.red : C.gold} /><View style={styles.rowMain}><Text style={styles.storeStatsComparisonLabel}>{t('finance.storeStats.salesRevenue')}</Text><Text style={[styles.storeStatsComparisonValue, storeStatsSalesChange !== null && storeStatsSalesChange < 0 && styles.negative]}>{storeStatsSalesChange === null ? t('finance.storeStats.noPreviousData') : `${storeStatsSalesChange >= 0 ? '+' : ''}${Math.round(storeStatsSalesChange)}%`}</Text></View></View>
        <View style={[styles.storeStatsComparison, compactStoreStats && styles.storeStatsComparisonNarrow]}><Ionicons name={storeStatsNetChange !== null && storeStatsNetChange < 0 ? 'trending-down-outline' : 'trending-up-outline'} size={15} color={storeStatsNetChange !== null && storeStatsNetChange < 0 ? C.red : C.gold} /><View style={styles.rowMain}><Text style={styles.storeStatsComparisonLabel}>{t('finance.storeStats.netFlow')}</Text><Text style={[styles.storeStatsComparisonValue, storeStatsNetChange !== null && storeStatsNetChange < 0 && styles.negative]}>{storeStatsNetChange === null ? t('finance.storeStats.noPreviousData') : `${storeStatsNetChange >= 0 ? '+' : ''}${Math.round(storeStatsNetChange)}%`}</Text></View></View>
      </View>
      <View style={styles.storeStatsHeroMetrics}><View style={styles.storeStatsHeroMetric}><Text style={styles.storeStatsMetricLabel}>{t('finance.storeStats.salesRevenue')}</Text><Text style={[styles.storeStatsHeroValue, styles.positive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{money(storeStatsData.salesRevenue, currency)}</Text></View><View style={styles.movementMetricDivider} /><View style={styles.storeStatsHeroMetric}><Text style={styles.storeStatsMetricLabel}>{t('finance.storeStats.cashOutflow')}</Text><Text style={[styles.storeStatsHeroValue, styles.negative]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{money(storeStatsData.cashOutflow, currency)}</Text></View></View>
    </LinearGradient>

    <View style={styles.storeStatsMetricGrid}>
      <View style={[styles.storeStatsMetricCard, compactStoreStats && styles.storeStatsMetricCardWide]}><View style={styles.storeStatsMetricIcon}><Ionicons name="calculator-outline" size={17} color={C.gold} /></View><Text style={styles.storeStatsMetricLabel}>{t('finance.storeStats.averageSale')}</Text><Text style={styles.storeStatsMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{money(storeStatsData.averageSale, currency)}</Text></View>
      <View style={[styles.storeStatsMetricCard, compactStoreStats && styles.storeStatsMetricCardWide]}><View style={styles.storeStatsMetricIcon}><Ionicons name="bag-handle-outline" size={17} color={C.gold} /></View><Text style={styles.storeStatsMetricLabel}>{t('finance.storeStats.itemsSold')}</Text><Text style={styles.storeStatsMetricValue}>{storeStatsData.itemsSold}</Text></View>
      <View style={[styles.storeStatsMetricCard, compactStoreStats && styles.storeStatsMetricCardWide]}><View style={styles.storeStatsMetricIcon}><Ionicons name="cube-outline" size={17} color={C.gold} /></View><Text style={styles.storeStatsMetricLabel}>{t('finance.storeStats.inventoryValue')}</Text><Text style={styles.storeStatsMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{money(storeStatsData.inventoryValue, currency)}</Text></View>
      <View style={[styles.storeStatsMetricCard, compactStoreStats && styles.storeStatsMetricCardWide]}><View style={styles.storeStatsMetricIcon}><Ionicons name="layers-outline" size={17} color={C.gold} /></View><Text style={styles.storeStatsMetricLabel}>{t('finance.store.activeProducts')}</Text><Text style={styles.storeStatsMetricValue}>{storeStatsData.activeProducts}</Text><Text style={[styles.storeStatsMetricMeta, storeStatsData.lowStock > 0 && styles.negative]}>{storeStatsData.lowStock} {t('finance.store.lowStock').toLocaleLowerCase()}</Text><Text style={styles.storeStatsMetricMeta}>{storeStatsData.archivedProducts} {t('finance.store.archived').toLocaleLowerCase()}</Text></View>
    </View>

    <Text style={styles.sectionTitle}>{t('finance.storeStats.salesFlow')}</Text>
    <View style={styles.storeStatsChartCard}>
      {storeStatsFlowBuckets.some((bucket) => bucket.sales > 0 || bucket.outflow > 0) ? <><View style={styles.storeStatsChart}>{storeStatsFlowBuckets.map((bucket) => <View key={bucket.key} style={styles.storeStatsFlowColumn}><View style={styles.storeStatsFlowBars}><View style={[styles.storeStatsFlowBar, { height: bucket.sales > 0 ? Math.max(7, bucket.sales / storeStatsFlowMax * 72) : 0, backgroundColor: C.gold }]} /><View style={[styles.storeStatsFlowBar, { height: bucket.outflow > 0 ? Math.max(7, bucket.outflow / storeStatsFlowMax * 72) : 0, backgroundColor: C.red }]} /></View><Text style={styles.storeStatsFlowLabel} numberOfLines={1}>{bucket.label}</Text></View>)}</View><View style={styles.flowLegend}><View style={styles.flowLegendItem}><View style={[styles.flowLegendChip, { backgroundColor: C.gold }]} /><Text style={styles.flowLegendText}>{t('finance.storeStats.salesRevenue')}</Text></View><View style={styles.flowLegendItem}><View style={[styles.flowLegendChip, { backgroundColor: C.red }]} /><Text style={styles.flowLegendText}>{t('finance.storeStats.cashOutflow')}</Text></View></View></> : <View style={styles.storeStatsEmpty}><Ionicons name="stats-chart-outline" size={22} color={C.textSubtle} /><Text style={styles.rowMeta}>{t('finance.storeStats.noData')}</Text></View>}
    </View>

    <Text style={styles.sectionTitle}>{t('finance.storeStats.topProducts')}</Text>
    <View style={styles.storeStatsChartCard}>{storeStatsData.topProducts.map((product, index) => <View key={product.productId} style={[styles.storeStatsProductRow, index === 0 && styles.storeStatsProductRowTop]}><View style={[styles.storeStatsRank, index === 0 && styles.storeStatsRankTop]}><Text style={[styles.storeStatsRankText, index === 0 && styles.storeStatsRankTextTop]}>{index + 1}</Text></View><View style={styles.rowMain}><Text style={[styles.rowTitle, index === 0 && styles.storeStatsProductNameTop]} numberOfLines={2}>{product.name}</Text><Text style={styles.rowMeta}>{product.quantity} {t('finance.store.reportUnits')}</Text><View style={styles.storeStatsProductTrack}><LinearGradient colors={[C.gold, C.goldMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.storeStatsProductFill, { width: `${product.total / storeStatsTopMax * 100}%` }]} /></View></View><Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{money(product.total, currency)}</Text></View>)}{!storeStatsData.topProducts.length ? <View style={styles.storeStatsEmpty}><Ionicons name="podium-outline" size={22} color={C.textSubtle} /><Text style={styles.rowMeta}>{t('finance.storeStats.noData')}</Text></View> : null}</View>
  </ScrollView>;

  const renderSettings = () => <ScrollView contentContainerStyle={[styles.content, styles.settingsContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Text style={styles.sectionTitle}>{t('finance.storeCurrency.sectionTitle')}</Text>
    <View style={styles.settingsCard}>
      <SearchableSelect label={t('finance.store.currency')} value={storeCurrency} options={currencyOptions} onChange={requestStoreCurrencyChange} placeholder={currency} searchPlaceholder={t('finance.searchCurrency')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} disabled={backupBusy} />
      <Text style={styles.settingsBackupCopy}>{t('finance.storeCurrency.conversionCopy')}</Text>
    </View>

    <Text style={styles.sectionTitle}>{t('finance.storeBackup.backupTitle')}</Text>
    <View style={styles.settingsCard}>
      <Text style={styles.settingsBackupCopy}>{t('finance.storeBackup.backupCopy')}</Text>
      <Pressable style={[styles.settingsAction, backupBusy && styles.buttonDisabled]} onPress={() => void exportStore()} disabled={backupBusy} accessibilityRole="button" accessibilityState={{ disabled: backupBusy }}>
        <View style={styles.settingsActionIcon}><Ionicons name="share-outline" size={20} color={C.gold} /></View>
        <View style={styles.rowMain}><Text style={styles.settingsActionText}>{t('finance.storeBackup.exportStore')}</Text><Text style={styles.settingsActionCopy}>{t('finance.storeBackup.exportStoreCopy')}</Text></View>
        <Ionicons name="chevron-forward-outline" size={18} color={C.textSubtle} />
      </Pressable>
      <Pressable style={[styles.settingsAction, styles.settingsActionLast, backupBusy && styles.buttonDisabled]} onPress={() => void importStore()} disabled={backupBusy} accessibilityRole="button" accessibilityState={{ disabled: backupBusy }}>
        <View style={styles.settingsActionIcon}><Ionicons name="document-attach-outline" size={20} color={C.gold} /></View>
        <View style={styles.rowMain}><Text style={styles.settingsActionText}>{t('finance.storeBackup.importStore')}</Text><Text style={styles.settingsActionCopy}>{t('finance.storeBackup.importStoreCopy')}</Text></View>
        <Ionicons name="chevron-forward-outline" size={18} color={C.textSubtle} />
      </Pressable>
    </View>
  </ScrollView>;

  const title = view === 'movements' ? t('finance.store.viewMovements') : view === 'statistics' ? t('finance.storeStats.title') : view === 'archived' ? t('finance.store.archivedProducts') : view === 'settings' ? t('finance.store.settings') : t(`finance.store.${view}`);
  const content = view === 'inventory' || view === 'services' ? renderProducts() : view === 'archived' ? renderArchivedProducts() : view === 'sales' ? renderSales() : view === 'reports' ? renderReports() : view === 'movements' ? renderMovements() : view === 'statistics' ? renderStatistics() : view === 'settings' ? renderSettings() : renderDirectory(view);
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><View style={styles.root}>
    <View style={styles.header}>{view === 'statistics' ? <Pressable style={styles.headerButton} onPress={() => switchView('inventory')} accessibilityRole="button" accessibilityLabel={t('finance.back')}><Ionicons name="arrow-back" size={20} color={C.gold} /></Pressable> : <Pressable style={styles.headerButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button" accessibilityLabel={t('finance.menu')}><MenuGlyph /></Pressable>}<Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>{view === 'statistics' ? <Pressable style={styles.headerButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button" accessibilityLabel={t('finance.menu')}><MenuGlyph /></Pressable> : <Pressable style={styles.headerButton} onPress={() => switchView('statistics')} accessibilityRole="button" accessibilityLabel={t('finance.storeStats.title')}><Ionicons name="stats-chart-outline" size={20} color={C.gold} /></Pressable>}</View>
    <Animated.View key={view} entering={FadeIn.duration(reduceMotion ? 0 : 190).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(reduceMotion ? 0 : 120)} style={styles.flex}>{content}</Animated.View>
    <Pressable style={[styles.workspaceFab, view === 'inventory' || view === 'services' || view === 'sales' ? styles.workspaceFabStacked : styles.workspaceFabSolo]} onPress={switchWorkspace} accessibilityRole="button" accessibilityLabel={t('finance.workspace.personal')}><Ionicons name="wallet-outline" size={20} color={C.gold} /></Pressable>
    {(view === 'inventory' || view === 'services' || view === 'sales') ? <Pressable style={styles.fab} onPress={view === 'sales' ? openSale : () => openProduct()} accessibilityRole="button" accessibilityLabel={view === 'sales' ? t('finance.store.newSale') : t('finance.store.addProduct')}><Ionicons name="add" size={25} color={C.gold} /></Pressable> : null}
    <ConfirmDialog visible={exitPromptOpen} title={t('finance.exit.title')} message={t('finance.exit.copy')} cancelLabel={t('finance.cancel')} confirmLabel={t('finance.exit.confirm')} icon="power-outline" destructive={false} onCancel={() => setExitPromptOpen(false)} onConfirm={() => { setExitPromptOpen(false); BackHandler.exitApp(); }} />
    <ConfirmDialog visible={Boolean(pendingStoreBackup)} title={t('finance.storeBackup.importStore')} message={t('finance.storeBackup.importConfirmCopy')} cancelLabel={t('finance.cancel')} confirmLabel={t('finance.storeBackup.importStore')} icon="cloud-download-outline" destructive onCancel={() => setPendingStoreBackup(null)} onConfirm={() => void confirmStoreImport()} />
    <Modal visible={importBusy} transparent animationType="fade" statusBarTranslucent><View style={styles.importBackdrop}><View style={styles.importCard}><ActivityIndicator size="large" color={C.gold} /><Text style={styles.importTitle}>{t('finance.releaseImport.importing')}</Text><Text style={styles.importCopy}>{t('finance.releaseImport.importingCopy')}</Text></View></View></Modal>

    <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
      <View style={styles.drawerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
        <Animated.View style={styles.drawerPanel} entering={SlideInLeft.duration(reduceMotion ? 0 : 220).easing(Easing.out(Easing.cubic))}>
          <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
              <View style={styles.balanceCard}><Text style={styles.eyebrow}>{t('finance.storeDrawer.inventoryValue')}</Text><Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>{money(inventoryValue, currency)}</Text><Text style={styles.rowMeta}>{t('finance.storeBackup.businessBalance')}: {money(store.businessAccount.balance, currency)}</Text></View>
              {([['inventory', 'cube-outline'], ['employees', 'people-outline'], ['clients', 'person-outline'], ['providers', 'business-outline'], ['services', 'construct-outline'], ['sales', 'cart-outline'], ['reports', 'bar-chart-outline']] as [StoreView, IconName][]).map(([item, icon]) => <Pressable key={item} style={[styles.drawerItem, view === item && styles.drawerItemActive]} onPress={() => switchView(item)} accessibilityRole="button" accessibilityLabel={t(`finance.store.${item}`)}><Ionicons name={icon} size={20} color={view === item ? C.goldLight : C.gold} /><Text style={styles.drawerText}>{t(`finance.store.${item}`)}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></Pressable>)}
              <Pressable style={[styles.drawerItem, view === 'movements' && styles.drawerItemActive]} onPress={() => switchView('movements')} accessibilityRole="button" accessibilityLabel={t('finance.store.viewMovements')}><Ionicons name="wallet-outline" size={20} color={view === 'movements' ? C.goldLight : C.gold} /><Text style={styles.drawerText}>{t('finance.store.viewMovements')}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></Pressable>
              <Pressable style={[styles.drawerItem, view === 'archived' && styles.drawerItemActive]} onPress={() => switchView('archived')} accessibilityRole="button" accessibilityLabel={t('finance.store.archived')}><Ionicons name="archive-outline" size={20} color={view === 'archived' ? C.goldLight : C.gold} /><Text style={styles.drawerText}>{t('finance.store.archived')}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></Pressable>
              <Pressable style={[styles.drawerItem, view === 'settings' && styles.drawerItemActive]} onPress={openSettings} accessibilityRole="button" accessibilityLabel={t('finance.store.settings')}><Ionicons name="settings-outline" size={20} color={view === 'settings' ? C.goldLight : C.gold} /><Text style={styles.drawerText}>{t('finance.store.settings')}</Text><Ionicons name="chevron-forward" size={16} color={C.textSubtle} /></Pressable>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>

    <ResponsiveSheet visible={filterOpen} title={t('finance.storeFilters.filters')} onClose={() => setFilterOpen(false)} closeLabel={t('finance.close')}>
      <SearchableSelect label={t('finance.store.category')} value={categoryFilter} options={[{ value: '', label: t('finance.filters.all'), icon: 'apps-outline' }, ...categoryOptions]} onChange={setCategoryFilter} placeholder={t('finance.filters.all')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      {view === 'inventory' ? <View style={styles.filterRows}>{(['', 'low', 'out', 'expired', 'expiring'] as StockFilter[]).map((item) => <Pressable key={item || 'all'} style={styles.filterRow} onPress={() => setStockFilter(item)} accessibilityRole="radio" accessibilityState={{ selected: stockFilter === item }}><Text style={styles.drawerText}>{item ? t(`finance.storeFilters.${item}`) : t('finance.filters.all')}</Text>{stockFilter === item ? <Ionicons name="checkmark-circle" size={20} color={C.gold} /> : <Ionicons name="ellipse-outline" size={20} color="rgba(255,244,208,0.25)" />}</Pressable>)}</View> : null}
      {filtersActive ? <Pressable style={styles.textAction} onPress={() => { setCategoryFilter(''); setStockFilter(''); }}><Text style={styles.link}>{t('finance.storeFilters.clear')}</Text></Pressable> : null}
    </ResponsiveSheet>

    <ResponsiveSheet visible={addOpen} title={t('finance.storeFunding.title')} onClose={() => setAddOpen(false)} closeLabel={t('finance.close')} footer={<FormActions saveLabel={t('finance.storeFunding.save')} onSave={() => commitFunding(false)} compact disabled={!(numeric(fundingAmount) > 0)} />}>
      <View style={styles.flowHero}><View style={styles.flowHeroSide}><Text style={styles.flowHeroLabel}>{t('finance.storeFunding.account')}</Text><Text style={styles.flowHeroValue} numberOfLines={1} adjustsFontSizeToFit>{selectedFundingAccount?.label ?? t('finance.storePurchase.none')}</Text><Text style={styles.flowHeroMeta}>{selectedFundingAccount?.description ?? t('finance.storePurchase.none')}</Text></View><Ionicons name="arrow-forward-outline" size={20} color={C.gold} /><View style={styles.flowHeroSide}><Text style={styles.flowHeroLabel}>{t('finance.storeBackup.businessBalance')}</Text><Text style={styles.flowHeroValue} numberOfLines={1} adjustsFontSizeToFit>{money(store.businessAccount.balance, currency)}</Text><Text style={styles.flowHeroMeta}>{t('finance.store.business')}</Text></View></View>
      <Text style={styles.helper}>{t('finance.storeFunding.copy')}</Text>
      <SearchableSelect label={t('finance.storeFunding.account')} value={fundingAccountId} options={accountOptions.filter((item) => item.value !== 'store-business')} onChange={(value) => { setFundingAccountId(value); setFundingError(''); }} placeholder={t('finance.storePurchase.none')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <FormField label={t('finance.storeFunding.amount')} value={fundingAmount} onChangeText={(value) => { setFundingAmount(value); setFundingError(''); }} numeric required placeholder="0.00" error={fundingError} />
      <FormField label={t('finance.storeFunding.note')} value={fundingNote} onChangeText={setFundingNote} />
    </ResponsiveSheet>

    <ResponsiveSheet visible={productOpen} title={editingProduct ? (productDraft.type === 'service' ? t('finance.store.service') : t('finance.store.editProduct')) : (productDraft.type === 'service' ? t('finance.store.service') : t('finance.store.newProduct'))} onClose={() => setProductOpen(false)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.store.saveProduct')} onCancel={() => setProductOpen(false)} onSave={() => commitProduct(false)} destructiveLabel={editingProduct ? (editingProduct.active ? t('finance.store.archiveProduct') : t('finance.store.restoreProduct')) : undefined} onDestructive={editingProduct ? () => { finance.updateState((current) => ({ ...current, store: { ...current.store, products: current.store.products.map((item) => item.id === editingProduct.id ? { ...item, active: !item.active } : item) } })); setProductOpen(false); } : undefined} />}>
      <StoreProductForm
        draft={productDraft}
        errors={productErrors}
        editing={Boolean(editingProduct)}
        service={view === 'services'}
        customUnitOpen={customUnitOpen}
        moreOpen={productMoreOpen}
        categoryOptions={categoryOptions}
        providerOptions={providerOptions}
        unitOptions={productUnitOptions}
        purchaseAccountOptions={accountOptions}
        purchaseAccountId={purchaseAccountId}
        onChangeText={updateProductText}
        onAdditionalPriceChange={(index, value) => {
          setProductDraft((current) => ({ ...current, additionalSalePrices: current.additionalSalePrices.map((item, itemIndex) => itemIndex === index ? value : item) }));
          setProductErrors((current) => ({ ...current, numbers: '' }));
        }}
        onRemoveAdditionalPrice={(index) => setProductDraft((current) => ({ ...current, additionalSalePrices: current.additionalSalePrices.filter((_, itemIndex) => itemIndex !== index) }))}
        onAddAdditionalPrice={() => setProductDraft((current) => ({ ...current, additionalSalePrices: [...current.additionalSalePrices, ''] }))}
        onUnitChange={handleProductUnitChange}
        onAddCategory={addCategoryFromSearch}
        onProviderChange={(value) => setProductDraft((current) => ({ ...current, providerId: value }))}
        onPurchaseAccountChange={(value) => {
          setPurchaseAccountId(value);
          setProductErrors((current) => ({ ...current, purchase: '' }));
        }}
        onCategoryChange={(value) => {
          setProductDraft((current) => ({ ...current, categoryId: value }));
          setProductErrors((current) => ({ ...current, category: '' }));
        }}
        onManageCategories={() => openCategoryManager()}
        onIconChange={(icon) => setProductDraft((current) => ({ ...current, icon }))}
        onToggleMore={() => setProductMoreOpen((current) => !current)}
        onChoosePicture={choosePicture}
        onRemovePicture={() => setProductDraft((current) => ({ ...current, picture: undefined }))}
        onExpirationChange={(value) => setProductDraft((current) => ({ ...current, expirationDate: value }))}
        onClearExpiration={() => setProductDraft((current) => ({ ...current, expirationDate: '' }))}
      />
    </ResponsiveSheet>

    <ResponsiveSheet visible={categoryManagerOpen} title={t('finance.store.manageCategories')} onClose={() => { setCategoryManagerOpen(false); setEditingCategoryId(null); setCategoryName(''); setCategoryIcon('pricetag-outline'); setCategoryError(''); }} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.save')} onCancel={() => { setCategoryManagerOpen(false); setEditingCategoryId(null); setCategoryName(''); setCategoryIcon('pricetag-outline'); setCategoryError(''); }} onSave={saveCategory} disabled={!categoryName.trim()} />}>
      <View style={styles.inline}><View style={styles.inlineMain}><FormField label={editingCategoryId ? t('finance.store.renameCategory') : t('finance.store.newCategoryPlaceholder')} value={categoryName} onChangeText={(value) => { setCategoryName(value); setCategoryError(''); }} error={categoryError} /></View></View>
      <View style={styles.categoryIconPicker}><View style={styles.categoryIconHeader}><Text style={styles.subLabel}>{t('finance.chooseIcon')}</Text><View style={styles.categorySelectedIcon}><Ionicons name={categoryIcon} size={18} color={C.goldLight} /></View></View><View style={styles.categoryIconChoices}>{PRODUCT_ICON_OPTIONS.map((icon) => { const selected = categoryIcon === icon; return <Pressable key={icon} style={[styles.categoryIconChoice, selected && styles.categoryIconChoiceActive]} onPress={() => setCategoryIcon(icon)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={t('finance.chooseIcon')}><Ionicons name={icon} size={20} color={selected ? C.void : C.gold} />{selected ? <View style={styles.categoryIconSelectedMark}><Ionicons name="checkmark" size={10} color={C.void} /></View> : null}</Pressable>; })}</View></View>
      {store.categories.map((category) => <View key={category.id} style={styles.categoryRow}><View style={styles.categoryListIcon}><Ionicons name={(category.icon as IconName | undefined) ?? (category.builtIn ? 'grid-outline' : 'pricetag-outline')} size={18} color={C.gold} /></View><Text style={[styles.rowTitle, styles.categoryRowText]} numberOfLines={1}>{categoryNameFor(category.id)}</Text>{!category.builtIn ? <><Pressable style={styles.iconButton} onPress={() => { setEditingCategoryId(category.id); setCategoryName(category.name); setCategoryIcon((category.icon as IconName | undefined) ?? 'pricetag-outline'); }} accessibilityLabel={t('finance.editAction')}><Ionicons name="pencil-outline" size={17} color={C.gold} /></Pressable><Pressable style={styles.iconButton} onPress={() => deleteCategory(category)} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></> : null}</View>)}
    </ResponsiveSheet>

    <ResponsiveSheet visible={Boolean(stockProduct)} title={stockProduct?.name ?? t('finance.store.adjustStock')} onClose={() => setStockProduct(null)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.save')} onCancel={() => setStockProduct(null)} onSave={saveStock} disabled={!Number.isFinite(numeric(stockQuantity)) || numeric(stockQuantity) < 0 || (stockAction !== 'adjustment' && numeric(stockQuantity) === 0)} />}>
      <SegmentedControl label={t('finance.store.stockMovement')} options={(['entry', 'exit', 'adjustment'] as StockAction[]).map((item) => ({ value: item, label: t(`finance.store.stockAction.${item}`) }))} value={stockAction} onChange={(value) => { setStockAction(value as StockAction); setStockError(''); }} />
      <FormField label={t('finance.store.quantity')} value={stockQuantity} onChangeText={(value) => { setStockQuantity(value); setStockError(''); }} numeric required error={stockError} />
      <FormField label={t('finance.store.stockReason')} value={stockNote} onChangeText={(value) => { setStockNote(value); setStockError(''); }} placeholder={t('finance.store.stockReason')} />
    </ResponsiveSheet>

    <ResponsiveSheet visible={saleOpen} title={t('finance.store.newSale')} onClose={() => setSaleOpen(false)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.store.completeSale')} onCancel={() => setSaleOpen(false)} onSave={submitSale} disabled={!cart.length || saleSubmitting} />}>
      <View style={styles.saleSummary}><View style={styles.movementMetric}><Text style={styles.movementMetricLabel}>{t('finance.store.cart')}</Text><Text style={styles.movementMetricValue}>{saleItemCount} {t('finance.store.units')}</Text></View><View style={styles.movementMetricDivider} /><View style={styles.movementMetric}><Text style={styles.movementMetricLabel}>{t('finance.store.cashMovement.sale')}</Text><Text style={styles.movementMetricValue}>{money(saleTotal, currency)}</Text></View></View><View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={saleQuery} onChangeText={setSaleQuery} placeholder={t('finance.store.searchProducts')} placeholderTextColor={C.textSubtle} style={styles.searchInput} /></View>
      {saleProducts.slice(0, 12).map((product) => <Pressable key={product.id} style={styles.saleProduct} onPress={() => addToCart(product)}><View style={styles.rowMain}><Text style={styles.rowTitle}>{product.name}</Text><Text style={styles.rowMeta}>{product.type === 'service' ? t('finance.store.service') : `${availableFor(product)} ${t('finance.store.units')}`}</Text></View><Text style={styles.amount}>{money(product.salePrice, currency)}</Text><Ionicons name="add-circle-outline" size={22} color={C.gold} /></Pressable>)}
      {cart.length ? <Text style={styles.sectionTitle}>{t('finance.store.cart')}</Text> : null}
      {cart.map((item) => <View key={item.productId} style={styles.cartRow}><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Pressable onPress={() => cyclePrice(item.productId)} disabled={(store.products.find((product) => product.id === item.productId)?.additionalSalePrices.length ?? 0) === 0}><Text style={styles.priceLink}>{money(item.unitPrice, currency)}{(store.products.find((product) => product.id === item.productId)?.additionalSalePrices.length ?? 0) > 0 ? ` · ${t('finance.store.changePrice')}` : ''}</Text></Pressable></View><Pressable style={styles.quantityButton} onPress={() => changeCart(item.productId, -1)}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityValue}>{item.quantity}</Text><Pressable style={styles.quantityButton} onPress={() => changeCart(item.productId, 1)}><Text style={styles.quantityText}>+</Text></Pressable></View>)}
      {cart.length ? <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('finance.store.total')}</Text><Text style={styles.totalValue}>{money(saleTotal, currency)}</Text></View> : null}
      <SearchableSelect label={t('finance.store.client')} value={saleClientId} options={clientOptions} onChange={setSaleClientId} placeholder={t('finance.store.noneSelected')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <SearchableSelect label={t('finance.store.employee')} value={saleEmployeeId} options={employeeOptions} onChange={setSaleEmployeeId} placeholder={t('finance.store.noneSelected')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <SearchableSelect label={t('finance.store.paymentMethod')} value={paymentMethod} options={['', 'cash', 'card', 'bank', 'other'].map((item) => ({ value: item, label: item ? t(`finance.accountTypes.${item}`) : t('finance.store.noPaymentMethod'), icon: 'card-outline' }))} onChange={setPaymentMethod} placeholder={t('finance.store.noPaymentMethod')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} />
      <FormField label={t('finance.store.saleNote')} value={saleNote} onChangeText={setSaleNote} multiline />
      {saleError ? <Text style={styles.error}>{saleError}</Text> : null}
    </ResponsiveSheet>

    <ResponsiveSheet visible={Boolean(selectedSale)} title={t('finance.store.saleDetails')} onClose={() => setSelectedSaleId(null)} closeLabel={t('finance.close')}>
      {selectedSale ? <><Text style={styles.helper}>{new Date(selectedSale.date).toLocaleString()}</Text>{selectedSale.items.map((item) => <ReportRow key={item.productId} title={`${item.name} × ${item.quantity}`} copy={money(item.unitPrice, currency)} amount={money(item.total, currency)} />)}<View style={styles.totalRow}><Text style={styles.totalLabel}>{t('finance.store.total')}</Text><Text style={styles.totalValue}>{money(selectedSale.total, currency)}</Text></View><Detail label={t('finance.store.client')} value={store.clients.find((item) => item.id === selectedSale.clientId)?.name ?? t('finance.store.noneSelected')} /><Detail label={t('finance.store.employee')} value={store.employees.find((item) => item.id === selectedSale.employeeId)?.name ?? t('finance.store.noneSelected')} /><Detail label={t('finance.store.paymentMethod')} value={selectedSale.paymentMethod ? t(`finance.accountTypes.${selectedSale.paymentMethod}`) : t('finance.store.noPaymentMethod')} />{selectedSale.note ? <Detail label={t('finance.store.saleNote')} value={selectedSale.note} /> : null}<Text style={selectedSale.status === 'void' ? styles.negative : styles.positive}>{t(`finance.store.${selectedSale.status === 'void' ? 'voided' : 'completed'}`)}</Text>{selectedSale.status === 'completed' ? <Pressable style={styles.dangerButton} onPress={() => confirmVoidSale(selectedSale.id)}><Text style={styles.dangerLink}>{t('finance.store.voidSale')}</Text></Pressable> : null}</> : null}
    </ResponsiveSheet>

    <ResponsiveSheet visible={directoryOpen} title={`${t(directoryId ? 'finance.store.editDirectory' : 'finance.store.addDirectory')} ${t(directoryKind === 'clients' ? 'finance.store.client' : directoryKind === 'providers' ? 'finance.store.provider' : 'finance.store.employee')}`} onClose={() => setDirectoryOpen(false)} closeLabel={t('finance.close')} footer={<FormActions cancelLabel={t('finance.cancel')} saveLabel={t('finance.save')} onCancel={() => setDirectoryOpen(false)} onSave={saveDirectory} disabled={!directoryName.trim()} />}>
      <View style={styles.directoryHero}><View style={styles.directoryHeroAvatar}><Ionicons name={directoryKind === 'clients' ? 'person-outline' : directoryKind === 'providers' ? 'business-outline' : 'people-outline'} size={22} color={C.gold} /><Text style={styles.directoryHeroAvatarText}>{directoryName.trim().charAt(0).toUpperCase() || '?'}</Text></View><View style={styles.rowMain}><Text style={styles.directoryHeroTitle}>{directoryName.trim() || t('finance.store.directoryNamePlaceholder')}</Text><Text style={styles.helper}>{t(directoryKind === 'clients' ? 'finance.store.clientsCopy' : directoryKind === 'providers' ? 'finance.store.providersCopy' : 'finance.store.employeesCopy')}</Text></View></View>
      <Text style={styles.formSectionTitle}>{t('finance.store.sectionIdentity')}</Text>
      <FormField label={t('finance.name')} value={directoryName} onChangeText={(value) => { setDirectoryName(value); setDirectoryError(''); }} placeholder={t('finance.store.directoryNamePlaceholder')} required />
      {directoryKind === 'employees' ? <FormField label={t('finance.store.employeeRole')} value={directoryRole} onChangeText={setDirectoryRole} placeholder={t('finance.store.employeeRolePlaceholder')} /> : null}
      {directoryKind === 'employees' ? <><FormField label={t('finance.payroll.salary')} value={directorySalary} onChangeText={(value) => { setDirectorySalary(value); setDirectoryError(''); }} numeric placeholder={t('finance.amount')} /><SegmentedControl label={t('finance.payroll.frequencyLabel')} options={(['weekly', 'biweekly', 'monthly'] as StorePayFrequency[]).map((value) => ({ value, label: t(`finance.payroll.frequency.${value}`) }))} value={directoryPayFrequency} onChange={(value) => setDirectoryPayFrequency(value as StorePayFrequency)} /><SegmentedControl label={t('finance.payroll.modeLabel')} options={[{ value: 'manual', label: t('finance.payroll.manual') }, { value: 'automatic', label: t('finance.payroll.automatic') }]} value={directoryPayMode} onChange={(value) => setDirectoryPayMode(value as StorePayMode)} /><DateSelect label={t('finance.payroll.nextDate')} value={directoryNextPayDate} emptyLabel={t('finance.payroll.nextDateEmpty')} onChange={setDirectoryNextPayDate} /><Text style={styles.helper}>{t('finance.payroll.accountHint')}</Text></> : null}
      <Text style={styles.formSectionTitle}>{t('finance.store.moreDetails')}</Text>
      <FormField label={t('finance.phone')} value={directoryPhone} onChangeText={setDirectoryPhone} placeholder={t('finance.phone')} />
      {directoryKind !== 'employees' ? <><FormField label={t('finance.email')} value={directoryEmail} onChangeText={(value) => { setDirectoryEmail(value); setDirectoryError(''); }} placeholder={t('finance.email')} /><FormField label={t('finance.notes')} value={directoryNote} onChangeText={setDirectoryNote} placeholder={t('finance.notes')} multiline /></> : null}
      {directoryKind !== 'employees' ? <View style={styles.defaultOperations}><Text style={styles.formSectionTitle}>{t('finance.store.defaultOperations')}</Text>{directoryOperations.map((operation) => <View key={operation.id} style={styles.operationRow}><View style={styles.operationFields}><SearchableSelect label={t('finance.store.operationProduct')} value={operation.productId} options={directoryOperationProductOptions} onChange={(value) => setDirectoryOperations((current) => current.map((item) => item.id === operation.id ? { ...item, productId: value } : item))} placeholder={t('finance.store.operationProduct')} searchPlaceholder={t('finance.searchProducts')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} /><FormField label={t('finance.store.operationQuantity')} value={String(operation.quantity || '')} onChangeText={(value) => setDirectoryOperations((current) => current.map((item) => item.id === operation.id ? { ...item, quantity: Math.max(0, numeric(value)) || 0 } : item))} numeric required /></View><Pressable style={styles.operationRemove} onPress={() => setDirectoryOperations((current) => current.filter((item) => item.id !== operation.id))} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></View>)}<Pressable style={styles.textAction} onPress={() => setDirectoryOperations((current) => [...current, { id: uid('directory-operation'), productId: directoryOperationProductOptions[0]?.value ?? '', quantity: 1 }])} disabled={!directoryOperationProductOptions.length}><Ionicons name="add" size={17} color={C.gold} /><Text style={styles.link}>{t('finance.store.addOperation')}</Text></Pressable></View> : null}
      <SegmentedControl label={t('finance.storeFilters.status')} options={[{ value: 'active', label: t('finance.storeFilters.active') }, { value: 'inactive', label: t('finance.storeFilters.inactive') }]} value={directoryActive ? 'active' : 'inactive'} onChange={(value) => setDirectoryActive(value === 'active')} />
      {directoryError ? <Text style={styles.error}>{directoryError}</Text> : null}
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
  toolbar: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 5 }, search: { minHeight: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, color: C.goldLight, fontFamily: SANS, fontSize: 13 }, filterButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, filterButtonActive: { backgroundColor: C.gold }, addSmall: { width: 44, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  list: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 136 }, listEmpty: { flexGrow: 1 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 136 },
  productRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }, productIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, productImage: { width: '100%', height: '100%' }, productIconChoices: { gap: 8, paddingVertical: 7 }, productIconChoice: { width: 44, height: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center' }, productIconChoiceActive: { backgroundColor: C.gold, borderColor: C.gold }, rowMain: { flex: 1, minWidth: 0 }, rowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13 }, rowMeta: { color: 'rgba(255,244,208,0.46)', fontFamily: SANS, fontSize: 10, lineHeight: 15, marginTop: 3 }, dangerMeta: { color: '#F08B88', fontFamily: SANS, fontSize: 10, marginTop: 3 }, stockSide: { flexDirection: 'row', alignItems: 'center' }, stockValue: { minWidth: 34, textAlign: 'right', color: C.goldLight, fontFamily: SERIF, fontSize: 15 }, iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, inactive: { opacity: 0.48 }, inactiveText: { color: 'rgba(255,244,208,0.28)' },
  saleRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 10 }, saleIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' }, saleIconVoided: { backgroundColor: 'rgba(240,139,136,0.08)' }, saleRowContent: { flex: 1, minWidth: 0 }, saleRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, saleStatusText: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }, saleStatusVoided: { color: C.red }, saleMetaLine: { color: 'rgba(255,244,208,0.46)', fontFamily: SANS, fontSize: 10, marginTop: 5 }, saleAmountSide: { alignItems: 'flex-end', gap: 2 }, amount: { color: C.goldLight, fontFamily: SERIF, fontSize: 14, maxWidth: '38%' },
  directoryRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, directoryMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }, payButton: { minHeight: 32, borderRadius: 10, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold }, operationButton: { minHeight: 32, borderRadius: 10, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold }, payButtonText: { color: C.void, fontFamily: SANS, fontSize: 9, fontWeight: '700' }, avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.goldLight, fontFamily: SERIF, fontSize: 17 },
  flowHero: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 12, marginBottom: 5 }, flowHeroSide: { flex: 1, minWidth: 0 }, flowHeroLabel: { color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }, flowHeroValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 16, marginTop: 4 }, flowHeroMeta: { color: 'rgba(255,244,208,0.44)', fontFamily: SANS, fontSize: 9, marginTop: 3 }, stockSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 12, marginBottom: 3 }, saleSummary: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 11, marginBottom: 4 }, directoryHero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 13, marginBottom: 5 }, directoryHeroAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(233,200,119,0.14)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }, directoryHeroAvatarText: { color: C.goldLight, fontFamily: SERIF, fontSize: 17 }, directoryHeroTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 17 }, formSectionTitle: { color: 'rgba(233,200,119,0.62)', fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1.3, marginTop: 17, marginBottom: 1, textTransform: 'uppercase' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  drawerPanel: { width: '84%', maxWidth: 420, height: '100%', backgroundColor: '#090B12', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.line, paddingHorizontal: 18 },
  drawerScroll: { flex: 1 },
  drawerContent: { paddingTop: 14, paddingBottom: 20 },
  balanceCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 16, marginBottom: 14 }, eyebrow: { color: 'rgba(233,200,119,0.64)', fontFamily: SANS, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' }, balance: { color: C.goldLight, fontFamily: SERIF, fontSize: 26, marginTop: 7 }, drawerItem: { minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 }, drawerItemActive: { backgroundColor: C.glass }, drawerText: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 14 },
  filterRows: { marginTop: 14 }, filterRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 3 }, secondaryButton: { minHeight: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, link: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' }, dangerLink: { color: '#F08B88', fontFamily: SANS, fontSize: 11, fontWeight: '700' }, helper: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, marginTop: 8 }, sectionTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 17, marginTop: 20, marginBottom: 2 },
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, inlineMain: { flex: 1, minWidth: 0 }, priceRow: { flexDirection: 'row', gap: 10 }, priceColumn: { flex: 1, minWidth: 0 }, moreHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, picturePicker: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, pictureBox: { width: 52, height: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, categoryIconPicker: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.16)', backgroundColor: 'rgba(233,200,119,0.035)', padding: 10, marginTop: 11 }, categoryIconHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, subLabel: { flex: 1, color: 'rgba(233,200,119,0.72)', fontFamily: SANS, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.35 }, categorySelectedIcon: { width: 34, height: 34, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.26)', backgroundColor: 'rgba(233,200,119,0.12)', alignItems: 'center', justifyContent: 'center' }, categoryIconChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, categoryIconChoice: { width: 46, height: 46, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center' }, categoryIconChoiceActive: { backgroundColor: C.gold, borderColor: C.gold }, categoryIconSelectedMark: { position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' }, categoryRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, categoryListIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' }, categoryRowText: { flex: 1, minWidth: 0 },
  historyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, positive: { color: C.gold, fontFamily: SERIF, fontSize: 14 }, negative: { color: '#F08B88', fontFamily: SERIF, fontSize: 14 },
  saleProduct: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, cartRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, quantityButton: { width: 44, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, quantityText: { color: C.gold, fontSize: 20 }, quantityValue: { minWidth: 22, color: C.goldLight, fontFamily: SANS, fontSize: 12, textAlign: 'center' }, priceLink: { color: C.gold, fontFamily: SANS, fontSize: 10, marginTop: 4 }, totalRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 8 }, totalLabel: { color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '700' }, totalValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 22 }, error: { color: '#F08B88', fontFamily: SANS, fontSize: 11, marginTop: 10 },
  reportPeriodCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 14, marginBottom: 10 }, reportPeriodTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 17, marginBottom: 2 }, reportDateRow: { flexDirection: 'row', gap: 8 }, reportDateColumn: { flex: 1, minWidth: 0 }, reportRangeLabel: { color: 'rgba(255,244,208,0.56)', fontFamily: SANS, fontSize: 10, marginTop: 10 }, reportOption: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, reportIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.09)', alignItems: 'center', justifyContent: 'center' }, reportRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, backRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, metric: { minHeight: 220, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, metricNumber: { color: C.goldLight, fontFamily: SERIF, fontSize: 44 }, metricAmount: { color: C.gold, fontFamily: SERIF, fontSize: 22, marginTop: 10 }, detail: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, dangerButton: { minHeight: 48, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: '#F08B88', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  reportExportCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 14, marginBottom: 8 }, reportExportHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, reportExportActions: { flexDirection: 'row', gap: 8, marginTop: 13 }, exportButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, exportButtonText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '800' }, exportButtonSecondary: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, exportButtonSecondaryText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '800' },
  storeStatsContent: { width: '100%', maxWidth: 720, alignSelf: 'center' }, storeStatsRange: { height: 48, flexDirection: 'row', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 4 }, storeStatsRangeOption: { flex: 1, minWidth: 0, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, storeStatsRangeOptionActive: { backgroundColor: 'rgba(233,200,119,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.42)' }, storeStatsRangeText: { maxWidth: '100%', color: C.textSubtle, fontFamily: SANS, fontSize: 9, textAlign: 'center' }, storeStatsRangeTextActive: { color: C.goldLight, fontWeight: '700' }, storeStatsRangeLabel: { color: C.textSubtle, fontFamily: SANS, fontSize: 9.5, textAlign: 'center', marginTop: 8, textTransform: 'capitalize' },
  storeStatsHero: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.22)', padding: 16, marginTop: 12, overflow: 'hidden' }, storeStatsHeroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, storeStatsLabel: { color: C.textSubtle, fontFamily: SANS, fontSize: 8.5, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' }, storeStatsNet: { width: '100%', fontFamily: SERIF, fontSize: 29, marginTop: 6 }, storeStatsBadge: { maxWidth: '42%', minHeight: 42, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(9,11,18,0.72)', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9 }, storeStatsBadgeValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 15 }, storeStatsBadgeLabel: { flexShrink: 1, color: C.textSubtle, fontFamily: SANS, fontSize: 8 }, storeStatsComparisonTitle: { color: C.textSubtle, fontFamily: SANS, fontSize: 8, letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 11 }, storeStatsComparisonRow: { flexDirection: 'row', gap: 8, marginTop: 6 }, storeStatsComparison: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 12, backgroundColor: 'rgba(9,11,18,0.48)', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9 }, storeStatsComparisonValue: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700', marginTop: 2 }, storeStatsComparisonLabel: { color: C.textSubtle, fontFamily: SANS, fontSize: 8.5 }, storeStatsHeroMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }, storeStatsHeroMetric: { flex: 1, minWidth: 0 }, storeStatsHeroValue: { fontFamily: SERIF, fontSize: 15, marginTop: 5 },
  storeStatsComparisonRowNarrow: { flexDirection: 'column' },
  storeStatsComparisonNarrow: { flex: 0, width: '100%' },
  storeStatsMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 9 }, storeStatsMetricCard: { width: '48.5%', minHeight: 118, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 12, justifyContent: 'space-between' }, storeStatsMetricCardWide: { width: '100%' }, storeStatsMetricIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }, storeStatsMetricLabel: { color: C.textSubtle, fontFamily: SANS, fontSize: 8.5, lineHeight: 12, textTransform: 'uppercase' }, storeStatsMetricValue: { width: '100%', color: C.goldLight, fontFamily: SERIF, fontSize: 17, marginTop: 5 }, storeStatsMetricMeta: { color: C.textSubtle, fontFamily: SANS, fontSize: 9, marginTop: 3 },
  storeStatsChartCard: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.62)', paddingHorizontal: 13, overflow: 'hidden' }, storeStatsChart: { minHeight: 112, flexDirection: 'row', alignItems: 'flex-end', paddingTop: 16 }, storeStatsFlowColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 }, storeStatsFlowBars: { width: '100%', height: 80, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, storeStatsFlowBar: { width: 7, borderRadius: 4 }, storeStatsFlowLabel: { width: '100%', height: 14, color: C.textSubtle, fontFamily: SANS, fontSize: 7.5, textAlign: 'center' }, flowLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 12, paddingBottom: 13 }, flowLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, flowLegendChip: { width: 8, height: 8, borderRadius: 4 }, flowLegendText: { color: C.textSubtle, fontFamily: SANS, fontSize: 9 }, storeStatsEmpty: { minHeight: 116, alignItems: 'center', justifyContent: 'center', gap: 6 },
  storeStatsProductRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 10 }, storeStatsProductRowTop: { marginHorizontal: -13, paddingHorizontal: 13, backgroundColor: 'rgba(233,200,119,0.055)' }, storeStatsRank: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' }, storeStatsRankTop: { backgroundColor: C.gold }, storeStatsRankText: { color: C.gold, fontFamily: SERIF, fontSize: 13 }, storeStatsRankTextTop: { color: C.void, fontWeight: '800' }, storeStatsProductNameTop: { color: C.goldLight, fontFamily: SERIF, fontSize: 15 }, storeStatsProductTrack: { height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden', marginTop: 7 }, storeStatsProductFill: { height: 4, borderRadius: 2 },
  viewIntro: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }, viewIntroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' }, viewIntroTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 18 }, viewIntroCopy: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 10, lineHeight: 15, marginTop: 3 }, movementSummary: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 12, marginBottom: 12 }, movementMetric: { flex: 1, minWidth: 0 }, movementMetricLabel: { color: 'rgba(233,200,119,0.55)', fontFamily: SANS, fontSize: 8, letterSpacing: 0.6, marginBottom: 4 }, movementMetricValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 13 }, movementMetricValueNegative: { color: C.red, fontFamily: SERIF, fontSize: 13 }, movementMetricDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: C.line, marginHorizontal: 7 }, movementList: { marginTop: 16 }, movementRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 }, movementIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, movementIconIncome: { backgroundColor: 'rgba(233,200,119,0.1)' }, movementIconExpense: { backgroundColor: 'rgba(240,139,136,0.1)' },
  settingsContent: { width: '100%', maxWidth: 720, alignSelf: 'center' }, settingsCard: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.72)', padding: 14 }, buttonDisabled: { opacity: 0.38 }, settingsBackupCopy: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11, lineHeight: 17, paddingBottom: 8 }, settingsAction: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)', paddingVertical: 9 }, settingsActionLast: { borderBottomWidth: 0 }, settingsActionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' }, settingsActionText: { color: C.goldLight, fontFamily: SANS, fontSize: 12.5, fontWeight: '600' }, settingsActionCopy: { color: C.textSubtle, fontFamily: SANS, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  empty: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, emptyIcon: { width: 50, height: 50, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13, textAlign: 'center' }, emptyCopy: { maxWidth: 280, color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  fab: { position: 'absolute', right: 31, bottom: 25, width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, workspaceFab: { position: 'absolute', right: 32, width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, workspaceFabStacked: { bottom: 81 }, workspaceFabSolo: { bottom: 25 },
  reportRangeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 10 }, reportRangeOption: { width: '31.5%', minHeight: 44, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.025)', paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }, reportRangeOptionActive: { backgroundColor: C.gold, borderColor: C.gold }, reportRangeOptionText: { maxWidth: '100%', color: C.textSubtle, fontFamily: SANS, fontSize: 9, lineHeight: 12, fontWeight: '600', textAlign: 'center' }, reportRangeOptionTextActive: { color: C.void, fontWeight: '800' },
  importBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.76)' }, importCard: { width: '100%', maxWidth: 330, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 24, alignItems: 'center' }, importTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 21, marginTop: 14, textAlign: 'center' }, importCopy: { color: C.textSubtle, fontFamily: SANS, fontSize: 11, lineHeight: 17, marginTop: 7, textAlign: 'center' },
  defaultOperations: { marginTop: 4 }, operationRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, operationFields: { flex: 1, minWidth: 0 }, operationRemove: { width: 42, height: 43, alignItems: 'center', justifyContent: 'center' }, archiveRestoreButton: { maxWidth: 120, minHeight: 36, borderRadius: 11, backgroundColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9 }, archiveRestoreText: { flexShrink: 1, color: C.void, fontFamily: SANS, fontSize: 8.5, fontWeight: '800' },
}));
