import React from 'react';
import {
  KeyboardAvoidingView,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Gem from '@/shared/ui/Gem';
import { C, LIGHT_C, SANS, SERIF, createThemeStyles, getThemeColors } from '@/shared/theme/luxury';
import type { FinanceModuleName } from './FinanceModulesScreen';
import { useFinance } from '@/features/finance/application/FinanceContext';
import type { Account as FinanceAccount, Budget as FinanceBudget } from '@/features/finance/domain/entities/financeTypes';
import { currencyRate, historicalAmountInCurrency } from '@/shared/finance/currency';
import DateSelect from '@/shared/ui/DateSelect';
import { SearchableSelect, type SelectOption } from '@/shared/ui/FormKit';
import { accountHasHistory, inDateRange, periodBounds, previousPeriodBounds } from '@/features/finance/domain/services/financeDomain';

type TransactionKind = 'expense' | 'income' | 'transfer';
type ScreenMode = 'budget' | 'allActivity';
type StatsRange = 'today' | 'week' | 'month' | 'year';
type StatsView = 'charts' | 'calendar';

type Category = string;

function amountFontSize(value: string, emptySize = 20) {
  const length = value.replace(/[^0-9]/g, '').length;
  if (length === 0) return emptySize;
  if (length <= 9) return 27;
  if (length <= 12) return 23;
  if (length <= 15) return 19;
  if (length <= 19) return 16;
  return 14;
}

type Transaction = {
  id: string;
  title: string;
  category: Category;
  amount: number;
  kind: TransactionKind;
  date: string;
  transferId?: string;
  debtId?: string;
  savingsGoalId?: string;
  currency?: string;
  baseAmount?: number;
  baseCurrency?: string;
};

type BudgetAccount = {
  id: string;
  name: string;
  type: FinanceAccount['type'];
  openingBalance: number;
  limit: number;
  limitSet: boolean;
  currency: string;
  exchangeRate?: number;
  color: string;
  transactions: Transaction[];
  storeAccount?: boolean;
  archived?: boolean;
};

type PortfolioTransaction = Transaction & { budgetId: string; budgetName: string; budgetColor: string };

function HeaderBackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return <Pressable onPress={onPress} style={styles.screenBackButton} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('finance.back')}><Ionicons name="arrow-back-outline" size={19} color={C.goldLight} /></Pressable>;
}

const ACCOUNT_COLORS = ['#E9C877', '#B7AD84', '#80B9FF', '#D99BEF', '#F08B88'];

function parseAmount(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function sanitizeAmount(value: string) {
  const cleaned = value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [whole, ...decimals] = cleaned.split('.');
  return decimals.length ? `${whole}.${decimals.join('')}` : cleaned;
}

function balanceFor(budget: BudgetAccount) {
  const totals = budget.transactions.reduce((result, item) => {
    if (item.kind === 'income') result.income += item.amount;
    if (item.kind === 'expense') result.expenses += item.amount;
    if (item.kind === 'transfer') result.transfers += item.amount;
    return result;
  }, { income: 0, expenses: 0, transfers: 0 });
  return budget.openingBalance + totals.income - totals.expenses - totals.transfers;
}

function balanceImpact(kind: TransactionKind | 'adjustment', amount: number) {
  if (kind === 'adjustment') return amount;
  return kind === 'income' ? Math.abs(amount) : -Math.abs(amount);
}

function formatMoney(value: number, language: string, currency = 'USD') {
  return `${value.toLocaleString(language, { maximumFractionDigits: 2 })} ${currency}`;
}

function MenuGlyph() {
  return (
    <View style={styles.menuGlyph}>
      <View style={styles.menuLineWide} />
      <View style={styles.menuLine} />
      <View style={styles.menuLineWide} />

    </View>
  );
}

function AccountsGlyph() {
  return (
    <View style={styles.accountsGlyph}>
      <View style={styles.accountGlyphRow}><View style={styles.accountGlyphDot} /><View style={styles.accountGlyphLine} /></View>
      <View style={styles.accountGlyphRow}><View style={styles.accountGlyphDot} /><View style={styles.accountGlyphLine} /></View>
      <View style={styles.accountGlyphRow}><View style={styles.accountGlyphDot} /><View style={styles.accountGlyphLine} /></View>
    </View>
  );
}

function DrawerModuleGlyph({ module }: { module: string }) {
  const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    accounts: 'wallet-outline', activity: 'receipt-outline', budget: 'speedometer-outline', recurring: 'repeat-outline',
    debt: 'card-outline', savings: 'trending-up-outline', reminders: 'notifications-outline', calendar: 'calendar-outline',
    charts: 'bar-chart-outline', categories: 'grid-outline', notes: 'document-text-outline', tools: 'calculator-outline',
    progress: 'diamond-outline', settings: 'settings-outline', about: 'information-circle-outline',
  };
  const iconName = icons[module] ?? 'apps-outline';

  return <Ionicons name={iconName} size={20} color={C.gold} />;
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

export default function RichScreen({ onOpenModule, drawerReopenSignal = 0 }: { onOpenModule?: (module: FinanceModuleName, returnToDrawer?: boolean, activityAccountId?: string) => void; drawerReopenSignal?: number }) {
  const { t, i18n } = useTranslation();
  const finance = useFinance();
  const { state: financeState, loaded: financeLoaded, updateState: updateFinanceState } = finance;
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const lightMode = getThemeColors().void === LIGHT_C.void;
  const screenWidth = useWindowDimensions().width;
  const narrowLayout = screenWidth < 360;
  const tabletLayout = screenWidth >= 700;
  const accountBudgetByAccountId = React.useMemo(() => {
    const budgetsByAccount = new Map<string, FinanceBudget>();
    financeState.budgets.forEach((budget) => {
      if (budget.category === 'all' && !budgetsByAccount.has(budget.accountId)) budgetsByAccount.set(budget.accountId, budget);
    });
    return budgetsByAccount;
  }, [financeState.budgets]);
  const accountTransactionsByAccountId = React.useMemo(() => {
    const transactionsByAccount = new Map<string, Transaction[]>();
    financeState.transactions.forEach((transaction) => {
      if (transaction.status === 'void') return;
      const accountTransactions = transactionsByAccount.get(transaction.accountId) ?? [];
      accountTransactions.push({
        id: transaction.id,
        title: transaction.payee || transaction.description || t('finance.untitled'),
        category: transaction.category,
        amount: Math.abs(transaction.amount),
        kind: transaction.kind === 'adjustment' ? (transaction.amount >= 0 ? 'income' : 'expense') : transaction.kind,
        date: transaction.date,
        transferId: transaction.transferId,
        debtId: transaction.debtId,
        savingsGoalId: transaction.savingsGoalId,
        currency: transaction.currency,
        baseAmount: Number.isFinite(transaction.baseAmount) ? Math.abs(transaction.baseAmount as number) : undefined,
        baseCurrency: transaction.baseCurrency,
      });
      transactionsByAccount.set(transaction.accountId, accountTransactions);
    });
    transactionsByAccount.forEach((transactions) => transactions.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()));
    return transactionsByAccount;
  }, [financeState.transactions, t]);
  const accountViews = React.useMemo<BudgetAccount[]>(() => financeState.accounts
    .map((account, index) => {
      const accountBudget = accountBudgetByAccountId.get(account.id);
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        openingBalance: account.openingBalance,
        limit: accountBudget?.limit ?? 0,
        limitSet: Boolean(accountBudget && accountBudget.limit > 0),
        currency: account.currency,
        exchangeRate: account.exchangeRate,
        color: account.color || ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
        transactions: [...(accountTransactionsByAccountId.get(account.id) ?? [])],
        archived: account.archived,
      };
    }), [accountBudgetByAccountId, accountTransactionsByAccountId, financeState.accounts]);
  const budgets = React.useMemo(() => accountViews.filter((account) => !account.archived), [accountViews]);
  const storeTransferOption = React.useMemo<BudgetAccount>(() => ({
    id: financeState.store.businessAccount.id,
    name: t('finance.storeAccount.name', { defaultValue: financeState.store.businessAccount.name }),
    type: 'cash',
    openingBalance: financeState.store.businessAccount.balance,
    limit: 0,
    limitSet: false,
    currency: financeState.store.businessAccount.currency,
    color: C.gold,
    transactions: [],
    storeAccount: true,
    archived: false,
  }), [financeState.store.businessAccount, t]);
  const transferOptions = React.useMemo(() => [...budgets, storeTransferOption], [budgets, storeTransferOption]);
  const activeBudgetId = financeState.settings.activeAccountId ?? budgets[0]?.id ?? '';
  const [screenMode, setScreenMode] = React.useState<ScreenMode>('budget');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [statsOpen, setStatsOpen] = React.useState(false);
  const [statsRange, setStatsRange] = React.useState<StatsRange>('month');
  const [statsView, setStatsView] = React.useState<StatsView>('charts');
  const [statsCalendarMonth, setStatsCalendarMonth] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedStatsDate, setSelectedStatsDate] = React.useState(() => new Date().toDateString());
  const [quickMenuOpen, setQuickMenuOpen] = React.useState(false);
  const [exitPromptOpen, setExitPromptOpen] = React.useState(false);
  const [negativeBalancePrompt, setNegativeBalancePrompt] = React.useState<{ account: string; amount: string; onConfirm: () => void } | null>(null);
  const [entryOpen, setEntryOpen] = React.useState(false);
  const [entryKind, setEntryKind] = React.useState<TransactionKind>('expense');
  const [entryTitle, setEntryTitle] = React.useState('');
  const [entryAmount, setEntryAmount] = React.useState('');
  const [entryDate, setEntryDate] = React.useState(() => new Date().toISOString());
  const [entryAccountId, setEntryAccountId] = React.useState('');
  const [entryCategory, setEntryCategory] = React.useState<Category>('other');
  const [categoryPickerOpen, setCategoryPickerOpen] = React.useState(false);
  const [categoryQuery, setCategoryQuery] = React.useState('');
  const [transferTargetId, setTransferTargetId] = React.useState('');
  const [transferSourceId, setTransferSourceId] = React.useState('');
  const [transferRate, setTransferRate] = React.useState('');
  const [transferError, setTransferError] = React.useState('');
  const [newBudgetName, setNewBudgetName] = React.useState('');
  const [newBudgetBalance, setNewBudgetBalance] = React.useState('');
  const [newBudgetLimit, setNewBudgetLimit] = React.useState('');
  const [newBudgetCurrency, setNewBudgetCurrency] = React.useState('USD');
  const [newBudgetExchangeRate, setNewBudgetExchangeRate] = React.useState('1');
  const [newBudgetColor, setNewBudgetColor] = React.useState(ACCOUNT_COLORS[0]);
  const [editingBudget, setEditingBudget] = React.useState<BudgetAccount | null>(null);
  const [editingTransaction, setEditingTransaction] = React.useState<{ budgetId: string; transaction: Transaction } | null>(null);
  const [selectedTransaction, setSelectedTransaction] = React.useState<{ budgetId: string; transaction: Transaction } | null>(null);
  const promptedForFirstAccount = React.useRef(false);
  const lastDrawerReopenSignal = React.useRef(drawerReopenSignal);


  React.useEffect(() => {
    if (!financeLoaded || !budgets[0] || financeState.settings.activeAccountId) return;
    updateFinanceState((current) => ({ ...current, settings: { ...current.settings, activeAccountId: budgets[0].id } }));
  }, [budgets, financeLoaded, financeState.settings.activeAccountId, updateFinanceState]);

  // Reopen the drawer in a layout effect so it is part of the first frame
  // after a module closes. Using a regular effect briefly exposes the main
  // screen with no drawer, which looks like a navigation flicker.
  React.useLayoutEffect(() => {
    if (drawerReopenSignal > lastDrawerReopenSignal.current) setDrawerOpen(true);
    lastDrawerReopenSignal.current = drawerReopenSignal;
  }, [drawerReopenSignal]);

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
      if (screenMode === 'allActivity') {
        setScreenMode('budget');
        return true;
      }
      setExitPromptOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [drawerOpen, exitPromptOpen, screenMode]);

  React.useEffect(() => {
    if (budgets.length) {
      promptedForFirstAccount.current = false;
      return;
    }
    if (!financeLoaded || promptedForFirstAccount.current) return;
    promptedForFirstAccount.current = true;
    onOpenModule?.('accounts');
  }, [budgets.length, financeLoaded, onOpenModule]);

  const activeBudget = React.useMemo(() => budgets.find((budget) => budget.id === activeBudgetId) ?? budgets[0], [activeBudgetId, budgets]);
  const activeBudgetHasLimit = activeBudget?.limitSet === true && activeBudget.limit > 0;
  const entryBudget = React.useMemo(() => {
    const selectedId = entryAccountId || editingTransaction?.budgetId || activeBudgetId;
    return budgets.find((budget) => budget.id === selectedId) ?? activeBudget;
  }, [activeBudget, activeBudgetId, budgets, editingTransaction, entryAccountId]);
  const entryAccountOptions = React.useMemo<SelectOption[]>(() => budgets.map((budget) => ({
    value: budget.id,
    label: budget.name,
    description: budget.currency,
    icon: 'wallet-outline',
  })), [budgets]);
  const transferAccountSelectOptions = React.useMemo<SelectOption[]>(() => transferOptions.map((budget) => ({
    value: budget.id,
    label: budget.name,
    description: budget.currency,
    icon: budget.storeAccount ? 'storefront-outline' : 'wallet-outline',
  })), [transferOptions]);
  const transferTargetSelectOptions = React.useMemo(() => transferAccountSelectOptions.filter((option) => option.value !== transferSourceId), [transferAccountSelectOptions, transferSourceId]);
  const operationCategories = entryKind === 'income' ? financeState.categories.income : financeState.categories.expense;
  const normalizedCategoryQuery = categoryQuery.trim().toLowerCase();
  const filteredOperationCategories = React.useMemo(() => operationCategories.filter((category) => {
    const label = category.name ?? t(`finance.categories.${category.id}`, { defaultValue: category.id });
    return !normalizedCategoryQuery || label.toLowerCase().includes(normalizedCategoryQuery);
  }), [normalizedCategoryQuery, operationCategories, t]);
  React.useEffect(() => {
    if (entryKind === 'transfer' || operationCategories.some((category) => category.id === entryCategory)) return;
    setEntryCategory(operationCategories.find((category) => category.id === 'other')?.id ?? operationCategories[0]?.id ?? 'other');
  }, [entryCategory, entryKind, operationCategories]);
  React.useEffect(() => {
    const reference = new Date();
    setStatsCalendarMonth(new Date(reference.getFullYear(), reference.getMonth(), 1));
    setSelectedStatsDate(reference.toDateString());
  }, [statsRange]);
  const [referenceNow] = React.useState(() => new Date());
  const activeLimitDefinition = React.useMemo(() => activeBudget ? financeState.budgets.find((item) => item.accountId === activeBudget.id && item.category === 'all') : undefined, [activeBudget, financeState.budgets]);
  const activeLimitRange = React.useMemo(() => activeLimitDefinition?.period === 'custom'
    ? { start: new Date(activeLimitDefinition.startDate), end: new Date(activeLimitDefinition.endDate) }
    : periodBounds(activeLimitDefinition?.period === 'weekly' ? 'week' : 'month', referenceNow, financeState.settings.firstDayOfWeek), [activeLimitDefinition, financeState.settings.firstDayOfWeek, referenceNow]);
  const expenses = React.useMemo(() => activeBudget ? activeBudget.transactions
    .filter((item) => item.kind === 'expense' && !item.transferId && inDateRange(item.date, activeLimitRange))
    .reduce((sum, item) => sum + item.amount, 0) : 0, [activeBudget, activeLimitRange]);
  const balance = React.useMemo(() => activeBudget ? balanceFor(activeBudget) : 0, [activeBudget]);
  const positiveBalance = Math.max(0, balance);
  const budgetProgress = activeBudgetHasLimit ? expenses / activeBudget.limit : 0;
  const baseCurrency = financeState.settings.preferredCurrency || 'USD';
  const currencyRates = React.useMemo(() => financeState.settings.exchangeRates ?? { USD: 1 }, [financeState.settings.exchangeRates]);
  const rateBetweenCurrencies = React.useCallback((fromCurrency: string, toCurrency: string) => currencyRate(fromCurrency, toCurrency, currencyRates), [currencyRates]);
  const rateForBudget = React.useCallback((budget: BudgetAccount, toCurrency: string) => {
    if (budget.currency === toCurrency) return 1;
    return rateBetweenCurrencies(budget.currency, toCurrency) ?? (toCurrency === baseCurrency ? budget.exchangeRate : undefined);
  }, [baseCurrency, rateBetweenCurrencies]);
  const rateForTransfer = React.useCallback((source: BudgetAccount, target: BudgetAccount) => {
    const configuredRate = rateBetweenCurrencies(source.currency, target.currency);
    if (configuredRate && configuredRate > 0) return configuredRate;
    const sourceToBase = rateForBudget(source, baseCurrency);
    const targetToBase = rateForBudget(target, baseCurrency);
    return sourceToBase && targetToBase && sourceToBase > 0 && targetToBase > 0 ? sourceToBase / targetToBase : undefined;
  }, [baseCurrency, rateBetweenCurrencies, rateForBudget]);
  const toBaseCurrency = React.useCallback((budget: BudgetAccount, value: number) => {
    const rate = rateForBudget(budget, baseCurrency);
    return rate && rate > 0 ? value * rate : 0;
  }, [baseCurrency, rateForBudget]);
  const transactionToBaseCurrency = React.useCallback((transaction: Transaction, budget: BudgetAccount) => historicalAmountInCurrency({
    amount: transaction.amount,
    currency: transaction.currency ?? budget.currency,
    baseAmount: transaction.baseAmount,
    baseCurrency: transaction.baseCurrency,
  }, baseCurrency, currencyRates) ?? toBaseCurrency(budget, transaction.amount), [baseCurrency, currencyRates, toBaseCurrency]);
  const missingRateCurrencies = React.useMemo(() => Array.from(new Set(budgets.filter((budget) => budget.currency !== baseCurrency && !rateForBudget(budget, baseCurrency)).map((budget) => budget.currency))), [baseCurrency, budgets, rateForBudget]);
  const portfolioBalance = React.useMemo(() => budgets.reduce((sum, budget) => sum + toBaseCurrency(budget, balanceFor(budget)), 0), [budgets, toBaseCurrency]);
  const portfolioPositiveBalance = Math.max(0, portfolioBalance);
  const allTransactions = React.useMemo<PortfolioTransaction[]>(() => accountViews
    .flatMap((budget) => budget.transactions.map((transaction) => ({
      ...transaction,
      budgetId: budget.id,
      budgetName: budget.name,
      budgetColor: budget.color,
    })))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()), [accountViews]);
  const accountViewsById = React.useMemo(() => new Map(accountViews.map((budget) => [budget.id, budget])), [accountViews]);
  const periodRanges = React.useMemo(() => ({
    today: periodBounds('today', referenceNow, financeState.settings.firstDayOfWeek),
    week: periodBounds('week', referenceNow, financeState.settings.firstDayOfWeek),
    month: periodBounds('month', referenceNow, financeState.settings.firstDayOfWeek),
    year: periodBounds('year', referenceNow, financeState.settings.firstDayOfWeek),
  }), [financeState.settings.firstDayOfWeek, referenceNow]);
  const todayTransactions = React.useMemo(() => activeBudget?.transactions.filter((item) => inDateRange(item.date, periodRanges.today)) ?? [], [activeBudget, periodRanges.today]);
  const todayAllTransactions = React.useMemo(() => allTransactions.filter((item) => inDateRange(item.date, periodRanges.today)), [allTransactions, periodRanges.today]);
  const periods = React.useMemo(() => {
    const periodTotals = (range: { start: Date; end: Date }) => {
      const totals = { income: 0, expenses: 0 };
      activeBudget?.transactions.forEach((item) => {
        if (item.transferId || !inDateRange(item.date, range)) return;
        if (item.kind === 'income') totals.income += item.amount;
        else totals.expenses += item.amount;
      });
      return totals;
    };
    return [
      { key: 'today', label: t('finance.today'), ...periodTotals(periodRanges.today) },
      { key: 'week', label: t('finance.thisWeek'), ...periodTotals(periodRanges.week) },
      { key: 'month', label: t('finance.thisMonth'), ...periodTotals(periodRanges.month) },
      { key: 'year', label: t('finance.yearToDate'), ...periodTotals(periodRanges.year) },
    ];
  }, [activeBudget, periodRanges, t]);
  const portfolioPeriods = React.useMemo(() => {
    const portfolioPeriodTotals = (range: { start: Date; end: Date }) => {
      const totals = { income: 0, expenses: 0 };
      allTransactions.forEach((item) => {
        if (item.transferId || !inDateRange(item.date, range)) return;
        const budget = accountViewsById.get(item.budgetId);
        if (!budget) return;
        if (item.kind === 'income') totals.income += transactionToBaseCurrency(item, budget);
        else totals.expenses += transactionToBaseCurrency(item, budget);
      });
      return totals;
    };
    return [
      { key: 'today', label: t('finance.today'), ...portfolioPeriodTotals(periodRanges.today) },
      { key: 'week', label: t('finance.thisWeek'), ...portfolioPeriodTotals(periodRanges.week) },
      { key: 'month', label: t('finance.thisMonth'), ...portfolioPeriodTotals(periodRanges.month) },
      { key: 'year', label: t('finance.yearToDate'), ...portfolioPeriodTotals(periodRanges.year) },
    ];
  }, [accountViewsById, allTransactions, periodRanges, t, transactionToBaseCurrency]);
  const statsPeriods = screenMode === 'allActivity' ? portfolioPeriods : periods;
  const statsCurrency = screenMode === 'allActivity' ? baseCurrency : activeBudget?.currency ?? baseCurrency;
  const statsRangeOptions: { key: StatsRange; label: string }[] = [
    { key: 'today', label: t('finance.today') },
    { key: 'week', label: t('finance.thisWeek') },
    { key: 'month', label: t('finance.thisMonth') },
    { key: 'year', label: t('finance.yearToDate') },
  ];
  const statsRangeBounds = periodRanges[statsRange];
  const statsCalendarRange = React.useMemo(() => ({
    start: new Date(statsCalendarMonth.getFullYear(), statsCalendarMonth.getMonth(), 1),
    end: new Date(statsCalendarMonth.getFullYear(), statsCalendarMonth.getMonth() + 1, 1),
  }), [statsCalendarMonth]);
  const statsTransactionRange = statsView === 'calendar' ? statsCalendarRange : statsRangeBounds;
  const statsTransactions = React.useMemo(() => (screenMode === 'allActivity' ? allTransactions : activeBudget?.transactions ?? [])
    .filter((item) => !item.transferId && inDateRange(item.date, statsTransactionRange)), [activeBudget, allTransactions, screenMode, statsTransactionRange]);
  const selectedStatsPeriod = statsPeriods.find((period) => period.key === statsRange) ?? statsPeriods[2];
  const statsNet = selectedStatsPeriod.income - selectedStatsPeriod.expenses;
  const selectedBudget = selectedTransaction ? accountViews.find((budget) => budget.id === selectedTransaction.budgetId) : undefined;
  const selectedDisplayAmount = selectedTransaction && selectedBudget
    ? screenMode === 'allActivity' ? transactionToBaseCurrency(selectedTransaction.transaction, selectedBudget) : selectedTransaction.transaction.amount
    : selectedTransaction?.transaction.amount ?? 0;
  const selectedDisplayCurrency = screenMode === 'allActivity'
    ? baseCurrency
    : selectedTransaction?.transaction.currency ?? selectedBudget?.currency ?? baseCurrency;
  const statsCategories = React.useMemo(() => {
    if (!statsOpen) return [];
    const configured = new Map(financeState.categories.expense.map((category) => [category.id, category]));
    const totals = new Map<string, number>();
    statsTransactions.forEach((item) => {
      if (item.kind !== 'expense') return;
      let value = item.amount;
      if (screenMode === 'allActivity') {
        const budget = accountViewsById.get((item as PortfolioTransaction).budgetId);
        value = budget ? transactionToBaseCurrency(item, budget) : 0;
      }
      totals.set(item.category, (totals.get(item.category) ?? 0) + value);
    });
    return Array.from(totals, ([categoryId, total]) => ({ category: categoryId, icon: configured.get(categoryId)?.icon ?? 'pricetag-outline', total })).filter((category) => category.total > 0).sort((left, right) => right.total - left.total);
  }, [accountViewsById, financeState.categories.expense, screenMode, statsOpen, statsTransactions, transactionToBaseCurrency]);
  const statsMaxCategory = Math.max(1, ...statsCategories.map((category) => category.total));
  const statsTotalExpense = statsCategories.reduce((sum, category) => sum + category.total, 0);
  const statsAmountOf = React.useCallback((item: typeof statsTransactions[number]) => {
    if (screenMode !== 'allActivity') return item.amount;
    const portfolioItem = item as PortfolioTransaction;
    const budget = accountViewsById.get(portfolioItem.budgetId);
    return budget ? transactionToBaseCurrency(item, budget) : 0;
  }, [accountViewsById, screenMode, transactionToBaseCurrency]);
  const statsPreviousRange = React.useMemo(() => previousPeriodBounds(statsRange, statsRangeBounds), [statsRange, statsRangeBounds]);
  const statsPreviousTransactions = React.useMemo(() => (screenMode === 'allActivity' ? allTransactions : activeBudget?.transactions ?? [])
    .filter((item) => !item.transferId && inDateRange(item.date, statsPreviousRange)), [activeBudget, allTransactions, screenMode, statsPreviousRange]);
  const statsPreviousTotals = React.useMemo(() => statsPreviousTransactions.reduce((totals, item) => {
    const amount = statsAmountOf(item);
    if (item.kind === 'income') totals.income += amount;
    if (item.kind === 'expense') totals.expenses += amount;
    return totals;
  }, { income: 0, expenses: 0 }), [statsAmountOf, statsPreviousTransactions]);
  const statsComparison = React.useMemo(() => {
    const change = (current: number, previous: number) => previous > 0 ? (current - previous) / previous * 100 : null;
    const currentSavings = selectedStatsPeriod.income > 0 ? (selectedStatsPeriod.income - selectedStatsPeriod.expenses) / selectedStatsPeriod.income * 100 : 0;
    const previousSavings = statsPreviousTotals.income > 0 ? (statsPreviousTotals.income - statsPreviousTotals.expenses) / statsPreviousTotals.income * 100 : 0;
    return {
      income: change(selectedStatsPeriod.income, statsPreviousTotals.income),
      expenses: change(selectedStatsPeriod.expenses, statsPreviousTotals.expenses),
      savings: statsPreviousTotals.income > 0 ? currentSavings - previousSavings : null,
      previousSavings,
    };
  }, [selectedStatsPeriod.expenses, selectedStatsPeriod.income, statsPreviousTotals.expenses, statsPreviousTotals.income]);
  const statsInsights = React.useMemo(() => {
    const dailyExpenses = new Map<string, number>();
    let income = 0;
    let expenses = 0;
    statsTransactions.forEach((item) => {
      const amount = statsAmountOf(item);
      if (item.kind === 'income') income += amount;
      if (item.kind === 'expense') {
        expenses += amount;
        const date = new Date(item.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        dailyExpenses.set(key, (dailyExpenses.get(key) ?? 0) + amount);
      }
    });
    const peak = Array.from(dailyExpenses.entries()).sort((left, right) => right[1] - left[1])[0];
    const days = Math.max(1, Math.ceil((statsTransactionRange.end.getTime() - statsTransactionRange.start.getTime()) / 86400000));
    return {
      averageDailyExpense: expenses / days,
      averageOperation: statsTransactions.length ? (income + expenses) / statsTransactions.length : 0,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
      peakExpense: peak?.[1] ?? 0,
      peakExpenseLabel: peak ? new Date(`${peak[0]}T12:00:00`).toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' }) : '-',
    };
  }, [language, statsAmountOf, statsTransactionRange, statsTransactions]);
  const statsFlowBuckets = React.useMemo(() => {
    if (!statsOpen || statsView !== 'charts') return [];
    const buckets: { key: string; label: string; income: number; expenses: number; current: boolean }[] = [];
    const pushBucket = (key: string, label: string, from: Date, to: Date) => {
      const items = statsTransactions.filter((item) => inDateRange(item.date, { start: from, end: to }));
      buckets.push({
        key,
        label,
        income: items.filter((item) => item.kind === 'income').reduce((sum, item) => sum + statsAmountOf(item), 0),
        expenses: items.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + statsAmountOf(item), 0),
        current: inDateRange(referenceNow.toISOString(), { start: from, end: to }),
      });
    };
    if (statsRange === 'year') {
      const year = statsRangeBounds.start.getFullYear();
      for (let month = 0; month < 12; month += 1) pushBucket(String(month), new Date(year, month, 1).toLocaleDateString(language, { month: 'narrow' }), new Date(year, month, 1), new Date(year, month + 1, 1));
    } else if (statsRange === 'month') {
      const cursor = new Date(statsRangeBounds.start.getFullYear(), statsRangeBounds.start.getMonth(), statsRangeBounds.start.getDate());
      while (cursor < statsRangeBounds.end) {
        const from = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        const weekEnd = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
        const to = weekEnd > statsRangeBounds.end ? statsRangeBounds.end : weekEnd;
        pushBucket(from.toDateString(), `${from.getDate()}–${new Date(to.getTime() - 1).getDate()}`, from, to);
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      const cursor = new Date(statsRangeBounds.start.getFullYear(), statsRangeBounds.start.getMonth(), statsRangeBounds.start.getDate());
      while (cursor < statsRangeBounds.end) {
        const day = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        pushBucket(day.toDateString(), statsRange === 'week' ? day.toLocaleDateString(language, { weekday: 'narrow' }) : String(day.getDate()), day, new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return buckets;
  }, [language, referenceNow, statsAmountOf, statsOpen, statsRange, statsRangeBounds, statsTransactions, statsView]);
  const statsFlowMax = Math.max(1, ...statsFlowBuckets.flatMap((bucket) => [bucket.income, bucket.expenses]));
  const statsFlowHasData = statsFlowBuckets.some((bucket) => bucket.income > 0 || bucket.expenses > 0);
  const statsFlowBarWidth = statsRange === 'year' ? 5 : 8;
  const statsFlowBarGap = statsRange === 'year' ? 2 : 4;
  const statsCalendarFirstDay = financeState.settings.firstDayOfWeek ?? 1;
  const statsCalendarOffset = (new Date(statsCalendarMonth.getFullYear(), statsCalendarMonth.getMonth(), 1).getDay() - statsCalendarFirstDay + 7) % 7;
  const statsCalendarDays = new Date(statsCalendarMonth.getFullYear(), statsCalendarMonth.getMonth() + 1, 0).getDate();
  const statsCalendarCells = React.useMemo(() => statsOpen && statsView === 'calendar' ? Array.from({ length: 42 }, (_, index) => index - statsCalendarOffset + 1) : [], [statsCalendarOffset, statsOpen, statsView]);
  const statsCalendarLabels = statsCalendarFirstDay === 1
    ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const statsCalendarItemsByDate = React.useMemo(() => {
    const itemsByDate = new Map<string, { items: Transaction[]; hasIncome: boolean; hasExpense: boolean }>();
    if (!statsOpen || statsView !== 'calendar') return itemsByDate;
    statsTransactions.forEach((item) => {
      const key = new Date(item.date).toDateString();
      const current = itemsByDate.get(key) ?? { items: [], hasIncome: false, hasExpense: false };
      current.items.push(item);
      current.hasIncome ||= item.kind === 'income';
      current.hasExpense ||= item.kind === 'expense';
      itemsByDate.set(key, current);
    });
    return itemsByDate;
  }, [statsOpen, statsTransactions, statsView]);
  const selectedStatsItems = statsCalendarItemsByDate.get(selectedStatsDate)?.items ?? [];
  const transferSource = transferOptions.find((budget) => budget.id === transferSourceId);
  const transferTarget = transferOptions.find((budget) => budget.id === transferTargetId);
  const transferDisplayedRate = parseAmount(transferRate);
  const transferSameCurrency = Boolean(transferSource && transferTarget && transferSource.currency === transferTarget.currency);
  const transferEffectiveRate = transferSameCurrency ? 1 : transferDisplayedRate;
  const transferHasRate = transferEffectiveRate > 0;
  const transferReceivedPreview = parseAmount(entryAmount) * transferEffectiveRate;
  const entryAmountError = entryAmount.trim() && parseAmount(entryAmount) <= 0 ? t('finance.operationForm.invalidAmount') : '';
  const entryCanSave = parseAmount(entryAmount) > 0 && (entryKind === 'transfer' ? Boolean(transferSource && transferTarget && transferSource.id !== transferTarget.id && transferHasRate) : Boolean(entryBudget));
  const transferValidationError = transferError || (entryKind === 'transfer' && transferSource && transferTarget && transferSource.currency !== transferTarget.currency && !transferHasRate ? t('finance.releaseErrors.missingRate') : '');
  const selectBudget = React.useCallback((budgetId: string) => {
    updateFinanceState((current) => ({ ...current, settings: { ...current.settings, activeAccountId: budgetId } }));
    setScreenMode('budget');
  }, [updateFinanceState]);

  const openQuickModule = React.useCallback((module: FinanceModuleName) => {
    setQuickMenuOpen(false);
    onOpenModule?.(module);
  }, [onOpenModule]);
  const openDrawerModule = React.useCallback((module: FinanceModuleName) => {
    setDrawerOpen(false);
    onOpenModule?.(module, true);
  }, [onOpenModule]);

  const budgetSwipeResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      screenMode === 'budget'
      && Math.abs(gestureState.dx) > 12
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
    ),
    onMoveShouldSetPanResponderCapture: (_, gestureState) => (
      screenMode === 'budget'
      && Math.abs(gestureState.dx) > 12
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
    ),
    onPanResponderRelease: (_, gestureState) => {
      const currentIndex = budgets.findIndex((budget) => budget.id === activeBudgetId);
      if (currentIndex < 0) return;

      const isHorizontalSwipe = Math.abs(gestureState.dx) >= 36 || Math.abs(gestureState.vx) >= 0.35;
      if (!isHorizontalSwipe || Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) return;

      const nextIndex = currentIndex + (gestureState.dx > 0 ? 1 : -1);
      const nextBudget = budgets[nextIndex];
      if (nextBudget) selectBudget(nextBudget.id);
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [activeBudgetId, budgets, screenMode, selectBudget]);


  const closeEntry = React.useCallback(() => {
    setEntryOpen(false);
    setCategoryPickerOpen(false);
    setCategoryQuery('');
    setEditingTransaction(null);
    setEntryTitle('');
    setEntryAmount('');
    setEntryDate(new Date().toISOString());
    setEntryAccountId('');
    setEntryCategory('other');
    setTransferTargetId('');
    setTransferSourceId('');
    setTransferRate('');
    setTransferError('');
  }, []);

  const openEntry = React.useCallback((kind: TransactionKind) => {
    setEditingTransaction(null);
    setEntryKind(kind);
    setEntryAccountId(activeBudget?.id ?? budgets[0]?.id ?? '');
    setEntryDate(new Date().toISOString());
    if (kind === 'transfer') {
      const sourceId = activeBudget?.id ?? budgets[0]?.id ?? '';
      const target = transferOptions.find((budget) => budget.id !== sourceId);
      const source = transferOptions.find((budget) => budget.id === sourceId);
      setTransferSourceId(sourceId);
      setTransferTargetId(target?.id ?? '');
      const configuredRate = source && target ? rateForTransfer(source, target) : undefined;
      setTransferRate(configuredRate ? String(Number(configuredRate.toPrecision(12))) : '');
      setTransferError('');
    }
    setEntryOpen(true);
  }, [activeBudget?.id, budgets, rateForTransfer, transferOptions]);

  React.useEffect(() => {
    if (entryKind !== 'transfer' || !entryOpen) return;
    const source = transferOptions.find((budget) => budget.id === transferSourceId);
    const target = transferOptions.find((budget) => budget.id === transferTargetId);
    const configuredRate = source && target ? rateForTransfer(source, target) : undefined;
    setTransferRate(configuredRate ? String(Number(configuredRate.toPrecision(12))) : '');
    setTransferError('');
  }, [entryKind, entryOpen, rateForTransfer, transferOptions, transferSourceId, transferTargetId]);

  const openTransactionEditor = React.useCallback((budgetId: string, transaction: Transaction) => {
    if (transaction.transferId || transaction.debtId || transaction.savingsGoalId) {
      Alert.alert(t('finance.linkedOperationTitle'), t('finance.linkedOperationCopy'));
      return;
    }
    setEditingTransaction({ budgetId, transaction: { ...transaction } });
    setEntryKind(transaction.kind);
    setEntryAccountId(budgetId);
    setEntryTitle(transaction.title);
    setEntryAmount(String(transaction.amount));
    setEntryDate(transaction.date);
    setEntryCategory(transaction.category);
    setEntryOpen(true);
  }, [t]);

  const removeTransaction = React.useCallback((budgetId: string, transaction: Transaction) => {
    Alert.alert(
      t('finance.deleteEntry', { defaultValue: 'Delete operation' }),
      t('finance.deleteEntryConfirm', { defaultValue: 'Delete this operation?' }),
      [
        { text: t('finance.cancel'), style: 'cancel' },
        {
          text: t('finance.deleteAction', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => transaction.transferId
            ? finance.deleteTransfer(transaction.transferId)
            : finance.deleteTransaction(transaction.id),
        },
      ],
    );
  }, [finance, t]);

  const openTransactionDetails = React.useCallback((budgetId: string, transaction: Transaction) => {
    setSelectedTransaction({ budgetId, transaction: { ...transaction } });
  }, []);

  const addTransaction = React.useCallback(() => {
    const amount = parseAmount(entryAmount);
    if (amount <= 0) return;

    let projectedBalance: number | undefined;
    let projectedAccountName = '';
    let projectedCurrency = baseCurrency;

    if (editingTransaction) {
      const original = financeState.transactions.find((item) => item.id === editingTransaction.transaction.id);
      const originalBudget = budgets.find((item) => item.id === editingTransaction.budgetId);
      const budget = entryBudget ?? originalBudget;
      if (!original || !originalBudget || !budget) return;
      projectedBalance = balanceFor(budget) - (budget.id === originalBudget.id ? balanceImpact(original.kind, original.amount) : 0) + balanceImpact(entryKind, amount);
      projectedAccountName = budget.name;
      projectedCurrency = budget.currency;
    } else if (entryKind === 'transfer') {
      const source = transferOptions.find((budget) => budget.id === transferSourceId);
      if (source) {
        projectedBalance = balanceFor(source) - amount;
        projectedAccountName = source.name;
        projectedCurrency = source.currency;
      }
    } else if (entryBudget) {
      projectedBalance = balanceFor(entryBudget) + balanceImpact(entryKind, amount);
      projectedAccountName = entryBudget.name;
      projectedCurrency = entryBudget.currency;
    }

    const commit = () => {
      if (editingTransaction) {
        const original = financeState.transactions.find((item) => item.id === editingTransaction.transaction.id);
        const budget = entryBudget ?? budgets.find((item) => item.id === editingTransaction.budgetId);
        if (!original || !budget) return;
        finance.updateTransaction({
          ...original,
          accountId: budget.id,
          payee: entryTitle.trim() || t('finance.untitled'),
          description: entryTitle.trim() || t('finance.untitled'),
          category: entryCategory,
          amount,
          kind: entryKind,
          currency: budget.currency,
          date: entryDate,
        });
        closeEntry();
        return;
      }

      if (entryKind === 'transfer') {
        const source = transferOptions.find((budget) => budget.id === transferSourceId);
        const target = transferOptions.find((budget) => budget.id === transferTargetId);
        const rate = source && target && source.currency === target.currency ? 1 : parseAmount(transferRate);
        const received = amount * rate;
        if (!source || !target || source.id === target.id || rate <= 0 || received <= 0) {
          setTransferError(t('finance.releaseErrors.missingRate'));
          return;
        }
        finance.addTransfer({
          id: `transfer-${Date.now()}`,
          fromAccountId: source.id,
          toAccountId: target.id,
          fromAmount: amount,
          toAmount: received,
          fromCurrency: source.currency,
          toCurrency: target.currency,
          rate,
          fee: 0,
          date: entryDate,
          note: entryTitle.trim(),
          status: 'cleared',
        });
        closeEntry();
        return;
      }

      if (!entryBudget) return;
      finance.addTransaction({
        id: `transaction-${Date.now()}`,
        accountId: entryBudget.id,
        payee: entryTitle.trim() || t('finance.untitled'),
        description: entryTitle.trim() || t('finance.untitled'),
        category: entryCategory,
        amount,
        kind: entryKind,
        date: entryDate,
        currency: entryBudget.currency,
        paymentMethod: 'cash',
        status: 'cleared',
        reference: '',
      });
      closeEntry();
    };

    if (projectedBalance !== undefined && projectedBalance < 0) {
      setNegativeBalancePrompt({
        account: projectedAccountName,
        amount: formatMoney(projectedBalance, language, projectedCurrency),
        onConfirm: commit,
      });
      return;
    }

    commit();
  }, [baseCurrency, budgets, closeEntry, editingTransaction, entryAmount, entryBudget, entryCategory, entryDate, entryKind, entryTitle, finance, financeState.transactions, language, t, transferOptions, transferRate, transferSourceId, transferTargetId]);

  const createBudget = React.useCallback(() => {
    const name = newBudgetName.trim();
    if (!name) return;
    const displayedRate = parseAmount(newBudgetExchangeRate);
    const exchangeRate = newBudgetCurrency === baseCurrency ? 1 : rateBetweenCurrencies(newBudgetCurrency, baseCurrency) ?? (displayedRate > 0 ? 1 / displayedRate : 0);
    if (newBudgetCurrency !== baseCurrency && exchangeRate <= 0) {
      Alert.alert(t('finance.exchangeRate'), t('finance.exchangeRateRequired', { defaultValue: `Enter the exchange rate from ${newBudgetCurrency} to ${baseCurrency}.` }));
      return;
    }

    const accountId = `account-${Date.now()}`;
    finance.addAccount({
      id: accountId,
      name,
      type: 'cash',
      openingBalance: parseAmount(newBudgetBalance),
      currency: newBudgetCurrency,
      exchangeRate,
      color: newBudgetColor,
      archived: false,
    });
    const baseUsdRate = currencyRates[baseCurrency] ?? (baseCurrency === 'USD' ? 1 : undefined);
    const currencyUsdRate = newBudgetCurrency === 'USD' ? 1 : baseUsdRate ? exchangeRate * baseUsdRate : undefined;
    if (currencyUsdRate) updateFinanceState((current) => ({ ...current, settings: { ...current.settings, exchangeRates: { ...(current.settings.exchangeRates ?? {}), USD: 1, [newBudgetCurrency]: currencyUsdRate } } }));
    const limit = parseAmount(newBudgetLimit);
    if (limit > 0) finance.addBudget({ id: `account-budget-${accountId}`, accountId, category: 'all', limit, period: 'monthly', rollover: false, rolloverAmount: 0, startDate: new Date().toISOString(), endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() });
    updateFinanceState((current) => ({ ...current, settings: { ...current.settings, activeAccountId: accountId } }));
    setScreenMode('budget');
    setNewBudgetName('');
    setNewBudgetBalance('');
    setNewBudgetLimit('');
    setNewBudgetCurrency(baseCurrency);
    setNewBudgetExchangeRate('1');
    setManagerOpen(false);
  }, [baseCurrency, currencyRates, finance, newBudgetBalance, newBudgetColor, newBudgetCurrency, newBudgetExchangeRate, newBudgetLimit, newBudgetName, rateBetweenCurrencies, t, updateFinanceState]);

  const openBudgetEditor = React.useCallback((budget: BudgetAccount) => {
    setEditingBudget({ ...budget, transactions: [...budget.transactions] });
  }, []);

  const openBudgetManager = React.useCallback(() => {
    setManagerOpen(true);
    const budgetNeedingRate = budgets.find((budget) => budget.currency !== baseCurrency && !budget.exchangeRate && !rateBetweenCurrencies(budget.currency, baseCurrency));
    if (budgetNeedingRate) openBudgetEditor(budgetNeedingRate);
  }, [baseCurrency, budgets, openBudgetEditor, rateBetweenCurrencies]);

  const saveBudgetEdit = React.useCallback(() => {
    if (!editingBudget || !editingBudget.name.trim()) return;
    const exchangeRate = editingBudget.currency === baseCurrency ? 1 : rateBetweenCurrencies(editingBudget.currency, baseCurrency) ?? editingBudget.exchangeRate ?? 0;
    if (editingBudget.currency !== baseCurrency && exchangeRate <= 0) {
      Alert.alert(t('finance.exchangeRate'), t('finance.exchangeRateRequired', { defaultValue: `Enter the exchange rate from ${editingBudget.currency} to ${baseCurrency}.` }));
      return;
    }
    const account = financeState.accounts.find((item) => item.id === editingBudget.id);
    if (!account) return;
    if (account.currency !== editingBudget.currency && accountHasHistory(financeState, account.id)) {
      Alert.alert(t('finance.currency'), t('finance.accountCurrencyLocked'));
      return;
    }
    finance.updateAccount({
      ...account,
      name: editingBudget.name.trim(),
      openingBalance: Number.isFinite(editingBudget.openingBalance) ? editingBudget.openingBalance : 0,
      currency: editingBudget.currency,
      color: editingBudget.color,
      exchangeRate,
    });
    const baseUsdRate = currencyRates[baseCurrency] ?? (baseCurrency === 'USD' ? 1 : undefined);
    const currencyUsdRate = editingBudget.currency === 'USD' ? 1 : baseUsdRate ? exchangeRate * baseUsdRate : undefined;
    if (currencyUsdRate) updateFinanceState((current) => ({ ...current, settings: { ...current.settings, exchangeRates: { ...(current.settings.exchangeRates ?? {}), USD: 1, [editingBudget.currency]: currencyUsdRate } } }));
    const existingBudget = financeState.budgets.find((item) => item.accountId === editingBudget.id && item.category === 'all');
    const limit = editingBudget.limitSet ? Math.max(0, editingBudget.limit) : 0;
    if (existingBudget) finance.updateBudget({ ...existingBudget, limit });
    else if (limit > 0) finance.addBudget({ id: `account-budget-${editingBudget.id}`, accountId: editingBudget.id, category: 'all', limit, period: 'monthly', rollover: false, rolloverAmount: 0, startDate: new Date().toISOString(), endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() });
    setEditingBudget(null);
  }, [baseCurrency, currencyRates, editingBudget, finance, financeState, rateBetweenCurrencies, t, updateFinanceState]);

  const renderTransactions = (items: PortfolioTransaction[] | Transaction[], showBudgetName = false) => {
    if (items.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyDiamond} />
          <Text style={styles.emptyTitle}>{t('finance.noActivity')}</Text>
          <Text style={styles.emptyCopy}>{t('finance.noActivityCopy')}</Text>
        </View>
      );
    }

    return items.map((item) => {
      const portfolioItem = item as PortfolioTransaction;
      const transactionBudgetId = showBudgetName ? portfolioItem.budgetId : activeBudgetId;
      const transactionBudget = showBudgetName ? accountViews.find((budget) => budget.id === portfolioItem.budgetId) : activeBudget;
      const displayAmount = showBudgetName && transactionBudget ? transactionToBaseCurrency(item, transactionBudget) : item.amount;
      const displayCurrency = showBudgetName ? baseCurrency : item.currency ?? activeBudget?.currency ?? baseCurrency;
      const category = (item.kind === 'income' ? financeState.categories.income : financeState.categories.expense).find((candidate) => candidate.id === item.category);
      const categoryLabel = category?.name ?? t(`finance.categories.${item.category}`, { defaultValue: item.category });
      const categoryIcon: React.ComponentProps<typeof Ionicons>['name'] = item.kind === 'transfer'
        ? 'swap-horizontal-outline'
        : category?.icon as React.ComponentProps<typeof Ionicons>['name'] ?? (item.kind === 'income' ? 'cash-outline' : 'pricetag-outline');
      const detail = showBudgetName
        ? `${portfolioItem.budgetName} / ${categoryLabel}`
        : `${categoryLabel} / ${new Date(item.date).toLocaleDateString(language, { month: 'short', day: 'numeric' })}`;

      return (
        <Pressable
          style={styles.transactionRow}
          key={`${showBudgetName ? portfolioItem.budgetId : activeBudgetId}-${item.id}`}
          onPress={() => openTransactionDetails(transactionBudgetId, item)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View
            style={[
              styles.categoryIcon,
              item.kind === 'income' && styles.incomeIcon,
            ]}
          >
            <Ionicons name={categoryIcon} size={19} color={item.kind === 'income' ? C.green : item.kind === 'transfer' ? C.gold : C.goldLight} />
          </View>
          <View style={styles.transactionMain}>
            <Text style={styles.transactionTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.transactionMeta} numberOfLines={1}>{detail}</Text>
          </View>
          <Text
            style={[
              styles.transactionAmount,
              item.kind === 'income' ? styles.incomeText : styles.expenseText,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit

            minimumFontScale={0.7}
          >
            {item.kind === 'income' ? '+' : '-'}{formatMoney(displayAmount, language, displayCurrency)}
          </Text>
        </Pressable>
      );
    });
  };

  const renderBudgetView = () => {
    if (!activeBudget) return null;

    return (
      <View style={styles.fixedBudgetView}>
        <View style={styles.compactHero}>
          <LinearGradient
            colors={[`${activeBudget.color}22`, lightMode ? 'rgba(255,255,255,0.42)' : 'rgba(10,12,20,0.25)', lightMode ? LIGHT_C.ink : 'rgba(10,12,20,0.72)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.compactHeroInfo}>
            <View>
              <Text style={styles.eyebrow}>{t('finance.availableBalance')}</Text>
              <Text style={styles.compactBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>
                {formatMoney(balance, language, activeBudget.currency)}
              </Text>
              {activeBudget.currency !== baseCurrency && <Text style={styles.compactEquivalent} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>≈ {formatMoney(toBaseCurrency(activeBudget, balance), language, baseCurrency)}</Text>}
            </View>

            <View style={[styles.compactLimitTop, activeBudgetHasLimit && styles.compactLimitTopWithProgress]}>
              <Text style={styles.compactLimitLabel}>{t('finance.budgetLimit')}</Text>
              {activeBudgetHasLimit ? <Text style={[styles.compactLimitValue, budgetProgress > 1 && styles.expenseText]}>
                {formatMoney(expenses, language, activeBudget.currency)} / {formatMoney(activeBudget.limit, language, activeBudget.currency)}
              </Text> : <Pressable style={styles.compactLimitUnset} onPress={() => { setManagerOpen(true); setEditingBudget({ ...activeBudget, transactions: [...activeBudget.transactions] }); }} accessibilityRole="button" accessibilityLabel={t('finance.spendingLimit')}>
                <View style={styles.compactLimitUnsetDot} />
                <Text style={styles.compactLimitUnsetText}>{t('finance.budgetNotSet')}</Text>
              </Pressable>}
            </View>
            {activeBudgetHasLimit && <ProgressBar progress={budgetProgress} color={budgetProgress > 1 ? '#F08B88' : activeBudget.color} />}
          </View>

          <View style={styles.compactGemWindow} pointerEvents="box-none">
            <View style={styles.compactGemCanvas}>
              <Gem netWorth={positiveBalance} />
            </View>
          </View>
        </View>

        <View style={styles.fixedSectionHeader}>
          <Pressable style={styles.sectionHeading} onPress={() => onOpenModule?.('activity', false, activeBudgetId)} accessibilityRole="button" accessibilityLabel={t('finance.allActivity')}>
            <Text style={styles.sectionEyebrow}>{t('finance.thisBudget')}</Text>
            <Text style={styles.sectionTitle}>{t('finance.operations')}</Text>
           </Pressable>
           <View style={styles.operationHeaderActions}>
             {todayTransactions.length > 0 && <Pressable style={styles.operationCountBadge} onPress={() => onOpenModule?.('activity', false, activeBudgetId)} accessibilityLabel={t('finance.allActivity')}><Ionicons name="receipt-outline" size={17} color={C.gold} /></Pressable>}
             <Pressable style={styles.statsIconButton} onPress={() => setStatsOpen(true)} accessibilityLabel={t('finance.statistics')}>
               <Ionicons name="analytics-outline" size={18} color={C.gold} />
             </Pressable>
             <Pressable style={styles.statsIconButton} onPress={() => setQuickMenuOpen(true)} accessibilityLabel={t('finance.quickOptions')}>
               <Ionicons name="grid-outline" size={18} color={C.gold} />
             </Pressable>
           </View>
        </View>
        <View style={[styles.panel, styles.fixedOperationsPanel]}>
          <FlatList
            style={styles.operationsScroll}
            data={todayTransactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <>{renderTransactions([item])}</>}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.operationsScrollContent}
            ListEmptyComponent={<>{renderTransactions([])}</>}
          />
        </View>

        <Pressable style={styles.floatingAdd} onPress={() => openEntry('expense')} accessibilityRole="button" accessibilityLabel={t('finance.newEntry')}>
          <Ionicons name="add" size={24} color={C.gold} />
        </Pressable>
        <Pressable
          style={styles.floatingWorkspace}
          onPress={() => updateFinanceState((current) => ({ ...current, settings: { ...current.settings, activeWorkspace: 'store' } }))}
          accessibilityRole="button"
          accessibilityLabel={t('finance.workspace.store')}
        >
          <Ionicons name="storefront-outline" size={19} color={C.gold} />
        </Pressable>
      </View>
    );
  };

  const renderPortfolioActivity = () => (
    <View style={styles.fixedBudgetView}>
      <View style={styles.compactHero}>
        <LinearGradient
          colors={[`${C.gold}22`, lightMode ? 'rgba(255,255,255,0.42)' : 'rgba(10,12,20,0.25)', lightMode ? LIGHT_C.ink : 'rgba(10,12,20,0.72)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.compactHeroInfo}>
          <View>
            <Text style={styles.eyebrow}>{t('finance.totalAcrossBudgets')}</Text>
            <Text style={styles.compactBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>
              {formatMoney(portfolioBalance, language, baseCurrency)}
            </Text>
          </View>
        </View>
        <View style={styles.compactGemWindow} pointerEvents="none">
          <View style={styles.compactGemCanvas}>
            <Gem netWorth={portfolioPositiveBalance} />
          </View>
        </View>
      </View>
      <View style={styles.fixedSectionHeader}>
        <Pressable style={styles.sectionHeading} onPress={() => onOpenModule?.('activity', false, 'all')} accessibilityRole="button" accessibilityLabel={t('finance.allActivity')}>
          <Text style={styles.sectionEyebrow}>{t('finance.portfolio')}</Text>
          <Text style={styles.sectionTitle}>{t('finance.allActivity')}</Text>
        </Pressable>
        <View style={styles.operationHeaderActions}>
          {todayAllTransactions.length > 0 && <Pressable style={styles.operationCountBadge} onPress={() => onOpenModule?.('activity', false, 'all')} accessibilityLabel={t('finance.allActivity')}><Ionicons name="receipt-outline" size={17} color={C.gold} /></Pressable>}
          <Pressable style={styles.statsIconButton} onPress={() => setStatsOpen(true)} accessibilityLabel={t('finance.statistics')}>
            <Ionicons name="analytics-outline" size={18} color={C.gold} />
          </Pressable>
          <Pressable style={styles.statsIconButton} onPress={() => setQuickMenuOpen(true)} accessibilityLabel={t('finance.quickOptions')}>
            <Ionicons name="grid-outline" size={18} color={C.gold} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.panel, styles.fixedOperationsPanel]}>
        <FlatList
          style={styles.operationsScroll}
          data={todayAllTransactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <>{renderTransactions([item], true)}</>}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.operationsScrollContent}
          ListEmptyComponent={<>{renderTransactions([], true)}</>}
        />
      </View>
      <Pressable style={styles.floatingAdd} onPress={() => openEntry('expense')} accessibilityRole="button" accessibilityLabel={t('finance.newEntry')}>
        <Ionicons name="add" size={24} color={C.gold} />
      </Pressable>
      <Pressable style={styles.floatingWorkspace} onPress={() => updateFinanceState((current) => ({ ...current, settings: { ...current.settings, activeWorkspace: 'store' } }))} accessibilityRole="button" accessibilityLabel={t('finance.workspace.store')}>
        <Ionicons name="storefront-outline" size={19} color={C.gold} />
      </Pressable>
    </View>
  );

  const headerTitle = screenMode === 'allActivity' ? t('finance.allActivity') : activeBudget?.name ?? '';
  const headerSubtitle = screenMode === 'allActivity' ? t('finance.portfolio') : t('finance.budgetAccount');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.root} {...budgetSwipeResponder.panHandlers}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('finance.menu')}
          >
            <MenuGlyph />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </View>
          <Pressable
            style={styles.headerButton}
            onPress={() => { if (onOpenModule) onOpenModule('accounts'); else openBudgetManager(); }}
            accessibilityRole="button"
            accessibilityLabel={t('finance.manageBudgets')}
          >
            <AccountsGlyph />
          </Pressable>
        </View>

        <View style={styles.tabShell}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.budgetTabs}>
            {budgets.map((budget) => {
                const active = screenMode === 'budget' && budget.id === activeBudgetId;
              return (
                <Pressable key={budget.id} onPress={() => selectBudget(budget.id)} style={[styles.budgetTab, active && styles.budgetTabActive]}>
                  <Text style={[styles.budgetTabText, active && styles.budgetTabTextActive]} numberOfLines={1}>{budget.name}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setScreenMode('allActivity')} style={[styles.budgetTab, screenMode === 'allActivity' && styles.budgetTabActive]}>
              <Text style={[styles.budgetTabText, screenMode === 'allActivity' && styles.budgetTabTextActive]}>{t('finance.filters.all')}</Text>
            </Pressable>
          </ScrollView>
        </View>

        {screenMode === 'budget' ? (
          <View style={styles.fixedContent}>{renderBudgetView()}</View>
        ) : (
          <View style={styles.fixedContent}>{renderPortfolioActivity()}</View>
        )}
      </View>

      <Modal visible={exitPromptOpen} transparent animationType="fade" onRequestClose={() => setExitPromptOpen(false)}>
        <View style={styles.exitBackdrop}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>{t('finance.exit.title')}</Text>
            <Text style={styles.exitCopy}>{t('finance.exit.copy')}</Text>
            <View style={styles.exitActions}>
              <Pressable style={styles.exitCancel} onPress={() => setExitPromptOpen(false)}><Text style={styles.exitCancelText}>{t('finance.cancel')}</Text></Pressable>
              <Pressable style={styles.exitConfirm} onPress={() => { setExitPromptOpen(false); BackHandler.exitApp(); }}><Text style={styles.exitConfirmText}>{t('finance.exit.confirm')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(negativeBalancePrompt)} transparent animationType="fade" onRequestClose={() => setNegativeBalancePrompt(null)}>
        <View style={styles.negativeBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNegativeBalancePrompt(null)} />
          <View style={styles.negativeCard}>
            <View style={styles.negativeIcon}><Ionicons name="warning-outline" size={22} color={C.gold} /></View>
            <Text style={styles.negativeEyebrow}>{t('finance.expense')}</Text>
            <Text style={styles.negativeTitle}>{t('finance.negativeBalanceTitle', { defaultValue: 'Balance will go below zero' })}</Text>
            <Text style={styles.negativeCopy}>
              {negativeBalancePrompt && t('finance.negativeBalanceMessage', {
                defaultValue: 'This operation will leave {{account}} at {{amount}}. Do you want to continue?',
                account: negativeBalancePrompt.account,
                amount: negativeBalancePrompt.amount,
              })}
            </Text>
            {negativeBalancePrompt && <Text style={styles.negativeAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{negativeBalancePrompt.amount}</Text>}
            <View style={styles.negativeActions}>
              <Pressable style={styles.negativeCancel} onPress={() => setNegativeBalancePrompt(null)}><Text style={styles.negativeCancelText}>{t('finance.cancel')}</Text></Pressable>
              <Pressable style={styles.negativeConfirm} onPress={() => { const prompt = negativeBalancePrompt; setNegativeBalancePrompt(null); prompt?.onConfirm(); }}><Text style={styles.negativeConfirmText}>{t('finance.continueAction', { defaultValue: 'Continue' })}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
          <SafeAreaView style={styles.drawer} edges={['top', 'bottom']}>
            <ScrollView style={styles.drawerMenuScroll} contentContainerStyle={styles.drawerMenuContent} showsVerticalScrollIndicator={false}>
              <View style={styles.drawerBalanceCard}>
                <Text style={styles.microLabel}>{t('finance.totalAcrossBudgets')}</Text>
                <Text style={styles.drawerBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                  {formatMoney(portfolioBalance, language, baseCurrency)}
                </Text>
                <Text style={styles.drawerBudgetCount}>{budgets.length} {t('finance.budgetAccounts')}</Text>
              </View>

              <View style={styles.drawerNav}>
                {(['tools', 'categories', 'notes', 'settings'] as FinanceModuleName[]).map((module) => (
                  <Pressable key={module} style={styles.drawerItem} onPress={() => openDrawerModule(module)}>
                    <View style={styles.drawerItemIcon}><DrawerModuleGlyph module={module} /></View>
                    <View style={styles.drawerItemCopy}><Text style={styles.drawerItemText}>{t(`finance.navigation.items.${module}.title`)}</Text><Text style={styles.drawerItemSubtitle} numberOfLines={1}>{module === 'tools' ? t('finance.releaseExtra.toolsSubtitle') : t(`finance.navigation.items.${module}.subtitle`)}</Text></View>
                    <Ionicons name="chevron-forward-outline" size={15} color={C.textSubtle} />
                  </Pressable>
                ))}
              </View>

            </ScrollView>

            {/* <Text style={styles.drawerPrivacy}>{t('finance.privacyCopy')}</Text> */}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={statsOpen} animationType="slide" onRequestClose={() => setStatsOpen(false)}>
        <View style={styles.statsRoot}>
          <LinearGradient colors={['rgba(233,200,119,0.12)', 'transparent']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.statsSafe} edges={['top', 'bottom']}>
            <View style={styles.managerHeader}>
              <View style={styles.managerHeaderSide}><HeaderBackButton onPress={() => setStatsOpen(false)} /></View>
              <Text style={styles.managerHeaderTitle}>{t('finance.statistics')}</Text>
              <View style={styles.managerHeaderSide} />
            </View>
            <ScrollView contentContainerStyle={[styles.statsContent, styles.screenTopSpacing]} showsVerticalScrollIndicator={false}>
              <Text style={styles.managerEyebrow}>{screenMode === 'allActivity' ? t('finance.allActivity') : activeBudget?.name}</Text>
              <View style={styles.rangeSelector}>{(['charts', 'calendar'] as StatsView[]).map((view) => { const selected = statsView === view; return <Pressable key={view} style={[styles.rangeOption, selected && styles.rangeOptionActive]} onPress={() => setStatsView(view)}><Ionicons name={view === 'charts' ? 'stats-chart-outline' : 'calendar-outline'} size={15} color={selected ? C.goldLight : C.gold} /><Text style={[styles.rangeOptionText, selected && styles.rangeOptionTextActive]}>{t(`finance.release.${view}`)}</Text></Pressable>; })}</View>
              {statsView === 'charts' && <View style={styles.rangeSelector}>{statsRangeOptions.map((option) => { const selected = option.key === statsRange; return <Pressable key={option.key} style={[styles.rangeOption, selected && styles.rangeOptionActive]} onPress={() => setStatsRange(option.key)}><Text style={[styles.rangeOptionText, selected && styles.rangeOptionTextActive]} numberOfLines={1}>{option.label}</Text>{selected && <View style={styles.rangeActiveDot} />}</Pressable>; })}</View>}
              {missingRateCurrencies.length ? <Pressable style={styles.rateWarning} onPress={() => { setStatsOpen(false); onOpenModule?.('settings'); }} accessibilityRole="button"><Ionicons name="alert-circle-outline" size={18} color={C.gold} /><Text style={styles.rateWarningText}>{t('finance.missingRatesWarning', { currencies: missingRateCurrencies.join(', ') })}</Text><Ionicons name="chevron-forward" size={16} color={C.gold} /></Pressable> : null}
              {statsView === 'charts' ? <>
              <View style={styles.statsSummary}>
                <View style={styles.statsSummaryTop}><View style={styles.statsSummaryCopy}><Text style={styles.statsSummaryLabel}>{t('finance.cashFlow')} · {selectedStatsPeriod.label}</Text><Text style={[styles.statsSummaryNet, statsNet < 0 ? styles.expenseText : styles.incomeText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{formatMoney(statsNet, language, statsCurrency)}</Text></View><View style={styles.statsOperationBadge}><Ionicons name="receipt-outline" size={14} color={C.gold} /><Text style={styles.statsOperationCount}>{statsTransactions.length}</Text></View></View>
                <View style={styles.statsSummaryValues}><View style={styles.statsMetric}><Text style={styles.statsMetricLabel}>{t('finance.income')}</Text><Text style={[styles.statsMetricValue, styles.incomeText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>+{formatMoney(selectedStatsPeriod.income, language, statsCurrency)}</Text></View><View style={styles.statsMetricDivider} /><View style={styles.statsMetric}><Text style={styles.statsMetricLabel}>{t('finance.expenses')}</Text><Text style={[styles.statsMetricValue, styles.expenseText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>-{formatMoney(selectedStatsPeriod.expenses, language, statsCurrency)}</Text></View></View>
              </View>
              <Text style={styles.managerEyebrow}>{t('finance.financeStats.vsPrevious')}</Text>
              <View style={styles.statsComparisonGrid}>
                <View style={[styles.statsComparisonCard, narrowLayout && styles.statsComparisonCardWide]}><Text style={styles.statsInsightLabel}>{t('finance.income')}</Text><Text style={[styles.statsComparisonValue, statsComparison.income !== null && statsComparison.income >= 0 ? styles.incomeText : styles.expenseText]}>{statsComparison.income === null ? '—' : `${statsComparison.income >= 0 ? '+' : ''}${Math.round(statsComparison.income)}%`}</Text><Text style={styles.statsComparisonMeta} numberOfLines={2}>{statsComparison.income === null ? t('finance.financeStats.noPreviousData') : `${t('finance.financeStats.previous')}: ${formatMoney(statsPreviousTotals.income, language, statsCurrency)}`}</Text></View>
                <View style={[styles.statsComparisonCard, narrowLayout && styles.statsComparisonCardWide]}><Text style={styles.statsInsightLabel}>{t('finance.expenses')}</Text><Text style={[styles.statsComparisonValue, statsComparison.expenses !== null && statsComparison.expenses <= 0 ? styles.incomeText : styles.expenseText]}>{statsComparison.expenses === null ? '—' : `${statsComparison.expenses >= 0 ? '+' : ''}${Math.round(statsComparison.expenses)}%`}</Text><Text style={styles.statsComparisonMeta} numberOfLines={2}>{statsComparison.expenses === null ? t('finance.financeStats.noPreviousData') : `${t('finance.financeStats.previous')}: ${formatMoney(statsPreviousTotals.expenses, language, statsCurrency)}`}</Text></View>
                <View style={[styles.statsComparisonCard, narrowLayout && styles.statsComparisonCardWide]}><Text style={styles.statsInsightLabel}>{t('finance.savingsRate')}</Text><Text style={[styles.statsComparisonValue, statsComparison.savings !== null && statsComparison.savings >= 0 ? styles.incomeText : styles.expenseText]}>{statsComparison.savings === null ? '—' : `${statsComparison.savings >= 0 ? '+' : ''}${Math.round(statsComparison.savings)}%`}</Text><Text style={styles.statsComparisonMeta} numberOfLines={2}>{statsComparison.savings === null ? t('finance.financeStats.noPreviousData') : `${t('finance.financeStats.previous')}: ${Math.round(statsComparison.previousSavings)}%`}</Text></View>
              </View>
              <View style={styles.statsInsights}>
                <View style={[styles.statsInsight, narrowLayout && styles.statsInsightWide]}><Text style={styles.statsInsightLabel}>{t('finance.averageDailyExpense')}</Text><Text style={styles.statsInsightValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{formatMoney(statsInsights.averageDailyExpense, language, statsCurrency)}</Text></View>
                <View style={[styles.statsInsight, narrowLayout && styles.statsInsightWide]}><Text style={styles.statsInsightLabel}>{t('finance.savingsRate')}</Text><Text style={[styles.statsInsightValue, statsInsights.savingsRate < 0 && styles.expenseText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{Math.round(statsInsights.savingsRate)}%</Text></View>
                <View style={[styles.statsInsight, narrowLayout && styles.statsInsightWide]}><Text style={styles.statsInsightLabel}>{t('finance.peakExpenseDay')}</Text><Text style={styles.statsInsightValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{statsInsights.peakExpense ? statsInsights.peakExpenseLabel : '-'}</Text></View>
                <View style={[styles.statsInsight, narrowLayout && styles.statsInsightWide]}><Text style={styles.statsInsightLabel}>{t('finance.financeStats.averageOperation')}</Text><Text style={styles.statsInsightValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{formatMoney(statsInsights.averageOperation, language, statsCurrency)}</Text></View>
              </View>
              {statsRange !== 'today' && <>
              <Text style={styles.managerEyebrow}>{t('finance.flowChart')}</Text>
              <View style={[styles.managerAccounts, styles.statsFlowCard]}>
                {statsFlowHasData ? <>
                <View style={styles.flowChart}>
                  {statsFlowBuckets.map((bucket) => {
                    const incomeHeight = bucket.income > 0 ? Math.max(7, bucket.income / statsFlowMax * 62) : 0;
                    const expenseHeight = bucket.expenses > 0 ? Math.max(7, bucket.expenses / statsFlowMax * 62) : 0;
                    return <View key={bucket.key} style={styles.flowColumn}>
                      <View style={[styles.flowBars, { gap: statsFlowBarGap }]}>
                        <View style={[styles.flowBar, { height: incomeHeight, width: statsFlowBarWidth, borderRadius: statsFlowBarWidth / 2, backgroundColor: C.gold }]} />
                        <View style={[styles.flowBar, { height: expenseHeight, width: statsFlowBarWidth, borderRadius: statsFlowBarWidth / 2, backgroundColor: C.red }]} />
                      </View>
                      <View style={[styles.flowNowDot, bucket.current && styles.flowNowDotActive]} />
                      <Text style={[styles.flowLabel, bucket.current && styles.flowLabelActive]} numberOfLines={1}>{bucket.label}</Text>
                    </View>;
                  })}
                </View>
                <View style={styles.flowLegend}>
                  <View style={styles.flowLegendItem}><View style={[styles.flowLegendChip, { backgroundColor: C.gold }]} /><Text style={styles.flowLegendText}>{t('finance.income')}</Text></View>
                  <View style={styles.flowLegendItem}><View style={[styles.flowLegendChip, { backgroundColor: C.red }]} /><Text style={styles.flowLegendText}>{t('finance.expenses')}</Text></View>
                </View>
                </> : <View style={styles.statsFlowEmpty}><Ionicons name="stats-chart-outline" size={21} color={C.textSubtle} /><Text style={styles.emptyCopy}>{t('finance.noActivityCopy')}</Text></View>}
              </View>
              </>}
              <Text style={styles.managerEyebrow}>{t('finance.categoryBreakdown')}</Text>
              <View style={styles.managerAccounts}>
                {statsCategories.length > 0 && (() => {
                  const top = statsCategories[0];
                  const topName = [...financeState.categories.expense, ...financeState.categories.income].find((item) => item.id === top.category)?.name ?? t(`finance.categories.${top.category}`, { defaultValue: top.category });
                  return <View style={styles.statsTopCard}>
                    <Text style={styles.statsTopLabel}>{t('finance.topCategory')}</Text>
                    <View style={styles.statsCategoryTop}>
                      <View style={styles.statsCategoryName}><View style={[styles.statsCategoryIcon, styles.statsCategoryIconTop]}><Ionicons name={top.icon as React.ComponentProps<typeof Ionicons>['name']} size={15} color={C.gold} /></View><Text style={styles.statsTopName} numberOfLines={2}>{topName}</Text></View>
                      <View style={styles.statsCategoryAmount}><Text style={styles.statsTopAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{formatMoney(top.total, language, statsCurrency)}</Text><Text style={styles.statsCategoryPct}>{Math.round(top.total / Math.max(1, statsTotalExpense) * 100)}%</Text></View>
                    </View>
                  </View>;
                })()}
                {statsCategories.slice(1).map(({ category, icon, total }, index) => {
                  const categoryName = [...financeState.categories.expense, ...financeState.categories.income].find((item) => item.id === category)?.name ?? t(`finance.categories.${category}`, { defaultValue: category });
                  return <View key={category} style={styles.statsCategoryRow}><View style={styles.statsCategoryTop}><View style={styles.statsCategoryName}><Text style={styles.statsCategoryRank}>{String(index + 2).padStart(2, '0')}</Text><View style={styles.statsCategoryIcon}><Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={14} color={C.gold} /></View><Text style={[styles.managerAccountName, styles.statsCategoryNameText]} numberOfLines={2}>{categoryName}</Text></View><View style={styles.statsCategoryAmount}><Text style={styles.managerAccountBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{formatMoney(total, language, statsCurrency)}</Text><Text style={styles.statsCategoryPct}>{Math.round(total / Math.max(1, statsTotalExpense) * 100)}%</Text></View></View><View style={styles.statsCategoryTrack}><LinearGradient colors={[C.gold, C.goldMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.statsCategoryFill, { width: `${total / statsMaxCategory * 100}%` }]} /></View></View>;
                })}
                {statsCategories.length > 0 && <View style={styles.statsTotalRow}><Text style={styles.statsTotalLabel}>{t('finance.totalSpent')}</Text><Text style={styles.statsTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{formatMoney(statsTotalExpense, language, statsCurrency)}</Text></View>}
                {!statsCategories.length && <View style={styles.statsEmpty}><Ionicons name="analytics-outline" size={22} color="rgba(233,200,119,0.35)" /><Text style={styles.emptyCopy}>{t('finance.noActivityCopy')}</Text></View>}
              </View>
              </> : <View style={styles.statsCalendarCard}>
                <View style={styles.statsCalendarHeader}>
                  <Pressable style={styles.statsCalendarArrow} onPress={() => setStatsCalendarMonth((current) => { const next = new Date(current.getFullYear(), current.getMonth() - 1, 1); setSelectedStatsDate(next.toDateString()); return next; })} accessibilityLabel={t('finance.release.previousMonth')}><Ionicons name="chevron-back" size={19} color={C.gold} /></Pressable>
                  <Text style={styles.statsCalendarTitle}>{statsCalendarMonth.toLocaleDateString(language, { month: 'long', year: 'numeric' })}</Text>
                  <Pressable style={styles.statsCalendarArrow} onPress={() => setStatsCalendarMonth((current) => { const next = new Date(current.getFullYear(), current.getMonth() + 1, 1); setSelectedStatsDate(next.toDateString()); return next; })} accessibilityLabel={t('finance.release.nextMonth')}><Ionicons name="chevron-forward" size={19} color={C.gold} /></Pressable>
                </View>
                <View style={styles.statsCalendarWeek}>{statsCalendarLabels.map((day) => <Text key={day} style={styles.statsCalendarWeekday}>{t(`finance.weekdays.${day}`)}</Text>)}</View>
                <View style={styles.statsCalendarGrid}>{statsCalendarCells.map((day, index) => {
                  const active = day > 0 && day <= statsCalendarDays;
                  const date = active ? new Date(statsCalendarMonth.getFullYear(), statsCalendarMonth.getMonth(), day) : null;
                  const key = date?.toDateString() ?? `empty-${index}`;
                  const daySummary = date ? statsCalendarItemsByDate.get(key) : undefined;
                  const selected = active && key === selectedStatsDate;
                  return <Pressable key={key} disabled={!active} style={[styles.statsCalendarCell, selected && styles.statsCalendarCellSelected]} onPress={() => date && setSelectedStatsDate(date.toDateString())}><Text style={[styles.statsCalendarDay, selected && styles.statsCalendarDaySelected]}>{active ? day : ''}</Text>{daySummary && <View style={styles.statsCalendarDots}>{daySummary.hasIncome && <View style={[styles.statsCalendarDot, styles.statsCalendarIncomeDot]} />}{daySummary.hasExpense && <View style={[styles.statsCalendarDot, styles.statsCalendarExpenseDot]} />}</View>}</Pressable>;
                })}</View>
                <View style={styles.statsCalendarDetails}>
                  <Text style={styles.managerEyebrow}>{new Date(selectedStatsDate).toLocaleDateString(language, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                  {selectedStatsItems.map((item) => { const portfolioItem = item as PortfolioTransaction; const budget = accountViews.find((candidate) => candidate.id === portfolioItem.budgetId); const displayAmount = screenMode === 'allActivity' && budget ? transactionToBaseCurrency(item, budget) : item.amount; const displayCurrency = screenMode === 'allActivity' ? baseCurrency : item.currency ?? statsCurrency; return <View key={item.id} style={styles.statsCategoryTop}><Text style={[styles.managerAccountName, styles.statsCalendarItemName]} numberOfLines={2}>{item.title}</Text><Text style={item.kind === 'income' ? styles.incomeText : styles.expenseText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{item.kind === 'income' ? '+' : '-'}{formatMoney(displayAmount, language, displayCurrency)}</Text></View>; })}
                  {!selectedStatsItems.length && <Text style={styles.emptyCopy}>{t('finance.noActivityCopy')}</Text>}
                </View>
              </View>}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={quickMenuOpen} transparent animationType="fade" onRequestClose={() => setQuickMenuOpen(false)}>
        <View style={styles.quickMenuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQuickMenuOpen(false)} />
          <View style={styles.quickMenuPanel}>
            <ScrollView contentContainerStyle={styles.quickMenuScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.quickMenuTitle}>{t('finance.quickOptions')}</Text>
            <Text style={styles.quickMenuSubtitle}>{t('finance.navigation.quickCopy')}</Text>
            {[
              { module: 'budget' as FinanceModuleName, icon: 'speedometer-outline' as const },
              { module: 'debt' as FinanceModuleName, icon: 'card-outline' as const },
              { module: 'savings' as FinanceModuleName, icon: 'trending-up-outline' as const },
              { module: 'recurring' as FinanceModuleName, icon: 'repeat-outline' as const },
            ].map((item) => (
              <Pressable key={item.module} style={styles.quickMenuItem} onPress={() => openQuickModule(item.module)}>
                <View style={styles.quickMenuIcon}><Ionicons name={item.icon} size={19} color={C.gold} /></View>
                <View style={styles.quickMenuItemCopy}><Text style={styles.quickMenuItemText}>{t(`finance.navigation.items.${item.module}.title`)}</Text><Text style={styles.quickMenuItemSubtitle}>{t(`finance.navigation.items.${item.module}.subtitle`)}</Text></View>
                <Ionicons name="chevron-forward-outline" size={17} color="rgba(255,244,208,0.35)" />
              </Pressable>
            ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={managerOpen} animationType="fade" onRequestClose={() => editingBudget ? setEditingBudget(null) : setManagerOpen(false)}>
        <View style={styles.managerRoot}>
          <LinearGradient colors={['rgba(233,200,119,0.12)', 'transparent']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.managerSafe} edges={['top', 'bottom']}>
            <View style={styles.managerHeader}>
              <View style={styles.managerHeaderSide}>
                <HeaderBackButton onPress={() => editingBudget ? setEditingBudget(null) : setManagerOpen(false)} />
              </View>
              <Text style={styles.managerHeaderTitle}>{editingBudget ? t('finance.editBudget') : t('finance.manageBudgets')}</Text>
              <Pressable onPress={() => editingBudget ? saveBudgetEdit() : setManagerOpen(false)} style={[styles.managerHeaderSide, styles.managerHeaderRight]}>
                <Text style={styles.managerHeaderAction}>{t('finance.done')}</Text>
              </Pressable>
            </View>

            <KeyboardAvoidingView style={styles.managerKeyboard} behavior="padding" enabled={Platform.OS === 'ios'}>
            <ScrollView contentContainerStyle={[styles.managerContent, styles.screenTopSpacing]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {!editingBudget && <>
              <Text style={styles.managerEyebrow}>{t('finance.yourBudgets')}</Text>
              <View style={styles.managerAccounts}>
                {budgets.map((budget) => {
                  const selected = budget.id === activeBudgetId;
                  return (
                    <Pressable
                      key={budget.id}
                      style={[styles.managerAccount, selected && styles.managerAccountSelected]}
                      onPress={() => openBudgetEditor(budget)}
                    >
                      <View style={[styles.managerAccountMark, { backgroundColor: `${budget.color}22`, borderColor: budget.color }]}>
                        <View style={[styles.managerAccountMarkDot, { backgroundColor: budget.color }]} />
                      </View>
                      <View style={styles.managerAccountMain}>
                        <Text style={styles.managerAccountName}>{budget.name}</Text>
                        <Text style={styles.managerAccountMeta}>{budget.transactions.length} {t('finance.operations')}</Text>
                      </View>
                      <View style={styles.managerAccountRight}>
                        <Text style={styles.managerAccountBalance}>{formatMoney(balanceFor(budget), language, budget.currency)}</Text>
                        <Text style={[styles.managerSelected, selected && { color: budget.color }]}>
                          {selected ? t('finance.selected') : t('finance.configure')}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              </>}

              {editingBudget && (
                <View style={styles.createCard}>
                  <Text style={styles.createEyebrow}>{t('finance.editBudget')}</Text>
                  <Text style={styles.createTitle}>{editingBudget.name}</Text>
                  <Text style={styles.inputLabel}>{t('finance.budgetName')}</Text>
                  <TextInput value={editingBudget.name} onChangeText={(value) => setEditingBudget((current) => current ? { ...current, name: value } : current)} placeholder={t('finance.budgetNamePlaceholder')} placeholderTextColor={C.textSubtle} style={styles.textInput} maxLength={24} />
                  <View style={styles.managerInputRow}>
                    <View style={styles.managerInputColumn}>
                      <Text style={styles.inputLabel}>{t('finance.openingBalance')}</Text>
                      <View style={styles.moneyInputShell}>
                        <Text style={styles.moneyInputCurrency}>{editingBudget.currency}</Text>
                        <TextInput value={String(editingBudget.openingBalance)} onChangeText={(value) => setEditingBudget((current) => current ? { ...current, openingBalance: parseAmount(value) } : current)} keyboardType="decimal-pad" style={styles.moneyInput} />
                      </View>
                    </View>
                    <View style={styles.managerInputColumn}>
                      <Text style={styles.inputLabel}>{t('finance.spendingLimit')}</Text>
                      <View style={styles.moneyInputShell}>
                        <Text style={styles.moneyInputCurrency}>{editingBudget.currency}</Text>
                        <TextInput value={editingBudget.limitSet ? String(editingBudget.limit) : ''} onChangeText={(value) => setEditingBudget((current) => current ? { ...current, limit: parseAmount(value), limitSet: parseAmount(value) > 0 } : current)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={C.textSubtle} style={styles.moneyInput} />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.inputLabel}>{t('finance.currency')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                    {['USD', 'CUP', 'EUR'].map((currency) => { const locked = accountHasHistory(financeState, editingBudget.id); return <Pressable key={currency} disabled={locked} onPress={() => setEditingBudget((current) => { if (!current) return current; const configuredRate = rateBetweenCurrencies(currency, baseCurrency); return { ...current, currency, exchangeRate: currency === baseCurrency ? 1 : configuredRate ?? (current.currency === baseCurrency ? undefined : current.exchangeRate) }; })} style={[styles.categoryChip, editingBudget.currency === currency && styles.categoryChipActive, locked && { opacity: 0.45 }]}><Text style={[styles.categoryChipText, editingBudget.currency === currency && styles.categoryChipTextActive]}>{currency}</Text></Pressable>; })}
                  </ScrollView>
                  {accountHasHistory(financeState, editingBudget.id) && <Text style={styles.rateWarningText}>{t('finance.accountCurrencyLocked')}</Text>}
                  <Text style={styles.inputLabel}>1 {baseCurrency} = ? {editingBudget.currency}</Text>
                  <TextInput value={String((() => { const direct = rateBetweenCurrencies(editingBudget.currency, baseCurrency) ?? editingBudget.exchangeRate; return direct && direct > 0 ? Number((1 / direct).toPrecision(12)) : ''; })())} onChangeText={(value) => setEditingBudget((current) => { const displayed = parseAmount(value); return current ? { ...current, exchangeRate: displayed > 0 ? 1 / displayed : undefined } : current; })} keyboardType="decimal-pad" placeholder="1.00" placeholderTextColor={C.textSubtle} style={styles.textInput} editable={!accountHasHistory(financeState, editingBudget.id) && editingBudget.currency !== baseCurrency && !rateBetweenCurrencies(editingBudget.currency, baseCurrency)} />
                  <Text style={styles.inputLabel}>{t('finance.accentColor')}</Text>
                  <View style={styles.colorRow}>{ACCOUNT_COLORS.map((color) => <Pressable key={color} onPress={() => setEditingBudget((current) => current ? { ...current, color } : current)} style={[styles.colorButton, editingBudget.color === color && styles.colorButtonSelected]}><View style={[styles.colorDot, { backgroundColor: color }]} /></Pressable>)}</View>
                  <View style={styles.editActions}><Pressable style={[styles.editCancelButton, styles.editAction]} onPress={() => setEditingBudget(null)}><Text style={styles.editCancelText}>{t('finance.cancel')}</Text></Pressable><Pressable style={[styles.createButton, styles.editAction]} onPress={saveBudgetEdit}><Text style={styles.createButtonText}>{t('finance.done')}</Text></Pressable></View>
                </View>
              )}

              {!editingBudget && <View style={styles.createCard}>
                <Text style={styles.createEyebrow}>{t('finance.newBudget')}</Text>
                <Text style={styles.createTitle}>{t('finance.createBudget')}</Text>

                <Text style={styles.inputLabel}>{t('finance.budgetName')}</Text>
                <TextInput
                  value={newBudgetName}
                  onChangeText={setNewBudgetName}
                  placeholder={t('finance.budgetNamePlaceholder')}
                  placeholderTextColor={C.textSubtle}
                  style={styles.textInput}
                  maxLength={24}
                />

                <View style={styles.managerInputRow}>
                  <View style={styles.managerInputColumn}>
                    <Text style={styles.inputLabel}>{t('finance.openingBalance')}</Text>
                    <View style={styles.moneyInputShell}>
                      <Text style={styles.moneyInputCurrency}>{newBudgetCurrency}</Text>

                      <TextInput
                        value={newBudgetBalance}
                        onChangeText={(value) => setNewBudgetBalance(value.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={C.textSubtle}
                        style={styles.moneyInput}
                      />
                    </View>
                  </View>
                  <View style={styles.managerInputColumn}>
                    <Text style={styles.inputLabel}>{t('finance.spendingLimit')}</Text>
                    <View style={styles.moneyInputShell}>
                      <Text style={styles.moneyInputCurrency}>{newBudgetCurrency}</Text>
                      <TextInput
                        value={newBudgetLimit}
                        onChangeText={(value) => setNewBudgetLimit(value.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={C.textSubtle}
                        style={styles.moneyInput}
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.inputLabel}>{t('finance.currency')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                  {['USD', 'CUP', 'EUR'].map((currency) => (
                    <Pressable
                      key={currency}
                      onPress={() => {
                        setNewBudgetCurrency(currency);
                        const configuredRate = rateBetweenCurrencies(currency, baseCurrency);
                        setNewBudgetExchangeRate(currency === baseCurrency ? '1' : configuredRate ? String(Number((1 / configuredRate).toPrecision(12))) : '');
                      }}
                      style={[styles.categoryChip, newBudgetCurrency === currency && styles.categoryChipActive]}
                    >
                      <Text style={[styles.categoryChipText, newBudgetCurrency === currency && styles.categoryChipTextActive]}>{currency}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.inputLabel}>1 {baseCurrency} = ? {newBudgetCurrency}</Text>
                <TextInput
                  value={newBudgetExchangeRate}
                  onChangeText={(value) => setNewBudgetExchangeRate(value.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={C.textSubtle}
                  style={styles.textInput}
                  editable={newBudgetCurrency !== baseCurrency && !rateBetweenCurrencies(newBudgetCurrency, baseCurrency)}
                />

                <Text style={styles.inputLabel}>{t('finance.accentColor')}</Text>
                <View style={styles.colorRow}>
                  {ACCOUNT_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => setNewBudgetColor(color)}
                      style={[styles.colorButton, newBudgetColor === color && styles.colorButtonSelected]}
                    >
                      <View style={[styles.colorDot, { backgroundColor: color }]} />
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[styles.createButton, !newBudgetName.trim() && styles.disabledButton]}
                  onPress={createBudget}
                  disabled={!newBudgetName.trim()}
                >
                  <Text style={styles.createButtonText}>{t('finance.createBudget')}</Text>
                </Pressable>
              </View>}
            </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedTransaction)} transparent animationType="fade" onRequestClose={() => setSelectedTransaction(null)}>
        <KeyboardAvoidingView style={styles.entryBackdrop} behavior="padding" enabled={Platform.OS === 'ios'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedTransaction(null)} />
          {selectedTransaction && (
            <ScrollView style={styles.detailSheet} contentContainerStyle={styles.detailSheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHandle} />
              <View style={styles.entryHeader}>
                <View style={styles.detailHeaderCopy}>
                  <Text style={styles.createEyebrow}>{selectedBudget?.name ?? t('finance.budgetAccount')}</Text>
                  <Text style={styles.entryTitle}>{t('finance.operationDetails', { defaultValue: 'OPERATION DETAILS' })}</Text>
                </View>
                <Pressable style={styles.entryClose} onPress={() => setSelectedTransaction(null)} accessibilityLabel={t('finance.close')}>
                  <Ionicons name="close" size={19} color={C.goldLight} />
                </Pressable>
              </View>

              <View style={styles.detailAmountBlock}>
                <Text style={[styles.detailKind, selectedTransaction.transaction.kind === 'income' ? styles.incomeText : styles.expenseText]}>
                  {selectedTransaction.transaction.kind === 'income' ? t('finance.income') : selectedTransaction.transaction.kind === 'transfer' ? t('finance.toolsList.transfer') : t('finance.expense')}
                </Text>
                <Text style={[styles.detailAmount, selectedTransaction.transaction.kind === 'income' ? styles.incomeText : styles.expenseText]}>
                  {selectedTransaction.transaction.kind === 'income' ? '+' : '-'}{formatMoney(selectedDisplayAmount, language, selectedDisplayCurrency)}
                </Text>
              </View>

              <View style={styles.detailInfoList}>
                <View style={styles.detailInfoRow}><Text style={styles.detailLabel}>{t('finance.description')}</Text><Text style={styles.detailValue}>{selectedTransaction.transaction.title}</Text></View>
                <View style={styles.detailInfoRow}><Text style={styles.detailLabel}>{t('finance.category')}</Text><Text style={styles.detailValue}>{[...financeState.categories.expense, ...financeState.categories.income].find((item) => item.id === selectedTransaction.transaction.category)?.name ?? t(`finance.categories.${selectedTransaction.transaction.category}`, { defaultValue: selectedTransaction.transaction.category })}</Text></View>
                <View style={styles.detailInfoRow}><Text style={styles.detailLabel}>{t('finance.date', { defaultValue: 'DATE' })}</Text><Text style={styles.detailValue}>{new Date(selectedTransaction.transaction.date).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' })}</Text></View>
                <View style={styles.detailInfoRow}><Text style={styles.detailLabel}>{t('finance.currency')}</Text><Text style={styles.detailValue}>{selectedDisplayCurrency}</Text></View>
              </View>

              <View style={styles.detailActions}>
                {!selectedTransaction.transaction.transferId && !selectedTransaction.transaction.debtId && <Pressable style={[styles.detailAction, styles.detailEditAction]} onPress={() => { const current = selectedTransaction; setSelectedTransaction(null); openTransactionEditor(current.budgetId, current.transaction); }}>
                  <Ionicons name="create-outline" size={18} color={C.gold} />
                  <Text style={styles.detailEditText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('finance.editEntry')}</Text>
                </Pressable>}
                <Pressable style={[styles.detailAction, styles.detailDeleteAction]} onPress={() => { const current = selectedTransaction; setSelectedTransaction(null); removeTransaction(current.budgetId, current.transaction); }}>
                  <Ionicons name="trash-outline" size={18} color={C.red} />
                  <Text style={styles.detailDeleteText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('finance.deleteAction')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={entryOpen} transparent animationType="fade" onRequestClose={closeEntry}>
        <KeyboardAvoidingView style={[styles.entryBackdrop, tabletLayout && styles.entryBackdropTablet]} behavior="padding" enabled={Platform.OS === 'ios'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEntry} />
          <View style={[styles.entrySheet, tabletLayout && styles.entrySheetTablet]}>
          <ScrollView style={styles.entryScroll} contentContainerStyle={styles.entrySheetContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHandle} />
            <View style={styles.entryHeader}>
              <View style={styles.detailHeaderCopy}>
                <Text style={styles.createEyebrow}>{entryKind === 'transfer' ? transferSource?.name : entryBudget?.name}</Text>
                <Text style={styles.entryTitle}>{editingTransaction ? t('finance.editEntry', { defaultValue: 'EDIT OPERATION' }) : t('finance.newEntry')}</Text>
              </View>
              <Pressable style={styles.entryClose} onPress={closeEntry} accessibilityRole="button" accessibilityLabel={t('finance.close')}><Ionicons name="close" size={19} color={C.goldLight} /></Pressable>
            </View>

            <View style={styles.kindControl}>
              {((editingTransaction ? ['expense', 'income'] : ['expense', 'income', 'transfer']) as TransactionKind[]).map((kind) => (
                <Pressable
                  key={kind}
                  onPress={() => setEntryKind(kind)}
                  style={[styles.kindOption, entryKind === kind && styles.kindOptionActive]}
                >
                  <Text style={[styles.kindText, entryKind === kind && styles.kindTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {kind === 'expense' ? t('finance.expense') : kind === 'income' ? t('finance.income') : t('finance.toolsList.transfer')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {entryKind !== 'transfer' ? <SearchableSelect label={t('finance.modules.account')} value={entryAccountId} options={entryAccountOptions} onChange={setEntryAccountId} placeholder={t('finance.modules.account')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} required /> : null}

            {entryKind === 'transfer' ? (
              <>
                <View style={styles.transferSelectCard}>
                  <SearchableSelect label={t('finance.transferFrom', { defaultValue: 'From account' })} value={transferSourceId} options={transferAccountSelectOptions} onChange={(budgetId) => { setTransferSourceId(budgetId); if (transferTargetId === budgetId) setTransferTargetId(transferOptions.find((candidate) => candidate.id !== budgetId)?.id ?? ''); }} placeholder={t('finance.transferFrom', { defaultValue: 'From account' })} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} required />
                  <SearchableSelect label={t('finance.transferTo')} value={transferTargetId} options={transferTargetSelectOptions} onChange={setTransferTargetId} placeholder={t('finance.transferTo')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} required />
                </View>
                <View style={styles.transferAmountCard}><Text style={styles.inputLabel}>{t('finance.amount')}</Text><View style={styles.amountInputShell}><TextInput value={entryAmount} onChangeText={(value) => setEntryAmount(sanitizeAmount(value))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.textSubtle} numberOfLines={1} style={[styles.amountInput, { fontSize: amountFontSize(entryAmount) }]} accessibilityLabel={t('finance.amount')} /><Text style={styles.amountCurrency}>{transferSource?.currency ?? baseCurrency}</Text></View>{Boolean(entryAmountError) && <Text style={styles.inlineError}>{entryAmountError}</Text>}</View>
                {!transferSameCurrency && transferSource && transferTarget ? <View style={styles.entryDetailsCard}><Text style={styles.inputLabel}>{t('finance.exchangeRate')}</Text>
                <View style={styles.rateInputLine}><Text style={styles.rateEquationValue}>1 {transferSource.currency}</Text><Text style={styles.rateEquals}>=</Text><TextInput value={transferRate} onChangeText={(value) => { setTransferRate(sanitizeAmount(value)); setTransferError(''); }} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textSubtle} style={[styles.rateInlineInput, Boolean(transferValidationError) && styles.inputError]} accessibilityLabel={t('finance.exchangeRate')} /><Text style={styles.rateEquationValue}>{transferTarget.currency}</Text></View>
                {transferSource && transferTarget && transferReceivedPreview > 0 ? <View style={styles.transferPreview}><Text style={styles.transferPreviewAmount}>{formatMoney(parseAmount(entryAmount), language, transferSource.currency)}</Text><Ionicons name="arrow-forward-outline" size={15} color={C.textSubtle} /><Text style={styles.transferPreviewAmount}>{formatMoney(transferReceivedPreview, language, transferTarget.currency)}</Text></View> : null}
                {Boolean(transferValidationError) && <Text style={styles.inlineError}>{transferValidationError}</Text>}
                </View> : null}
                <View style={styles.entryDetailsCard}><Text style={styles.inputLabel}>{t('finance.description')}</Text>
                <TextInput value={entryTitle} onChangeText={setEntryTitle} placeholder={t('finance.descriptionPlaceholder')} placeholderTextColor={C.textSubtle} style={styles.textInput} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.entryAmountCard}><Text style={styles.inputLabel}>{t('finance.amount')}</Text><View style={styles.amountInputShell}><TextInput value={entryAmount} onChangeText={(value) => setEntryAmount(sanitizeAmount(value))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.textSubtle} numberOfLines={1} style={[styles.amountInput, { fontSize: amountFontSize(entryAmount) }]} accessibilityLabel={t('finance.amount')} /><Text style={styles.amountCurrency}>{entryBudget?.currency ?? baseCurrency}</Text></View>{Boolean(entryAmountError) && <Text style={styles.inlineError}>{entryAmountError}</Text>}</View>
                <View style={styles.entryDetailsCard}><Text style={styles.inputLabel}>{t('finance.description')}</Text>
                <TextInput value={entryTitle} onChangeText={setEntryTitle} placeholder={t('finance.descriptionPlaceholder')} placeholderTextColor={C.textSubtle} style={styles.textInput} />
                <Text style={styles.inputLabel}>{t('finance.category')}</Text>
                <Pressable style={styles.categorySelect} onPress={() => { setCategoryQuery(''); setCategoryPickerOpen(true); }} accessibilityRole="button" accessibilityLabel={t('finance.category')}>
                  <View style={styles.categorySelectIcon}><Ionicons name={(operationCategories.find((category) => category.id === entryCategory)?.icon ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name']} size={17} color={C.gold} /></View>
                  <Text style={styles.categorySelectText} numberOfLines={1}>{operationCategories.find((category) => category.id === entryCategory)?.name ?? t(`finance.categories.${entryCategory}`, { defaultValue: entryCategory })}</Text>
                  <Ionicons name="chevron-down-outline" size={17} color="rgba(255,244,208,0.45)" />
                </Pressable>
                </View>
                <Modal visible={categoryPickerOpen} transparent animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
                  <KeyboardAvoidingView style={styles.categoryPickerBackdrop} behavior="padding" enabled={Platform.OS === 'ios'}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setCategoryPickerOpen(false)} />
                    <View style={styles.categoryPickerSheet}>
                      <View style={styles.categoryPickerHeader}><Text style={styles.categoryPickerTitle}>{t('finance.category')}</Text><Pressable style={styles.categoryPickerClose} onPress={() => setCategoryPickerOpen(false)} accessibilityLabel={t('finance.close')}><Ionicons name="close" size={18} color={C.goldLight} /></Pressable></View>
                      <View style={styles.categorySearch}><Ionicons name="search-outline" size={17} color={C.textSubtle} /><TextInput value={categoryQuery} onChangeText={setCategoryQuery} placeholder={t('finance.search', { defaultValue: 'Search categories' })} placeholderTextColor={C.textSubtle} style={styles.categorySearchInput} /></View>
                      <ScrollView style={styles.categoryPickerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {filteredOperationCategories.map((category) => <Pressable key={category.id} style={[styles.categoryPickerRow, entryCategory === category.id && styles.categoryPickerRowActive]} onPress={() => { setEntryCategory(category.id); setCategoryPickerOpen(false); }}><View style={styles.categoryPickerRowIcon}><Ionicons name={category.icon as React.ComponentProps<typeof Ionicons>['name']} size={17} color={entryCategory === category.id ? C.goldLight : C.gold} /></View><Text style={[styles.categoryPickerRowText, entryCategory === category.id && styles.categoryPickerRowTextActive]}>{category.name ?? t(`finance.categories.${category.id}`, { defaultValue: category.id })}</Text>{entryCategory === category.id && <Ionicons name="checkmark" size={18} color={C.gold} />}</Pressable>)}
                        {!filteredOperationCategories.length && <Text style={styles.categoryPickerEmpty}>{t('finance.modules.noResults', { defaultValue: 'No categories found' })}</Text>}
                        <Pressable style={styles.categoryPickerAdd} onPress={() => { setCategoryPickerOpen(false); onOpenModule?.('categories'); }} accessibilityRole="button" accessibilityLabel={t('finance.addCategory')}><Ionicons name="add-circle-outline" size={18} color={C.gold} /><Text style={styles.categoryPickerAddText}>{t('finance.addCategory')}</Text></Pressable>
                      </ScrollView>
                    </View>
                  </KeyboardAvoidingView>
                </Modal>
              </>
            )}

            <View style={styles.entryDateCard}><DateSelect label={t('finance.date')} value={entryDate} onChange={setEntryDate} firstDayOfWeek={financeState.settings.firstDayOfWeek} /></View>

          </ScrollView>
          <View style={styles.entryFooter}><Pressable style={[styles.saveButton, !entryCanSave && styles.disabledButton]} onPress={addTransaction} disabled={!entryCanSave} accessibilityRole="button" accessibilityState={{ disabled: !entryCanSave }}><Text style={styles.saveButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{editingTransaction ? t('finance.updateEntry', { defaultValue: 'UPDATE OPERATION' }) : t('finance.saveEntry')}</Text></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = createThemeStyles((C) => StyleSheet.create({
  screenBackButton: { width: 42, height: 42, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  screenTopSpacing: { paddingTop: 24 },
  rateWarning: { minHeight: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.35)', backgroundColor: 'rgba(233,200,119,0.07)', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 12 },
  rateWarningText: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SANS, fontSize: 10, lineHeight: 15 },
  activityPanel: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.56)', padding: 14, marginTop: 22, marginBottom: 18 },
  activityCopy: { color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 9, marginTop: -3, marginBottom: 12 },
  activityScrollContent: { flexDirection: 'row', paddingBottom: 3 },
  activityLabelsColumn: { width: 28, paddingTop: 17, gap: 3 },
  activityMonthSpacer: { height: 11 },
  activityWeekdayLabel: { height: 11, color: 'rgba(255,244,208,0.3)', fontFamily: SANS, fontSize: 6, lineHeight: 11 },
  activityMonthRow: { height: 14, flexDirection: 'row' },
  activityMonthLabel: { width: 14, color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 6, lineHeight: 10 },
  activityGrid: { flexDirection: 'row', gap: 3 },
  activityWeek: { gap: 3 },
  activityDay: { width: 11, height: 11, borderRadius: 3 },
  activityLevel0: { backgroundColor: 'rgba(255,255,255,0.055)' },
  activityLevel1: { backgroundColor: 'rgba(233,200,119,0.24)' },
  activityLevel2: { backgroundColor: 'rgba(233,200,119,0.45)' },
  activityLevel3: { backgroundColor: 'rgba(233,200,119,0.7)' },
  activityLevel4: { backgroundColor: C.gold },
  activityLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 11 },
  activityLegendText: { color: 'rgba(255,244,208,0.3)', fontFamily: SANS, fontSize: 6.5, letterSpacing: 0.4 },
  activityLegendCell: { width: 10, height: 10, borderRadius: 3 },
  editActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  editAction: { flex: 1, marginTop: 0 },
  editCancelButton: { minHeight: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  editCancelText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700' },
  quickMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', paddingHorizontal: 24 },
  quickMenuPanel: { maxHeight: '88%', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#090B12', padding: 16 },
  quickMenuScroll: { paddingBottom: 2 },
  quickMenuTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 22 },
  quickMenuSubtitle: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 12 },
  quickMenuItem: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(233,200,119,0.12)', gap: 12 },
  quickMenuIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.055)', alignItems: 'center', justifyContent: 'center' },
  quickMenuItemCopy: { flex: 1, minWidth: 0 },
  quickMenuItemText: { color: C.goldLight, fontFamily: SANS, fontSize: 13, letterSpacing: 0.25 },
  quickMenuItemSubtitle: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 11, marginTop: 4 },
  safe: { flex: 1 },
  root: { flex: 1, minHeight: 0 },
  header: { height: 78, paddingTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { maxWidth: 220, color: C.goldLight, fontFamily: SANS, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  headerSubtitle: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 9.5, letterSpacing: 1.35, marginTop: 3 },
  menuGlyph: { width: 18, gap: 3.5 },
  menuLineWide: { width: 18, height: 1.5, borderRadius: 2, backgroundColor: C.gold },
  menuLine: { width: 12, height: 1.5, borderRadius: 2, backgroundColor: C.gold },
  accountsGlyph: { width: 19, gap: 3 },
  accountGlyphRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  accountGlyphDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.gold },
  accountGlyphLine: { width: 13, height: 1.5, borderRadius: 2, backgroundColor: C.gold },
  tabShell: { height: 50, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.11)', overflow: 'hidden' },
  budgetTabs: { alignItems: 'stretch', gap: 2, paddingHorizontal: 10 },
  budgetTab: { maxWidth: 170, height: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  budgetTabActive: { borderBottomColor: C.gold },
  budgetTabText: { flexShrink: 1, color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 10, letterSpacing: 0.5 },
  budgetTabTextActive: { color: C.goldLight, fontWeight: '600' },
  content: { paddingHorizontal: 18, paddingTop: 13, paddingBottom: 13 },
  fixedContent: { flex: 1, minHeight: 0, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 0 },
  fixedBudgetView: { flex: 1, minHeight: 0 },
  compactHero: { height: 146, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(10,12,20,0.66)' },
  compactHeroInfo: { flex: 1, minWidth: 0, paddingLeft: 16, paddingTop: 14, paddingBottom: 14, justifyContent: 'space-between' },
  compactBalance: { maxWidth: 205, color: C.goldLight, fontFamily: SERIF, fontSize: 30, letterSpacing: 0.3, marginTop: 5 },
  compactEquivalent: { color: 'rgba(255,244,208,0.54)', fontFamily: SANS, fontSize: 10.5, marginTop: 2 },
  compactLimitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 3 },
  compactLimitTopWithProgress: { marginBottom: 7 },
  compactLimitLabel: { flex: 1, color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 9, letterSpacing: 0.7 },
  compactLimitValue: { maxWidth: 128, color: 'rgba(255,244,208,0.66)', fontFamily: SERIF, fontSize: 10.5, textAlign: 'right' },
  compactLimitUnset: { minHeight: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.22)', backgroundColor: 'rgba(233,200,119,0.055)', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  compactLimitUnsetDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(233,200,119,0.48)' },
  compactLimitUnsetText: { color: 'rgba(255,244,208,0.45)', fontFamily: SANS, fontSize: 7.5, fontWeight: '600', letterSpacing: 0.65 },
  compactGemWindow: { width: 130, height: 145, overflow: 'hidden' },
  compactGemCanvas: { position: 'absolute', width: 300, height: 288, left: -85, top: -71, transform: [{ scale: 0.39 }] },
  rangeSelector: { height: 46, flexDirection: 'row', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.035)', padding: 4, marginBottom: 12 },
  rangeOption: { flex: 1, minWidth: 0, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rangeOptionActive: { backgroundColor: 'rgba(233,200,119,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.42)' },
  rangeOptionText: { maxWidth: '94%', color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 9, letterSpacing: 0.15, textAlign: 'center' },
  rangeOptionTextActive: { color: C.goldLight, fontWeight: '700' },
  rangeActiveDot: { position: 'absolute', bottom: 4, width: 3, height: 3, borderRadius: 2, backgroundColor: C.gold },
  statsSummary: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.62)', padding: 16, marginBottom: 22 },
  statsInsights: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  statsInsight: { width: '48.5%', minHeight: 82, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.56)', padding: 12, justifyContent: 'center' },
  statsInsightWide: { width: '100%' },
  statsInsightLabel: { color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 7.5, lineHeight: 11, letterSpacing: 0.7, textTransform: 'uppercase' },
  statsInsightValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 13, marginTop: 5 },
  statsInsightDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: C.line },
  statsComparisonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 },
  statsComparisonCard: { width: '31.5%', minHeight: 92, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.045)', padding: 11, justifyContent: 'center' },
  statsComparisonCardWide: { width: '100%' },
  statsComparisonValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 18, marginTop: 6 },
  statsComparisonMeta: { color: C.textSubtle, fontFamily: SANS, fontSize: 8.5, lineHeight: 13, marginTop: 4 },
  statsSummaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statsSummaryCopy: { flex: 1, minWidth: 0 },
  statsSummaryLabel: { color: 'rgba(233,200,119,0.5)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.4 },
  statsSummaryNet: { width: '100%', fontFamily: SERIF, fontSize: 29, marginTop: 6 },
  statsOperationBadge: { minWidth: 44, height: 44, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, paddingHorizontal: 8 },
  statsOperationCount: { color: C.goldLight, fontFamily: SANS, fontSize: 10.5 },
  statsSummaryValues: { flexDirection: 'row', alignItems: 'center', marginTop: 17, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  statsMetric: { flex: 1, minWidth: 0 },
  statsMetricLabel: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 10, letterSpacing: 0.6, marginBottom: 5 },
  statsMetricValue: { fontFamily: SERIF, fontSize: 15 },
  statsMetricDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: C.line, marginHorizontal: 14 },
  operationHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statsIconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  statsIcon: { width: 17, height: 17, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, paddingBottom: 3 },
  statsBarShort: { width: 3, height: 8, borderRadius: 2, backgroundColor: C.gold },
  statsBarTall: { width: 3, height: 15, borderRadius: 2, backgroundColor: C.goldLight },
  statsBarMid: { width: 3, height: 11, borderRadius: 2, backgroundColor: C.goldMid },
  fixedSectionHeader: { minHeight: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  sectionHeading: { paddingLeft: 3 },
  fixedOperationsPanel: { flex: 1, minHeight: 0, paddingBottom: 0 },
  operationsScroll: { flex: 1 },
  operationsScrollContent: { flexGrow: 1, paddingBottom: 76 },
  floatingAdd: { position: 'absolute', right: 13, bottom: 25, width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  floatingWorkspace: { position: 'absolute', right: 14, bottom: 81, width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, padding: 18, overflow: 'hidden', backgroundColor: 'rgba(10,12,20,0.66)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 8, letterSpacing: 2.1 },
  balance: { maxWidth: 245, color: C.goldLight, fontFamily: SERIF, fontSize: 36, letterSpacing: 0.4, marginTop: 7 },
  accountBadge: { height: 27, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(4,5,10,0.35)' },
  accountBadgeDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  accountBadgeText: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 7, letterSpacing: 1.1 },
  gemStage: { height: 213, alignItems: 'center', justifyContent: 'center', marginTop: -3, marginBottom: -15 },
  heroFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, flexDirection: 'row', paddingTop: 13 },
  heroFooterBlock: { flex: 1, minWidth: 0 },
  heroFooterRight: { alignItems: 'flex-end' },
  microLabel: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 9.5, letterSpacing: 1.1, marginBottom: 5 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 11 },
  actionButton: { flex: 1, height: 54, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  expenseButton: { borderColor: 'rgba(240,139,136,0.32)', backgroundColor: 'rgba(240,139,136,0.075)' },
  incomeButton: { borderColor: 'rgba(183,173,132,0.32)', backgroundColor: 'rgba(183,173,132,0.075)' },
  actionCircle: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  expenseCircle: { backgroundColor: 'rgba(240,139,136,0.15)' },
  incomeCircle: { backgroundColor: 'rgba(183,173,132,0.15)' },
  expenseSymbol: { color: '#F08B88', fontFamily: SANS, fontSize: 18, lineHeight: 20 },
  incomeSymbol: { color: C.green, fontFamily: SANS, fontSize: 17, lineHeight: 19 },
  actionText: { color: C.goldLight, fontFamily: SANS, fontSize: 9, letterSpacing: 0.8 },

  incomeText: { color: C.green },
  expenseText: { color: '#F08B88' },
  sectionEyebrow: { color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 9, letterSpacing: 1.35, marginBottom: 4 },
  sectionTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13, fontWeight: '600', letterSpacing: 0.45 },
  operationCountBadge: { height: 44, minWidth: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.ink, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  operationCount: { color: C.goldLight, fontFamily: SANS, fontSize: 10.5, fontWeight: '600' },
  panel: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.53)', paddingHorizontal: 13, overflow: 'hidden' },
  transactionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.09)' },
  categoryIcon: { width: 42, height: 42, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.2)', backgroundColor: 'rgba(233,200,119,0.055)', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  incomeIcon: { borderColor: 'rgba(183,173,132,0.28)', backgroundColor: 'rgba(183,173,132,0.08)' },
  transactionMain: { flex: 1, minWidth: 0 },
  transactionTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13, letterSpacing: 0.1 },
  transactionMeta: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 10.5, letterSpacing: 0.1, marginTop: 5 },
  transactionAmount: { width: 91, fontFamily: SERIF, fontSize: 14, textAlign: 'right' },
  transactionActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 7 },
  transactionAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flexGrow: 1, minHeight: 150, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  emptyDiamond: { width: 19, height: 19, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 13, opacity: 0.75 },
  emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 11, letterSpacing: 0.8 },
  emptyCopy: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  limitCard: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.53)', padding: 16 },
  limitAmounts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  limitSpent: { color: C.goldLight, fontFamily: SERIF, fontSize: 21 },
  limitTotal: { color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 9 },
  limitPercent: { color: C.gold, fontFamily: SANS, fontSize: 10, letterSpacing: 0.5 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  exitBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.72)' },
  exitCard: { width: '100%', maxWidth: 360, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 22 },
  exitTitle: { color: C.text, fontFamily: SERIF, fontSize: 23, textAlign: 'center' },
  exitCopy: { color: C.textMuted, fontFamily: SANS, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 9 },
  exitActions: { flexDirection: 'row', gap: 9, marginTop: 19 },
  exitCancel: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  exitCancelText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' },
  exitConfirm: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  exitConfirmText: { color: C.void, fontFamily: SANS, fontSize: 11, fontWeight: '800' },
  negativeBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.76)' },
  negativeCard: { width: '100%', maxWidth: 360, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.38)', backgroundColor: '#0A0C14', padding: 22, alignItems: 'center' },
  negativeIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.4)', backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  negativeEyebrow: { color: 'rgba(233,200,119,0.55)', fontFamily: SANS, fontSize: 8, fontWeight: '700', letterSpacing: 1.6 },
  negativeTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 24, textAlign: 'center', marginTop: 6 },
  negativeCopy: { color: 'rgba(255,244,208,0.58)', fontFamily: SANS, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  negativeAmount: { color: C.red, fontFamily: SERIF, fontSize: 25, marginTop: 14, maxWidth: '100%' },
  negativeActions: { width: '100%', flexDirection: 'row', gap: 9, marginTop: 21 },
  negativeCancel: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  negativeCancelText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700' },
  negativeConfirm: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  negativeConfirmText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '800' },
  drawer: { width: '84%', height: '100%', backgroundColor: '#090B12', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.line, paddingHorizontal: 18 },
  drawerMenuScroll: { flex: 1 },
  drawerMenuContent: { paddingTop: 6, paddingBottom: 12 },
  drawerBalanceCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, padding: 15, marginTop: 8, backgroundColor: C.glass },
  drawerBalance: { color: C.goldLight, fontFamily: SERIF, fontSize: 28, marginTop: 3 },
  drawerBudgetCount: { color: 'rgba(255,244,208,0.32)', fontFamily: SANS, fontSize: 9.5, letterSpacing: 0.8, marginTop: 7 },
  drawerNav: { marginTop: 18, gap: 3 },
  drawerSectionTitle: { color: 'rgba(233,200,119,0.48)', fontFamily: SANS, fontSize: 8, fontWeight: '700', letterSpacing: 1.2, marginBottom: 5, paddingHorizontal: 12 },
  drawerItem: { minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  drawerItemActive: { backgroundColor: 'rgba(233,200,119,0.09)' },
  drawerItemIcon: { width: 34, alignItems: 'flex-start' },
  drawerItemCopy: { flex: 1, minWidth: 0 },
  drawerItemText: { color: C.goldLight, fontFamily: SANS, fontSize: 14.5, letterSpacing: 0.4 },
  drawerItemSubtitle: { color: 'rgba(255,244,208,0.3)', fontFamily: SANS, fontSize: 10.5, marginTop: 3 },
  drawerPrivacy: { color: 'rgba(255,244,208,0.24)', fontFamily: SANS, fontSize: 8.5, lineHeight: 13, marginTop: 'auto', marginBottom: 14 },
  managerRoot: { flex: 1, backgroundColor: C.background },
  managerSafe: { flex: 1 },
  managerHeader: { height: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, paddingHorizontal: 8 },
  managerHeaderSide: { width: 78, padding: 10 },
  managerHeaderRight: { alignItems: 'flex-end' },
  managerHeaderAction: { color: C.gold, fontFamily: SANS, fontSize: 11 },
  managerHeaderTitle: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  managerContent: { padding: 18, paddingBottom: 38 },
  managerEyebrow: { color: 'rgba(233,200,119,0.48)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.8, marginBottom: 9 },
  managerAccounts: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.56)', paddingHorizontal: 12, overflow: 'hidden' },
  managerAccount: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.09)' },
  managerAccountSelected: { backgroundColor: 'rgba(233,200,119,0.035)' },
  managerAccountMark: { width: 38, height: 38, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  managerAccountMarkDot: { width: 9, height: 9, borderRadius: 5 },
  managerAccountMain: { flex: 1, minWidth: 0 },
  managerAccountName: { color: C.goldLight, fontFamily: SANS, fontSize: 11.5 },
  managerAccountMeta: { color: 'rgba(255,244,208,0.3)', fontFamily: SANS, fontSize: 8.5, marginTop: 5 },
  managerAccountRight: { alignItems: 'flex-end', marginLeft: 8 },
  managerAccountBalance: { color: C.goldLight, fontFamily: SERIF, fontSize: 14 },
  managerSelected: { color: 'rgba(255,244,208,0.26)', fontFamily: SANS, fontSize: 7.5, marginTop: 5 },
  statsRoot: { flex: 1, backgroundColor: C.background },
  statsSafe: { flex: 1 },
  statsContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, paddingBottom: 38 },
  statsCategoryRow: { minHeight: 61, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.09)', paddingVertical: 11 },
  statsCategoryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statsCategoryName: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 }, statsCategoryNameText: { flex: 1, minWidth: 0 },
  statsCategoryRank: { color: 'rgba(255,244,208,0.3)', fontFamily: SANS, fontSize: 9, fontWeight: '700', minWidth: 15 },
  statsCategoryIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' },
  statsCategoryIconTop: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(233,200,119,0.16)' },
  statsCategoryAmount: { minWidth: 82, maxWidth: '44%', alignItems: 'flex-end', gap: 2 },
  statsCategoryPct: { color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 9 },
  statsTopCard: { marginHorizontal: -12, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, borderBottomColor: C.line, backgroundColor: C.glass },
  statsTopLabel: { color: 'rgba(233,200,119,0.55)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.2, marginBottom: 9 },
  statsTopName: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SERIF, fontSize: 16, lineHeight: 20 },
  statsTopAmount: { width: '100%', color: C.goldLight, fontFamily: SERIF, fontSize: 16, textAlign: 'right' },
  statsTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  statsTotalLabel: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 9, letterSpacing: 1 },
  statsTotalValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 16, flexShrink: 1, marginLeft: 10 },
  statsCategoryTrack: { height: 5, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden', marginTop: 10 },
  statsCategoryFill: { height: 5, borderRadius: 3 },
  statsFlowCard: { marginBottom: 22 },
  flowChart: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 14, paddingHorizontal: 2 },
  flowColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  flowBars: { height: 72, width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  flowBar: { borderRadius: 3 },
  flowNowDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  flowNowDotActive: { backgroundColor: C.gold },
  flowLabel: { width: '100%', height: 14, color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 7.5, lineHeight: 12, maxWidth: '100%', textAlign: 'center' },
  flowLabelActive: { color: C.goldLight, fontWeight: '700' },
  flowLegend: { flexDirection: 'row', gap: 18, paddingTop: 12, paddingBottom: 10 },
  flowLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowLegendChip: { width: 8, height: 8, borderRadius: 4 },
  flowLegendText: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 9 },
  statsFlowEmpty: { minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statsCalendarCard: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.72)', padding: 12 },
  statsCalendarHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsCalendarArrow: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statsCalendarTitle: { flex: 1, color: C.goldLight, fontFamily: SERIF, fontSize: 18, textAlign: 'center', textTransform: 'capitalize' },
  statsCalendarWeek: { flexDirection: 'row', marginTop: 6 },
  statsCalendarWeekday: { width: '14.285%', color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 10, textAlign: 'center', textTransform: 'uppercase' },
  statsCalendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  statsCalendarCell: { width: '14.285%', minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statsCalendarCellSelected: { backgroundColor: C.gold },
  statsCalendarDay: { color: C.goldLight, fontFamily: SANS, fontSize: 13 },
  statsCalendarDaySelected: { color: C.void, fontWeight: '800' },
  statsCalendarDots: { height: 6, flexDirection: 'row', gap: 3, marginTop: 3 },
  statsCalendarDot: { width: 5, height: 5, borderRadius: 3 },
  statsCalendarIncomeDot: { backgroundColor: C.goldLight },
  statsCalendarExpenseDot: { backgroundColor: C.red },
  statsCalendarDetails: { minHeight: 76, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 10, paddingTop: 13, gap: 9 },
  statsCalendarItemName: { flex: 1, minWidth: 0, lineHeight: 16 },
  statsEmpty: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 5 },
  createCard: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.62)', padding: 17, marginTop: 22 },
  createEyebrow: { color: 'rgba(233,200,119,0.55)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.7 },
  createTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 27, marginTop: 7, marginBottom: 8 },
  inputLabel: { color: 'rgba(233,200,119,0.5)', fontFamily: SANS, fontSize: 8.5, letterSpacing: 0.5, marginTop: 11, marginBottom: 1 },
  textInput: { height: 43, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.16)', backgroundColor: 'transparent', color: C.goldLight, fontFamily: SANS, fontSize: 13, paddingHorizontal: 2 },
  rateInputLine: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rateEquationValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 16 },
  rateEquals: { color: C.textSubtle, fontFamily: SANS, fontSize: 16 },
  rateInlineInput: { flex: 1, minWidth: 48, height: 43, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.28)', color: C.goldLight, fontFamily: SERIF, fontSize: 18, paddingHorizontal: 2, paddingVertical: 0, textAlign: 'center' },
  transferPreview: { minHeight: 38, borderRadius: 11, backgroundColor: 'rgba(233,200,119,0.055)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 9, marginTop: 8 },
  transferPreviewAmount: { flexShrink: 1, color: C.goldLight, fontFamily: SANS, fontSize: 10, fontWeight: '600' },
  inputError: { borderBottomColor: C.red },
  inlineError: { color: C.red, fontFamily: SANS, fontSize: 11, lineHeight: 16, marginTop: 7 },
  managerInputRow: { flexDirection: 'row', gap: 9 },
  managerInputColumn: { flex: 1, minWidth: 0 },
  moneyInputShell: { height: 45, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.16)', backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  moneyInputCurrency: { color: C.gold, fontFamily: SERIF, fontSize: 17, marginRight: 5 },
  moneyInput: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SERIF, fontSize: 15, paddingVertical: 0 },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorButton: { width: 37, height: 37, borderRadius: 19, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  colorButtonSelected: { borderColor: C.goldLight },
  colorDot: { width: 25, height: 25, borderRadius: 13 },
  createButton: { height: 53, borderRadius: 16, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  createButtonText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 },
  disabledButton: { opacity: 0.35 },
  entryBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.66)' },
  entryBackdropTablet: { justifyContent: 'center', padding: 28 },
  managerKeyboard: { flex: 1 },
  entrySheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', overflow: 'hidden' },
  entrySheetTablet: { borderRadius: 28, maxHeight: '86%' },
  entryScroll: { flexShrink: 1 },
  entrySheetContent: { paddingHorizontal: 19, paddingBottom: 18 },
  entryFooter: { paddingHorizontal: 19, paddingTop: 10, paddingBottom: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: '#0A0C14' },
  detailSheet: { maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14' },
  detailSheetContent: { flexGrow: 1, paddingHorizontal: 19, paddingBottom: 28 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,244,208,0.2)', alignSelf: 'center', marginTop: 9, marginBottom: 13 },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  detailHeaderCopy: { flex: 1 },
  entryTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 27, marginTop: 5 },

  entryClose: { width: 31, height: 31, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  entryCloseText: { color: 'rgba(255,244,208,0.55)', fontFamily: SANS, fontSize: 13 },
  kindControl: { height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.055)', flexDirection: 'row', padding: 3, marginTop: 18 },
  kindOption: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kindOptionActive: { backgroundColor: 'rgba(233,200,119,0.17)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  kindText: { color: 'rgba(255,244,208,0.36)', fontFamily: SANS, fontSize: 9, letterSpacing: 0.9 },
  kindTextActive: { color: C.goldLight },
  entryAccountCard: { minHeight: 66, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.055)', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginTop: 12 },
  entryAccountIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.025)', alignItems: 'center', justifyContent: 'center' },
  entryAccountCopy: { flex: 1, minWidth: 0 },
  entryAccountName: { color: C.goldLight, fontFamily: SANS, fontSize: 12, lineHeight: 17, marginTop: 2 },
  entryAccountCurrency: { color: C.gold, fontFamily: SERIF, fontSize: 15 },
  entryAmountCard: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.56)', paddingHorizontal: 13, paddingBottom: 8, marginTop: 11 },
  entryDetailsCard: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.48)', paddingHorizontal: 13, paddingBottom: 11, marginTop: 11 },
  entryDateCard: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.48)', paddingHorizontal: 13, paddingBottom: 8, marginTop: 11 },
  amountInputShell: { height: 57, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.22)', backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  amountCurrency: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginLeft: 9 },
  amountInput: { flex: 1, color: C.goldLight, fontFamily: SERIF, fontSize: 27, paddingVertical: 0 },
  categoryChips: { gap: 7, paddingBottom: 2 },
  categoryChip: { borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.025)', paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryChipActive: { backgroundColor: 'rgba(233,200,119,0.14)' },
  categoryChipText: { color: 'rgba(255,244,208,0.43)', fontFamily: SANS, fontSize: 9 },
  categoryChipTextActive: { color: C.goldLight },
  transferSelectCard: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.48)', paddingHorizontal: 13, paddingBottom: 11, marginTop: 11 },
  transferAmountCard: { minWidth: 0, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.56)', paddingHorizontal: 12, paddingBottom: 8, marginTop: 11 },
  categorySelect: { minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.16)', backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, gap: 9 },
  categorySelectIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' },
  categorySelectText: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 12 },
  categoryPickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  categoryPickerSheet: { width: '100%', maxWidth: 560, maxHeight: '72%', alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 18 },
  categoryPickerHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryPickerTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 21 },
  categoryPickerClose: { width: 40, height: 40, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  categorySearch: { minHeight: 45, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, marginTop: 10 },
  categorySearchInput: { flex: 1, minHeight: 43, color: C.goldLight, fontFamily: SANS, fontSize: 13 },
  categoryPickerList: { marginTop: 8 },
  categoryPickerRow: { minHeight: 52, borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 10 },
  categoryPickerRowActive: { backgroundColor: 'rgba(233,200,119,0.1)' },
  categoryPickerRowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  categoryPickerRowText: { flex: 1, color: 'rgba(255,244,208,0.72)', fontFamily: SANS, fontSize: 12 },
  categoryPickerRowTextActive: { color: C.goldLight, fontWeight: '700' },
  categoryPickerEmpty: { color: 'rgba(255,244,208,0.46)', fontFamily: SANS, fontSize: 11, textAlign: 'center', paddingVertical: 24 },
  categoryPickerAdd: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginTop: 6 },
  categoryPickerAddText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' },
  operationCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  operationCategoryChip: { width: '31.5%', minHeight: 38, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  operationCategoryChipNarrow: { width: '48%' },
  operationCategoryText: { flexShrink: 1, textAlign: 'center' },
  detailAmountBlock: { alignItems: 'center', marginTop: 25, paddingBottom: 21, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  detailKind: { fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  detailAmount: { fontFamily: SERIF, fontSize: 34, marginTop: 7 },
  detailInfoList: { marginTop: 10 },
  detailInfoRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  detailLabel: { color: 'rgba(233,200,119,0.52)', fontFamily: SANS, fontSize: 8, letterSpacing: 1 },
  detailValue: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 10, textAlign: 'right' },
  detailActions: { flexDirection: 'row', gap: 9, marginTop: 20 },
  detailAction: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 9, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  detailEditAction: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.08)' },
  detailDeleteAction: { borderColor: 'rgba(240,139,136,0.55)', backgroundColor: 'rgba(240,139,136,0.07)' },
  detailEditText: { flexShrink: 1, color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 0.7, textAlign: 'center' },
  detailDeleteText: { flexShrink: 1, color: C.red, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 0.7, textAlign: 'center' },
  saveButton: { height: 52, borderRadius: 16, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
}));
