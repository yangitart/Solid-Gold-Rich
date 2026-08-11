import React from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../stores/FinanceContext';
import { DEFAULT_COLORS, exportCsv, exportJson } from '../stores/financeStorage';
import { hashPin } from '../core/pin';
import { supportedLanguages } from '../core/locales/i18next';
import type { Account, AppLanguage, Budget, Debt, FinanceCategory, RecurringFrequency, RecurringTransaction, SavingsGoal } from '../core/finance/types';
import { C, SANS, SERIF } from '../theme/luxury';
import DateSelect from '../components/DateSelect';
import { currencyRate as resolveCurrencyRate } from '../core/finance/currency';

export type FinanceModuleName = 'accounts' | 'debt' | 'notes' | 'tools' | 'savings' | 'budget' | 'activity' | 'recurring' | 'categories' | 'progress' | 'settings';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const money = (value: number, currency: string) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
const dateText = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ToolKey = 'calculator' | 'cashCounter' | 'discountTax' | 'interest';
type CashCountRow = { id: string; denomination: string; quantity: string };
type SettingsSection = 'language' | 'currency' | 'pin' | 'data';
type ActivityFilter = 'all' | 'expense' | 'income';
const CATEGORY_ICON_OPTIONS: { name: IconName; label: string }[] = [
  { name: 'pricetag-outline', label: 'Tag' },
  { name: 'restaurant-outline', label: 'Food' },
  { name: 'home-outline', label: 'Home' },
  { name: 'car-outline', label: 'Car' },
  { name: 'cart-outline', label: 'Shopping' },
  { name: 'medkit-outline', label: 'Health' },
  { name: 'cash-outline', label: 'Cash' },
  { name: 'briefcase-outline', label: 'Work' },
  { name: 'gift-outline', label: 'Gift' },
  { name: 'school-outline', label: 'School' },
  { name: 'airplane-outline', label: 'Travel' },
  { name: 'heart-outline', label: 'Care' },
  { name: 'phone-portrait-outline', label: 'Phone' },
  { name: 'paw-outline', label: 'Pets' },
  { name: 'game-controller-outline', label: 'Fun' },
  { name: 'musical-notes-outline', label: 'Music' },
  { name: 'fitness-outline', label: 'Fitness' },
];
const ACCOUNT_TYPE_OPTIONS: { key: Account['type']; icon: IconName }[] = [
  { key: 'cash', icon: 'cash-outline' },
  { key: 'bank', icon: 'business-outline' },
  { key: 'card', icon: 'card-outline' },
  { key: 'savings', icon: 'wallet-outline' },
  { key: 'debt', icon: 'trending-down-outline' },
  { key: 'other', icon: 'ellipsis-horizontal-outline' },
];
const TOOL_OPTIONS: { key: ToolKey; icon: IconName }[] = [
  { key: 'calculator', icon: 'calculator-outline' },
  { key: 'cashCounter', icon: 'cash-outline' },
  { key: 'discountTax', icon: 'pricetag-outline' },
  { key: 'interest', icon: 'trending-up-outline' },
];
const ACCOUNT_CURRENCIES = [
  'AED', 'ARS', 'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CZK',
  'DKK', 'DOP', 'EGP', 'EUR', 'GBP', 'GTQ', 'HKD', 'HNL', 'HUF', 'IDR', 'ILS', 'INR',
  'ISK', 'JPY', 'KRW', 'MXN', 'NIO', 'NOK', 'NZD', 'PAB', 'PEN', 'PHP', 'PLN', 'PYG',
  'RON', 'RUB', 'SEK', 'SGD', 'THB', 'TRY', 'UAH', 'USD', 'UYU', 'VES', 'VND', 'ZAR',
] as const;

function Field({ title, value, onChangeText, placeholder, multiline = false, numeric = false, secureTextEntry = false, maxLength }: { title: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; numeric?: boolean; secureTextEntry?: boolean; maxLength?: number }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{title}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,244,208,0.3)" keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} secureTextEntry={secureTextEntry} maxLength={maxLength} style={[styles.input, multiline && styles.multiline]} accessibilityLabel={title} /></View>;
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress * 100))}%`, backgroundColor: color }]} /></View>;
}

function Choice({ values, value, onChange, labels }: { values: string[]; value: string; onChange: (value: string) => void; labels?: Record<string, string> }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>{values.map((item) => <Pressable key={item} onPress={() => onChange(item)} hitSlop={4} style={[styles.choice, { minHeight: 36, borderRadius: 9, paddingHorizontal: 10 }, item === value && styles.choiceActive]} accessibilityRole="radio" accessibilityState={{ selected: item === value }} accessibilityLabel={labels?.[item] ?? item}><Text style={[styles.choiceText, { fontSize: 10 }, item === value && styles.choiceTextActive]}>{labels?.[item] ?? item}</Text></Pressable>)}</ScrollView>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><View style={styles.diamond} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return <Pressable onPress={onPress} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('finance.cancel')}><Ionicons name="arrow-back-outline" size={19} color={C.goldLight} /></Pressable>;
}

function AddAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.addAction} onPress={onPress} accessibilityRole="button" accessibilityLabel={label.replace(/^\+\s*/, '')}><View style={styles.addActionIcon}><Ionicons name="add" size={17} color={C.gold} /></View><Text style={styles.addActionText}>{label.replace(/^\+\s*/, '')}</Text></Pressable>;
}

function Sheet({ children }: { children: React.ReactNode }) {
  return <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

function ResponsiveModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><Sheet>{children}</Sheet></KeyboardAvoidingView></Modal>;
}

export default function FinanceModulesScreen({ module: initialModule, onBack }: { module: FinanceModuleName; onBack: () => void }) {
  const { t, i18n: translationI18n } = useTranslation();
  const finance = useFinance();
  const { state } = finance;
  const [module, setModule] = React.useState<FinanceModuleName>(initialModule);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = React.useState(false);
  const [currencyPickerMode, setCurrencyPickerMode] = React.useState<'account' | 'debt' | 'primary'>('account');
  const [currencyQuery, setCurrencyQuery] = React.useState('');
  const [account, setAccount] = React.useState({ name: '', type: 'cash' as Account['type'], currency: 'USD', opening: '', exchangeRate: '', color: DEFAULT_COLORS[0] });
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [accountError, setAccountError] = React.useState('');
  const [recurringOpen, setRecurringOpen] = React.useState(false);
  const [recurringTab, setRecurringTab] = React.useState<'recurring' | 'dates'>('recurring');
  const [recurring, setRecurring] = React.useState({ accountId: '', kind: 'expense' as 'expense' | 'income', amount: '', payee: '', category: 'other', frequency: 'monthly' as RecurringFrequency, nextDate: new Date().toISOString(), description: '' });
  const [debtOpen, setDebtOpen] = React.useState(false);
  const [debt, setDebt] = React.useState({ name: '', creditor: '', currency: 'USD', amount: '', dueDate: new Date().toISOString(), interest: '0' });
  const [savingsOpen, setSavingsOpen] = React.useState(false);
  const [savings, setSavings] = React.useState({ name: '', currency: 'USD', accountId: '', target: '', deadline: new Date().toISOString() });
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [reminder, setReminder] = React.useState({ title: '', date: new Date().toISOString(), note: '' });
  const [categoryType, setCategoryType] = React.useState<'expense' | 'income' | 'tag'>('expense');
  const [categoryName, setCategoryName] = React.useState('');
  const [categoryIcon, setCategoryIcon] = React.useState<IconName>('pricetag-outline');
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [iconPickerOpen, setIconPickerOpen] = React.useState(false);
  const [categoryError, setCategoryError] = React.useState('');
  const [importOpen, setImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [activeTool, setActiveTool] = React.useState<ToolKey | null>(null);
  const [calculator, setCalculator] = React.useState('');
  const [calculatorResult, setCalculatorResult] = React.useState('');
  const [cashRows, setCashRows] = React.useState<CashCountRow[]>(() => ['1', '5', '10', '20', '50', '100'].map((denomination) => ({ id: uid('cash'), denomination, quantity: '' })));
  const [discountAmount, setDiscountAmount] = React.useState('');
  const [discountPercent, setDiscountPercent] = React.useState('10');
  const [taxPercent, setTaxPercent] = React.useState('0');
  const [interestPrincipal, setInterestPrincipal] = React.useState('');
  const [interestRate, setInterestRate] = React.useState('5');
  const [interestYears, setInterestYears] = React.useState('1');
  const [interestCompounds, setInterestCompounds] = React.useState('12');
  const [pinDraft, setPinDraft] = React.useState('');
  const [pinConfirmation, setPinConfirmation] = React.useState('');
  const [pinError, setPinError] = React.useState('');
  const [settingsSection, setSettingsSection] = React.useState<SettingsSection | null>(null);
  const [currencyRateCurrency, setCurrencyRateCurrency] = React.useState('USD');
  const [currencyRate, setCurrencyRate] = React.useState('1');
  const [currencyRateError, setCurrencyRateError] = React.useState('');
  const [activityFilter, setActivityFilter] = React.useState<ActivityFilter>('all');
  const [activityCategory, setActivityCategory] = React.useState('all');
  const [activityQuery, setActivityQuery] = React.useState('');
  const [debtPaymentTarget, setDebtPaymentTarget] = React.useState<Debt | null>(null);
  const [debtPaymentAmount, setDebtPaymentAmount] = React.useState('');
  const [debtPaymentAccountId, setDebtPaymentAccountId] = React.useState('');
  const [savingsTarget, setSavingsTarget] = React.useState<SavingsGoal | null>(null);
  const [savingsAmount, setSavingsAmount] = React.useState('');
  const [savingsSourceAccountId, setSavingsSourceAccountId] = React.useState('');
  const [savingsDestinationAccountId, setSavingsDestinationAccountId] = React.useState('');
  const [linkedActionError, setLinkedActionError] = React.useState('');
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  const [budgetDraft, setBudgetDraft] = React.useState({ accountId: '', category: 'other', limit: '', period: 'monthly' as Budget['period'], rollover: false });
  const firstAccountPrompted = React.useRef(false);

  React.useEffect(() => {
    setModule(initialModule);
    if (initialModule === 'tools') setActiveTool(null);
    if (initialModule === 'settings') setSettingsSection(null);
  }, [initialModule]);
  React.useEffect(() => {
    if (settingsSection === 'currency') setCurrencyRateCurrency(state.settings.preferredCurrency || 'USD');
  }, [settingsSection, state.settings.preferredCurrency]);
  React.useEffect(() => {
    const configured = state.settings.exchangeRates?.[currencyRateCurrency];
    setCurrencyRate(currencyRateCurrency === 'USD' ? '1' : configured ? String(configured) : '');
    setCurrencyRateError('');
  }, [currencyRateCurrency, state.settings.exchangeRates]);
  const accounts = state.accounts.filter((item) => !item.archived);
  const baseCurrency = state.settings.preferredCurrency || 'USD';
  const currencyRates = React.useMemo(() => state.settings.exchangeRates ?? { USD: 1 }, [state.settings.exchangeRates]);
  const rateBetweenCurrencies = React.useCallback((fromCurrency: string, toCurrency: string) => resolveCurrencyRate(fromCurrency, toCurrency, currencyRates), [currencyRates]);
  const accountBalance = (item: Account) => state.transactions.filter((transaction) => transaction.accountId === item.id && transaction.status !== 'void').reduce((total, transaction) => transaction.kind === 'income' || transaction.kind === 'adjustment' ? total + transaction.amount : total - transaction.amount, item.openingBalance);
  const filteredAccountCurrencies = React.useMemo(() => {
    const query = currencyQuery.trim().toUpperCase();
    return query ? ACCOUNT_CURRENCIES.filter((currency) => currency.includes(query)) : ACCOUNT_CURRENCIES;
  }, [currencyQuery]);

  React.useEffect(() => {
    if (initialModule !== 'accounts' || accounts.length || firstAccountPrompted.current) return;
    firstAccountPrompted.current = true;
    setEditingAccount(null);
    setAccountError('');
    setAccount({ name: '', type: 'cash', currency: baseCurrency, opening: '', exchangeRate: '1', color: DEFAULT_COLORS[0] });
    setAccountOpen(true);
  }, [accounts.length, baseCurrency, initialModule]);

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountError('');
    setAccount({ name: '', type: 'cash', currency: baseCurrency, opening: '', exchangeRate: '1', color: DEFAULT_COLORS[0] });
    setAccountOpen(true);
  };
  const openAccountEditor = (item: Account) => {
    setEditingAccount(item);
    setAccountError('');
    setAccount({ name: item.name, type: item.type, currency: item.currency, opening: String(item.openingBalance), exchangeRate: String(item.currency === baseCurrency ? 1 : item.exchangeRate ?? rateBetweenCurrencies(item.currency, baseCurrency) ?? ''), color: item.color });
    setAccountOpen(true);
  };
  const closeAccountEditor = () => {
    setCurrencyPickerOpen(false);
    setCurrencyQuery('');
    setAccountOpen(false);
    setEditingAccount(null);
    setAccountError('');
  };
  const saveAccount = () => {
    if (!account.name.trim()) return;
    const currency = account.currency.toUpperCase() || baseCurrency;
    const exchangeRate = currency === baseCurrency ? 1 : Number(account.exchangeRate);
    if (currency !== baseCurrency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      setAccountError(t('finance.exchangeRateRequired', { defaultValue: `Enter the exchange rate from ${currency} to ${baseCurrency}.` }));
      return;
    }
    const values = { name: account.name.trim(), type: account.type, currency, exchangeRate, openingBalance: Number(account.opening) || 0, color: account.color, archived: false };
    const savedAccount = editingAccount ? { ...editingAccount, ...values } : { id: uid('account'), ...values };
    const baseUsdRate = currencyRates[baseCurrency] ?? (baseCurrency === 'USD' ? 1 : undefined);
    const currencyUsdRate = currency === 'USD' ? 1 : baseUsdRate ? exchangeRate * baseUsdRate : undefined;
    finance.updateState((current) => ({
      ...current,
      accounts: editingAccount ? current.accounts.map((item) => item.id === savedAccount.id ? savedAccount : item) : [...current.accounts, savedAccount],
      settings: currencyUsdRate ? { ...current.settings, exchangeRates: { ...(current.settings.exchangeRates ?? {}), USD: 1, [currency]: currencyUsdRate } } : current.settings,
    }));
    closeAccountEditor();
  };
  const choosePrimaryCurrency = (currency: string) => {
    setCurrencyRateCurrency(currency);
    setCurrencyRateError('');
    finance.updateState((current) => ({ ...current, settings: { ...current.settings, preferredCurrency: currency } }));
  };
  const saveCurrencyRate = () => {
    const value = Number(currencyRate);
    if (currencyRateCurrency !== 'USD' && (!Number.isFinite(value) || value <= 0)) {
      setCurrencyRateError(t('finance.exchangeRateRequired', { defaultValue: `Enter how much 1 ${currencyRateCurrency} is worth in USD.` }));
      return;
    }
    finance.updateState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        exchangeRates: { ...(current.settings.exchangeRates ?? {}), USD: 1, [currencyRateCurrency]: currencyRateCurrency === 'USD' ? 1 : value },
      },
    }));
    setCurrencyRateError('');
  };
  const addRecurring = () => {
    const selected = accounts.find((item) => item.id === recurring.accountId) ?? accounts[0];
    if (!selected || !Number(recurring.amount)) return;
    const item: RecurringTransaction = { id: uid('recurring'), accountId: selected.id, kind: recurring.kind, amount: Number(recurring.amount), currency: selected.currency, payee: recurring.payee, category: recurring.category, paymentMethod: 'bank', frequency: recurring.frequency, nextDate: recurring.nextDate, description: recurring.description, active: true };
    finance.addRecurring(item); setRecurringOpen(false);
  };
  const addDebt = () => {
    if (!debt.name.trim() || !Number(debt.amount)) return;
    finance.addDebt({ id: uid('debt'), name: debt.name.trim(), creditor: debt.creditor, currency: debt.currency.toUpperCase(), originalAmount: Number(debt.amount), balance: Number(debt.amount), interestRate: Number(debt.interest) || 0, dueDate: debt.dueDate, payments: [], active: true }); setDebtOpen(false);
  };
  const addSavings = () => {
    const destination = accounts.find((item) => item.id === savings.accountId);
    if (!destination || !savings.name.trim() || !Number(savings.target)) return;
    finance.addSavingsGoal({ id: uid('goal'), name: savings.name.trim(), accountId: destination.id, currency: destination.currency, targetAmount: Number(savings.target), balance: 0, deadline: savings.deadline, contributions: [], active: true }); setSavingsOpen(false);
  };
  const addReminder = () => {
    if (!reminder.title.trim()) return;
    finance.addReminder({ id: uid('reminder'), title: reminder.title.trim(), date: reminder.date, note: reminder.note, completed: false }); setReminderOpen(false);
  };
  const confirmDelete = (title: string, action: () => void) => Alert.alert(title, t('finance.modules.cannotUndo'), [
    { text: t('finance.cancel'), style: 'cancel' },
    { text: t('finance.deleteAction'), style: 'destructive', onPress: action },
  ]);
  const confirmArchive = (item: Account) => Alert.alert(t('finance.release.archiveAccount'), t('finance.releaseArchive.archiveCopy'), [
    { text: t('finance.cancel'), style: 'cancel' },
    { text: t('finance.release.archiveAccount'), onPress: () => { finance.archiveAccount(item.id); closeAccountEditor(); } },
  ]);
  const registerDebtPayment = () => {
    if (!debtPaymentTarget) return;
    const sourceAccount = accounts.find((item) => item.id === debtPaymentAccountId);
    const amount = Number(debtPaymentAmount);
    if (!sourceAccount || !Number.isFinite(amount) || amount <= 0) return;
    const applied = Math.min(amount, debtPaymentTarget.balance);
    const conversionRate = rateBetweenCurrencies(debtPaymentTarget.currency, sourceAccount.currency);
    if (!conversionRate) {
      setLinkedActionError(t('finance.releaseErrors.missingRate'));
      return;
    }
    const accountAmount = applied * conversionRate;
    const transactionId = uid('debt-payment');
    finance.addTransaction({ id: transactionId, accountId: sourceAccount.id, kind: 'expense', amount: accountAmount, currency: sourceAccount.currency, date: new Date().toISOString(), payee: debtPaymentTarget.name, category: 'other', paymentMethod: 'bank', status: 'cleared', reference: debtPaymentTarget.id, description: debtPaymentTarget.creditor, debtId: debtPaymentTarget.id });
    finance.updateDebt({ ...debtPaymentTarget, accountId: sourceAccount.id, balance: Math.max(0, debtPaymentTarget.balance - applied), active: debtPaymentTarget.balance - applied > 0, payments: [...debtPaymentTarget.payments, { id: uid('payment'), amount: applied, date: new Date().toISOString(), note: '', accountId: sourceAccount.id, transactionId }] });
    setDebtPaymentTarget(null); setDebtPaymentAmount(''); setLinkedActionError('');
  };
  const registerSavingsContribution = () => {
    if (!savingsTarget) return;
    const source = accounts.find((item) => item.id === savingsSourceAccountId);
    const destination = accounts.find((item) => item.id === (savingsTarget.accountId ?? savingsDestinationAccountId));
    const amount = Number(savingsAmount);
    if (!source || !destination || source.id === destination.id || !Number.isFinite(amount) || amount <= 0) return;
    const conversionRate = rateBetweenCurrencies(destination.currency, source.currency);
    if (!conversionRate) {
      setLinkedActionError(t('finance.releaseErrors.missingRate'));
      return;
    }
    const fromAmount = amount * conversionRate;
    const transferId = uid('savings-transfer');
    finance.addTransfer({ id: transferId, fromAccountId: source.id, toAccountId: destination.id, fromAmount, toAmount: amount, fromCurrency: source.currency, toCurrency: destination.currency, rate: amount / fromAmount, fee: 0, date: new Date().toISOString(), note: savingsTarget.name, status: 'cleared' });
    const balance = savingsTarget.balance + amount;
    finance.updateSavingsGoal({ ...savingsTarget, accountId: destination.id, currency: destination.currency, balance, active: balance < savingsTarget.targetAmount, contributions: [...savingsTarget.contributions, { id: uid('contribution'), amount, date: new Date().toISOString(), note: '', fromAccountId: source.id, transferId }] });
    setSavingsTarget(null); setSavingsAmount(''); setLinkedActionError('');
  };
  const addBudget = () => {
    const accountId = budgetDraft.accountId || accounts[0]?.id;
    const limit = Number(budgetDraft.limit);
    if (!accountId || !Number.isFinite(limit) || limit <= 0) return;
    const start = new Date();
    const end = new Date(start);
    if (budgetDraft.period === 'weekly') end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    const category = budgetDraft.category.trim().toLowerCase() || 'other';
    const existing = state.budgets.find((item) => item.category !== 'all' && item.accountId === accountId && item.category === category && item.period === budgetDraft.period);
    const nextBudget: Budget = { id: existing?.id ?? uid('budget'), accountId, category, period: budgetDraft.period, startDate: start.toISOString(), endDate: end.toISOString(), limit, rollover: budgetDraft.rollover, rolloverAmount: existing?.rolloverAmount ?? 0 };
    if (existing) finance.updateBudget(nextBudget); else finance.addBudget(nextBudget);
    setBudgetOpen(false); setBudgetDraft({ accountId, category: 'other', limit: '', period: 'monthly', rollover: false });
  };
  const addCategory = () => {
    const name = categoryName.trim().toLowerCase();
    if (!name) return;
    if (state.categories[categoryType].some((item) => item.id === name)) {
      setCategoryError(t('finance.categoryExists'));
      return;
    }
    const category: FinanceCategory = { id: name, icon: categoryIcon };
    finance.updateCategories({ ...state.categories, [categoryType]: [...state.categories[categoryType], category] });
    setCategoryName('');
    setCategoryIcon('pricetag-outline');
    setCategoryError('');
    setCategoryCreateOpen(false);
  };
  const removeCategory = (type: 'expense' | 'income' | 'tag', categoryId: string) => {
    if (categoryId === 'other') return;
    confirmDelete(t('finance.deleteCategory'), () => finance.updateState((current) => ({
      ...current,
      categories: { ...current.categories, [type]: current.categories[type].filter((item) => item.id !== categoryId) },
      transactions: current.transactions.map((item) => item.category === categoryId && (type === 'tag' || item.kind === type) ? { ...item, category: 'other' } : item),
      recurring: current.recurring.map((item) => item.category === categoryId && (type === 'tag' || item.kind === type) ? { ...item, category: 'other' } : item),
      budgets: current.budgets.map((item) => item.category === categoryId ? { ...item, category: 'other' } : item),
    })));
  };
  const changeLanguage = (value: string) => {
    const language = value as AppLanguage;
    finance.updateState((current) => ({ ...current, settings: { ...current.settings, language } }));
    void translationI18n.changeLanguage(language);
  };
  const savePin = () => {
    if (!/^\d{4,6}$/.test(pinDraft)) {
      setPinError(t('finance.pin.invalid'));
      return;
    }
    if (pinDraft !== pinConfirmation) {
      setPinError(t('finance.pin.mismatch'));
      return;
    }
    finance.updateState((current) => ({ ...current, settings: { ...current.settings, pinHash: hashPin(pinDraft) } }));
    setPinDraft('');
    setPinConfirmation('');
    setPinError('');
  };
  const removePin = () => {
    finance.updateState((current) => ({ ...current, settings: { ...current.settings, pinHash: undefined } }));
    setPinDraft('');
    setPinConfirmation('');
    setPinError('');
  };
  const importData = () => {
    if (!importText.trim()) return;
    if (importText.trim().startsWith('{')) {
      if (!finance.importJson(importText)) Alert.alert(t('finance.releaseImport.importFailed'), t('finance.releaseImport.invalidBackup')); else setImportOpen(false);
    } else if (accounts[0]) {
      const errors = finance.importCsvText(importText, accounts[0].id); setImportOpen(false); if (errors.length) Alert.alert(t('finance.releaseImport.csvWarnings'), errors.join('\n'));
    }
    setImportText('');
  };
  const share = async (format: 'json' | 'csv') => Share.share({ title: `Solid Gold Rich ${format}`, message: format === 'json' ? exportJson(state) : exportCsv(state) });

  const toolNumber = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const toolMoney = (value: number, currency = '') => Number.isFinite(value) ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}` : '—';
  const evaluateCalculator = (value: string) => {
    try {
      if (!value.trim()) return '';
      const expression = value.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/[^0-9+\-*/(). ]/g, '');
      return String(Function(`"use strict"; return (${expression})`)());
    } catch {
      return '—';
    }
  };
  const pressCalculatorKey = (key: string) => {
    if (key === 'C') {
      setCalculator('');
      setCalculatorResult('');
      return;
    }
    if (key === 'DEL') {
      setCalculator((current) => current.slice(0, -1));
      setCalculatorResult('');
      return;
    }
    if (key === '=') {
      setCalculatorResult(evaluateCalculator(calculator));
      return;
    }
    setCalculator((current) => `${current}${key}`);
    setCalculatorResult('');
  };

  const renderActivity = () => {
    const query = activityQuery.trim().toLowerCase();
    const activityCategories = Array.from(new Set([
      ...state.categories.expense.map((item) => item.id),
      ...state.categories.income.map((item) => item.id),
      ...state.transactions.map((item) => item.category),
    ].filter(Boolean)));
    const items = state.transactions.filter((item) => item.status !== 'void' && (activityFilter === 'all' || item.kind === activityFilter) && (activityCategory === 'all' || item.category === activityCategory) && (!query || `${item.payee} ${item.description} ${item.category}`.toLowerCase().includes(query))).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const categoryLabels = Object.fromEntries(activityCategories.map((category) => [category, t(`finance.categories.${category}`, { defaultValue: category })]));
    return <View style={styles.panel}><View style={styles.activitySearch}><Ionicons name="search-outline" size={17} color="rgba(255,244,208,0.35)" /><TextInput value={activityQuery} onChangeText={setActivityQuery} placeholder={t('finance.modules.searchActivity')} placeholderTextColor="rgba(255,244,208,0.3)" style={styles.activitySearchInput} /></View><Choice values={['all', 'expense', 'income']} value={activityFilter} onChange={(value) => setActivityFilter(value as ActivityFilter)} labels={{ all: t('finance.filters.all'), expense: t('finance.filters.expense'), income: t('finance.filters.income') }} /><Text style={styles.fieldLabel}>{t('finance.category')}</Text><Choice values={['all', ...activityCategories]} value={activityCategory} onChange={setActivityCategory} labels={{ all: t('finance.filters.all'), ...categoryLabels }} />{items.map((item) => { const category = state.categories[item.kind === 'income' ? 'income' : 'expense'].find((entry) => entry.id === item.category); const icon: IconName = item.transferId ? 'swap-horizontal-outline' : category?.icon as IconName ?? (item.kind === 'income' ? 'cash-outline' : 'pricetag-outline'); const accountName = state.accounts.find((accountItem) => accountItem.id === item.accountId)?.name; return <View key={item.id} style={styles.row}><View style={[styles.activityIcon, item.kind === 'income' && styles.activityIncomeIcon]}><Ionicons name={icon} size={18} color={item.kind === 'income' ? C.goldLight : C.gold} /></View><View style={styles.rowMain}><Text style={styles.cardTitle} numberOfLines={1}>{item.payee || item.description || item.category}</Text><Text style={styles.cardMeta} numberOfLines={1}>{accountName ? `${accountName} · ` : ''}{dateText(item.date)}</Text></View><Text style={item.kind === 'income' ? styles.positive : styles.negative} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{item.kind === 'income' ? '+' : '-'}{money(item.amount, item.currency)}</Text></View>; })}{!items.length && <Empty title={t('finance.modules.noResults')} body={t('finance.modules.noResultsCopy')} />}</View>;
  };
  const renderAccounts = () => (
    <View style={styles.panel}>
      {accounts.map((item) => (
        <Pressable key={item.id} style={styles.row} onPress={() => openAccountEditor(item)}>
          <View style={[styles.accountStripe, { backgroundColor: item.color }]} />
          <View style={styles.rowMain}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>{t(`finance.accountTypes.${item.type}`)} · {item.currency}{item.currency !== baseCurrency ? ` · 1 ${item.currency} = ${item.exchangeRate ?? '?'} ${baseCurrency}` : ''}</Text>
          </View>
          <View style={styles.accountAmount}>
            <Text style={styles.positive} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{money(accountBalance(item), item.currency)}</Text>
            {item.currency !== baseCurrency && Boolean(rateBetweenCurrencies(item.currency, baseCurrency) ?? item.exchangeRate) && <Text style={styles.cardMeta} numberOfLines={1}>≈ {money(accountBalance(item) * (rateBetweenCurrencies(item.currency, baseCurrency) ?? item.exchangeRate as number), baseCurrency)}</Text>}
          </View>
          <Ionicons name="chevron-forward-outline" size={17} color="rgba(255,244,208,0.35)" />
        </Pressable>
      ))}
      {!accounts.length && <Empty title={t('finance.release.noAccounts')} body={t('finance.release.noAccountsCopy')} />}
      <AddAction label={t('finance.release.addAccount')} onPress={openNewAccount} />
      {state.accounts.some((item) => item.archived) && <View style={styles.module}>
        <Text style={styles.fieldLabel}>{t('finance.release.archivedAccounts')}</Text>
        {state.accounts.filter((item) => item.archived).map((item) => <View key={item.id} style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardMeta}>{item.currency}</Text></View><Pressable style={styles.inlineButton} onPress={() => finance.restoreAccount(item.id)}><Text style={styles.inlineButtonText}>{t('finance.release.restore')}</Text></Pressable></View>)}
      </View>}
    </View>
  );
  const renderRecurring = () => <View style={styles.panel}><Choice values={['recurring', 'dates']} value={recurringTab} onChange={(value) => setRecurringTab(value as 'recurring' | 'dates')} labels={{ recurring: t('finance.release.recurringTab'), dates: t('finance.release.datesTab') }} />{recurringTab === 'recurring' ? <>{state.recurring.map((item) => <View key={item.id} style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.payee || item.category}</Text><Text style={styles.cardMeta}>{t(`finance.releaseFrequency.${item.frequency}`)} · {dateText(item.nextDate)} · {money(item.amount, item.currency)}</Text></View><Pressable style={styles.smallAction} onPress={() => finance.updateRecurring({ ...item, active: !item.active })} accessibilityLabel={item.active ? t('finance.release.pause') : t('finance.release.resume')}><Ionicons name={item.active ? 'pause-outline' : 'play-outline'} size={17} color={item.active ? C.gold : C.goldLight} /></Pressable><Pressable style={styles.smallAction} onPress={() => confirmDelete(t('finance.modules.deleteRecurring'), () => finance.updateState((current) => ({ ...current, recurring: current.recurring.filter((entry) => entry.id !== item.id) })))} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></View>)}{!state.recurring.length && <Empty title={t('finance.modules.noRecurring')} body={t('finance.modules.noRecurringCopy')} />}<AddAction label={t('finance.modules.addRecurring')} onPress={() => { setRecurring((current) => ({ ...current, accountId: accounts[0]?.id ?? '' })); setRecurringOpen(true); }} /></> : renderReminders()}</View>;
  const renderDebts = () => <View style={styles.panel}>{state.debts.map((item) => <View key={item.id} style={styles.module}><View style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardMeta}>{item.creditor} · {dateText(item.dueDate)} · {item.payments.length} {t('finance.modules.payments')}</Text></View><Text style={styles.negative} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{money(item.balance, item.currency)}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (1 - item.balance / Math.max(1, item.originalAmount)) * 100)}%`, backgroundColor: C.gold }]} /></View><View style={styles.inlineActions}><Pressable style={styles.inlineButton} onPress={() => { setDebtPaymentTarget(item); setDebtPaymentAmount(''); setDebtPaymentAccountId(item.accountId && accounts.some((accountItem) => accountItem.id === item.accountId) ? item.accountId : accounts[0]?.id ?? ''); setLinkedActionError(''); }}><Text style={styles.inlineButtonText}>{t('finance.modules.registerPayment')}</Text></Pressable><Pressable style={styles.smallAction} onPress={() => confirmDelete(t('finance.modules.deleteDebt'), () => finance.updateState((current) => ({ ...current, debts: current.debts.filter((entry) => entry.id !== item.id) })))} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></View></View>)}{!state.debts.length && <Empty title={t('finance.modules.noDebts')} body={t('finance.modules.noDebtsCopy')} />}<AddAction label={t('finance.modules.addDebt')} onPress={() => setDebtOpen(true)} /></View>;
  const renderSavings = () => <View style={styles.panel}>{state.savingsGoals.map((item) => <View key={item.id} style={styles.module}><View style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardMeta}>{dateText(item.deadline)} · {Math.min(100, Math.round(item.balance / Math.max(1, item.targetAmount) * 100))}%</Text></View><Text style={styles.positive} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{money(item.balance, item.currency)}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, item.balance / Math.max(1, item.targetAmount) * 100)}%`, backgroundColor: C.gold }]} /></View><Text style={styles.cardMeta}>{t('finance.modules.goalOf', { target: money(item.targetAmount, item.currency) })}</Text><View style={styles.inlineActions}><Pressable style={styles.inlineButton} onPress={() => { setSavingsTarget(item); setSavingsAmount(''); setSavingsDestinationAccountId(item.accountId ?? accounts.find((accountItem) => accountItem.type === 'savings')?.id ?? accounts[0]?.id ?? ''); setSavingsSourceAccountId(accounts.find((accountItem) => accountItem.id !== item.accountId)?.id ?? ''); setLinkedActionError(''); }}><Text style={styles.inlineButtonText}>{t('finance.modules.addContribution')}</Text></Pressable><Pressable style={styles.smallAction} onPress={() => confirmDelete(t('finance.modules.deleteGoal'), () => finance.updateState((current) => ({ ...current, savingsGoals: current.savingsGoals.filter((entry) => entry.id !== item.id) })))} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></View></View>)}{!state.savingsGoals.length && <Empty title={t('finance.modules.noGoals')} body={t('finance.modules.noGoalsCopy')} />}<AddAction label={t('finance.modules.addGoal')} onPress={() => { setSavings((current) => ({ ...current, accountId: accounts.find((item) => item.type === 'savings')?.id ?? accounts[0]?.id ?? '' })); setSavingsOpen(true); }} /></View>;
  const renderReminders = () => <View style={styles.panel}>{state.reminders.slice().sort((a, b) => Number(a.completed) - Number(b.completed) || new Date(a.date).getTime() - new Date(b.date).getTime()).map((item) => { const overdue = !item.completed && new Date(item.date).getTime() < Date.now(); return <View key={item.id} style={styles.row}><Pressable onPress={() => finance.updateReminder({ ...item, completed: !item.completed })} style={[styles.reminderCheck, item.completed && styles.reminderCheckDone, overdue && styles.reminderCheckOverdue]}><Ionicons name={item.completed ? 'checkmark' : overdue ? 'alert' : 'notifications-outline'} size={15} color={item.completed ? C.void : overdue ? C.red : C.gold} /></Pressable><View style={styles.rowMain}><Text style={[styles.cardTitle, item.completed && styles.strike]}>{item.title}</Text><Text style={[styles.cardMeta, overdue && styles.overdueText]}>{dateText(item.date)}{item.note ? ` · ${item.note}` : ''}</Text></View><Pressable style={styles.smallAction} onPress={() => confirmDelete(t('finance.modules.deleteReminder'), () => finance.updateState((current) => ({ ...current, reminders: current.reminders.filter((entry) => entry.id !== item.id) })))}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></View>; })}{!state.reminders.length && <Empty title={t('finance.modules.noReminders')} body={t('finance.modules.noRemindersCopy')} />}<AddAction label={t('finance.modules.addReminder')} onPress={() => setReminderOpen(true)} /></View>;
  const renderCategories = () => {
    const selectedCategories = state.categories[categoryType];
    const categoryTabs = [
      { key: 'expense' as const, label: t('finance.expenses') },
      { key: 'income' as const, label: t('finance.income') },
      { key: 'tag' as const, label: t('finance.tags') },
    ];
    return (
      <View style={styles.panel}>
        <View style={styles.categoryTabShell}>
          <View style={styles.categoryTabRow}>
            {categoryTabs.map((tab) => <Pressable key={tab.key} style={[styles.categoryTab, categoryType === tab.key && styles.categoryTabActive]} onPress={() => setCategoryType(tab.key)}><Text style={[styles.categoryTabText, categoryType === tab.key && styles.categoryTabTextActive]}>{tab.label}</Text></Pressable>)}
          </View>
        </View>
        <View style={styles.categoryListHeader}>
          <Text style={styles.cardMeta}>{t('finance.modules.categoriesCount', { count: selectedCategories.length })}</Text>
          <Pressable style={styles.categoryAddButton} onPress={() => { setCategoryName(''); setCategoryIcon('pricetag-outline'); setCategoryError(''); setIconPickerOpen(false); setCategoryCreateOpen(true); }} accessibilityLabel={t('finance.addCategory')}><Ionicons name="add" size={17} color={C.gold} /><Text style={styles.addCategoryText}>{t('finance.addCategory')}</Text></Pressable>
        </View>
        {selectedCategories.map((item) => (
          <View key={`${categoryType}-${item.id}`} style={styles.row}>
            <View style={styles.categoryRowIcon}><Ionicons name={item.icon as IconName} size={18} color={C.gold} /></View>
            <Text style={[styles.cardTitle, styles.categoryRowName]}>{t(`finance.categories.${item.id}`, { defaultValue: item.id })}</Text>
            {item.id !== 'other' && <Pressable onPress={() => removeCategory(categoryType, item.id)} accessibilityLabel={t('finance.deleteCategory')}><Ionicons name="trash-outline" size={19} color={C.red} /></Pressable>}
          </View>
        ))}
      </View>
    );
  };
  const renderTools = () => {
    const baseAmount = toolNumber(discountAmount);
    const discountValue = baseAmount * toolNumber(discountPercent) / 100;
    const taxedAmount = (baseAmount - discountValue) * (1 + toolNumber(taxPercent) / 100);
    const principal = toolNumber(interestPrincipal);
    const annualRate = toolNumber(interestRate) / 100;
    const years = toolNumber(interestYears);
    const compounds = Math.max(1, toolNumber(interestCompounds));
    const interestTotal = principal * Math.pow(1 + annualRate / compounds, compounds * years);
    const cashTotal = cashRows.reduce((total, row) => total + toolNumber(row.denomination) * Math.max(0, Math.floor(toolNumber(row.quantity))), 0);
    const updateCashRow = (id: string, field: 'denomination' | 'quantity', value: string) => {
      const cleanValue = field === 'quantity' ? value.replace(/[^0-9]/g, '') : value.replace(/[^0-9.,]/g, '');
      setCashRows((current) => current.map((row) => row.id === id ? { ...row, [field]: cleanValue } : row));
    };

    return (
      <View style={styles.panel}>
        {activeTool === null ? <View style={styles.toolGrid}>
          {TOOL_OPTIONS.map((item) => (
            <Pressable key={item.key} onPress={() => setActiveTool(item.key)} style={styles.toolCard} accessibilityRole="button">
              <View style={styles.toolCardIcon}><Ionicons name={item.icon} size={21} color={C.gold} /></View>
              <Text style={styles.toolCardTitle}>{t(`finance.toolCalculators.${item.key}`)}</Text>
              <Ionicons name="chevron-forward-outline" size={15} color="rgba(255,244,208,0.26)" />
            </Pressable>
          ))}
        </View> : <View style={styles.toolWorkspace}>
          <Pressable style={styles.toolBack} onPress={() => setActiveTool(null)} accessibilityRole="button">
            <Ionicons name="chevron-back-outline" size={17} color={C.gold} />
            <Text style={styles.toolBackText}>{t('finance.tools')}</Text>
          </Pressable>
          <Text style={styles.toolWorkspaceTitle}>{t(`finance.toolCalculators.${activeTool}`)}</Text>

        {activeTool === 'calculator' && <>
          <View style={styles.calculatorDisplay}><Text style={styles.calculatorExpression} numberOfLines={1} adjustsFontSizeToFit>{calculator || '0'}</Text>{Boolean(calculatorResult) && <Text style={styles.calculatorAnswer} numberOfLines={1} adjustsFontSizeToFit>{calculatorResult}</Text>}</View>
          <View style={styles.calculatorGrid}>{['C', 'DEL', '(', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', ')', '0', '.', '='].map((key) => <Pressable key={key} style={[styles.calculatorKey, ['C', 'DEL', '(', ')'].includes(key) && styles.calculatorUtilityKey, ['÷', '×', '−', '+', '='].includes(key) && styles.calculatorOperatorKey]} onPress={() => pressCalculatorKey(key)} accessibilityRole="button" accessibilityLabel={key === 'DEL' ? t('finance.deleteAction') : key}><Text style={[styles.calculatorKeyText, ['C', 'DEL', '(', ')'].includes(key) && styles.calculatorUtilityText, ['÷', '×', '−', '+', '='].includes(key) && styles.calculatorOperatorText]}>{key === 'DEL' ? '⌫' : key}</Text></Pressable>)}</View>
        </>}

        {activeTool === 'cashCounter' && <>
          <View style={styles.cashSummary}>
            <Text style={styles.fieldLabel}>{t('finance.toolCalculators.cashTotal')}</Text>
            <Text style={styles.cashTotal} numberOfLines={1} adjustsFontSizeToFit>{toolMoney(cashTotal, baseCurrency)}</Text>
            <Text style={styles.cardMeta}>{t('finance.toolCalculators.cashCounterCopy')}</Text>
          </View>
          <View style={styles.cashTableHeader}>
            <Text style={[styles.fieldLabel, styles.cashDenomination]}>{t('finance.toolCalculators.denomination')}</Text>
            <Text style={[styles.fieldLabel, styles.cashQuantity]}>{t('finance.toolCalculators.quantity')}</Text>
            <View style={styles.cashDeleteSpace} />
          </View>
          {cashRows.map((row) => <View key={row.id} style={styles.cashRow}>
            <TextInput value={row.denomination} onChangeText={(value) => updateCashRow(row.id, 'denomination', value)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="rgba(255,244,208,0.28)" style={[styles.input, styles.cashDenomination]} />
            <Text style={styles.cashMultiply}>×</Text>
            <TextInput value={row.quantity} onChangeText={(value) => updateCashRow(row.id, 'quantity', value)} keyboardType="number-pad" placeholder="0" placeholderTextColor="rgba(255,244,208,0.28)" style={[styles.input, styles.cashQuantity]} />
            <Pressable style={styles.cashDelete} onPress={() => setCashRows((current) => current.filter((item) => item.id !== row.id))} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="close-outline" size={17} color={C.red} /></Pressable>
          </View>)}
          <AddAction label={t('finance.toolCalculators.addDenomination')} onPress={() => setCashRows((current) => [...current, { id: uid('cash'), denomination: '', quantity: '' }])} />
        </>}

        {activeTool === 'discountTax' && <>
          <Field title={t('finance.toolCalculators.amount')} value={discountAmount} onChangeText={setDiscountAmount} numeric />
          <Field title={t('finance.toolCalculators.discount')} value={discountPercent} onChangeText={setDiscountPercent} numeric />
          <Field title={t('finance.toolCalculators.tax')} value={taxPercent} onChangeText={setTaxPercent} numeric />
          <Text style={styles.toolResult}>{toolMoney(taxedAmount)}</Text>
          <Text style={styles.cardMeta}>{t('finance.toolCalculators.discountedTotal', { amount: toolMoney(taxedAmount) })}</Text>
        </>}

        {activeTool === 'interest' && <>
          <Field title={t('finance.toolCalculators.principal')} value={interestPrincipal} onChangeText={setInterestPrincipal} numeric />
          <Field title={t('finance.toolCalculators.annualRate')} value={interestRate} onChangeText={setInterestRate} numeric />
          <Field title={t('finance.toolCalculators.years')} value={interestYears} onChangeText={setInterestYears} numeric />
          <Field title={t('finance.toolCalculators.compounds')} value={interestCompounds} onChangeText={setInterestCompounds} numeric />
          <Text style={styles.toolResult}>{toolMoney(interestTotal)}</Text>
          <Text style={styles.cardMeta}>{t('finance.toolCalculators.interestEarned', { amount: toolMoney(Math.max(0, interestTotal - principal)) })}</Text>
        </>}
        </View>}
      </View>
    );
  };
  const renderProgress = () => {
    const incomeTransactions = state.transactions.filter((item) => item.kind === 'income' && item.status !== 'void' && !item.transferId);
    const points = incomeTransactions.length;
    const level = Math.floor(points / 5) + 1;
    const pointsInLevel = points % 5;
    const levelProgress = pointsInLevel / 5;
    const levelNodes = Array.from({ length: 5 }, (_, index) => index < Math.min(5, level));

    return (
      <View style={styles.panel}>
        <View style={styles.progressIntro}>
          <Text style={styles.fieldLabel}>{t('finance.progress.eyebrow')}</Text>
          <Text style={styles.progressTitle}>{t('finance.progress.title')}</Text>
          <Text style={styles.progressCopy}>{t('finance.progress.copy')}</Text>
        </View>
        <View style={styles.progressCard}>
          <View style={styles.progressTreeArt} accessibilityLabel={t('finance.progress.treeLabel')}>
            <View style={styles.progressBranchLeft} />
            <View style={styles.progressBranchRight} />
            <View style={styles.progressTrunk} />
            <View style={styles.progressCrown}>
              <Ionicons name="diamond" size={46} color={C.gold} />
            </View>
            <View style={styles.progressNodes}>
              {levelNodes.map((active, index) => <View key={index} style={[styles.progressNode, active && styles.progressNodeActive]}><Ionicons name="diamond" size={13} color={active ? C.void : 'rgba(233,200,119,0.32)'} /></View>)}
            </View>
          </View>
          <View style={styles.progressSummary}>
            <Text style={styles.progressLevelLabel}>{t('finance.progress.level', { level })}</Text>
            <Text style={styles.progressPoints}>{points} <Text style={styles.progressPointsUnit}>{t('finance.progress.points')}</Text></Text>
            <Text style={styles.cardMeta}>{t('finance.progress.incomeCount', { count: incomeTransactions.length })}</Text>
            <ProgressBar progress={levelProgress} color={C.gold} />
            <Text style={styles.progressNext}>{t('finance.progress.nextLevel', { count: 5 - pointsInLevel })}</Text>
          </View>
        </View>
        <View style={styles.progressRule}>
          <Ionicons name="sparkles-outline" size={18} color={C.gold} />
          <Text style={styles.cardMeta}>{t('finance.progress.rule')}</Text>
        </View>
      </View>
    );
  };
  const renderSettings = () => {
    const currentLanguage = supportedLanguages.includes((translationI18n.resolvedLanguage ?? 'en') as AppLanguage)
      ? (translationI18n.resolvedLanguage ?? 'en')
      : 'en';
    const selectedLanguage = state.settings.language ?? currentLanguage;
    const settingRow = (section: SettingsSection, icon: IconName, title: string, value: string) => (
      <Pressable key={section} style={styles.settingsRow} onPress={() => setSettingsSection(section)}>
        <Ionicons name={icon} size={20} color={C.gold} />
        <View style={styles.settingsRowMain}>
          <Text style={styles.settingsRowTitle}>{title}</Text>
          <Text style={styles.settingsRowValue} numberOfLines={1}>{value}</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={18} color="rgba(255,244,208,0.35)" />
      </Pressable>
    );

    if (!settingsSection) {
      return (
        <View style={styles.panel}>
          {settingRow('language', 'language-outline', t('finance.language'), t(`finance.languages.${selectedLanguage}`))}
          {settingRow('currency', 'cash-outline', t('finance.currency'), state.settings.preferredCurrency)}
          {settingRow('pin', 'lock-closed-outline', t('finance.pin.title'), state.settings.pinHash ? t('finance.pin.enabled') : t('finance.pin.disabled'))}
          {settingRow('data', 'archive-outline', t('finance.releaseExtra.dataBackups'), t('finance.releaseExtra.dataBackupsCopy'))}
          <View style={styles.settingsDivider} />
          <View style={styles.aboutCompact}><Text style={styles.aboutTitle}>Solid Gold Rich</Text><Text style={styles.body}>{t('finance.releaseExtra.aboutCopy')}</Text><Text style={styles.cardMeta}>{t('finance.releaseExtra.localOnlyCopy')}</Text></View>
        </View>
      );
    }

    return (
      <View style={styles.panel}>
        <View style={styles.settingsBack}>
          <BackButton onPress={() => setSettingsSection(null)} />
          <Text style={styles.settingsBackText}>{t('finance.navigation.items.settings.title')}</Text>
        </View>
        {settingsSection === 'language' && <>
          <Text style={styles.fieldLabel}>{t('finance.language')}</Text>
          <View style={styles.settingsOptionList}>
            {supportedLanguages.map((language) => <Pressable key={language} style={styles.settingsOption} onPress={() => changeLanguage(language)}><Text style={[styles.settingsOptionText, selectedLanguage === language && styles.settingsOptionTextActive]}>{t(`finance.languages.${language}`)}</Text>{selectedLanguage === language && <Ionicons name="checkmark-outline" size={18} color={C.gold} />}</Pressable>)}
          </View>
        </>}
        {settingsSection === 'currency' && <>
          <Text style={styles.fieldLabel}>{t('finance.currency')}</Text>
          <View style={styles.settingsOptionList}>
            <Pressable style={styles.settingsOption} onPress={() => { setCurrencyPickerMode('primary'); setCurrencyQuery(''); setCurrencyPickerOpen(true); }}><View style={styles.settingsRowMain}><Text style={styles.settingsOptionTextActive}>{state.settings.preferredCurrency}</Text><Text style={styles.settingsRowValue}>{t('finance.selectCurrency')}</Text></View><Ionicons name="chevron-forward-outline" size={18} color={C.gold} /></Pressable>
          </View>
          <Text style={styles.fieldLabel}>{t('finance.currencyRateLabel', { currency: currencyRateCurrency })}</Text>
          <Field title={t('finance.exchangeRate')} value={currencyRate} onChangeText={(value) => { setCurrencyRate(value.replace(/[^0-9.]/g, '')); setCurrencyRateError(''); }} numeric placeholder={currencyRateCurrency === 'USD' ? '1' : '670'} />
          {Boolean(currencyRateError) && <Text style={styles.pinError}>{currencyRateError}</Text>}
          <Pressable style={styles.primary} onPress={saveCurrencyRate}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable>
        </>}
        {settingsSection === 'pin' && <>
          <Text style={styles.settingsTitle}>{t('finance.pin.title')}</Text>
          <Text style={styles.cardMeta}>{state.settings.pinHash ? t('finance.pin.enabled') : t('finance.pin.disabled')}</Text>
          <Field title={t('finance.pin.newPin')} value={pinDraft} onChangeText={(value) => { setPinDraft(value.replace(/\D/g, '')); setPinError(''); }} placeholder="0000" numeric secureTextEntry maxLength={6} />
          <Field title={t('finance.pin.confirmPin')} value={pinConfirmation} onChangeText={(value) => { setPinConfirmation(value.replace(/\D/g, '')); setPinError(''); }} placeholder="0000" numeric secureTextEntry maxLength={6} />
          {Boolean(pinError) && <Text style={styles.pinError}>{pinError}</Text>}
          <Pressable style={styles.primary} onPress={savePin}><Text style={styles.primaryText}>{state.settings.pinHash ? t('finance.pin.change') : t('finance.pin.set')}</Text></Pressable>
          {state.settings.pinHash && <Pressable style={styles.danger} onPress={removePin}><Text style={styles.dangerText}>{t('finance.pin.remove')}</Text></Pressable>}
        </>}
        {settingsSection === 'data' && <>
          <Text style={styles.settingsTitle}>{t('finance.releaseExtra.dataBackups')}</Text>
          <Pressable style={styles.secondary} onPress={() => void share('json')}><Text style={styles.secondaryText}>{t('finance.releaseExtra.exportJson')}</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => void share('csv')}><Text style={styles.secondaryText}>{t('finance.releaseExtra.exportCsv')}</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => setImportOpen(true)}><Text style={styles.secondaryText}>{t('finance.releaseExtra.importData')}</Text></Pressable>
          <Pressable style={styles.danger} onPress={() => confirmDelete(t('finance.releaseExtra.resetData'), finance.resetData)}><Text style={styles.dangerText}>{t('finance.releaseExtra.resetData')}</Text></Pressable>
        </>}
      </View>
    );
  };
  const categoryBudgets = state.budgets.filter((item) => item.category !== 'all');
  const renderBudget = () => <View style={styles.panel}>{categoryBudgets.map((item) => {
    const account = state.accounts.find((accountItem) => accountItem.id === item.accountId);
    const budgetCurrency = account?.currency ?? baseCurrency;
    const spent = state.transactions.filter((transaction) => transaction.status !== 'void' && transaction.accountId === item.accountId && transaction.kind === 'expense' && transaction.category === item.category && new Date(transaction.date) >= new Date(item.startDate) && new Date(transaction.date) <= new Date(item.endDate)).reduce((sum, transaction) => {
      const rate = rateBetweenCurrencies(transaction.currency, budgetCurrency);
      return rate ? sum + transaction.amount * rate : sum;
    }, 0);
    const accountName = state.accounts.find((accountItem) => accountItem.id === item.accountId)?.name ?? t('finance.modules.unknownAccount');
    const percentage = Math.min(100, spent / Math.max(1, item.limit + item.rolloverAmount) * 100);
    return <View key={item.id} style={styles.module}><View style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{t(`finance.categories.${item.category}`, { defaultValue: item.category })}</Text><Text style={styles.cardMeta}>{accountName} · {t(`finance.releaseFrequency.${item.period}`)}</Text></View><Text style={spent > item.limit + item.rolloverAmount ? styles.negative : styles.positive} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{money(spent, budgetCurrency)}</Text><Pressable style={styles.smallAction} onPress={() => confirmDelete(t('finance.modules.deleteBudget'), () => finance.deleteBudget(item.id))} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></View><View style={styles.track}><View style={[styles.fill, { width: `${percentage}%`, backgroundColor: percentage >= 100 ? C.red : percentage >= 80 ? C.gold : C.goldLight }]} /></View><Text style={styles.cardMeta}>{t('finance.modules.budgetRemaining', { amount: money(Math.max(0, item.limit + item.rolloverAmount - spent), budgetCurrency) })}</Text></View>;
  })}{!categoryBudgets.length && <Empty title={t('finance.modules.noBudgets')} body={t('finance.modules.noBudgetsCopy')} />}<AddAction label={t('finance.modules.addBudget')} onPress={() => { setBudgetDraft((current) => ({ ...current, accountId: current.accountId || accounts[0]?.id || '' })); setBudgetOpen(true); }} /></View>;
  const content = module === 'accounts' ? renderAccounts() : module === 'activity' ? renderActivity() : module === 'recurring' ? renderRecurring() : module === 'categories' ? renderCategories() : module === 'progress' ? renderProgress() : module === 'debt' ? renderDebts() : module === 'savings' ? renderSavings() : module === 'tools' ? renderTools() : module === 'settings' || module === 'notes' ? renderSettings() : renderBudget();
  const titles = Object.fromEntries((['accounts', 'debt', 'notes', 'tools', 'savings', 'budget', 'activity', 'recurring', 'categories', 'progress', 'settings'] as FinanceModuleName[]).map((item) => [item, item === 'progress' ? t('finance.progress.title') : t(`finance.navigation.items.${item}.title`)])) as Record<FinanceModuleName, string>;
  const debtPaymentAccount = accounts.find((item) => item.id === debtPaymentAccountId);
  const debtPaymentReady = Boolean(debtPaymentTarget && debtPaymentAccount && Number(debtPaymentAmount) > 0 && rateBetweenCurrencies(debtPaymentTarget.currency, debtPaymentAccount.currency));
  const debtPaymentValidationError = linkedActionError || (debtPaymentTarget && debtPaymentAccount && Number(debtPaymentAmount) > 0 && !rateBetweenCurrencies(debtPaymentTarget.currency, debtPaymentAccount.currency) ? t('finance.releaseErrors.missingRate') : '');
  const contributionDestinationId = savingsTarget?.accountId ?? savingsDestinationAccountId;
  const contributionDestination = accounts.find((item) => item.id === contributionDestinationId);
  const contributionSource = accounts.find((item) => item.id === savingsSourceAccountId);
  const contributionReady = Boolean(savingsTarget && contributionDestination && contributionSource && contributionDestination.id !== contributionSource.id && Number(savingsAmount) > 0 && rateBetweenCurrencies(contributionDestination.currency, contributionSource.currency));
  const contributionValidationError = linkedActionError || (savingsTarget && contributionDestination && contributionSource && Number(savingsAmount) > 0 && !rateBetweenCurrencies(contributionDestination.currency, contributionSource.currency) ? t('finance.releaseErrors.missingRate') : '');

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}><View style={styles.header}><BackButton onPress={onBack} /><Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{titles[module]}</Text><View style={styles.headerSpace} /></View><ScrollView contentContainerStyle={[styles.content, styles.moduleContent]} keyboardShouldPersistTaps="handled">{content}</ScrollView>
    <Modal visible={categoryCreateOpen} transparent animationType="slide" onRequestClose={() => setCategoryCreateOpen(false)}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Sheet>
          <Text style={styles.sheetTitle}>{t('finance.newCategory')}</Text>
          <Text style={styles.cardMeta}>{categoryType === 'expense' ? t('finance.expenses') : categoryType === 'income' ? t('finance.income') : t('finance.tags')}</Text>
          <Field title={t('finance.category')} value={categoryName} onChangeText={(value) => { setCategoryName(value); setCategoryError(''); }} placeholder={t('finance.categoryPlaceholder')} />
          <Text style={styles.fieldLabel}>{t('finance.chooseIcon')}</Text>
          <Pressable style={styles.iconPreviewRow} onPress={() => setIconPickerOpen(true)} accessibilityLabel={t('finance.chooseIcon')}>
            <View style={styles.iconPreviewButton}><Ionicons name={categoryIcon} size={21} color={C.gold} /></View>
            <Text style={styles.iconPreviewText}>{t('finance.chooseIcon')}</Text>
            <Ionicons name="chevron-forward-outline" size={18} color="rgba(255,244,208,0.35)" />
          </Pressable>
          {Boolean(categoryError) && <Text style={styles.pinError}>{categoryError}</Text>}
          <Pressable style={[styles.primary, !categoryName.trim() && styles.buttonDisabled]} disabled={!categoryName.trim()} onPress={addCategory}><Text style={styles.primaryText}>{t('finance.addCategory')}</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => setCategoryCreateOpen(false)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable>
        </Sheet>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={iconPickerOpen} transparent animationType="fade" onRequestClose={() => setIconPickerOpen(false)}>
      <View style={styles.iconPickerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setIconPickerOpen(false)} />
        <View style={styles.iconPickerSheet}>
          <View style={styles.iconPickerHeader}>
            <Text style={styles.sheetTitle}>{t('finance.chooseIcon')}</Text>
            <Pressable onPress={() => setIconPickerOpen(false)} accessibilityLabel={t('finance.cancel')}><Ionicons name="close-outline" size={24} color={C.goldLight} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.iconPickerGrid} showsVerticalScrollIndicator={false}>
            {CATEGORY_ICON_OPTIONS.map((item) => <Pressable key={item.name} onPress={() => { setCategoryIcon(item.name); setIconPickerOpen(false); }} style={[styles.iconPickerChoice, categoryIcon === item.name && styles.iconChoiceActive]} accessibilityLabel={t('finance.chooseIcon')}><Ionicons name={item.name} size={22} color={categoryIcon === item.name ? C.void : C.goldLight} /></Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
    <Modal visible={accountOpen} transparent animationType="slide" onRequestClose={closeAccountEditor}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Sheet>
          <Text style={styles.sheetTitle}>{editingAccount ? t('finance.release.editAccount') : t('finance.release.newAccount')}</Text>
          <Field title={t('finance.budgetName', { defaultValue: 'NAME' })} value={account.name} onChangeText={(value) => setAccount((current) => ({ ...current, name: value }))} />
          <Text style={styles.fieldLabel}>{t('finance.accountType')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountTypeChoices}>
            {ACCOUNT_TYPE_OPTIONS.map((item) => { const selected = account.type === item.key; return <Pressable key={item.key} style={[styles.accountTypeChoice, selected && styles.accountTypeChoiceActive]} onPress={() => setAccount((current) => ({ ...current, type: item.key }))}><Ionicons name={item.icon} size={18} color={selected ? C.void : C.gold} /><Text style={[styles.accountTypeText, selected && styles.accountTypeTextActive]}>{t(`finance.accountTypes.${item.key}`)}</Text></Pressable>; })}
          </ScrollView>
          <Text style={styles.fieldLabel}>{t('finance.currency')}</Text>
          <Pressable style={styles.currencySelect} onPress={() => { setCurrencyPickerMode('account'); setCurrencyQuery(''); setCurrencyPickerOpen(true); }} accessibilityRole="button" accessibilityLabel={t('finance.currency')}>
            <View style={styles.currencySelectIcon}><Ionicons name="cash-outline" size={18} color={C.gold} /></View>
            <View style={styles.currencySelectCopy}><Text style={styles.currencySelectCode}>{account.currency}</Text><Text style={styles.currencySelectHint}>{t('finance.selectCurrency')}</Text></View>
            <Ionicons name="chevron-down-outline" size={17} color="rgba(255,244,208,0.38)" />
          </Pressable>
          <Field title={t('finance.openingBalance')} value={account.opening} onChangeText={(value) => setAccount((current) => ({ ...current, opening: value }))} numeric />
          {account.currency !== baseCurrency && <>
            <Field title={`${t('finance.exchangeRate')} · 1 ${account.currency} = ? ${baseCurrency}`} value={account.exchangeRate} onChangeText={(value) => { setAccount((current) => ({ ...current, exchangeRate: value })); setAccountError(''); }} numeric placeholder="0.00" />
            {Boolean(accountError) && <Text style={styles.pinError}>{accountError}</Text>}
          </>}
          <Pressable style={[styles.primary, (!account.name.trim() || (account.currency !== baseCurrency && (!Number.isFinite(Number(account.exchangeRate)) || Number(account.exchangeRate) <= 0))) && styles.buttonDisabled]} disabled={!account.name.trim() || (account.currency !== baseCurrency && (!Number.isFinite(Number(account.exchangeRate)) || Number(account.exchangeRate) <= 0))} onPress={saveAccount}><Text style={styles.primaryText}>{editingAccount ? t('finance.release.saveChanges') : t('finance.release.save')}</Text></Pressable>
          {editingAccount && <Pressable style={styles.dangerButton} onPress={() => confirmArchive(editingAccount)}><Text style={styles.dangerButtonText}>{t('finance.release.archiveAccount')}</Text></Pressable>}
          <Pressable style={styles.secondary} onPress={closeAccountEditor}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable>
        </Sheet>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={currencyPickerOpen} transparent animationType="fade" onRequestClose={() => setCurrencyPickerOpen(false)}>
      <View style={styles.currencyPickerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setCurrencyPickerOpen(false)} />
        <View style={styles.currencyPickerSheet}>
          <View style={styles.currencyPickerHeader}><Text style={styles.sheetTitle}>{t('finance.selectCurrency')}</Text><Pressable style={styles.sheetClose} onPress={() => setCurrencyPickerOpen(false)} accessibilityLabel={t('finance.cancel')}><Ionicons name="close" size={18} color={C.goldLight} /></Pressable></View>
          <View style={styles.currencySearch}><Ionicons name="search-outline" size={17} color="rgba(255,244,208,0.38)" /><TextInput value={currencyQuery} onChangeText={setCurrencyQuery} autoCapitalize="characters" autoCorrect={false} placeholder={t('finance.searchCurrency')} placeholderTextColor="rgba(255,244,208,0.3)" style={styles.currencySearchInput} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {filteredAccountCurrencies.map((currency) => { const selectedCurrency = currencyPickerMode === 'account' ? account.currency : currencyPickerMode === 'debt' ? debt.currency : state.settings.preferredCurrency; return <Pressable key={currency} style={[styles.currencyOption, selectedCurrency === currency && styles.currencyOptionActive]} onPress={() => { if (currencyPickerMode === 'account') { const configuredRate = rateBetweenCurrencies(currency, baseCurrency); setAccount((current) => ({ ...current, currency, exchangeRate: currency === baseCurrency ? '1' : current.currency === currency ? current.exchangeRate : configuredRate ? String(configuredRate) : '' })); setAccountError(''); } else if (currencyPickerMode === 'debt') setDebt((current) => ({ ...current, currency })); else choosePrimaryCurrency(currency); setCurrencyPickerOpen(false); }}><View style={styles.currencyOptionMark}><Text style={styles.currencyOptionMarkText}>{currency.slice(0, 1)}</Text></View><Text style={styles.currencyOptionCode}>{currency}</Text>{selectedCurrency === currency && <Ionicons name="checkmark" size={18} color={C.gold} />}</Pressable>; })}
          </ScrollView>
        </View>
      </View>
    </Modal>
    <ResponsiveModal visible={recurringOpen} onClose={() => setRecurringOpen(false)}>
      <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{t('finance.modules.addRecurring').replace(/^\+\s*/, '')}</Text><Pressable style={styles.sheetClose} onPress={() => setRecurringOpen(false)}><Ionicons name="close" size={18} color={C.goldLight} /></Pressable></View>
      <Text style={styles.fieldLabel}>{t('finance.modules.account')}</Text>
      <Choice values={accounts.map((item) => item.id)} value={recurring.accountId} onChange={(accountId) => setRecurring((current) => ({ ...current, accountId }))} labels={Object.fromEntries(accounts.map((item) => [item.id, item.name]))} />
      <Text style={styles.fieldLabel}>{t('finance.categoryType')}</Text>
      <Choice values={['expense', 'income']} value={recurring.kind} onChange={(kind) => setRecurring((current) => ({ ...current, kind: kind as 'expense' | 'income', category: 'other' }))} labels={{ expense: t('finance.expense'), income: t('finance.income') }} />
      <Field title={t('finance.amount')} value={recurring.amount} onChangeText={(value) => setRecurring((current) => ({ ...current, amount: value.replace(/[^0-9.]/g, '') }))} numeric />
      <Field title={t('finance.description')} value={recurring.payee} onChangeText={(value) => setRecurring((current) => ({ ...current, payee: value }))} />
      <Text style={styles.fieldLabel}>{t('finance.modules.period')}</Text>
      <Choice values={['daily', 'weekly', 'monthly', 'yearly']} value={recurring.frequency} onChange={(frequency) => setRecurring((current) => ({ ...current, frequency: frequency as RecurringFrequency }))} labels={{ daily: t('finance.releaseFrequency.daily'), weekly: t('finance.releaseFrequency.weekly'), monthly: t('finance.releaseFrequency.monthly'), yearly: t('finance.releaseFrequency.yearly') }} />
      <Text style={styles.fieldLabel}>{t('finance.category')}</Text>
      <Choice values={state.categories[recurring.kind].map((item) => item.id)} value={recurring.category} onChange={(category) => setRecurring((current) => ({ ...current, category }))} labels={Object.fromEntries(state.categories[recurring.kind].map((item) => [item.id, t(`finance.categories.${item.id}`, { defaultValue: item.id })]))} />
      <DateSelect label={t('finance.date')} value={recurring.nextDate} onChange={(nextDate) => setRecurring((current) => ({ ...current, nextDate }))} firstDayOfWeek={state.settings.firstDayOfWeek} />
      <Pressable style={[styles.primary, (!recurring.accountId || !Number(recurring.amount)) && styles.buttonDisabled]} disabled={!recurring.accountId || !Number(recurring.amount)} onPress={addRecurring}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable>
    </ResponsiveModal>
    <ResponsiveModal visible={debtOpen} onClose={() => setDebtOpen(false)}><Text style={styles.sheetTitle}>{t('finance.release.newDebt')}</Text><Field title={t('finance.release.name')} value={debt.name} onChangeText={(value) => setDebt((current) => ({ ...current, name: value }))} /><Field title={t('finance.release.creditor')} value={debt.creditor} onChangeText={(value) => setDebt((current) => ({ ...current, creditor: value }))} /><Text style={styles.fieldLabel}>{t('finance.currency')}</Text><Pressable style={styles.currencySelect} onPress={() => { setCurrencyPickerMode('debt'); setCurrencyQuery(''); setCurrencyPickerOpen(true); }}><Text style={styles.currencySelectCode}>{debt.currency}</Text><Ionicons name="chevron-down-outline" size={17} color={C.gold} /></Pressable><Field title={t('finance.amount')} value={debt.amount} onChangeText={(value) => setDebt((current) => ({ ...current, amount: value }))} numeric /><DateSelect label={t('finance.release.dueDate')} value={debt.dueDate} onChange={(dueDate) => setDebt((current) => ({ ...current, dueDate }))} firstDayOfWeek={state.settings.firstDayOfWeek} /><Pressable style={[styles.primary, (!debt.name.trim() || !Number(debt.amount)) && styles.buttonDisabled]} disabled={!debt.name.trim() || !Number(debt.amount)} onPress={addDebt}><Text style={styles.primaryText}>{t('finance.release.save')}</Text></Pressable></ResponsiveModal>
    <ResponsiveModal visible={savingsOpen} onClose={() => setSavingsOpen(false)}><Text style={styles.sheetTitle}>{t('finance.release.newSavingsGoal')}</Text><Field title={t('finance.release.name')} value={savings.name} onChangeText={(value) => setSavings((current) => ({ ...current, name: value }))} /><Text style={styles.fieldLabel}>{t('finance.modules.account')}</Text><Choice values={accounts.map((item) => item.id)} value={savings.accountId} onChange={(accountId) => { const selected = accounts.find((item) => item.id === accountId); setSavings((current) => ({ ...current, accountId, currency: selected?.currency ?? current.currency })); }} labels={Object.fromEntries(accounts.map((item) => [item.id, `${item.name} · ${item.currency}`]))} /><Field title={t('finance.release.target')} value={savings.target} onChangeText={(value) => setSavings((current) => ({ ...current, target: value }))} numeric /><DateSelect label={t('finance.release.deadline')} value={savings.deadline} onChange={(deadline) => setSavings((current) => ({ ...current, deadline }))} firstDayOfWeek={state.settings.firstDayOfWeek} /><Pressable style={[styles.primary, (!savings.name.trim() || !savings.accountId || !Number(savings.target)) && styles.buttonDisabled]} disabled={!savings.name.trim() || !savings.accountId || !Number(savings.target)} onPress={addSavings}><Text style={styles.primaryText}>{t('finance.release.save')}</Text></Pressable></ResponsiveModal>
    <ResponsiveModal visible={reminderOpen} onClose={() => setReminderOpen(false)}><Text style={styles.sheetTitle}>{t('finance.release.newReminder')}</Text><Field title={t('finance.release.title')} value={reminder.title} onChangeText={(value) => setReminder((current) => ({ ...current, title: value }))} /><DateSelect label={t('finance.date')} value={reminder.date} onChange={(date) => setReminder((current) => ({ ...current, date }))} firstDayOfWeek={state.settings.firstDayOfWeek} /><Field title={t('finance.release.note')} value={reminder.note} onChangeText={(value) => setReminder((current) => ({ ...current, note: value }))} multiline /><Pressable style={[styles.primary, !reminder.title.trim() && styles.buttonDisabled]} disabled={!reminder.title.trim()} onPress={addReminder}><Text style={styles.primaryText}>{t('finance.release.save')}</Text></Pressable></ResponsiveModal>
    <ResponsiveModal visible={importOpen} onClose={() => setImportOpen(false)}><Text style={styles.sheetTitle}>{t('finance.releaseExtra.importData')}</Text><Text style={styles.body}>{t('finance.releaseImport.importCopy')}</Text><TextInput value={importText} onChangeText={setImportText} multiline style={[styles.input, styles.import]} placeholder="JSON / CSV" placeholderTextColor="rgba(255,244,208,0.3)" accessibilityLabel={t('finance.releaseExtra.importData')} /><Pressable style={[styles.primary, !importText.trim() && styles.buttonDisabled]} disabled={!importText.trim()} onPress={importData}><Text style={styles.primaryText}>{t('finance.releaseExtra.importData')}</Text></Pressable></ResponsiveModal>
    <ResponsiveModal visible={Boolean(debtPaymentTarget)} onClose={() => { setDebtPaymentTarget(null); setLinkedActionError(''); }}><Text style={styles.sheetTitle}>{t('finance.modules.registerPayment')}</Text>{debtPaymentTarget && <Text style={styles.cardMeta}>{debtPaymentTarget.name} · {t('finance.modules.balanceDue', { amount: money(debtPaymentTarget.balance, debtPaymentTarget.currency) })}</Text>}<Text style={styles.fieldLabel}>{t('finance.modules.account')}</Text><Choice values={accounts.map((item) => item.id)} value={debtPaymentAccountId} onChange={(value) => { setDebtPaymentAccountId(value); setLinkedActionError(''); }} labels={Object.fromEntries(accounts.map((item) => [item.id, `${item.name} · ${item.currency}`]))} /><Field title={t('finance.amount')} value={debtPaymentAmount} onChangeText={(value) => { setDebtPaymentAmount(value.replace(/[^0-9.]/g, '')); setLinkedActionError(''); }} numeric placeholder="0" />{Boolean(debtPaymentValidationError) && <Text style={styles.pinError}>{debtPaymentValidationError}</Text>}<Pressable style={[styles.primary, !debtPaymentReady && styles.buttonDisabled]} disabled={!debtPaymentReady} onPress={registerDebtPayment}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable><Pressable style={styles.secondary} onPress={() => setDebtPaymentTarget(null)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable></ResponsiveModal>
    <ResponsiveModal visible={Boolean(savingsTarget)} onClose={() => { setSavingsTarget(null); setLinkedActionError(''); }}><Text style={styles.sheetTitle}>{t('finance.modules.addContribution')}</Text>{savingsTarget && <Text style={styles.cardMeta}>{savingsTarget.name} · {t('finance.modules.goalOf', { target: money(savingsTarget.targetAmount, savingsTarget.currency) })}</Text>}{savingsTarget && !savingsTarget.accountId && <><Text style={styles.fieldLabel}>{t('finance.release.destinationAccount')}</Text><Choice values={accounts.map((item) => item.id)} value={savingsDestinationAccountId} onChange={(value) => { setSavingsDestinationAccountId(value); setLinkedActionError(''); }} labels={Object.fromEntries(accounts.map((item) => [item.id, `${item.name} · ${item.currency}`]))} /></>}<Text style={styles.fieldLabel}>{t('finance.release.sourceAccount')}</Text><Choice values={accounts.filter((item) => item.id !== contributionDestinationId).map((item) => item.id)} value={savingsSourceAccountId} onChange={(value) => { setSavingsSourceAccountId(value); setLinkedActionError(''); }} labels={Object.fromEntries(accounts.map((item) => [item.id, `${item.name} · ${item.currency}`]))} /><Field title={t('finance.amount')} value={savingsAmount} onChangeText={(value) => { setSavingsAmount(value.replace(/[^0-9.]/g, '')); setLinkedActionError(''); }} numeric placeholder="0" />{Boolean(contributionValidationError) && <Text style={styles.pinError}>{contributionValidationError}</Text>}<Pressable style={[styles.primary, !contributionReady && styles.buttonDisabled]} disabled={!contributionReady} onPress={registerSavingsContribution}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable><Pressable style={styles.secondary} onPress={() => setSavingsTarget(null)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable></ResponsiveModal>
    <ResponsiveModal visible={budgetOpen} onClose={() => setBudgetOpen(false)}>
      <Text style={styles.sheetTitle}>{t('finance.modules.newCategoryBudget')}</Text>
      <Text style={styles.fieldLabel}>{t('finance.modules.account')}</Text>
      <Choice values={accounts.map((item) => item.id)} value={budgetDraft.accountId} onChange={(accountId) => setBudgetDraft((current) => ({ ...current, accountId }))} labels={Object.fromEntries(accounts.map((item) => [item.id, item.name]))} />
      <Text style={styles.fieldLabel}>{t('finance.category')}</Text>
      <Choice values={state.categories.expense.map((item) => item.id)} value={budgetDraft.category} onChange={(category) => setBudgetDraft((current) => ({ ...current, category }))} labels={Object.fromEntries(state.categories.expense.map((item) => [item.id, t(`finance.categories.${item.id}`, { defaultValue: item.id })]))} />
      <Text style={styles.fieldLabel}>{t('finance.modules.period')}</Text>
      <Choice values={['weekly', 'monthly']} value={budgetDraft.period} onChange={(period) => setBudgetDraft((current) => ({ ...current, period: period as Budget['period'] }))} labels={{ weekly: t('finance.modules.weekly'), monthly: t('finance.modules.monthly') }} />
      <Field title={t('finance.spendingLimit')} value={budgetDraft.limit} onChangeText={(limit) => setBudgetDraft((current) => ({ ...current, limit: limit.replace(/[^0-9.]/g, '') }))} numeric placeholder="0" />
      <Pressable style={styles.toggleRow} onPress={() => setBudgetDraft((current) => ({ ...current, rollover: !current.rollover }))}><Ionicons name={budgetDraft.rollover ? 'checkbox-outline' : 'square-outline'} size={21} color={C.gold} /><Text style={styles.cardTitle}>{t('finance.modules.rollover')}</Text></Pressable>
      <Pressable style={[styles.primary, (!budgetDraft.accountId || !Number(budgetDraft.limit)) && styles.buttonDisabled]} disabled={!budgetDraft.accountId || !Number(budgetDraft.limit)} onPress={addBudget}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable>
      <Pressable style={styles.secondary} onPress={() => setBudgetOpen(false)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable>
    </ResponsiveModal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  accountTypeChoices: { gap: 8, paddingBottom: 4 },
  accountTypeChoice: { minHeight: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.035)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  accountTypeChoiceActive: { borderColor: C.gold, backgroundColor: C.gold },
  accountTypeText: { color: 'rgba(255,244,208,0.55)', fontFamily: SANS, fontSize: 9, fontWeight: '600' },
  accountTypeTextActive: { color: C.void },
  categoryListHeader: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  categoryAddButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  currencySelect: { minHeight: 54, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  currencySelectIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  currencySelectCopy: { flex: 1, minWidth: 0 },
  currencySelectCode: { color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  currencySelectHint: { color: 'rgba(255,244,208,0.36)', fontFamily: SANS, fontSize: 8.5, marginTop: 3 },
  currencyPickerBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 34, backgroundColor: 'rgba(0,0,0,0.78)' },
  currencyPickerSheet: { width: '100%', maxWidth: 520, maxHeight: '82%', alignSelf: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 16, overflow: 'hidden' },
  currencyPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currencySearch: { height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.055)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  currencySearchInput: { flex: 1, minWidth: 0, height: 43, color: C.goldLight, fontFamily: SANS, fontSize: 11, paddingVertical: 0 },
  currencyOption: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.09)', paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencyOptionActive: { backgroundColor: 'rgba(233,200,119,0.055)' },
  currencyOptionMark: { width: 30, height: 30, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.2)', alignItems: 'center', justifyContent: 'center' },
  currencyOptionMarkText: { color: C.gold, fontFamily: SERIF, fontSize: 14 },
  currencyOptionCode: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  settingsOptionList: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, overflow: 'hidden', marginBottom: 14 },
  activitySearch: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.055)', paddingHorizontal: 12 },
  activitySearchInput: { flex: 1, height: 42, color: C.goldLight, fontFamily: SANS, fontSize: 11, paddingVertical: 0 },
  activityIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  activityIncomeIcon: { backgroundColor: 'rgba(183,173,132,0.08)' },
  chartCategory: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.07)', padding: 14, marginBottom: 18 },
  addAction: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 12 },
  addActionIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.32)', backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  addActionText: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  summaryAmount: { color: C.goldLight, fontFamily: SERIF, fontSize: 28 },
  smallAction: { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.025)', alignItems: 'center', justifyContent: 'center' },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  inlineButton: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.45)', backgroundColor: 'rgba(233,200,119,0.055)', alignItems: 'center', justifyContent: 'center' },
  inlineButtonText: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  toggleRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  reminderCheck: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  reminderCheckDone: { backgroundColor: C.green, borderColor: C.green },
  reminderCheckOverdue: { borderColor: 'rgba(240,139,136,0.55)', backgroundColor: 'rgba(240,139,136,0.08)' },
  overdueText: { color: C.red },
  settingsOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  settingsOptionText: { color: 'rgba(255,244,208,0.55)', fontFamily: SANS, fontSize: 10 },
  settingsOptionTextActive: { color: C.goldLight, fontWeight: '700' },
  settingsRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  settingsRowMain: { flex: 1, minWidth: 0 },
  settingsRowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 11, fontWeight: '600' },
  settingsRowValue: { color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 9, marginTop: 5 },
  settingsBack: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  settingsBackText: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  iconPreviewRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 10, marginBottom: 8 },
  iconPreviewButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' },
  iconPreviewText: { flex: 1, color: 'rgba(255,244,208,0.46)', fontFamily: SANS, fontSize: 9 },
  iconPickerBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.72)' },
  iconPickerSheet: { maxHeight: '78%', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 18 },
  iconPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 10, paddingBottom: 4 },
  iconPickerChoice: { width: 46, height: 46, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center' },
  accountAmount: { alignItems: 'flex-end', marginLeft: 8 },
  categoryTabShell: { height: 50, marginHorizontal: -14, marginTop: -14, marginBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.11)' },
  categoryTabRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 10 },
  categoryTab: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  categoryTabActive: { borderBottomColor: C.gold },
  categoryTabText: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 9, letterSpacing: 0.5 },
  categoryTabTextActive: { color: C.goldLight, fontWeight: '600' },
  toolGrid: { gap: 8 },
  toolCard: { minHeight: 62, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.16)', backgroundColor: 'rgba(255,255,255,0.025)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  toolCardActive: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.12)' },
  toolCardIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.2)', backgroundColor: 'rgba(233,200,119,0.06)', alignItems: 'center', justifyContent: 'center' },
  toolCardIconActive: { backgroundColor: C.gold, borderColor: C.gold },
  toolCardTitle: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SANS, fontSize: 10.5, lineHeight: 14 },
  toolCardTitleActive: { color: C.goldLight, fontWeight: '700' },
  toolBack: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  toolBackText: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  toolWorkspace: { paddingTop: 2 },
  toolWorkspaceTitle: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  calculatorDisplay: { minHeight: 128, paddingHorizontal: 8, paddingVertical: 12, alignItems: 'flex-end', justifyContent: 'flex-end', marginBottom: 14 },
  calculatorExpression: { width: '100%', color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 24, textAlign: 'right' },
  calculatorAnswer: { width: '100%', color: C.goldLight, fontFamily: SANS, fontSize: 46, fontWeight: '300', textAlign: 'right', marginTop: 6 },
  calculatorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  calculatorKey: { width: '22.5%', aspectRatio: 1, maxHeight: 70, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.105)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  calculatorUtilityKey: { backgroundColor: 'rgba(255,244,208,0.62)' },
  calculatorOperatorKey: { backgroundColor: C.gold },
  calculatorKeyText: { color: '#FFF8E9', fontFamily: SANS, fontSize: 20, lineHeight: 24, fontWeight: '500', includeFontPadding: false, textAlignVertical: 'center', textAlign: 'center' },
  calculatorUtilityText: { color: C.void },
  calculatorOperatorText: { color: C.void, fontSize: 23, lineHeight: 27 },
  cashSummary: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.2)', backgroundColor: 'rgba(233,200,119,0.07)', padding: 15, marginBottom: 15 },
  cashTotal: { color: C.goldLight, fontFamily: SERIF, fontSize: 30, marginBottom: 3 },
  cashTableHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  cashRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cashDenomination: { flex: 1.15, minWidth: 0, marginTop: 0, marginBottom: 0 },
  cashQuantity: { flex: 0.8, minWidth: 0, marginTop: 0, marginBottom: 0 },
  cashMultiply: { width: 12, color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 14, textAlign: 'center' },
  cashDelete: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,139,136,0.06)' },
  cashDeleteSpace: { width: 44 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarArrow: { width: 34, height: 34, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  calendarMonth: { color: C.goldLight, fontFamily: SERIF, fontSize: 19, textTransform: 'capitalize' },
  calendarWeekdays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calendarWeekday: { width: '13.4%', color: 'rgba(255,244,208,0.36)', fontFamily: SANS, fontSize: 7, textAlign: 'center', letterSpacing: 0.5 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 5 },
  calendarCell: { width: '13.4%', minHeight: 58, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.14)', backgroundColor: 'rgba(255,255,255,0.025)', padding: 5 },
  calendarCellSelected: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.12)' },
  calendarCellMuted: { opacity: 0.22 },
  calendarDay: { color: C.goldLight, fontFamily: SANS, fontSize: 9, marginBottom: 4 },
  calendarIncome: { color: C.green, fontFamily: SANS, fontSize: 7, minHeight: 10 },
  calendarExpense: { color: C.red, fontFamily: SANS, fontSize: 7, minHeight: 10 },
  calendarLegend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 12 },
  calendarDetails: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 14, paddingTop: 14 },
  calendarDetailRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.08)' },
  addCategoryItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 4 },
  addCategoryText: { color: C.gold, fontFamily: SANS, fontSize: 10, letterSpacing: 0.8 },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 20 },
  settingsTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 18, marginTop: 4 },
  pinError: { color: C.red, fontFamily: SANS, fontSize: 10, marginTop: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  moduleContent: { paddingTop: 24 },
  buttonDisabled: { opacity: 0.42 },
  dangerButton: { minHeight: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  dangerButtonText: { color: C.red, fontFamily: SANS, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  progressIntro: { paddingHorizontal: 2, marginBottom: 14 },
  progressTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 26, marginTop: 3 },
  progressCopy: { color: 'rgba(255,244,208,0.58)', fontFamily: SANS, fontSize: 12, lineHeight: 18, marginTop: 7 },
  progressCard: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.24)', backgroundColor: 'rgba(233,200,119,0.07)', padding: 14 },
  progressTreeArt: { height: 182, alignItems: 'center', justifyContent: 'flex-start', position: 'relative', overflow: 'hidden' },
  progressCrown: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: 'rgba(233,200,119,0.44)', backgroundColor: 'rgba(233,200,119,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  progressTrunk: { position: 'absolute', width: 2, height: 58, backgroundColor: 'rgba(233,200,119,0.4)', top: 88 },
  progressBranchLeft: { position: 'absolute', width: 54, height: 2, backgroundColor: 'rgba(233,200,119,0.3)', top: 120, left: '25%', transform: [{ rotate: '-27deg' }] },
  progressBranchRight: { position: 'absolute', width: 54, height: 2, backgroundColor: 'rgba(233,200,119,0.3)', top: 120, right: '25%', transform: [{ rotate: '27deg' }] },
  progressNodes: { position: 'absolute', top: 139, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  progressNode: { width: 27, height: 27, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.25)', backgroundColor: 'rgba(10,12,20,0.46)', alignItems: 'center', justifyContent: 'center' },
  progressNodeActive: { borderColor: C.gold, backgroundColor: C.gold },
  progressSummary: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(233,200,119,0.16)', paddingTop: 14 },
  progressTrack: { width: '100%', height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLevelLabel: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  progressPoints: { color: C.goldLight, fontFamily: SERIF, fontSize: 34, marginTop: 3 },
  progressPointsUnit: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11 },
  progressNext: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 10, marginTop: 7 },
  progressRule: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 3, marginTop: 14 },
  aboutCompact: { alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  root: { flex: 1, backgroundColor: C.void }, header: { height: 78, paddingTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, back: { width: 42 }, backText: { color: C.goldLight, fontSize: 34, fontWeight: '200' }, headerTitle: { flex: 1, textAlign: 'center', color: C.goldLight, fontFamily: SERIF, fontSize: 21 }, headerSpace: { width: 42 }, content: { paddingHorizontal: 18, paddingBottom: 50 }, panel: { width: '100%', maxWidth: 720, alignSelf: 'center', borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.72)', padding: 14, marginBottom: 15 }, row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' }, rowMain: { flex: 1, minWidth: 0 }, accountStripe: { width: 5, height: 38, borderRadius: 3 }, cardTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13 }, cardMeta: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11, marginTop: 4 }, positive: { color: C.goldLight, fontFamily: SERIF, fontSize: 14 }, negative: { color: C.red, fontFamily: SERIF, fontSize: 14 }, primary: { minHeight: 48, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: C.void, fontFamily: SANS, fontSize: 11, fontWeight: '700', letterSpacing: 1 }, secondary: { minHeight: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, secondaryText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' }, danger: { minHeight: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, dangerText: { color: C.red, fontFamily: SANS, fontSize: 11, fontWeight: '700' }, module: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, body: { color: 'rgba(255,244,208,0.72)', fontFamily: SANS, fontSize: 13, lineHeight: 20, marginVertical: 10 }, track: { height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginVertical: 9 }, fill: { height: '100%', borderRadius: 4, backgroundColor: C.gold }, chart: { marginBottom: 14 }, chartTop: { flexDirection: 'row', justifyContent: 'space-between' }, check: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.gold, color: C.gold, textAlign: 'center', textAlignVertical: 'center' }, checkDone: { backgroundColor: C.gold, borderColor: C.gold, color: C.void }, strike: { textDecorationLine: 'line-through', opacity: 0.5 }, toolResult: { color: C.goldLight, fontFamily: SERIF, fontSize: 29, marginBottom: 15 }, toolChoices: { gap: 7, paddingBottom: 8 }, toolChoice: { minHeight: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 }, toolChoiceActive: { backgroundColor: C.gold, borderColor: C.gold }, toolChoiceText: { color: 'rgba(255,244,208,0.62)', fontFamily: SANS, fontSize: 11 }, toolChoiceTextActive: { color: C.void, fontWeight: '700' }, menuLink: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, field: { marginTop: 11 }, fieldLabel: { color: 'rgba(233,200,119,0.72)', fontFamily: SANS, fontSize: 11, letterSpacing: 1, marginBottom: 6 }, input: { minHeight: 48, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', color: C.goldLight, fontFamily: SANS, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 }, multiline: { minHeight: 80, textAlignVertical: 'top' }, import: { minHeight: 210, textAlignVertical: 'top', marginTop: 12 }, choices: { gap: 7, paddingVertical: 8 }, choice: { minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 12, justifyContent: 'center' }, choiceActive: { backgroundColor: 'rgba(233,200,119,0.14)', borderColor: C.gold }, choiceText: { color: 'rgba(255,244,208,0.62)', fontFamily: SANS, fontSize: 11 }, choiceTextActive: { color: C.goldLight }, iconChoices: { gap: 8, paddingVertical: 8 }, iconChoice: { width: 44, height: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center' }, iconChoiceActive: { backgroundColor: C.gold, borderColor: C.gold }, categoryRowIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.06)', alignItems: 'center', justifyContent: 'center' }, categoryRowName: { flex: 1 }, empty: { alignItems: 'center', paddingVertical: 28 }, diamond: { width: 22, height: 22, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 15 }, emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13 }, emptyBody: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11, marginTop: 7, textAlign: 'center' }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' }, sheet: { width: '100%', maxWidth: 620, maxHeight: '90%', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 18 }, sheetTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 23, marginBottom: 12 }, about: { color: C.gold, fontFamily: SERIF, fontSize: 48, textAlign: 'center', marginTop: 20 }, aboutTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 24, textAlign: 'center', marginBottom: 12 },
});
