import React from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { useFinance } from '../core/finance/FinanceContext';
import type { PaymentMethod, StoreProduct, StoreProductType, StoreSale, StoreSaleItem, StoreStockMovementType } from '../core/finance/types';
import { currencyRate } from '../core/finance/currency';
import { C, SANS, SERIF } from '../theme/luxury';
import DateSelect from '../components/DateSelect';

type StoreView = 'inventory' | 'sales' | 'employees' | 'clients' | 'services';
type AddStoreTab = 'product' | 'funding';
type StockAction = 'entry' | 'exit' | 'adjustment';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ProductDraft = { key: string; name: string; type: StoreProductType; unit: string; category: string; purchasePrice: string; salePrice: string; additionalSalePrices: string; picture: string; stock: string; reservedQuantity: string; stockMinimum: string; expirationDate: string; additionalInfo: string };
type CartItem = StoreSaleItem;

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const numberValue = (value: string) => Number(value.replace(',', '.'));
const STORE_FALLBACKS: Record<string, string> = {
  'finance.store.productKey': 'Product key', 'finance.store.productKeyPlaceholder': 'e.g. PROD-001', 'finance.store.unit': 'Unit', 'finance.store.unitPlaceholder': 'e.g. piece, kg or hour',
  'finance.store.purchasePrice': 'Purchase price', 'finance.store.additionalSalePrices': 'Additional sale prices', 'finance.store.additionalSalePricesPlaceholder': 'Separate prices with commas',
  'finance.store.picture': 'Picture (optional)', 'finance.store.picturePlaceholder': 'Image URI (optional)', 'finance.store.quantityReserve': 'Reserved quantity',
  'finance.store.expiration': 'Expiration (optional)', 'finance.store.clearExpiration': 'Remove expiration', 'finance.store.noExpiration': 'No expiration',
  'finance.store.additionalInfo': 'Additional product information', 'finance.store.additionalInfoPlaceholder': 'Notes, measurements or details',
  'finance.storeFilters.search': 'Search by name or code', 'finance.storeFilters.filters': 'Filters', 'finance.storeFilters.status': 'Status',
  'finance.storeFilters.active': 'Active', 'finance.storeFilters.inactive': 'Inactive', 'finance.storeFilters.clear': 'Clear filters',
  'finance.storeDrawer.totalInvested': 'Total invested', 'finance.storeDrawer.inventoryValue': 'Business balance',
  'finance.storePurchase.purchaseFrom': 'Purchase paid from', 'finance.storePurchase.none': 'No account', 'finance.storePurchase.insufficientBusiness': 'The Business account does not have enough balance.', 'finance.storePurchase.insufficientAccount': 'The selected account does not have enough balance.', 'finance.storePurchase.sourceRequired': 'Select a valid purchase source.', 'finance.storePurchase.inventoryPurchase': 'Inventory purchase',
  'finance.storeFunding.addMenuTitle': 'Add to store', 'finance.storeFunding.title': 'Fund business', 'finance.storeFunding.account': 'Fund from', 'finance.storeFunding.amount': 'Amount to add', 'finance.storeFunding.note': 'Note (optional)', 'finance.storeFunding.save': 'Add funds', 'finance.storeFunding.insufficient': 'The selected account does not have enough balance.', 'finance.storeFunding.missingRate': 'Configure a valid exchange rate for these currencies.', 'finance.storeFunding.invalid': 'Enter a valid amount.',
  'finance.store.errors.key': 'Enter a product key.', 'finance.store.errors.duplicateKey': 'That product key is already in use.', 'finance.store.errors.reserve': 'Reserved quantity cannot exceed available stock.',
};

function money(value: number, currency: string) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function MenuGlyph() {
  return <View style={styles.menuGlyph}><View style={styles.menuLineWide} /><View style={styles.menuLine} /><View style={styles.menuLineWide} /></View>;
}

function Field({ title, value, onChangeText, placeholder, numeric = false, multiline = false }: { title: string; value: string; onChangeText: (value: string) => void; placeholder?: string; numeric?: boolean; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{title}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,244,208,0.3)" keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} style={[styles.input, multiline && styles.multiline]} accessibilityLabel={title} />{value.trim() && title.toLowerCase().includes('picture') && <Image source={{ uri: value.trim() }} style={styles.picturePreview} resizeMode="cover" />}</View>;
}

function Choice({ values, value, labels, onChange }: { values: string[]; value: string; labels: Record<string, string>; onChange: (value: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>{values.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[styles.choice, value === item && styles.choiceActive]} accessibilityRole="radio" accessibilityState={{ selected: value === item }} accessibilityLabel={labels[item]}><Text style={[styles.choiceText, value === item && styles.choiceTextActive]}>{labels[item]}</Text></Pressable>)}</ScrollView>;
}

function StoreSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.sheet}><Pressable style={styles.sheetDismiss} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('finance.close', { defaultValue: 'Close' })}><Ionicons name="close" size={20} color={C.goldLight} /></Pressable><ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView></View></KeyboardAvoidingView></Modal>;
}

export default function StoreScreen() {
  const { t: translate } = useTranslation();
  const t = (key: string, options?: { defaultValue?: string }) => translate(key, { ...options, defaultValue: options?.defaultValue ?? STORE_FALLBACKS[key] });
  const finance = useFinance();
  const { state } = finance;
  const store = state.store;
  const storeText = (key: string, fallback: string) => t(`finance.store.${key}`, { defaultValue: fallback });
  const currency = store.currency || state.settings.preferredCurrency || 'USD';
  const [view, setView] = React.useState<StoreView>('inventory');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const [addTab, setAddTab] = React.useState<AddStoreTab>('product');
  const [productOpen, setProductOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<StoreProduct | null>(null);
  const [purchaseAccountId, setPurchaseAccountId] = React.useState('store-business');
  const [productDraft, setProductDraft] = React.useState<ProductDraft>({ key: '', name: '', type: 'product', unit: 'unit', category: '', purchasePrice: '', salePrice: '', additionalSalePrices: '', picture: '', stock: '', reservedQuantity: '0', stockMinimum: '0', expirationDate: '', additionalInfo: '' });
  const [productError, setProductError] = React.useState('');
  const [productQuery, setProductQuery] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'inactive' | ''>('');
  const [stockFilter, setStockFilter] = React.useState<'low' | ''>('');
  const [stockProduct, setStockProduct] = React.useState<StoreProduct | null>(null);
  const [stockAction, setStockAction] = React.useState<StockAction>('entry');
  const [stockQuantity, setStockQuantity] = React.useState('');
  const [stockNote, setStockNote] = React.useState('');
  const [stockError, setStockError] = React.useState('');
  const [saleOpen, setSaleOpen] = React.useState(false);
  const [saleQuery, setSaleQuery] = React.useState('');
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | ''>('');
  const [saleError, setSaleError] = React.useState('');
  const [selectedSale, setSelectedSale] = React.useState<StoreSale | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [storeName, setStoreName] = React.useState(store.name);
  const [categoryDraft, setCategoryDraft] = React.useState('');
  const [fundingOpen, setFundingOpen] = React.useState(false);
  const [fundingAccountId, setFundingAccountId] = React.useState('none');
  const [fundingAmount, setFundingAmount] = React.useState('');
  const [fundingNote, setFundingNote] = React.useState('');
  const [fundingError, setFundingError] = React.useState('');

  const stockFor = React.useCallback((productId: string) => {
    const product = store.products.find((item) => item.id === productId);
    return (product?.initialStock ?? 0) + store.stockMovements.filter((movement) => movement.productId === productId).reduce((total, movement) => total + movement.quantity, 0);
  }, [store.products, store.stockMovements]);
  const availableFor = React.useCallback((product: StoreProduct) => Math.max(0, stockFor(product.id) - product.reservedQuantity), [stockFor]);
  const activeProducts = store.products.filter((product) => product.active);
  const filteredProducts = store.products.filter((product) => {
    const query = productQuery.trim().toLowerCase();
    const matchesQuery = !query || `${product.key} ${product.name} ${product.sku ?? ''}`.toLowerCase().includes(query);
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? product.active : !product.active);
    const matchesStock = !stockFilter || (product.type === 'product' && stockFor(product.id) <= product.stockMinimum);
    return matchesQuery && matchesCategory && matchesStatus && matchesStock;
  });
  const visibleProducts = filteredProducts.filter((product) => view === 'services' ? product.type === 'service' : product.type === 'product');
  const filtersActive = Boolean(categoryFilter || statusFilter || (view === 'inventory' && stockFilter));
  const filteredSaleProducts = activeProducts.filter((product) => `${product.key} ${product.name} ${product.sku ?? ''}`.toLowerCase().includes(saleQuery.trim().toLowerCase()));
  const cartTotal = cart.reduce((total, item) => total + item.total, 0);
  const totalInvested = store.products.filter((product) => product.type === 'product').reduce((total, product) => total + (product.purchasePrice ?? 0) * stockFor(product.id), 0);
  const accountBalance = React.useCallback((accountId: string) => {
    const account = state.accounts.find((item) => item.id === accountId);
    if (!account) return 0;
    return state.transactions.filter((item) => item.accountId === accountId && item.status !== 'void').reduce((total, item) => item.kind === 'income' || item.kind === 'adjustment' ? total + item.amount : total - item.amount, account.openingBalance);
  }, [state.accounts, state.transactions]);
  const purchaseSources = [
    { id: 'none', name: t('finance.storePurchase.none') },
    { id: store.businessAccount.id, name: t('finance.storeAccount.name', { defaultValue: store.businessAccount.name }) },
    ...state.accounts.filter((item) => !item.archived).map((item) => ({ id: item.id, name: item.name })),
  ];
  const fundingSources = [
    { id: 'none', name: t('finance.storePurchase.none') },
    ...state.accounts.filter((item) => !item.archived).map((item) => ({ id: item.id, name: item.name })),
  ];

  const switchWorkspace = (storeActive: boolean) => {
    setDrawerOpen(false);
    if (storeActive) return;
    finance.updateState((current) => ({ ...current, settings: { ...current.settings, activeWorkspace: 'personal' } }));
  };

  const openProduct = (product?: StoreProduct) => {
    setEditingProduct(product ?? null);
    setProductError('');
    setCategoryDraft('');
    setPurchaseAccountId(product ? 'none' : store.businessAccount.id);
    setProductDraft(product ? {
      key: product.key, name: product.name, type: product.type, unit: product.unit, category: product.category, purchasePrice: product.purchasePrice ? String(product.purchasePrice) : '', salePrice: String(product.salePrice), additionalSalePrices: product.additionalSalePrices.join(', '), picture: product.picture ?? '', stock: product.initialStock ? String(product.initialStock) : '', reservedQuantity: String(product.reservedQuantity), stockMinimum: String(product.stockMinimum), expirationDate: product.expirationDate ?? '', additionalInfo: product.additionalInfo ?? '',
    } : { key: '', name: '', type: view === 'services' ? 'service' : 'product', unit: 'unit', category: store.categories[0] ?? '', purchasePrice: '', salePrice: '', additionalSalePrices: '', picture: '', stock: '', reservedQuantity: '0', stockMinimum: '0', expirationDate: '', additionalInfo: '' });
    setProductOpen(true);
  };

  const openAddMenu = () => {
    setAddTab('product');
    setAddMenuOpen(true);
  };

  const openFunding = () => {
    setFundingAccountId(state.accounts.find((item) => !item.archived)?.id ?? 'none');
    setFundingAmount('');
    setFundingNote('');
    setFundingError('');
    setAddMenuOpen(false);
    setFundingOpen(true);
  };

  const saveFunding = () => {
    const amount = numberValue(fundingAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setFundingError(t('finance.storeFunding.invalid'));
    const account = state.accounts.find((item) => item.id === fundingAccountId && !item.archived);
    if (!account) {
      finance.updateState((current) => ({ ...current, store: { ...current.store, businessAccount: { ...current.store.businessAccount, balance: current.store.businessAccount.balance + amount } } }));
      setFundingOpen(false);
      return;
    }
    const sourceRate = currencyRate(store.currency, account.currency, state.settings.exchangeRates ?? { USD: 1 });
    if (!sourceRate) return setFundingError(t('finance.storeFunding.missingRate'));
    const sourceAmount = amount * sourceRate;
    if (accountBalance(account.id) < sourceAmount) return setFundingError(t('finance.storeFunding.insufficient'));
    finance.addTransfer({
      id: uid('store-funding'), fromAccountId: account.id, toAccountId: store.businessAccount.id,
      fromAmount: sourceAmount, toAmount: amount, fromCurrency: account.currency, toCurrency: store.currency,
      rate: amount / sourceAmount, fee: 0, date: new Date().toISOString(), note: fundingNote.trim(), status: 'cleared',
    });
    setFundingOpen(false);
  };

  const saveProduct = () => {
    const key = productDraft.key.trim();
    const name = productDraft.name.trim();
    const purchasePrice = numberValue(productDraft.purchasePrice || '0');
    const salePrice = numberValue(productDraft.salePrice);
    const initialStock = numberValue(productDraft.stock || '0');
    const reservedQuantity = numberValue(productDraft.reservedQuantity || '0');
    const stockMinimum = numberValue(productDraft.stockMinimum || '0');
    const additionalSalePrices = productDraft.additionalSalePrices.split(',').map((value) => numberValue(value.trim())).filter((value) => Number.isFinite(value) && value >= 0);
    if (!name) return setProductError(t('finance.store.errors.name'));
    if (!key) return setProductError(t('finance.store.errors.key'));
    if (store.products.some((product) => product.key.toLowerCase() === key.toLowerCase() && product.id !== editingProduct?.id)) return setProductError(t('finance.store.errors.duplicateKey'));
    if (!Number.isFinite(salePrice) || salePrice < 0) return setProductError(t('finance.store.errors.price'));
    if (![purchasePrice, initialStock, reservedQuantity, stockMinimum].every((value) => Number.isFinite(value) && value >= 0) || additionalSalePrices.length !== productDraft.additionalSalePrices.split(',').filter((value) => value.trim()).length) return setProductError(t('finance.store.errors.stock'));
    if ((editingProduct ? stockFor(editingProduct.id) : initialStock) < reservedQuantity) return setProductError(t('finance.store.errors.reserve'));
    const purchaseTotal = !editingProduct && productDraft.type === 'product' ? purchasePrice * initialStock : 0;
    const purchaseSource = purchaseSources.find((source) => source.id === purchaseAccountId);
    const sourceAccount = state.accounts.find((account) => account.id === purchaseAccountId && !account.archived);
    const purchaseRate = sourceAccount ? currencyRate(store.currency, sourceAccount.currency, state.settings.exchangeRates ?? { USD: 1 }) : 1;
    const accountPurchaseAmount = purchaseTotal * (purchaseRate ?? 0);
    if (purchaseTotal > 0 && purchaseAccountId !== 'none' && !purchaseSource) return setProductError(t('finance.storePurchase.sourceRequired'));
    if (purchaseTotal > 0 && purchaseAccountId !== 'none' && purchaseAccountId !== store.businessAccount.id && !purchaseRate) return setProductError(t('finance.releaseErrors.missingRate'));
    if (purchaseTotal > 0 && purchaseAccountId === store.businessAccount.id && store.businessAccount.balance < purchaseTotal) return setProductError(t('finance.storePurchase.insufficientBusiness'));
    if (purchaseTotal > 0 && sourceAccount && accountBalance(sourceAccount.id) < accountPurchaseAmount) return setProductError(t('finance.storePurchase.insufficientAccount'));
    const category = productDraft.category.trim() || t('finance.store.generalCategory');
    const values = { key, name, type: productDraft.type, unit: productDraft.unit.trim() || 'unit', category, sku: key, salePrice, purchasePrice, additionalSalePrices, picture: productDraft.picture.trim() || undefined, initialStock: editingProduct ? editingProduct.initialStock : 0, reservedQuantity: productDraft.type === 'service' ? 0 : reservedQuantity, stockMinimum: productDraft.type === 'service' ? 0 : stockMinimum, expirationDate: productDraft.expirationDate || undefined, additionalInfo: productDraft.additionalInfo.trim() || undefined, active: editingProduct?.active ?? true };
    const product = editingProduct ? { ...editingProduct, ...values } : { id: uid('store-product'), ...values };
    finance.updateState((current) => {
      const categories = current.store.categories.includes(category) ? current.store.categories : [...current.store.categories, category];
      const products = editingProduct ? current.store.products.map((item) => item.id === product.id ? product : item) : [...current.store.products, product];
      const stockMovements = !editingProduct && initialStock > 0 ? [...current.store.stockMovements, { id: uid('store-stock'), productId: product.id, type: 'initial' as const, quantity: initialStock, date: new Date().toISOString(), note: t('finance.store.initialStock') }] : current.store.stockMovements;
      const date = new Date().toISOString();
      const purchaseTransaction = purchaseTotal > 0 && sourceAccount ? {
        id: uid('store-purchase'), accountId: sourceAccount.id, kind: 'expense' as const, amount: accountPurchaseAmount, currency: sourceAccount.currency, date,
        payee: product.name, category: 'other', paymentMethod: 'bank' as const, status: 'cleared' as const, reference: product.id, description: t('finance.storePurchase.inventoryPurchase'),
      } : null;
      const businessAccount = { ...current.store.businessAccount, balance: current.store.businessAccount.balance - (purchaseTotal > 0 && purchaseAccountId === current.store.businessAccount.id ? purchaseTotal : 0) };
      return { ...current, transactions: purchaseTransaction ? [purchaseTransaction, ...current.transactions] : current.transactions, store: { ...current.store, setupCompleted: true, categories, products, stockMovements, businessAccount } };
    });
    setProductOpen(false);
  };

  const addCategory = () => {
    const category = categoryDraft.trim();
    if (!category || store.categories.includes(category)) return;
    finance.updateState((current) => ({ ...current, store: { ...current.store, categories: [...current.store.categories, category] } }));
    setProductDraft((current) => ({ ...current, category }));
    setCategoryDraft('');
  };

  const saveStockMovement = () => {
    if (!stockProduct) return;
    const value = numberValue(stockQuantity);
    if (!Number.isFinite(value) || value < 0 || (stockAction !== 'adjustment' && value === 0)) return setStockError(t('finance.store.errors.stock'));
    const currentStock = stockFor(stockProduct.id);
    const delta = stockAction === 'entry' ? value : stockAction === 'exit' ? -value : value - currentStock;
    if (currentStock + delta < 0) return setStockError(t('finance.store.errors.insufficientStock'));
    const movementType: StoreStockMovementType = stockAction;
    finance.updateState((current) => ({ ...current, store: { ...current.store, stockMovements: [...current.store.stockMovements, { id: uid('store-stock'), productId: stockProduct.id, type: movementType, quantity: delta, date: new Date().toISOString(), note: stockNote.trim() }] } }));
    setStockProduct(null);
    setStockQuantity('');
    setStockNote('');
    setStockError('');
  };

  const addToCart = (product: StoreProduct) => {
    const existing = cart.find((item) => item.productId === product.id);
    const nextQuantity = (existing?.quantity ?? 0) + 1;
    if (product.type === 'product' && nextQuantity > availableFor(product)) return setSaleError(t('finance.store.errors.insufficientStock'));
    const item: CartItem = { productId: product.id, name: product.name, type: product.type, quantity: nextQuantity, unitPrice: product.salePrice, total: nextQuantity * product.salePrice };
    setCart((current) => existing ? current.map((line) => line.productId === product.id ? item : line) : [...current, item]);
    setSaleError('');
  };

  const changeCartQuantity = (productId: string, delta: number) => {
    const item = cart.find((line) => line.productId === productId);
    const product = activeProducts.find((entry) => entry.id === productId);
    if (!item || !product) return;
    const quantity = item.quantity + delta;
    if (quantity <= 0) return setCart((current) => current.filter((line) => line.productId !== productId));
    if (product.type === 'product' && quantity > availableFor(product)) return setSaleError(t('finance.store.errors.insufficientStock'));
    setCart((current) => current.map((line) => line.productId === productId ? { ...line, quantity, total: quantity * line.unitPrice } : line));
  };

  const completeSale = () => {
    if (!cart.length) return setSaleError(t('finance.store.errors.emptySale'));
    const saleId = uid('store-sale');
    const sale: StoreSale = { id: saleId, date: new Date().toISOString(), items: cart, total: cartTotal, paymentMethod: paymentMethod || undefined, status: 'completed', note: '' };
    const movements = cart.filter((item) => item.type === 'product').map((item) => ({ id: uid('store-stock'), productId: item.productId, type: 'sale' as const, quantity: -item.quantity, date: sale.date, note: t('finance.store.saleStock'), saleId }));
    finance.updateState((current) => ({ ...current, store: { ...current.store, setupCompleted: true, sales: [sale, ...current.store.sales], stockMovements: [...current.store.stockMovements, ...movements], businessAccount: { ...current.store.businessAccount, balance: current.store.businessAccount.balance + sale.total } } }));
    setCart([]);
    setPaymentMethod('');
    setSaleError('');
    setSaleOpen(false);
  };

  const voidSale = (sale: StoreSale) => {
    Alert.alert(t('finance.store.voidSale'), t('finance.store.voidSaleConfirm'), [{ text: t('finance.cancel'), style: 'cancel' }, { text: t('finance.deleteAction'), style: 'destructive', onPress: () => finance.updateState((current) => {
      if (sale.status === 'void') return current;
      const reversals = sale.items.filter((item) => item.type === 'product').map((item) => ({ id: uid('store-stock'), productId: item.productId, type: 'saleReversal' as const, quantity: item.quantity, date: new Date().toISOString(), note: t('finance.store.saleReversal'), saleId: sale.id }));
      return { ...current, store: { ...current.store, sales: current.store.sales.map((entry) => entry.id === sale.id ? { ...entry, status: 'void' as const } : entry), stockMovements: [...current.store.stockMovements, ...reversals], businessAccount: { ...current.store.businessAccount, balance: current.store.businessAccount.balance - sale.total } } };
    }) }]);
  };

  const saveSettings = () => {
    finance.updateState((current) => ({ ...current, store: { ...current.store, name: storeName.trim(), setupCompleted: true } }));
    setSettingsOpen(false);
  };

  const openSale = () => { setCart([]); setSaleQuery(''); setPaymentMethod(''); setSaleError(''); setSaleOpen(true); };
  const renderProducts = () => <View style={styles.productView}>
    <View style={styles.searchContainer}><View style={styles.searchRow}><Ionicons name="search-outline" size={18} color="rgba(255,244,208,0.4)" /><TextInput value={productQuery} onChangeText={setProductQuery} placeholder={t('finance.storeFilters.search')} placeholderTextColor="rgba(255,244,208,0.3)" style={styles.searchInput} accessibilityLabel={t('finance.storeFilters.search')} /><Pressable style={[styles.filterButton, filtersActive && styles.filterButtonActive]} onPress={() => setFilterOpen(true)} accessibilityLabel={t('finance.storeFilters.filters')}><Ionicons name="options-outline" size={18} color={filtersActive ? C.void : C.gold} />{filtersActive && <View style={styles.filterDot} />}</Pressable></View></View>
    <ScrollView style={styles.productScroll} contentContainerStyle={[styles.productList, !visibleProducts.length && styles.productListEmpty]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    {visibleProducts.map((product) => <ProductRow key={product.id} product={product} stock={stockFor(product.id)} available={availableFor(product)} currency={currency} onPress={() => openProduct(product)} onStock={() => { setStockProduct(product); setStockError(''); }} t={t} />)}
    {!visibleProducts.length && <View style={styles.productEmpty}><View style={styles.emptyDiamond} /><Text style={styles.productEmptyTitle}>{t('finance.store.noProducts')}</Text><Text style={styles.productEmptyCopy}>{t('finance.store.noProductsCopy')}</Text></View>}
    </ScrollView>
  </View>;

  const renderSales = () => <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable style={styles.primary} onPress={openSale}><Ionicons name="cart-outline" size={18} color={C.void} /><Text style={styles.primaryText}>{t('finance.store.newSale')}</Text></Pressable>
    {store.sales.map((sale) => <SaleRow key={sale.id} sale={sale} currency={currency} onPress={() => setSelectedSale(sale)} t={t} />)}
    {!store.sales.length && <View style={styles.empty}><Text style={styles.emptyTitle}>{t('finance.store.noSales')}</Text><Text style={styles.emptyBody}>{t('finance.store.noSalesCopy')}</Text></View>}
  </ScrollView>;

  const renderSimpleSection = (section: 'employees' | 'clients') => { const label = storeText(section, section === 'employees' ? 'Employees' : 'Clients'); return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.emptyModule}><Ionicons name={section === 'employees' ? 'people-outline' : 'person-outline'} size={32} color={C.gold} /><Text style={styles.sectionTitle}>{label}</Text><Text style={styles.emptyBody}>{storeText(`${section}Copy`, section === 'employees' ? 'Employee management is not enabled yet.' : 'Client management is not enabled yet.')}</Text></View></ScrollView>; };

  const title = view === 'inventory' ? storeText('inventory', 'Inventory') : view === 'sales' ? t('finance.store.sales') : view === 'services' ? storeText('services', 'Services') : view === 'employees' ? storeText('employees', 'Employees') : storeText('clients', 'Clients');

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><View style={styles.root}>
    <View style={styles.header}><Pressable style={styles.headerButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button" accessibilityLabel={t('finance.menu')}><MenuGlyph /></Pressable><View style={styles.headerCopy}><Text style={styles.headerTitle} numberOfLines={1}>{title}</Text><Text style={styles.headerSubtitle}>{t('finance.store.subtitle')}</Text></View><View style={styles.headerSpacer} /></View>
    <Animated.View key={view} entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(140).easing(Easing.in(Easing.cubic))} style={styles.screenTransition}>{view === 'inventory' || view === 'services' ? renderProducts() : view === 'sales' ? renderSales() : renderSimpleSection(view)}</Animated.View>
    <Pressable style={[styles.workspaceFab, (view === 'inventory' || view === 'services') ? styles.workspaceFabStacked : styles.workspaceFabSolo]} onPress={() => switchWorkspace(false)} accessibilityRole="button" accessibilityLabel={t('finance.workspace.personal')}><Ionicons name="wallet-outline" size={19} color={C.gold} /></Pressable>
    {(view === 'inventory' || view === 'services') && <Pressable style={styles.fab} onPress={openAddMenu} accessibilityRole="button" accessibilityLabel={t('finance.store.addProduct')}><Ionicons name="add" size={24} color={C.void} /></Pressable>}

    <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}><View style={styles.drawerBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} /><SafeAreaView style={styles.drawer} edges={['top', 'bottom']}><ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}><View style={styles.drawerStoreCard}><Text style={styles.drawerStoreEyebrow}>{t('finance.storeDrawer.totalInvested')}</Text><Text style={styles.drawerStoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{money(totalInvested, currency)}</Text><Text style={styles.drawerStoreCaption}>{t('finance.storeDrawer.inventoryValue')}: {money(store.businessAccount.balance, store.businessAccount.currency)}</Text></View><View style={styles.drawerNav}><DrawerItem icon="cube-outline" label={storeText('inventory', 'Inventory')} active={view === 'inventory'} onPress={() => { setView('inventory'); setStockFilter(''); setDrawerOpen(false); }} /><DrawerItem icon="people-outline" label={storeText('employees', 'Employees')} active={view === 'employees'} onPress={() => { setView('employees'); setDrawerOpen(false); }} /><DrawerItem icon="person-outline" label={storeText('clients', 'Clients')} active={view === 'clients'} onPress={() => { setView('clients'); setDrawerOpen(false); }} /><DrawerItem icon="construct-outline" label={storeText('services', 'Services')} active={view === 'services'} onPress={() => { setView('services'); setStockFilter(''); setDrawerOpen(false); }} /><DrawerItem icon="cart-outline" label={t('finance.store.sales')} active={view === 'sales'} onPress={() => { setView('sales'); setDrawerOpen(false); }} /><DrawerItem icon="settings-outline" label={t('finance.store.settings')} onPress={() => { setSettingsOpen(true); setDrawerOpen(false); }} /></View></ScrollView></SafeAreaView></View></Modal>

    <StoreSheet visible={addMenuOpen} onClose={() => setAddMenuOpen(false)}><Text style={styles.sheetTitle}>{t('finance.storeFunding.addMenuTitle')}</Text><View style={styles.addTabs}><Pressable style={[styles.addTab, addTab === 'product' && styles.addTabActive]} onPress={() => setAddTab('product')}><Ionicons name="cube-outline" size={17} color={addTab === 'product' ? C.void : C.gold} /><Text style={[styles.addTabText, addTab === 'product' && styles.addTabTextActive]}>{t('finance.storeFunding.productTab', { defaultValue: 'Product' })}</Text></Pressable><Pressable style={[styles.addTab, addTab === 'funding' && styles.addTabActive]} onPress={() => setAddTab('funding')}><Ionicons name="wallet-outline" size={17} color={addTab === 'funding' ? C.void : C.gold} /><Text style={[styles.addTabText, addTab === 'funding' && styles.addTabTextActive]}>{t('finance.storeFunding.tab', { defaultValue: 'Funding' })}</Text></Pressable></View><View style={styles.addTabPanel}>{addTab === 'product' ? <><Text style={styles.addPanelTitle}>{t('finance.store.addProduct')}</Text><Text style={styles.addPanelCopy}>{t('finance.storeFunding.productCopy', { defaultValue: 'Create a product, set its stock and choose how the purchase is paid.' })}</Text><Pressable style={styles.actionSave} onPress={() => { setAddMenuOpen(false); openProduct(); }}><Ionicons name="add" size={17} color={C.void} /><Text style={styles.actionSaveText}>{t('finance.store.addProduct')}</Text></Pressable></> : <><Text style={styles.addPanelTitle}>{t('finance.storeFunding.title')}</Text><Text style={styles.addPanelCopy}>{t('finance.storeFunding.copy', { defaultValue: 'Move money from a personal account to the business balance, or add it without linking an account.' })}</Text><Pressable style={styles.actionSave} onPress={openFunding}><Ionicons name="wallet-outline" size={17} color={C.void} /><Text style={styles.actionSaveText}>{t('finance.storeFunding.save')}</Text></Pressable></>}</View></StoreSheet>
    <StoreSheet visible={fundingOpen} onClose={() => setFundingOpen(false)}><Text style={styles.sheetTitle}>{t('finance.storeFunding.title')}</Text><Text style={styles.sheetCaption}>{t('finance.storeFunding.copy', { defaultValue: 'Add money to the business balance.' })}</Text><Text style={styles.fieldLabel}>{t('finance.storeFunding.account')}</Text><Choice values={fundingSources.map((source) => source.id)} value={fundingAccountId} labels={Object.fromEntries(fundingSources.map((source) => [source.id, source.name]))} onChange={setFundingAccountId} /><Field title={t('finance.storeFunding.amount')} value={fundingAmount} onChangeText={(value) => { setFundingAmount(value); setFundingError(''); }} numeric placeholder={money(0, currency)} /><Field title={t('finance.storeFunding.note')} value={fundingNote} onChangeText={setFundingNote} /><Text style={styles.sheetCaption}>{t('finance.store.currency')}: {currency}</Text>{Boolean(fundingError) && <Text style={styles.error}>{fundingError}</Text>}<View style={styles.modalActions}><View style={styles.actionMainRow}><Pressable style={styles.actionCancel} onPress={() => setFundingOpen(false)}><Text style={styles.actionCancelText}>{t('finance.cancel')}</Text></Pressable><Pressable style={styles.actionSave} onPress={saveFunding}><Text style={styles.actionSaveText}>{t('finance.storeFunding.save')}</Text></Pressable></View></View></StoreSheet>
    <StoreSheet visible={filterOpen} onClose={() => setFilterOpen(false)}><Text style={styles.sheetTitle}>{t('finance.storeFilters.filters')}</Text><Text style={styles.fieldLabel}>{t('finance.store.category')}</Text><Choice values={['', ...store.categories]} value={categoryFilter} labels={{ '': t('finance.filters.all'), ...Object.fromEntries(store.categories.map((item) => [item, item])) }} onChange={setCategoryFilter} /><Text style={styles.fieldLabel}>{t('finance.storeFilters.status')}</Text><Choice values={['', 'active', 'inactive']} value={statusFilter} labels={{ '': t('finance.filters.all'), active: t('finance.storeFilters.active'), inactive: t('finance.storeFilters.inactive') }} onChange={(value) => setStatusFilter(value as 'active' | 'inactive' | '')} />{view === 'inventory' && <><Text style={styles.fieldLabel}>{t('finance.store.stock')}</Text><Choice values={['', 'low']} value={stockFilter} labels={{ '': t('finance.filters.all'), low: t('finance.store.lowStock') }} onChange={(value) => setStockFilter(value as 'low' | '')} /></>}<Pressable style={styles.actionTertiary} onPress={() => { setCategoryFilter(''); setStatusFilter(''); setStockFilter(''); }}><Text style={styles.actionTertiaryText}>{t('finance.storeFilters.clear')}</Text></Pressable><View style={styles.actionMainRow}><Pressable style={styles.actionCancel} onPress={() => setFilterOpen(false)}><Text style={styles.actionCancelText}>{t('finance.cancel')}</Text></Pressable><Pressable style={styles.actionSave} onPress={() => setFilterOpen(false)}><Text style={styles.actionSaveText}>{t('finance.done')}</Text></Pressable></View></StoreSheet>


    <StoreSheet visible={productOpen} onClose={() => setProductOpen(false)}><Text style={styles.sheetTitle}>{editingProduct ? t('finance.store.editProduct') : t('finance.store.newProduct')}</Text><Field title={t('finance.store.productKey')} value={productDraft.key} onChangeText={(value) => { setProductDraft((current) => ({ ...current, key: value })); setProductError(''); }} placeholder={t('finance.store.productKeyPlaceholder')} /><Field title={t('finance.store.productName')} value={productDraft.name} onChangeText={(value) => { setProductDraft((current) => ({ ...current, name: value })); setProductError(''); }} placeholder={t('finance.store.productNamePlaceholder')} /><Text style={styles.fieldLabel}>{t('finance.store.type')}</Text><Choice values={['product', 'service']} value={productDraft.type} labels={{ product: t('finance.store.product'), service: t('finance.store.service') }} onChange={(value) => setProductDraft((current) => ({ ...current, type: value as StoreProductType }))} /><Field title={t('finance.store.unit')} value={productDraft.unit} onChangeText={(value) => setProductDraft((current) => ({ ...current, unit: value }))} placeholder={t('finance.store.unitPlaceholder')} /><Text style={styles.fieldLabel}>{t('finance.store.category')}</Text><Choice values={store.categories.length ? store.categories : ['General']} value={productDraft.category || store.categories[0] || 'General'} labels={Object.fromEntries((store.categories.length ? store.categories : ['General']).map((item) => [item, item]))} onChange={(value) => setProductDraft((current) => ({ ...current, category: value }))} /><View style={styles.inlineField}><TextInput value={categoryDraft} onChangeText={setCategoryDraft} placeholder={t('finance.store.newCategoryPlaceholder')} placeholderTextColor="rgba(255,244,208,0.3)" style={[styles.input, styles.inlineInput]} /><Pressable style={styles.iconButton} onPress={addCategory} accessibilityLabel={t('finance.store.addCategory')}><Ionicons name="add" size={19} color={C.gold} /></Pressable></View><Field title={t('finance.store.purchasePrice')} value={productDraft.purchasePrice} onChangeText={(value) => setProductDraft((current) => ({ ...current, purchasePrice: value }))} numeric /><Field title={t('finance.store.salePrice')} value={productDraft.salePrice} onChangeText={(value) => { setProductDraft((current) => ({ ...current, salePrice: value })); setProductError(''); }} numeric /><Field title={t('finance.store.additionalSalePrices')} value={productDraft.additionalSalePrices} onChangeText={(value) => setProductDraft((current) => ({ ...current, additionalSalePrices: value }))} placeholder={t('finance.store.additionalSalePricesPlaceholder')} numeric /><Field title={t('finance.store.picture')} value={productDraft.picture} onChangeText={(value) => setProductDraft((current) => ({ ...current, picture: value }))} placeholder={t('finance.store.picturePlaceholder')} />{!editingProduct && <Field title={t('finance.store.quantity')} value={productDraft.stock} onChangeText={(value) => setProductDraft((current) => ({ ...current, stock: value }))} numeric />}{!editingProduct && productDraft.type === 'product' && <><Text style={styles.fieldLabel}>{t('finance.storePurchase.purchaseFrom')}</Text><Choice values={purchaseSources.map((source) => source.id)} value={purchaseAccountId} labels={Object.fromEntries(purchaseSources.map((source) => [source.id, source.name]))} onChange={setPurchaseAccountId} /></>}<Field title={t('finance.store.quantityReserve')} value={productDraft.reservedQuantity} onChangeText={(value) => setProductDraft((current) => ({ ...current, reservedQuantity: value }))} numeric /><Field title={t('finance.store.stockMinimum')} value={productDraft.stockMinimum} onChangeText={(value) => setProductDraft((current) => ({ ...current, stockMinimum: value }))} numeric /><DateSelect label={t('finance.store.expiration')} value={productDraft.expirationDate} emptyLabel={t('finance.store.noExpiration')} onChange={(value) => setProductDraft((current) => ({ ...current, expirationDate: value }))} /><Pressable style={styles.clearDate} onPress={() => setProductDraft((current) => ({ ...current, expirationDate: '' }))}><Text style={styles.clearDateText}>{productDraft.expirationDate ? t('finance.store.clearExpiration') : t('finance.store.noExpiration')}</Text></Pressable><Field title={t('finance.store.additionalInfo')} value={productDraft.additionalInfo} onChangeText={(value) => setProductDraft((current) => ({ ...current, additionalInfo: value }))} placeholder={t('finance.store.additionalInfoPlaceholder')} multiline />{Boolean(productError) && <Text style={styles.error}>{productError}</Text>}<View style={styles.modalActions}>{editingProduct && <Pressable style={styles.actionTertiary} onPress={() => { finance.updateState((current) => ({ ...current, store: { ...current.store, products: current.store.products.map((item) => item.id === editingProduct.id ? { ...item, active: !item.active } : item) } })); setProductOpen(false); }}><Text style={styles.actionTertiaryText}>{editingProduct.active ? t('finance.store.deactivate') : t('finance.store.activate')}</Text></Pressable>}<View style={styles.actionMainRow}><Pressable style={styles.actionCancel} onPress={() => setProductOpen(false)}><Text style={styles.actionCancelText}>{t('finance.cancel')}</Text></Pressable><Pressable style={styles.actionSave} onPress={saveProduct}><Text style={styles.actionSaveText}>{t('finance.store.saveProduct')}</Text></Pressable></View></View></StoreSheet>
    <StoreSheet visible={Boolean(stockProduct)} onClose={() => setStockProduct(null)}><Text style={styles.sheetTitle}>{t('finance.store.stockMovement')}</Text><Text style={styles.sheetCaption}>{stockProduct?.name} · {stockProduct ? stockFor(stockProduct.id) : 0} {t('finance.store.units')}</Text><Choice values={['entry', 'exit', 'adjustment']} value={stockAction} labels={{ entry: t('finance.store.entry'), exit: t('finance.store.exit'), adjustment: t('finance.store.correction') }} onChange={(value) => { setStockAction(value as StockAction); setStockError(''); }} /><Field title={stockAction === 'adjustment' ? t('finance.store.newStock') : t('finance.store.quantity')} value={stockQuantity} onChangeText={(value) => { setStockQuantity(value); setStockError(''); }} numeric /><Field title={t('finance.store.reason')} value={stockNote} onChangeText={setStockNote} placeholder={t('finance.store.reasonPlaceholder')} />{Boolean(stockError) && <Text style={styles.error}>{stockError}</Text>}<Pressable style={styles.primary} onPress={saveStockMovement}><Text style={styles.primaryText}>{t('finance.store.saveMovement')}</Text></Pressable></StoreSheet>

    <StoreSheet visible={saleOpen} onClose={() => setSaleOpen(false)}><Text style={styles.sheetTitle}>{t('finance.store.newSale')}</Text><View style={styles.searchRow}><Ionicons name="search-outline" size={18} color="rgba(255,244,208,0.4)" /><TextInput value={saleQuery} onChangeText={setSaleQuery} placeholder={t('finance.store.searchProducts')} placeholderTextColor="rgba(255,244,208,0.3)" style={styles.searchInput} /></View><Text style={styles.fieldLabel}>{t('finance.store.addToCart')}</Text>{filteredSaleProducts.map((product) => <Pressable key={product.id} style={styles.saleProduct} onPress={() => addToCart(product)}><View style={styles.rowMain}><Text style={styles.rowTitle}>{product.name}</Text><Text style={styles.rowMeta}>{product.type === 'product' ? `${availableFor(product)} ${t('finance.store.units')}` : t('finance.store.service')}</Text></View><Text style={styles.rowAmount}>{money(product.salePrice, currency)}</Text><Ionicons name="add-circle-outline" size={21} color={C.gold} /></Pressable>)}<Text style={styles.fieldLabel}>{t('finance.store.cart')}</Text>{cart.map((item) => <View key={item.productId} style={styles.cartRow}><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{money(item.unitPrice, currency)}</Text></View><Pressable style={styles.quantityButton} onPress={() => changeCartQuantity(item.productId, -1)}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityValue}>{item.quantity}</Text><Pressable style={styles.quantityButton} onPress={() => changeCartQuantity(item.productId, 1)}><Text style={styles.quantityText}>+</Text></Pressable><Text style={styles.rowAmount}>{money(item.total, currency)}</Text></View>)}{Boolean(cart.length) && <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('finance.store.total')}</Text><Text style={styles.totalValue}>{money(cartTotal, currency)}</Text></View>}<Text style={styles.fieldLabel}>{t('finance.store.paymentMethod')}</Text><Choice values={['', 'cash', 'card', 'bank', 'other']} value={paymentMethod} labels={{ '': t('finance.store.noPaymentMethod'), cash: t('finance.accountTypes.cash'), card: t('finance.accountTypes.card'), bank: t('finance.accountTypes.bank'), other: t('finance.accountTypes.other') }} onChange={(value) => setPaymentMethod(value as PaymentMethod | '')} />{Boolean(saleError) && <Text style={styles.error}>{saleError}</Text>}<Pressable style={[styles.primary, !cart.length && styles.disabled]} disabled={!cart.length} onPress={completeSale}><Text style={styles.primaryText}>{t('finance.store.completeSale')}</Text></Pressable></StoreSheet>

    <StoreSheet visible={Boolean(selectedSale)} onClose={() => setSelectedSale(null)}><Text style={styles.sheetTitle}>{t('finance.store.saleDetails')}</Text><Text style={styles.sheetCaption}>{selectedSale ? new Date(selectedSale.date).toLocaleString() : ''}</Text>{selectedSale?.items.map((item) => <View key={item.productId} style={styles.detailRow}><Text style={styles.rowTitle}>{item.name} × {item.quantity}</Text><Text style={styles.rowAmount}>{money(item.total, currency)}</Text></View>)}<View style={styles.totalRow}><Text style={styles.totalLabel}>{t('finance.store.total')}</Text><Text style={styles.totalValue}>{selectedSale ? money(selectedSale.total, currency) : ''}</Text></View><Text style={selectedSale?.status === 'void' ? styles.voidText : styles.paidText}>{selectedSale?.status === 'void' ? t('finance.store.voided') : t('finance.store.completed')}</Text>{selectedSale?.status === 'completed' && <Pressable style={styles.danger} onPress={() => { if (selectedSale) voidSale(selectedSale); setSelectedSale(null); }}><Text style={styles.dangerText}>{t('finance.store.voidSale')}</Text></Pressable>}</StoreSheet>

    <StoreSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)}><Text style={styles.sheetTitle}>{t('finance.store.settings')}</Text><Field title={t('finance.store.storeName')} value={storeName} onChangeText={setStoreName} placeholder={t('finance.store.storeNamePlaceholder')} /><Text style={styles.sheetCaption}>{t('finance.store.currency')}: {currency}</Text><Pressable style={styles.primary} onPress={saveSettings}><Text style={styles.primaryText}>{t('finance.store.saveSettings')}</Text></Pressable></StoreSheet>
  </View></SafeAreaView>;
}

function ProductRow({ product, stock, available, currency, onPress, onStock, t }: { product: StoreProduct; stock: number; available: number; currency: string; onPress: () => void; onStock: () => void; t: (key: string) => string }) {
  const low = product.type === 'product' && stock <= product.stockMinimum;
  return <View style={styles.productRow}><Pressable style={styles.productMain} onPress={onPress}><View style={styles.productIcon}>{product.picture ? <Image source={{ uri: product.picture }} style={styles.productImage} resizeMode="cover" /> : <Ionicons name={product.type === 'service' ? 'construct-outline' : 'cube-outline'} size={19} color={C.gold} />}</View><View style={styles.rowMain}><Text style={styles.rowTitle} numberOfLines={1}>{product.name}</Text><Text style={styles.rowMeta} numberOfLines={1}>{product.key} · {product.category} · {product.unit} · {money(product.salePrice, currency)}</Text></View></Pressable><View style={styles.productRight}>{product.type === 'service' ? <Text style={styles.rowMeta}>{t('finance.store.service')}</Text> : <><Text style={[styles.stockValue, low && styles.stockLow]}>{available}/{stock}</Text><Pressable style={styles.smallButton} onPress={onStock} accessibilityLabel={t('finance.store.adjustStock')}><Ionicons name="swap-vertical-outline" size={17} color={C.gold} /></Pressable></>}</View></View>;
}

function SaleRow({ sale, currency, onPress, t }: { sale: StoreSale; currency: string; onPress: () => void; t: (key: string) => string }) {
  return <Pressable style={styles.saleRow} onPress={onPress}><View style={styles.saleIcon}><Ionicons name="receipt-outline" size={18} color={sale.status === 'void' ? 'rgba(255,244,208,0.3)' : C.gold} /></View><View style={styles.rowMain}><Text style={[styles.rowTitle, sale.status === 'void' && styles.voidText]}>{sale.items.length} {t('finance.store.items')} · {new Date(sale.date).toLocaleDateString()}</Text><Text style={styles.rowMeta}>{sale.paymentMethod ? t(`finance.accountTypes.${sale.paymentMethod}`) : t('finance.store.noPaymentMethod')}</Text></View><Text style={[styles.rowAmount, sale.status === 'void' && styles.voidText]}>{money(sale.total, currency)}</Text></Pressable>;
}

function DrawerItem({ icon, label, active = false, onPress }: { icon: IconName; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.drawerItem, active && styles.drawerItemActive]} onPress={onPress} accessibilityRole="button"><Ionicons name={icon} size={20} color={active ? C.goldLight : 'rgba(255,244,208,0.62)'} /><Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{label}</Text><Ionicons name="chevron-forward-outline" size={15} color="rgba(255,244,208,0.25)" /></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.void },
  root: { flex: 1, backgroundColor: C.void },
  screenTransition: { flex: 1 },
  header: { height: 78, paddingTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  headerButton: { width: 44, height: 44, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44, height: 44 },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { maxWidth: 220, color: C.goldLight, fontFamily: SANS, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  headerSubtitle: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 9.5, letterSpacing: 1.35, marginTop: 3 },
  menuGlyph: { width: 18, gap: 3.5 },
  menuLineWide: { width: 18, height: 1.5, borderRadius: 2, backgroundColor: C.goldLight },
  menuLine: { width: 12, height: 1.5, borderRadius: 2, backgroundColor: C.goldLight },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  tab: { minHeight: 42, flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  tabActive: { backgroundColor: C.gold, borderColor: C.gold },
  tabText: { color: C.gold, fontFamily: SANS, fontSize: 11 },
  tabTextActive: { color: C.void, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 112, gap: 12 },
  kpiGrid: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, minHeight: 92, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, justifyContent: 'space-between' },
  kpiWarning: { borderColor: 'rgba(240,139,136,0.5)' },
  kpiLabel: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 9, lineHeight: 13 },
  kpiValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 18 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickAction: { flex: 1, minHeight: 70, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.06)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, gap: 5 },
  quickText: { color: C.goldLight, fontFamily: SANS, fontSize: 9, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 18 },
  link: { color: C.gold, fontFamily: SANS, fontSize: 10 },
  productView: { flex: 1 },
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  productScroll: { flex: 1 },
  productList: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 112, gap: 12 },
  productListEmpty: { flexGrow: 1, paddingBottom: 62 },
  searchRow: { minHeight: 46, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, minHeight: 44, color: C.goldLight, fontFamily: SANS, fontSize: 13 },
  filterButton: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: C.gold },
  filterDot: { position: 'absolute', top: 8, right: 8, width: 4, height: 4, borderRadius: 2, backgroundColor: C.void },
  productRow: { minHeight: 67, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  productIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  productRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stockValue: { minWidth: 28, color: C.goldLight, fontFamily: SERIF, fontSize: 15, textAlign: 'right' },
  stockLow: { color: '#F08B88' },
  smallButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13 },
  rowMeta: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 10, marginTop: 3 },
  rowAmount: { color: C.goldLight, fontFamily: SERIF, fontSize: 14 },
  saleRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingVertical: 8 },
  saleIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  saleProduct: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  cartRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  quantityButton: { width: 36, height: 36, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  quantityText: { color: C.gold, fontSize: 19 },
  quantityValue: { minWidth: 20, color: C.goldLight, textAlign: 'center', fontFamily: SANS, fontSize: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 8 },
  totalLabel: { color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '700' },
  totalValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 22 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  paidText: { color: C.gold, fontFamily: SANS, fontSize: 11, marginBottom: 10 },
  voidText: { color: 'rgba(255,244,208,0.32)' },
  primary: { minHeight: 44, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 8, paddingHorizontal: 14 },
  primaryText: { color: C.void, fontFamily: SANS, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  secondary: { minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 14 },
  secondaryText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' },
  modalActions: { marginTop: 18, gap: 8 },
  actionTertiary: { minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  actionTertiaryText: { color: 'rgba(240,139,136,0.9)', fontFamily: SANS, fontSize: 10, fontWeight: '700' },
  actionMainRow: { flexDirection: 'row', gap: 8 },
  actionCancel: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  actionCancelText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' },
  actionSave: { flex: 1.35, minHeight: 44, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  actionSaveText: { color: C.void, fontFamily: SANS, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  addTabs: { flexDirection: 'row', gap: 8, marginTop: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingBottom: 10 },
  addTab: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addTabActive: { backgroundColor: C.gold, borderColor: C.gold },
  addTabText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '600' },
  addTabTextActive: { color: C.void },
  addTabPanel: { paddingTop: 20, gap: 9 },
  addPanelTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 18 },
  addPanelCopy: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11, lineHeight: 17, maxWidth: 320 },
  fab: { position: 'absolute', right: 31, bottom: 25, width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, borderColor: C.goldLight, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 9 },
  workspaceFab: { position: 'absolute', right: 32, width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.34)', backgroundColor: '#11141D', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  workspaceFabStacked: { bottom: 81 },
  workspaceFabSolo: { bottom: 25 },
  danger: { minHeight: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#F08B88', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  dangerText: { color: '#F08B88', fontFamily: SANS, fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.42 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 7 },
  productEmpty: { flexGrow: 1, minHeight: 150, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  emptyDiamond: { width: 19, height: 19, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 13, opacity: 0.75 },
  productEmptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 11, letterSpacing: 0.8 },
  productEmptyCopy: { maxWidth: 270, color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  emptyModule: { minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13, textAlign: 'center' },
  emptyBody: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11, textAlign: 'center', lineHeight: 17 },
  field: { marginTop: 10 },
  fieldLabel: { color: 'rgba(233,200,119,0.7)', fontFamily: SANS, fontSize: 10, letterSpacing: 0.8, marginBottom: 6 },
  input: { minHeight: 44, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.05)', color: C.goldLight, fontFamily: SANS, fontSize: 14, paddingHorizontal: 12 },
  multiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  picturePreview: { width: 72, height: 72, borderRadius: 14, marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  productImage: { width: '100%', height: '100%', borderRadius: 12 },
  clearDate: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  clearDateText: { color: C.gold, fontFamily: SANS, fontSize: 10 },
  choices: { gap: 7, paddingVertical: 3 },
  choice: { minHeight: 40, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 12, justifyContent: 'center' },
  choiceActive: { backgroundColor: C.gold, borderColor: C.gold },
  choiceText: { color: 'rgba(255,244,208,0.65)', fontFamily: SANS, fontSize: 11 },
  choiceTextActive: { color: C.void, fontWeight: '700' },
  error: { color: '#F08B88', fontFamily: SANS, fontSize: 11, marginTop: 10, lineHeight: 16 },
  sheetTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 21, lineHeight: 26, paddingRight: 52, marginBottom: 8 },
  sheetCaption: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, marginBottom: 9 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#0A0C14', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, overflow: 'hidden' },
  sheetDismiss: { position: 'absolute', right: 10, top: 9, zIndex: 2, width: 42, height: 42, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center' },
  sheetContent: { padding: 18, paddingTop: 20, paddingBottom: 30 },
  inlineField: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  inlineInput: { flex: 1 },
  iconButton: { width: 44, height: 44, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  drawer: { width: '84%', height: '100%', backgroundColor: '#090B12', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.line, paddingHorizontal: 18 },
  drawerContent: { paddingTop: 14, paddingBottom: 28 },
  drawerStoreCard: { padding: 15, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.05)', marginBottom: 18 },
  drawerStoreEyebrow: { color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.5 },
  drawerStoreValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 25, marginTop: 8 },
  drawerStoreCaption: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 9, marginTop: 4 },
  drawerBrand: { padding: 15, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.05)', marginBottom: 18 },
  drawerName: { color: C.goldLight, fontFamily: SERIF, fontSize: 23, marginTop: 9 },
  drawerHint: { color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 9, marginTop: 4 },
  drawerNav: { gap: 4 },
  drawerItem: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  drawerItemActive: { backgroundColor: 'rgba(233,200,119,0.1)' },
  drawerItemText: { flex: 1, color: 'rgba(255,244,208,0.62)', fontFamily: SANS, fontSize: 12 },
  drawerItemTextActive: { color: C.goldLight },
});
