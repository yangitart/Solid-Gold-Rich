import React from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '@/features/app-state/presentation/components/AppStateContext';
import type { AppLanguage } from '@/domain/AppState';
import { DEFAULT_COLORS } from '@/features/finance/domain/entities/defaultColors';
import { hashPin } from '@/shared/utils/pin';
import { waitForImportLoading } from '@/shared/ui/importLoading';
import { supportedLanguages } from '@/shared/i18n/i18next';
import type {
  Account,
  Budget,
  Debt,
  FinanceCategory,
  RecurringFrequency,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
} from '@/features/finance/domain/entities/financeTypes';
import { C, FORM_TYPOGRAPHY, SANS, SERIF, createThemeStyles } from '@/shared/ui/theme/luxury';
import { useCurrentDate } from '@/shared/ui/useCurrentDate';
import DateSelect from '@/shared/ui/DateSelect';
import DeveloperContactCard from '@/shared/ui/DeveloperContactCard';
import { ConfirmDialog, SearchableSelect } from '@/shared/ui/FormKit';
import {
  captureCurrencySnapshot,
  historicalAmountInCurrency,
  currencyRate as resolveCurrencyRate,
} from '@/shared/domain/finance/currency';
import {
  accountHasHistory,
  budgetSpent,
  isCashFlowTransaction,
  isTransferTransaction,
  filterActivityTransactions,
  inDateRange,
  periodBounds,
  transactionMatchesActivityFilter,
  type FinanceActivityFilter,
} from '@/features/finance/domain/services/financeDomain';
import {
  recordDebtPayment,
  recordSavingsContribution,
} from '@/features/finance/application/services/financeStateOperations';
import { removeCategory as removeFinanceCategory } from '@/features/finance/application/useCases/removeCategory';
import type { FileService } from '@/shared/application/ports/FileService';
import type { BackupRepository } from '@/features/backup/application/ports/BackupRepository';
import type { AppBackup } from '@/features/backup/application/ports/BackupTypes';

export type FinanceModuleName =
  | 'accounts'
  | 'debt'
  | 'notes'
  | 'tools'
  | 'savings'
  | 'budget'
  | 'activity'
  | 'recurring'
  | 'categories'
  | 'settings';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const money = (value: number, currency: string) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
const dateText = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ToolKey = 'calculator' | 'cashCounter' | 'discountTax' | 'interest';
type CashCountRow = { id: string; denomination: string; quantity: string };
type SettingsSection = 'language' | 'currency' | 'theme' | 'week' | 'pin' | 'data' | 'contact';
type ActivityFilter = FinanceActivityFilter;
type ActivityPeriod = 'all' | 'today' | 'week' | 'month' | 'year';
type ActivityGroup = { key: string; label: string; transactions: Transaction[] };
type ConfirmPrompt = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  icon?: IconName;
  destructive?: boolean;
};
type PendingFinanceImport =
  { kind: 'app'; backup: AppBackup } | { kind: 'full-json' | 'finance'; json: string };

const localDayKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const CATEGORY_ICON_OPTIONS: { name: IconName; label: string }[] = [
  { name: 'pricetag-outline', label: 'Tag' },
  { name: 'restaurant-outline', label: 'Food' },
  { name: 'cafe-outline', label: 'Coffee' },
  { name: 'fast-food-outline', label: 'Fast food' },
  { name: 'pizza-outline', label: 'Pizza' },
  { name: 'wine-outline', label: 'Drinks' },
  { name: 'home-outline', label: 'Home' },
  { name: 'build-outline', label: 'Repairs' },
  { name: 'construct-outline', label: 'Services' },
  { name: 'hammer-outline', label: 'Tools' },
  { name: 'car-outline', label: 'Car' },
  { name: 'car-sport-outline', label: 'Sport car' },
  { name: 'bus-outline', label: 'Bus' },
  { name: 'bicycle-outline', label: 'Bike' },
  { name: 'airplane-outline', label: 'Travel' },
  { name: 'boat-outline', label: 'Boat' },
  { name: 'cart-outline', label: 'Shopping' },
  { name: 'bag-handle-outline', label: 'Bags' },
  { name: 'shirt-outline', label: 'Clothes' },
  { name: 'diamond-outline', label: 'Luxury' },
  { name: 'medkit-outline', label: 'Health' },
  { name: 'bandage-outline', label: 'Pharmacy' },
  { name: 'pulse-outline', label: 'Fitness' },
  { name: 'barbell-outline', label: 'Gym' },
  { name: 'cash-outline', label: 'Cash' },
  { name: 'card-outline', label: 'Card' },
  { name: 'briefcase-outline', label: 'Work' },
  { name: 'business-outline', label: 'Business' },
  { name: 'gift-outline', label: 'Gift' },
  { name: 'school-outline', label: 'School' },
  { name: 'book-outline', label: 'Books' },
  { name: 'heart-outline', label: 'Care' },
  { name: 'phone-portrait-outline', label: 'Phone' },
  { name: 'laptop-outline', label: 'Tech' },
  { name: 'tv-outline', label: 'TV' },
  { name: 'musical-notes-outline', label: 'Music' },
  { name: 'film-outline', label: 'Movies' },
  { name: 'game-controller-outline', label: 'Fun' },
  { name: 'paw-outline', label: 'Pets' },
  { name: 'flower-outline', label: 'Garden' },
  { name: 'leaf-outline', label: 'Nature' },
  { name: 'sunny-outline', label: 'Energy' },
  { name: 'water-outline', label: 'Utilities' },
  { name: 'cube-outline', label: 'Box' },
  { name: 'layers-outline', label: 'Other' },
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
  'AED',
  'ARS',
  'AUD',
  'BRL',
  'CAD',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CUP',
  'CZK',
  'DKK',
  'DOP',
  'EGP',
  'EUR',
  'GBP',
  'GTQ',
  'HKD',
  'HNL',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'ISK',
  'JPY',
  'KRW',
  'MXN',
  'NIO',
  'NOK',
  'NZD',
  'PAB',
  'PEN',
  'PHP',
  'PLN',
  'PYG',
  'RON',
  'RUB',
  'SEK',
  'SGD',
  'THB',
  'TRY',
  'UAH',
  'USD',
  'UYU',
  'VES',
  'VND',
  'ZAR',
] as const;

function Field({
  title,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  numeric = false,
  secureTextEntry = false,
  maxLength,
}: {
  title: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  secureTextEntry?: boolean;
  maxLength?: number;
}) {
  const [focused, setFocused] = React.useState(false);
  const [showSecureText, setShowSecureText] = React.useState(false);
  return (
    <View style={styles.formField}>
      <Text style={styles.formFieldLabel} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.formInputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textSubtle}
          keyboardType={secureTextEntry ? 'number-pad' : numeric ? 'decimal-pad' : 'default'}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !showSecureText}
          maxLength={maxLength}
          autoCapitalize={secureTextEntry ? 'none' : undefined}
          autoCorrect={secureTextEntry ? false : undefined}
          autoComplete={secureTextEntry ? 'off' : undefined}
          importantForAutofill={secureTextEntry ? 'no' : 'auto'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={C.gold}
          style={[
            styles.formInput,
            secureTextEntry && styles.formInputWithVisibility,
            focused && styles.formInputFocused,
            multiline && styles.formMultiline,
          ]}
          accessibilityLabel={title}
        />
        {secureTextEntry && (
          <Pressable
            style={styles.formInputVisibility}
            onPress={() => setShowSecureText((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={title}
          >
            <Ionicons
              name={showSecureText ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={C.gold}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Choice({
  values,
  value,
  onChange,
  labels,
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.formChoices}
    >
      {values.map((item) => (
        <Pressable
          key={item}
          onPress={() => onChange(item)}
          hitSlop={4}
          style={[styles.formChoice, item === value && styles.formChoiceActive]}
          accessibilityRole="radio"
          accessibilityState={{ selected: item === value }}
          accessibilityLabel={labels?.[item] ?? item}
        >
          <Text
            style={[styles.formChoiceText, item === value && styles.formChoiceTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {labels?.[item] ?? item}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Empty({
  title,
  body,
  fullHeight = false,
}: {
  title: string;
  body: string;
  fullHeight?: boolean;
}) {
  return (
    <View style={[styles.empty, fullHeight && styles.fullHeightEmpty]}>
      <View style={styles.diamond} />
      <Text style={styles.emptyTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.emptyBody} numberOfLines={3}>
        {body}
      </Text>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={styles.backButton}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('finance.back')}
    >
      <Ionicons name="arrow-back-outline" size={19} color={C.goldLight} />
    </Pressable>
  );
}

function AddAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={styles.addAction}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label.replace(/^\+\s*/, '')}
    >
      <View style={styles.addActionIcon}>
        <Ionicons name="add" size={17} color={C.gold} />
      </View>
      <Text
        style={styles.addActionText}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {label.replace(/^\+\s*/, '')}
      </Text>
    </Pressable>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.formSheet}
      contentContainerStyle={styles.formSheetContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function ResponsiveModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tablet = useWindowDimensions().width >= 700;
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalBackdrop, tablet && styles.modalBackdropTablet]}
        behavior="padding"
        enabled={Platform.OS === 'ios'}
      >
        <Sheet>
          <View style={styles.responsiveModalHeader}>
            <Pressable
              style={styles.sheetClose}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('finance.close')}
            >
              <Ionicons name="close" size={18} color={C.goldLight} />
            </Pressable>
          </View>
          {children}
        </Sheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FinanceModulesScreen({
  module: initialModule,
  onBack,
  initialActivityAccountId,
  backupRepository,
  fileService,
}: {
  module: FinanceModuleName;
  onBack: () => void;
  initialActivityAccountId?: string;
  backupRepository: BackupRepository;
  fileService: FileService;
}) {
  const { t, i18n: translationI18n } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTablet = windowWidth >= 700;
  const finance = useFinance();
  const { state } = finance;
  const [module, setModule] = React.useState<FinanceModuleName>(initialModule);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = React.useState(false);
  const [currencyPickerMode, setCurrencyPickerMode] = React.useState<
    'account' | 'debt' | 'primary' | 'rate'
  >('account');
  const [currencyQuery, setCurrencyQuery] = React.useState('');
  const [account, setAccount] = React.useState({
    name: '',
    type: 'cash' as Account['type'],
    currency: 'USD',
    opening: '',
    exchangeRate: '',
    color: DEFAULT_COLORS[0],
  });
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [accountError, setAccountError] = React.useState('');
  const [recurringOpen, setRecurringOpen] = React.useState(false);
  const [recurringTab, setRecurringTab] = React.useState<'recurring' | 'dates'>('recurring');
  const [recurring, setRecurring] = React.useState({
    accountId: '',
    kind: 'expense' as 'expense' | 'income',
    amount: '',
    payee: '',
    category: 'other',
    frequency: 'monthly' as RecurringFrequency,
    nextDate: new Date().toISOString(),
    description: '',
  });
  const [debtOpen, setDebtOpen] = React.useState(false);
  const [debt, setDebt] = React.useState({
    name: '',
    creditor: '',
    currency: 'USD',
    amount: '',
    dueDate: new Date().toISOString(),
    interest: '0',
  });
  const [savingsOpen, setSavingsOpen] = React.useState(false);
  const [savings, setSavings] = React.useState({
    name: '',
    currency: 'USD',
    accountId: '',
    target: '',
    deadline: new Date().toISOString(),
  });
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [reminder, setReminder] = React.useState({
    title: '',
    date: new Date().toISOString(),
    note: '',
  });
  const [categoryType, setCategoryType] = React.useState<'expense' | 'income' | 'store'>('expense');
  const [categoryName, setCategoryName] = React.useState('');
  const [categoryIcon, setCategoryIcon] = React.useState<IconName>('pricetag-outline');
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [iconPickerOpen, setIconPickerOpen] = React.useState(false);
  const [categoryError, setCategoryError] = React.useState('');
  const [activeTool, setActiveTool] = React.useState<ToolKey | null>(null);
  const [calculator, setCalculator] = React.useState('');
  const [calculatorResult, setCalculatorResult] = React.useState('');
  const [cashRows, setCashRows] = React.useState<CashCountRow[]>(() =>
    ['1', '5', '10', '20', '50', '100'].map((denomination) => ({
      id: uid('cash'),
      denomination,
      quantity: '',
    })),
  );
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
  const [confirmPrompt, setConfirmPrompt] = React.useState<ConfirmPrompt | null>(null);
  const [pendingFinanceImport, setPendingFinanceImport] =
    React.useState<PendingFinanceImport | null>(null);
  const fileOperationInFlight = React.useRef(false);
  const [importBusy, setImportBusy] = React.useState(false);
  const [currencyRateCurrency, setCurrencyRateCurrency] = React.useState('USD');
  const [currencyBaseDraft, setCurrencyBaseDraft] = React.useState('USD');
  const [currencyRate, setCurrencyRate] = React.useState('1');
  const [currencyRateInverted, setCurrencyRateInverted] = React.useState(false);
  const [currencyRateError, setCurrencyRateError] = React.useState('');
  const [activityFilter, setActivityFilter] = React.useState<ActivityFilter>('all');
  const [activityAccountId, setActivityAccountId] = React.useState(
    () =>
      initialActivityAccountId ??
      state.settings.activeAccountId ??
      state.accounts.find((account) => !account.archived)?.id ??
      'all',
  );
  const [activityPeriod, setActivityPeriod] = React.useState<ActivityPeriod>('today');
  const [activityPeriodOpen, setActivityPeriodOpen] = React.useState(false);
  const [activityCategory, setActivityCategory] = React.useState('all');
  const [activityQuery, setActivityQuery] = React.useState('');
  const [activityFilterOpen, setActivityFilterOpen] = React.useState(false);
  const [activityPage, setActivityPage] = React.useState(0);
  const activityListRef = React.useRef<SectionList<Transaction>>(null);
  const [debtPaymentTarget, setDebtPaymentTarget] = React.useState<Debt | null>(null);
  const [debtPaymentAmount, setDebtPaymentAmount] = React.useState('');
  const [debtPaymentAccountId, setDebtPaymentAccountId] = React.useState('');
  const [savingsTarget, setSavingsTarget] = React.useState<SavingsGoal | null>(null);
  const [savingsAmount, setSavingsAmount] = React.useState('');
  const [savingsSourceAccountId, setSavingsSourceAccountId] = React.useState('');
  const [savingsDestinationAccountId, setSavingsDestinationAccountId] = React.useState('');
  const [linkedActionError, setLinkedActionError] = React.useState('');
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  const [budgetDraft, setBudgetDraft] = React.useState({
    accountId: '',
    category: 'other',
    limit: '',
    period: 'monthly' as Budget['period'],
    rollover: false,
  });
  const [editingRecurringId, setEditingRecurringId] = React.useState<string | null>(null);
  const [editingReminderId, setEditingReminderId] = React.useState<string | null>(null);
  const firstAccountPrompted = React.useRef(false);

  React.useEffect(() => {
    setModule(initialModule);
    if (initialModule === 'tools') setActiveTool(null);
    if (initialModule === 'settings') setSettingsSection(null);
    if (initialModule === 'activity' && initialActivityAccountId)
      setActivityAccountId(initialActivityAccountId);
  }, [initialActivityAccountId, initialModule]);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currencyPickerOpen) {
        setCurrencyPickerOpen(false);
        return true;
      }
      if (activeTool) {
        setActiveTool(null);
        return true;
      }
      if (settingsSection) {
        setSettingsSection(null);
        return true;
      }
      if (
        accountOpen ||
        recurringOpen ||
        debtOpen ||
        savingsOpen ||
        reminderOpen ||
        debtPaymentTarget ||
        savingsTarget ||
        budgetOpen
      ) {
        setAccountOpen(false);
        setRecurringOpen(false);
        setDebtOpen(false);
        setSavingsOpen(false);
        setReminderOpen(false);
        setDebtPaymentTarget(null);
        setSavingsTarget(null);
        setBudgetOpen(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [
    accountOpen,
    activeTool,
    budgetOpen,
    currencyPickerOpen,
    debtOpen,
    debtPaymentTarget,
    onBack,
    recurringOpen,
    reminderOpen,
    savingsOpen,
    savingsTarget,
    settingsSection,
  ]);
  React.useEffect(() => {
    if (settingsSection === 'currency') {
      const preferred = state.settings.preferredCurrency || 'USD';
      setCurrencyBaseDraft(preferred);
      setCurrencyRateCurrency(preferred);
    }
  }, [settingsSection, state.settings.preferredCurrency]);
  const accounts = React.useMemo(
    () => state.accounts.filter((item) => !item.archived),
    [state.accounts],
  );
  const operationalAccounts = React.useMemo(
    () => accounts.filter((item) => item.type !== 'debt'),
    [accounts],
  );
  const baseCurrency = state.settings.preferredCurrency || 'USD';
  const currencyRates = React.useMemo(
    () => state.settings.exchangeRates ?? { USD: 1 },
    [state.settings.exchangeRates],
  );
  const rateBetweenCurrencies = React.useCallback(
    (fromCurrency: string, toCurrency: string) =>
      resolveCurrencyRate(fromCurrency, toCurrency, currencyRates),
    [currencyRates],
  );
  const configuredRateCurrency =
    currencyRateCurrency === 'USD' && currencyBaseDraft !== 'USD'
      ? currencyBaseDraft
      : currencyRateCurrency;
  const comparisonRateCurrency =
    configuredRateCurrency === currencyBaseDraft ? 'USD' : currencyBaseDraft;
  const currencyRateLeft = currencyRateInverted ? comparisonRateCurrency : configuredRateCurrency;
  const currencyRateRight = currencyRateInverted ? configuredRateCurrency : comparisonRateCurrency;
  const friendlyRate = React.useCallback(
    (configuredCurrency: string, comparisonCurrency: string) => {
      const direct = resolveCurrencyRate(configuredCurrency, comparisonCurrency, currencyRates);
      const inverted = direct !== undefined ? direct < 1 : comparisonCurrency === 'USD';
      return {
        inverted,
        value:
          direct === undefined
            ? ''
            : String(Number((inverted ? 1 / direct : direct).toPrecision(12))),
      };
    },
    [currencyRates],
  );
  const friendlyRateText = React.useCallback(
    (fromCurrency: string, toCurrency: string) => {
      const direct = rateBetweenCurrencies(fromCurrency, toCurrency);
      if (!direct) return `1 ${fromCurrency} = ? ${toCurrency}`;
      return direct < 1
        ? `1 ${toCurrency} = ${Number((1 / direct).toPrecision(12))} ${fromCurrency}`
        : `1 ${fromCurrency} = ${Number(direct.toPrecision(12))} ${toCurrency}`;
    },
    [rateBetweenCurrencies],
  );
  React.useEffect(() => {
    const display = friendlyRate(configuredRateCurrency, comparisonRateCurrency);
    setCurrencyRateInverted(display.inverted);
    setCurrencyRate(display.value);
    setCurrencyRateError('');
  }, [comparisonRateCurrency, configuredRateCurrency, friendlyRate]);
  const accountBalancesById = React.useMemo(() => {
    const balances = new Map<string, number>();
    state.accounts.forEach((account) => {
      if (!balances.has(account.id)) balances.set(account.id, account.openingBalance);
    });
    state.transactions.forEach((transaction) => {
      if (transaction.status === 'void' || !balances.has(transaction.accountId)) return;
      const current = balances.get(transaction.accountId) as number;
      balances.set(
        transaction.accountId,
        transaction.kind === 'income' || transaction.kind === 'adjustment'
          ? current + transaction.amount
          : current - transaction.amount,
      );
    });
    return balances;
  }, [state.accounts, state.transactions]);
  const accountBalance = React.useCallback(
    (item: Account) => accountBalancesById.get(item.id) ?? 0,
    [accountBalancesById],
  );
  const activityScopedTransactions = React.useMemo(
    () =>
      state.transactions.filter(
        (item) => activityAccountId === 'all' || item.accountId === activityAccountId,
      ),
    [activityAccountId, state.transactions],
  );
  const activityCategories = React.useMemo(() => {
    const configured =
      activityFilter === 'all'
        ? [...state.categories.expense, ...state.categories.income]
        : activityFilter === 'transfer'
          ? []
          : state.categories[activityFilter];
    const used = activityScopedTransactions
      .filter(
        (item) => item.status !== 'void' && transactionMatchesActivityFilter(item, activityFilter),
      )
      .map((item) => item.category);
    return Array.from(new Set([...configured.map((item) => item.id), ...used].filter(Boolean)));
  }, [activityFilter, activityScopedTransactions, state.categories]);
  const accountNames = React.useMemo(
    () => Object.fromEntries(state.accounts.map((item) => [item.id, item.name])),
    [state.accounts],
  );
  const filteredAccountCurrencies = React.useMemo(() => {
    const query = currencyQuery.trim().toUpperCase();
    return query
      ? ACCOUNT_CURRENCIES.filter((currency) => currency.includes(query))
      : ACCOUNT_CURRENCIES;
  }, [currencyQuery]);

  React.useEffect(() => {
    if (activityCategory !== 'all' && !activityCategories.includes(activityCategory))
      setActivityCategory('all');
  }, [activityCategories, activityCategory]);

  React.useEffect(() => {
    if (
      activityAccountId === 'all' ||
      state.accounts.some((account) => account.id === activityAccountId)
    )
      return;
    setActivityAccountId(
      state.settings.activeAccountId &&
        accounts.some((account) => account.id === state.settings.activeAccountId)
        ? state.settings.activeAccountId
        : 'all',
    );
  }, [accounts, activityAccountId, state.accounts, state.settings.activeAccountId]);

  React.useEffect(() => {
    setActivityPage(0);
  }, [activityAccountId, activityCategory, activityFilter, activityPeriod, activityQuery]);

  const openActivityFilters = () => {
    setActivityFilterOpen(true);
  };

  const closeActivityFilters = () => setActivityFilterOpen(false);
  const activityFilterName = (value: ActivityFilter) =>
    value === 'transfer' ? t('finance.toolsList.transfer') : t(`finance.filters.${value}`);
  const activityPeriodName = (value: ActivityPeriod) =>
    value === 'all'
      ? t('finance.filters.all')
      : t(
          `finance.${value === 'today' ? 'today' : value === 'week' ? 'thisWeek' : value === 'month' ? 'thisMonth' : 'yearToDate'}`,
        );

  React.useEffect(() => {
    if (initialModule !== 'accounts' || accounts.length || firstAccountPrompted.current) return;
    firstAccountPrompted.current = true;
    setEditingAccount(null);
    setAccountError('');
    setAccount({
      name: '',
      type: 'cash',
      currency: baseCurrency,
      opening: '',
      exchangeRate: '1',
      color: DEFAULT_COLORS[0],
    });
    setAccountOpen(true);
  }, [accounts.length, baseCurrency, initialModule]);

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountError('');
    setAccount({
      name: '',
      type: 'cash',
      currency: baseCurrency,
      opening: '',
      exchangeRate: '1',
      color: DEFAULT_COLORS[0],
    });
    setAccountOpen(true);
  };
  const openAccountEditor = (item: Account) => {
    setEditingAccount(item);
    setAccountError('');
    const directRate =
      item.currency === baseCurrency
        ? 1
        : (rateBetweenCurrencies(item.currency, baseCurrency) ?? item.exchangeRate);
    setAccount({
      name: item.name,
      type: item.type,
      currency: item.currency,
      opening: String(item.openingBalance),
      exchangeRate: directRate ? String(Number((1 / directRate).toPrecision(12))) : '',
      color: item.color,
    });
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
    if (
      editingAccount &&
      editingAccount.currency !== currency &&
      accountHasHistory(state, editingAccount.id)
    ) {
      setAccountError(t('finance.accountCurrencyLocked'));
      return;
    }
    const displayedRate = Number(account.exchangeRate);
    const exchangeRate = currency === baseCurrency ? 1 : displayedRate > 0 ? 1 / displayedRate : 0;
    if (
      currency !== baseCurrency &&
      (!Number.isFinite(displayedRate) || displayedRate <= 0 || !Number.isFinite(exchangeRate))
    ) {
      setAccountError(
        t('finance.exchangeRateRequired', {
          defaultValue: `Enter the exchange rate from ${currency} to ${baseCurrency}.`,
        }),
      );
      return;
    }
    const values = {
      name: account.name.trim(),
      type: account.type,
      currency,
      exchangeRate,
      openingBalance: Number(account.opening) || 0,
      color: account.color,
      archived: false,
    };
    const savedAccount = editingAccount
      ? { ...editingAccount, ...values }
      : { id: uid('account'), ...values };
    const baseUsdRate = currencyRates[baseCurrency] ?? (baseCurrency === 'USD' ? 1 : undefined);
    const currencyUsdRate =
      currency === 'USD' ? 1 : baseUsdRate ? exchangeRate * baseUsdRate : undefined;
    finance.updateState((current) => ({
      ...current,
      accounts: editingAccount
        ? current.accounts.map((item) => (item.id === savedAccount.id ? savedAccount : item))
        : [...current.accounts, savedAccount],
      settings: {
        ...current.settings,
        activeAccountId: current.settings.activeAccountId ?? savedAccount.id,
        ...(currencyUsdRate
          ? {
              exchangeRates: {
                ...(current.settings.exchangeRates ?? {}),
                USD: 1,
                [currency]: currencyUsdRate,
              },
            }
          : {}),
      },
    }));
    closeAccountEditor();
  };
  const choosePrimaryCurrency = (currency: string) => {
    setCurrencyBaseDraft(currency);
    setCurrencyRateCurrency(currency);
    setCurrencyRateError('');
  };
  const chooseRateCurrency = (currency: string) => {
    setCurrencyRateCurrency(currency);
    setCurrencyRateError('');
  };
  const saveCurrencyRate = () => {
    const value = Number(currencyRate);
    if (!Number.isFinite(value) || value <= 0) {
      setCurrencyRateError(
        t('finance.exchangeRateRequired', { defaultValue: `Enter a valid exchange rate.` }),
      );
      return;
    }
    const knownUsdRate =
      comparisonRateCurrency === 'USD'
        ? 1
        : Number(state.settings.exchangeRates?.[comparisonRateCurrency]);
    const configuredToComparison = currencyRateInverted ? 1 / value : value;
    const nextReferenceRate = configuredToComparison * knownUsdRate;
    if (
      !Number.isFinite(knownUsdRate) ||
      knownUsdRate <= 0 ||
      !Number.isFinite(nextReferenceRate) ||
      nextReferenceRate <= 0
    ) {
      setCurrencyRateError(
        t('finance.exchangeRateRequired', {
          defaultValue: `Configure the base currency rate first.`,
        }),
      );
      return;
    }
    finance.updateState((current) => {
      const exchangeRates = {
        ...(current.settings.exchangeRates ?? {}),
        USD: 1,
        [configuredRateCurrency]: configuredRateCurrency === 'USD' ? 1 : nextReferenceRate,
      };
      return {
        ...current,
        transactions: current.transactions.map((transaction) =>
          Number.isFinite(transaction.baseAmount) && transaction.baseCurrency
            ? transaction
            : {
                ...transaction,
                ...captureCurrencySnapshot(
                  transaction.amount,
                  transaction.currency,
                  currencyBaseDraft,
                  exchangeRates,
                ),
              },
        ),
        settings: { ...current.settings, preferredCurrency: currencyBaseDraft, exchangeRates },
      };
    });
    setCurrencyRateError('');
  };
  const addRecurring = () => {
    const selected =
      operationalAccounts.find((item) => item.id === recurring.accountId) ?? operationalAccounts[0];
    const amount = Number(recurring.amount);
    if (!selected || !Number.isFinite(amount) || amount <= 0) return;
    const existing = state.recurring.find((entry) => entry.id === editingRecurringId);
    const item: RecurringTransaction = {
      id: existing?.id ?? uid('recurring'),
      accountId: selected.id,
      kind: recurring.kind,
      amount,
      currency: selected.currency,
      payee: recurring.payee,
      category: recurring.category,
      paymentMethod:
        existing?.paymentMethod ??
        (selected.type === 'cash' || selected.type === 'card' || selected.type === 'bank'
          ? selected.type
          : 'other'),
      frequency: recurring.frequency,
      nextDate: recurring.nextDate,
      dayOfMonth: new Date(recurring.nextDate).getDate(),
      description: recurring.description || recurring.payee,
      active: existing?.active ?? true,
      lastGeneratedDate: existing?.lastGeneratedDate,
    };
    if (existing) finance.updateRecurring(item);
    else finance.addRecurring(item);
    setEditingRecurringId(null);
    setRecurringOpen(false);
  };
  const addDebt = () => {
    const amount = Number(debt.amount);
    const interest = Number(debt.interest);
    if (
      !debt.name.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(interest) ||
      interest < 0
    )
      return;
    finance.addDebt({
      id: uid('debt'),
      name: debt.name.trim(),
      creditor: debt.creditor.trim(),
      currency: debt.currency.toUpperCase(),
      originalAmount: amount,
      balance: amount,
      interestRate: interest,
      dueDate: debt.dueDate,
      payments: [],
      active: true,
    });
    setDebt({
      name: '',
      creditor: '',
      currency: baseCurrency,
      amount: '',
      dueDate: new Date().toISOString(),
      interest: '0',
    });
    setDebtOpen(false);
  };
  const addSavings = () => {
    const destination = accounts.find((item) => item.id === savings.accountId);
    const target = Number(savings.target);
    if (
      !destination ||
      destination.type === 'debt' ||
      !savings.name.trim() ||
      !Number.isFinite(target) ||
      target <= 0
    )
      return;
    finance.addSavingsGoal({
      id: uid('goal'),
      name: savings.name.trim(),
      accountId: destination.id,
      currency: destination.currency,
      targetAmount: target,
      balance: 0,
      deadline: savings.deadline,
      contributions: [],
      active: true,
    });
    setSavings({
      name: '',
      currency: baseCurrency,
      accountId: destination.id,
      target: '',
      deadline: new Date().toISOString(),
    });
    setSavingsOpen(false);
  };
  const addReminder = () => {
    if (!reminder.title.trim()) return;
    const existing = state.reminders.find((entry) => entry.id === editingReminderId);
    const value = {
      id: existing?.id ?? uid('reminder'),
      title: reminder.title.trim(),
      date: reminder.date,
      note: reminder.note,
      completed: existing?.completed ?? false,
      linkedAccountId: existing?.linkedAccountId,
      linkedTransactionId: existing?.linkedTransactionId,
    };
    if (existing) finance.updateReminder(value);
    else finance.addReminder(value);
    setEditingReminderId(null);
    setReminderOpen(false);
  };
  const confirmDelete = (
    title: string,
    action: () => void,
    message = t('finance.modules.cannotUndo'),
  ) =>
    setConfirmPrompt({
      title,
      message,
      confirmLabel: t('finance.deleteAction'),
      onConfirm: action,
      icon: 'trash-outline',
    });
  const confirmArchive = (item: Account) =>
    Alert.alert(t('finance.release.archiveAccount'), t('finance.releaseArchive.archiveCopy'), [
      { text: t('finance.cancel'), style: 'cancel' },
      {
        text: t('finance.release.archiveAccount'),
        onPress: () => {
          finance.archiveAccount(item.id);
          closeAccountEditor();
        },
      },
    ]);
  const registerDebtPayment = () => {
    if (!debtPaymentTarget) return;
    const sourceAccount = operationalAccounts.find((item) => item.id === debtPaymentAccountId);
    const amount = Number(debtPaymentAmount);
    if (!sourceAccount || !Number.isFinite(amount) || amount <= 0) return;
    if (amount > debtPaymentTarget.balance) {
      setLinkedActionError(t('finance.paymentExceedsDebt'));
      return;
    }
    const applied = amount;
    const conversionRate = rateBetweenCurrencies(
      debtPaymentTarget.currency,
      sourceAccount.currency,
    );
    if (!conversionRate) {
      setLinkedActionError(t('finance.releaseErrors.missingRate'));
      return;
    }
    const accountAmount = applied * conversionRate;
    const commit = () => {
      const transactionId = uid('debt-payment');
      const date = new Date().toISOString();
      const paymentId = uid('payment');
      finance.updateState((current) =>
        recordDebtPayment(current, {
          debtId: debtPaymentTarget.id,
          accountId: sourceAccount.id,
          amount: applied,
          accountAmount,
          date,
          transactionId,
          paymentId,
        }),
      );
      setDebtPaymentTarget(null);
      setDebtPaymentAmount('');
      setLinkedActionError('');
    };
    if (accountBalance(sourceAccount) - accountAmount < 0) {
      Alert.alert(t('finance.negativeBalance.title'), t('finance.negativeBalance.body'), [
        { text: t('finance.cancel'), style: 'cancel' },
        { text: t('finance.negativeBalance.confirm'), onPress: commit },
      ]);
    } else commit();
  };
  const registerSavingsContribution = () => {
    if (!savingsTarget) return;
    const source = operationalAccounts.find((item) => item.id === savingsSourceAccountId);
    const destination = operationalAccounts.find(
      (item) => item.id === (savingsTarget.accountId ?? savingsDestinationAccountId),
    );
    const amount = Number(savingsAmount);
    if (
      !source ||
      !destination ||
      source.id === destination.id ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return;
    if (amount > savingsTarget.targetAmount - savingsTarget.balance) {
      setLinkedActionError(t('finance.contributionExceedsGoal'));
      return;
    }
    const conversionRate = rateBetweenCurrencies(destination.currency, source.currency);
    if (!conversionRate) {
      setLinkedActionError(t('finance.releaseErrors.missingRate'));
      return;
    }
    const fromAmount = amount * conversionRate;
    const commit = () => {
      const transferId = uid('savings-transfer');
      const contributionId = uid('contribution');
      const date = new Date().toISOString();
      finance.updateState((current) =>
        recordSavingsContribution(current, {
          goalId: savingsTarget.id,
          sourceAccountId: source.id,
          destinationAccountId: destination.id,
          amount,
          sourceAmount: fromAmount,
          date,
          transferId,
          contributionId,
        }),
      );
      setSavingsTarget(null);
      setSavingsAmount('');
      setLinkedActionError('');
    };
    if (accountBalance(source) - fromAmount < 0)
      Alert.alert(t('finance.negativeBalance.title'), t('finance.negativeBalance.body'), [
        { text: t('finance.cancel'), style: 'cancel' },
        { text: t('finance.negativeBalance.confirm'), onPress: commit },
      ]);
    else commit();
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
    const existing = state.budgets.find(
      (item) =>
        item.accountId === accountId &&
        item.category === category &&
        item.period === budgetDraft.period,
    );
    const nextBudget: Budget = {
      id: existing?.id ?? uid('budget'),
      accountId,
      category,
      period: budgetDraft.period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit,
      rollover: false,
      rolloverAmount: 0,
    };
    if (existing) finance.updateBudget(nextBudget);
    else finance.addBudget(nextBudget);
    setBudgetOpen(false);
    setBudgetDraft({ accountId, category: 'other', limit: '', period: 'monthly', rollover: false });
  };
  const addCategory = () => {
    const name = categoryName.trim();
    const id = name
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!id) return;
    if (categoryType === 'store') {
      if (
        state.store.categories.some(
          (item) => item.id === id || item.name?.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      ) {
        setCategoryError(t('finance.categoryExists'));
        return;
      }
      finance.updateState((current) => ({
        ...current,
        store: {
          ...current.store,
          categories: [...current.store.categories, { id, name, icon: 'pricetag-outline' }],
        },
      }));
      setCategoryName('');
      setCategoryError('');
      setCategoryCreateOpen(false);
      return;
    }
    if (
      state.categories[categoryType].some(
        (item) => item.id === id || item.name?.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      setCategoryError(t('finance.categoryExists'));
      return;
    }
    const category: FinanceCategory = { id, icon: categoryIcon, name, builtIn: false };
    finance.updateCategories({
      ...state.categories,
      [categoryType]: [...state.categories[categoryType], category],
    });
    setCategoryName('');
    setCategoryIcon('pricetag-outline');
    setCategoryError('');
    setCategoryCreateOpen(false);
  };
  const removeCategory = (type: 'expense' | 'income' | 'store', categoryId: string) => {
    if (type === 'store') {
      const category = state.store.categories.find((item) => item.id === categoryId);
      if (!category || category.builtIn || categoryId === 'general') return;
      confirmDelete(t('finance.store.deleteCategory'), () =>
        finance.updateState((current) => ({
          ...current,
          store: {
            ...current.store,
            categories: current.store.categories.filter((item) => item.id !== categoryId),
            products: current.store.products.map((item) =>
              item.categoryId === categoryId ? { ...item, categoryId: 'general' } : item,
            ),
          },
        })),
      );
      return;
    }
    const category = state.categories[type].find((item) => item.id === categoryId);
    if (!category || category.builtIn) return;
    confirmDelete(
      t('finance.deleteCategory'),
      () => finance.updateState((current) => removeFinanceCategory(current, type, categoryId)),
      t('finance.deleteCategoryImpact', { other: t('finance.categories.other') }),
    );
  };
  const changeLanguage = (value: string) => {
    const language = value as AppLanguage;
    finance.updateState((current) => ({ ...current, settings: { ...current.settings, language } }));
    void translationI18n.changeLanguage(language);
  };
  const savePin = () => {
    if (!/^\d{4}$/.test(pinDraft)) {
      setPinError(t('finance.pinInvalid4'));
      return;
    }
    if (pinDraft !== pinConfirmation) {
      setPinError(t('finance.pin.mismatch'));
      return;
    }
    finance.updateState((current) => ({
      ...current,
      settings: { ...current.settings, pinHash: hashPin(pinDraft) },
    }));
    setPinDraft('');
    setPinConfirmation('');
    setPinError('');
  };
  const removePin = () => {
    finance.updateState((current) => ({
      ...current,
      settings: { ...current.settings, pinHash: undefined },
    }));
    setPinDraft('');
    setPinConfirmation('');
    setPinError('');
  };
  const csvErrorText = React.useCallback(
    (error: string) => {
      if (error === 'header') return t('finance.releaseImport.csvHeaderError');
      const duplicates = /^duplicates:(\d+)$/.exec(error);
      if (duplicates) return t('finance.releaseImport.csvDuplicates', { count: duplicates[1] });
      const invalid = /^row:(\d+):invalid$/.exec(error);
      if (invalid) return t('finance.formUx.csvInvalidRow', { row: invalid[1] });
      const match = /^row:(\d+):amount$/.exec(error);
      return match
        ? t('finance.releaseImport.csvAmountError', { row: match[1] })
        : t('finance.releaseImport.csvUnknownError');
    },
    [t],
  );
  const share = async (format: 'json' | 'csv' | 'zip') => {
    if (fileOperationInFlight.current || pendingFinanceImport) return;
    fileOperationInFlight.current = true;
    try {
      const fileName = `solid-gold-rich-${new Date().toISOString().slice(0, 10)}.${format}`;
      const mimeType =
        format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/zip';
      const uri =
        format === 'zip'
          ? await fileService.writeBase64(fileName, await backupRepository.createAppArchive(state))
          : await fileService.writeText(
              fileName,
              format === 'json'
                ? JSON.stringify(await backupRepository.createAppJson(state), null, 2)
                : backupRepository.createCsv(state),
            );
      await fileService.share(uri, mimeType, t('finance.releaseExtra.dataBackups'));
    } catch {
      Alert.alert(
        t('finance.releaseImport.exportFailed'),
        t('finance.releaseImport.exportFailedCopy'),
      );
    } finally {
      fileOperationInFlight.current = false;
    }
  };
  const pickImportFile = async () => {
    if (fileOperationInFlight.current || pendingFinanceImport) return;
    fileOperationInFlight.current = true;
    setImportBusy(true);
    try {
      const result = await fileService.pick([
        'application/json',
        'text/csv',
        'application/zip',
        'application/x-zip-compressed',
        'text/plain',
      ]);
      if (!result) return;
      await waitForImportLoading(result.size);
      const fileUri = result.uri;
      const fileName = result.name.toLocaleLowerCase();
      if (fileName.endsWith('.zip')) {
        setPendingFinanceImport({
          kind: 'app',
          backup: backupRepository.parseAppArchive(await fileService.readBase64(fileUri)),
        });
        return;
      }
      const content = await fileService.readText(fileUri);
      if (result.name.toLocaleLowerCase().endsWith('.json') || content.trim().startsWith('{')) {
        try {
          setPendingFinanceImport({ kind: 'app', backup: backupRepository.parseAppJson(content) });
        } catch {
          const parsed = JSON.parse(content) as {
            accounts?: unknown;
            transactions?: unknown;
            store?: { products?: unknown; sales?: unknown };
          };
          if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions))
            throw new Error('invalid-backup');
          const includesStore = Boolean(
            parsed.store &&
            Array.isArray(parsed.store.products) &&
            Array.isArray(parsed.store.sales),
          );
          setPendingFinanceImport({ kind: includesStore ? 'full-json' : 'finance', json: content });
        }
      } else if (accounts[0]) {
        const errors = finance.importCsvText(
          content,
          accounts.find((account) => account.id === state.settings.activeAccountId)?.id ??
            accounts[0].id,
        );
        if (errors.length)
          Alert.alert(t('finance.releaseImport.csvWarnings'), errors.map(csvErrorText).join('\n'));
      } else throw new Error('invalid-backup');
    } catch {
      Alert.alert(
        t('finance.releaseImport.importFailed'),
        t('finance.releaseImport.invalidBackup'),
      );
    } finally {
      fileOperationInFlight.current = false;
      setImportBusy(false);
    }
  };

  const confirmFinanceImport = async () => {
    const pending = pendingFinanceImport;
    if (!pending || fileOperationInFlight.current) return;
    fileOperationInFlight.current = true;
    setPendingFinanceImport(null);
    setImportBusy(true);
    try {
      await waitForImportLoading();
      if (pending.kind === 'app') {
        const restored = await backupRepository.restoreApp(pending.backup);
        if (!finance.importJson(JSON.stringify(restored))) throw new Error('invalid-backup');
      } else if (!finance.importJson(pending.json, { preserveStore: pending.kind === 'finance' }))
        throw new Error('invalid-backup');
      Alert.alert(
        t('finance.releaseImport.importComplete'),
        t('finance.releaseImport.importCompleteCopy'),
      );
    } catch {
      Alert.alert(
        t('finance.releaseImport.importFailed'),
        t('finance.releaseImport.invalidBackup'),
      );
    } finally {
      fileOperationInFlight.current = false;
      setImportBusy(false);
    }
  };

  const toolNumber = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const toolMoney = (value: number, currency = '') =>
    Number.isFinite(value)
      ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`
      : '—';
  const evaluateCalculator = (value: string) => {
    try {
      if (!value.trim()) return '';
      const expression = value
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/[^0-9+\-*/(). ]/g, '');
      const result = Function(`"use strict"; return (${expression})`)();
      return typeof result === 'number' && Number.isFinite(result) ? String(result) : '—';
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

  const sortedReminders = React.useMemo(
    () =>
      state.reminders
        .slice()
        .sort(
          (left, right) =>
            Number(left.completed) - Number(right.completed) ||
            new Date(left.date).getTime() - new Date(right.date).getTime(),
        ),
    [state.reminders],
  );
  const sortedStoreCategories = React.useMemo(
    () =>
      [...state.store.categories].sort(
        (left, right) =>
          Number(Boolean(left.builtIn)) - Number(Boolean(right.builtIn)) ||
          left.name.localeCompare(right.name),
      ),
    [state.store.categories],
  );
  const categoryTabs = React.useMemo(
    () => [
      { key: 'expense' as const, label: t('finance.expenses') },
      { key: 'income' as const, label: t('finance.income') },
      { key: 'store' as const, label: t('finance.workspace.store') },
    ],
    [t],
  );
  const visibleBudgets = React.useMemo(
    () => state.budgets.filter((item) => item.limit > 0),
    [state.budgets],
  );
  const moduleReferenceNow = useCurrentDate();
  const accountsById = React.useMemo(
    () => new Map(state.accounts.map((item) => [item.id, item])),
    [state.accounts],
  );
  const budgetSummaries = React.useMemo(
    () =>
      visibleBudgets.map((item) => {
        const account = accountsById.get(item.accountId);
        const budgetCurrency = account?.currency ?? baseCurrency;
        const bounds = periodBounds(
          item.period === 'weekly' ? 'week' : 'month',
          moduleReferenceNow,
          state.settings.firstDayOfWeek,
        );
        const spent = budgetSpent(
          item,
          state.transactions,
          budgetCurrency,
          bounds,
          rateBetweenCurrencies,
        );
        const category = state.categories.expense.find((entry) => entry.id === item.category);
        return {
          item,
          accountName: account?.name ?? t('finance.modules.unknownAccount'),
          budgetCurrency,
          spent,
          percentage: Math.min(100, (spent / Math.max(1, item.limit)) * 100),
          categoryLabel:
            item.category === 'all'
              ? t('finance.filters.all')
              : (category?.name ??
                t(`finance.categories.${item.category}`, { defaultValue: item.category })),
        };
      }),
    [
      accountsById,
      baseCurrency,
      moduleReferenceNow,
      rateBetweenCurrencies,
      state.categories.expense,
      state.settings.firstDayOfWeek,
      state.transactions,
      t,
      visibleBudgets,
    ],
  );
  const titles = React.useMemo(
    () =>
      Object.fromEntries(
        (
          [
            'accounts',
            'debt',
            'notes',
            'tools',
            'savings',
            'budget',
            'activity',
            'recurring',
            'categories',
            'settings',
          ] as FinanceModuleName[]
        ).map((item) => [item, t(`finance.navigation.items.${item}.title`)]),
      ) as Record<FinanceModuleName, string>,
    [t],
  );

  const renderActivity = () => {
    const categoryLabels = Object.fromEntries(
      activityCategories.map((category) => {
        const configured = [...state.categories.expense, ...state.categories.income].find(
          (item) => item.id === category,
        );
        return [
          category,
          configured?.name ?? t(`finance.categories.${category}`, { defaultValue: category }),
        ];
      }),
    );
    const selectedActivityAccount = state.accounts.find(
      (account) => account.id === activityAccountId,
    );
    const activityCurrency = selectedActivityAccount?.currency ?? baseCurrency;
    const availableTransactions = activityScopedTransactions.filter(
      (item) => item.status !== 'void',
    );
    const activityBounds =
      activityPeriod === 'all'
        ? undefined
        : periodBounds(activityPeriod, moduleReferenceNow, state.settings.firstDayOfWeek);
    const filteredItems = filterActivityTransactions(activityScopedTransactions, {
      filter: activityFilter,
      category: activityCategory,
      query: activityQuery,
      categoryLabels,
      accountNames,
    })
      .filter((item) => !activityBounds || inDateRange(item.date, activityBounds))
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const pageSize = 50;
    const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const currentPage = Math.min(activityPage, pageCount - 1);
    const pageStart = currentPage * pageSize;
    const items = filteredItems.slice(pageStart, pageStart + pageSize);
    const today = moduleReferenceNow;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayKey = localDayKey(today);
    const yesterdayKey = localDayKey(yesterday);
    const grouped = new Map<string, Transaction[]>();
    items.forEach((item) => {
      const key = localDayKey(item.date);
      const transactions = grouped.get(key);
      if (transactions) transactions.push(item);
      else grouped.set(key, [item]);
    });
    const groups: ActivityGroup[] = Array.from(grouped.entries()).map(([key, transactions]) => ({
      key,
      transactions,
      label:
        key === todayKey
          ? t('finance.activity.today')
          : key === yesterdayKey
            ? t('finance.activity.yesterday')
            : new Date(transactions[0].date).toLocaleDateString(translationI18n.resolvedLanguage, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year:
                  new Date(transactions[0].date).getFullYear() === today.getFullYear()
                    ? undefined
                    : 'numeric',
              }),
    }));
    const filterCount = Number(activityFilter !== 'all') + Number(activityCategory !== 'all');
    const activityDisplayAmount = (item: Transaction) =>
      historicalAmountInCurrency(item, activityCurrency, currencyRates);
    const activityTotals = filteredItems.reduce(
      (totals, item) => {
        if (!isCashFlowTransaction(item)) return totals;
        const amount = activityDisplayAmount(item);
        if (amount === undefined || !Number.isFinite(amount)) {
          totals.incomplete = true;
          return totals;
        }
        if (item.kind === 'income') totals.income += amount;
        else totals.expenses += amount;
        return totals;
      },
      { income: 0, expenses: 0, incomplete: false },
    );
    const resetActivityFilters = () => {
      setActivityFilter('all');
      setActivityCategory('all');
      setActivityQuery('');
      setActivityPeriod('all');
    };
    const detailFilterLabel = [
      activityFilter !== 'all' ? activityFilterName(activityFilter) : '',
      activityCategory !== 'all' ? categoryLabels[activityCategory] : '',
    ]
      .filter(Boolean)
      .join(' / ');
    const changePage = (nextPage: number) => {
      setActivityPage(Math.max(0, Math.min(pageCount - 1, nextPage)));
      requestAnimationFrame(() =>
        activityListRef.current?.scrollToLocation({
          sectionIndex: 0,
          itemIndex: 0,
          viewOffset: 0,
          animated: true,
        }),
      );
    };
    return (
      <View style={styles.activityView}>
        <View style={styles.activityToolbar}>
          <View style={styles.activitySearch}>
            <Ionicons name="search-outline" size={18} color={C.textSubtle} />
            <TextInput
              value={activityQuery}
              onChangeText={setActivityQuery}
              placeholder={t('finance.modules.searchActivity')}
              placeholderTextColor={C.textSubtle}
              style={styles.activitySearchInput}
              accessibilityLabel={t('finance.modules.searchActivity')}
              returnKeyType="search"
              autoCorrect={false}
            />
            {activityQuery ? (
              <Pressable
                style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setActivityQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('finance.activityUx.clearSearch')}
              >
                <Ionicons name="close-circle" size={18} color={C.textSubtle} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            style={[
              styles.activityFilterButton,
              filterCount > 0 && styles.activityFilterButtonActive,
            ]}
            onPress={openActivityFilters}
            accessibilityRole="button"
            accessibilityLabel={t('finance.activity.filterA11y', { count: filterCount })}
          >
            <Ionicons
              name="options-outline"
              size={19}
              color={filterCount > 0 ? C.void : C.goldLight}
            />
            {filterCount > 0 && (
              <View style={styles.activityFilterBadge}>
                <Text style={styles.activityFilterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={styles.activityAccountBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activityAccountTabs}
          >
            {state.accounts.map((account) => (
              <Pressable
                key={account.id}
                style={[
                  styles.activityAccountTab,
                  activityAccountId === account.id && styles.activityAccountTabActive,
                ]}
                onPress={() => {
                  setActivityAccountId(account.id);
                  setActivityCategory('all');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activityAccountId === account.id }}
                accessibilityLabel={`${account.name}${account.archived ? ` / ${t('finance.activityUx.archived')}` : ''}`}
              >
                <Ionicons
                  name={account.archived ? 'archive-outline' : 'wallet-outline'}
                  size={15}
                  color={activityAccountId === account.id ? C.gold : C.textSubtle}
                />
                <Text
                  style={[
                    styles.activityAccountText,
                    activityAccountId === account.id && styles.activityAccountTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {account.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[
                styles.activityAccountTab,
                activityAccountId === 'all' && styles.activityAccountTabActive,
              ]}
              onPress={() => {
                setActivityAccountId('all');
                setActivityCategory('all');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activityAccountId === 'all' }}
            >
              <Ionicons
                name="layers-outline"
                size={15}
                color={activityAccountId === 'all' ? C.goldLight : C.textSubtle}
              />
              <Text
                style={[
                  styles.activityAccountText,
                  activityAccountId === 'all' && styles.activityAccountTextActive,
                ]}
              >
                {t('finance.filters.all')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
        <View style={styles.activityScopeSummary}>
          <Pressable
            style={styles.activityPeriodTrigger}
            onPress={() => setActivityPeriodOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('finance.date')}: ${activityPeriodName(activityPeriod)}`}
          >
            <Ionicons name="calendar-outline" size={15} color={C.gold} />
            <Text style={styles.activityScopeText} numberOfLines={1}>
              {activityPeriodName(activityPeriod)}
            </Text>
            <Ionicons name="chevron-down" size={13} color={C.textSubtle} />
          </Pressable>
          {detailFilterLabel ? (
            <Pressable
              style={styles.activityActiveFilters}
              onPress={openActivityFilters}
              accessibilityRole="button"
            >
              <Text style={styles.activityActiveFilterText} numberOfLines={1}>
                {detailFilterLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <SectionList
          ref={activityListRef}
          style={styles.activityList}
          sections={groups.map((group) => ({ title: group.label, data: group.transactions }))}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.activityListContent}
          ListHeaderComponent={
            <View style={styles.activityListHeader}>
              <View
                style={styles.activitySummaryStrip}
                accessible
                accessibilityHint={t('finance.activityUx.totalsHint')}
              >
                <View style={styles.activitySummaryMetric}>
                  <Text style={styles.activitySummaryLabel}>{t('finance.income')}</Text>
                  <Text
                    style={styles.activitySummaryIncome}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {activityTotals.incomplete
                      ? '\u2014'
                      : `+${money(activityTotals.income, activityCurrency)}`}
                  </Text>
                </View>
                <View style={styles.activitySummaryDivider} />
                <View style={styles.activitySummaryMetric}>
                  <Text style={styles.activitySummaryLabel}>{t('finance.expenses')}</Text>
                  <Text
                    style={styles.activitySummaryExpense}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {activityTotals.incomplete
                      ? '\u2014'
                      : `-${money(activityTotals.expenses, activityCurrency)}`}
                  </Text>
                </View>
                <View style={styles.activitySummaryDivider} />
                <View style={styles.activitySummaryMetric}>
                  <Text style={styles.activitySummaryLabel}>{t('finance.cashFlow')}</Text>
                  <Text
                    style={[
                      styles.activitySummaryNet,
                      activityTotals.income < activityTotals.expenses && { color: C.red },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {activityTotals.incomplete
                      ? '\u2014'
                      : money(activityTotals.income - activityTotals.expenses, activityCurrency)}
                  </Text>
                </View>
              </View>
              {activityTotals.incomplete ? (
                <Text style={styles.activityNotice} accessibilityLiveRegion="polite">
                  {t('finance.activityUx.totalsUnavailable')}
                </Text>
              ) : null}
              <View style={styles.activityResultsHeader}>
                <Text style={styles.activityHistoryTitle}>{t('finance.operations')}</Text>
                <Text style={styles.activityResultsLabel}>{filteredItems.length}</Text>
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.activityGroupTitle}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const category = state.categories[item.kind === 'income' ? 'income' : 'expense'].find(
              (entry) => entry.id === item.category,
            );
            const icon: IconName = isTransferTransaction(item)
              ? 'swap-horizontal-outline'
              : ((category?.icon as IconName) ??
                (item.kind === 'income' ? 'cash-outline' : 'pricetag-outline'));
            const categoryLabel = isTransferTransaction(item)
              ? t('finance.toolsList.transfer')
              : (category?.name ??
                categoryLabels[item.category] ??
                t(`finance.categories.${item.category}`, { defaultValue: item.category }));
            const accountName = accountNames[item.accountId];
            const positive =
              item.kind === 'income' || (item.kind === 'adjustment' && item.amount >= 0);
            return (
              <View style={styles.activityRow}>
                <View style={[styles.activityIcon, positive && styles.activityIncomeIcon]}>
                  <Ionicons name={icon} size={18} color={positive ? C.goldLight : C.gold} />
                </View>
                <View style={styles.activityRowMain}>
                  <Text style={styles.activityRowTitle} numberOfLines={2}>
                    {item.payee || item.description || categoryLabel}
                  </Text>
                  <Text style={styles.activityRowMeta} numberOfLines={1}>
                    {[categoryLabel, activityAccountId === 'all' ? accountName : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.activityRowAmount}>
                  <Text
                    style={[styles.activityAmountText, !positive && { color: C.red }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.62}
                  >
                    {positive ? '+' : '-'}
                    {money(Math.abs(item.amount), item.currency)}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(item.date).toLocaleTimeString(translationI18n.resolvedLanguage, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            !availableTransactions.length ? (
              <View
                style={[
                  styles.activityEmptyState,
                  { minHeight: Math.min(420, Math.max(270, windowHeight * 0.36)) },
                ]}
              >
                <Empty
                  title={t('finance.activity.emptyTitle')}
                  body={t('finance.activity.emptyBody')}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.activityEmptyState,
                  { minHeight: Math.min(420, Math.max(270, windowHeight * 0.36)) },
                ]}
              >
                <Empty
                  title={t('finance.modules.noResults')}
                  body={t('finance.modules.noResultsCopy')}
                />
                <Pressable
                  style={[styles.activityClearFilters, styles.activityEmptyReset]}
                  onPress={resetActivityFilters}
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh-outline" size={16} color={C.gold} />
                  <Text style={styles.activityClearFiltersText}>
                    {t('finance.activity.clearFilters')}
                  </Text>
                </Pressable>
              </View>
            )
          }
          ListFooterComponent={
            filteredItems.length > pageSize ? (
              <View style={styles.activityPagination}>
                <Text style={styles.activityPaginationRange}>
                  {t('finance.activityPagination.showing', {
                    from: pageStart + 1,
                    to: Math.min(pageStart + pageSize, filteredItems.length),
                    total: filteredItems.length,
                  })}
                </Text>
                <View style={styles.activityPaginationControls}>
                  <Pressable
                    style={[styles.activityPageButton, currentPage === 0 && styles.buttonDisabled]}
                    disabled={currentPage === 0}
                    onPress={() => changePage(currentPage - 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('finance.activityPagination.previous')}
                  >
                    <Ionicons name="chevron-back" size={18} color={C.gold} />
                  </Pressable>
                  <Text style={styles.activityPageLabel}>
                    {t('finance.activityPagination.page', {
                      page: currentPage + 1,
                      pages: pageCount,
                    })}
                  </Text>
                  <Pressable
                    style={[
                      styles.activityPageButton,
                      currentPage >= pageCount - 1 && styles.buttonDisabled,
                    ]}
                    disabled={currentPage >= pageCount - 1}
                    onPress={() => changePage(currentPage + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('finance.activityPagination.next')}
                  >
                    <Ionicons name="chevron-forward" size={18} color={C.gold} />
                  </Pressable>
                </View>
              </View>
            ) : null
          }
        />
      </View>
    );
  };
  const renderAccounts = () => (
    <View style={styles.panel}>
      {accounts.map((item) => {
        const balance = accountBalance(item);
        const equivalentRate =
          item.currency === baseCurrency
            ? undefined
            : rateBetweenCurrencies(item.currency, baseCurrency);
        return (
          <Pressable key={item.id} style={styles.row} onPress={() => openAccountEditor(item)}>
            <View style={[styles.accountStripe, { backgroundColor: item.color }]} />
            <View style={styles.rowMain}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {t(`finance.accountTypes.${item.type}`)} · {item.currency}
                {item.currency !== baseCurrency
                  ? ` · ${friendlyRateText(item.currency, baseCurrency)}`
                  : ''}
              </Text>
            </View>
            <View style={styles.accountAmount}>
              <Text
                style={styles.positive}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
              >
                {money(balance, item.currency)}
              </Text>
              {equivalentRate && (
                <Text style={styles.cardMeta} numberOfLines={1}>
                  ≈ {money(balance * equivalentRate, baseCurrency)}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward-outline" size={17} color="rgba(255,244,208,0.35)" />
          </Pressable>
        );
      })}
      {!accounts.length && (
        <Empty title={t('finance.release.noAccounts')} body={t('finance.release.noAccountsCopy')} />
      )}
      <AddAction label={t('finance.release.addAccount')} onPress={openNewAccount} />
      {state.accounts.some((item) => item.archived) && (
        <View style={styles.module}>
          <Text style={styles.fieldLabel}>{t('finance.release.archivedAccounts')}</Text>
          {state.accounts
            .filter((item) => item.archived)
            .map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>{item.currency}</Text>
                </View>
                <Pressable
                  style={styles.inlineButton}
                  onPress={() => finance.restoreAccount(item.id)}
                >
                  <Text style={styles.inlineButtonText}>{t('finance.release.restore')}</Text>
                </Pressable>
              </View>
            ))}
        </View>
      )}
    </View>
  );
  const renderRecurring = () => (
    <View style={styles.panel}>
      <Choice
        values={['recurring', 'dates']}
        value={recurringTab}
        onChange={(value) => setRecurringTab(value as 'recurring' | 'dates')}
        labels={{
          recurring: t('finance.release.recurringTab'),
          dates: t('finance.release.datesTab'),
        }}
      />
      {recurringTab === 'recurring' ? (
        <>
          {state.recurring.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.cardTitle}>
                  {item.payee || item.description || item.category}
                </Text>
                <Text style={styles.cardMeta}>
                  {t(`finance.releaseFrequency.${item.frequency}`)} · {dateText(item.nextDate)} ·{' '}
                  {money(item.amount, item.currency)}
                </Text>
              </View>
              <Pressable
                style={styles.smallAction}
                onPress={() => {
                  setEditingRecurringId(item.id);
                  setRecurring({
                    accountId: item.accountId,
                    kind: item.kind,
                    amount: String(item.amount),
                    payee: item.payee,
                    category: item.category,
                    frequency: item.frequency,
                    nextDate: item.nextDate,
                    description: item.description,
                  });
                  setRecurringOpen(true);
                }}
                accessibilityLabel={t('finance.editAction')}
              >
                <Ionicons name="pencil-outline" size={17} color={C.gold} />
              </Pressable>
              <Pressable
                style={styles.smallAction}
                onPress={() => finance.updateRecurring({ ...item, active: !item.active })}
                accessibilityLabel={
                  item.active ? t('finance.release.pause') : t('finance.release.resume')
                }
              >
                <Ionicons
                  name={item.active ? 'pause-outline' : 'play-outline'}
                  size={17}
                  color={item.active ? C.gold : C.goldLight}
                />
              </Pressable>
              <Pressable
                style={styles.smallAction}
                onPress={() =>
                  confirmDelete(t('finance.modules.deleteRecurring'), () =>
                    finance.updateState((current) => ({
                      ...current,
                      recurring: current.recurring.filter((entry) => entry.id !== item.id),
                    })),
                  )
                }
                accessibilityLabel={t('finance.deleteAction')}
              >
                <Ionicons name="trash-outline" size={17} color={C.red} />
              </Pressable>
            </View>
          ))}
          {!state.recurring.length && (
            <Empty
              title={t('finance.modules.noRecurring')}
              body={t('finance.modules.noRecurringCopy')}
            />
          )}
          <AddAction
            label={t('finance.modules.addRecurring')}
            onPress={() => {
              setEditingRecurringId(null);
              setRecurring({
                accountId: operationalAccounts[0]?.id ?? '',
                kind: 'expense',
                amount: '',
                payee: '',
                category: 'other',
                frequency: 'monthly',
                nextDate: new Date().toISOString(),
                description: '',
              });
              setRecurringOpen(true);
            }}
          />
        </>
      ) : (
        renderReminders()
      )}
    </View>
  );
  const renderDebts = () => (
    <View style={styles.panel}>
      {state.debts.map((item) => (
        <View key={item.id} style={styles.module}>
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {item.creditor} · {dateText(item.dueDate)} · {item.interestRate}%{' '}
                {t('finance.interestReference')}
              </Text>
            </View>
            <Text
              style={styles.negative}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {money(item.balance, item.currency)}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(0, Math.min(100, (1 - item.balance / Math.max(1, item.originalAmount)) * 100))}%`,
                  backgroundColor: item.active ? C.gold : C.green,
                },
              ]}
            />
          </View>
          {item.payments
            .slice()
            .reverse()
            .map((payment) => (
              <View key={payment.id} style={styles.historyRow}>
                <Text style={styles.cardMeta}>{dateText(payment.date)}</Text>
                <Text style={styles.positive}>−{money(payment.amount, item.currency)}</Text>
                <Pressable
                  style={styles.smallAction}
                  onPress={() =>
                    confirmDelete(t('finance.deleteAction'), () =>
                      payment.transactionId
                        ? finance.deleteTransaction(payment.transactionId)
                        : finance.updateState((current) => ({
                            ...current,
                            debts: current.debts.map((debtItem) =>
                              debtItem.id === item.id
                                ? {
                                    ...debtItem,
                                    balance: Math.min(
                                      debtItem.originalAmount,
                                      debtItem.balance + payment.amount,
                                    ),
                                    active: true,
                                    payments: debtItem.payments.filter(
                                      (entry) => entry.id !== payment.id,
                                    ),
                                  }
                                : debtItem,
                            ),
                          })),
                    )
                  }
                  accessibilityLabel={t('finance.deleteAction')}
                >
                  <Ionicons name="trash-outline" size={15} color={C.red} />
                </Pressable>
              </View>
            ))}
          <View style={styles.inlineActions}>
            <Pressable
              style={[styles.inlineButton, !item.active && styles.buttonDisabled]}
              disabled={!item.active}
              onPress={() => {
                setDebtPaymentTarget(item);
                setDebtPaymentAmount('');
                setDebtPaymentAccountId(
                  item.accountId &&
                    operationalAccounts.some((accountItem) => accountItem.id === item.accountId)
                    ? item.accountId
                    : (operationalAccounts[0]?.id ?? ''),
                );
                setLinkedActionError('');
              }}
            >
              <Text style={styles.inlineButtonText}>{t('finance.modules.registerPayment')}</Text>
            </Pressable>
            <Pressable
              style={styles.smallAction}
              onPress={() =>
                confirmDelete(t('finance.modules.deleteDebt'), () =>
                  finance.updateState((current) => ({
                    ...current,
                    debts: current.debts.filter((entry) => entry.id !== item.id),
                    transactions: current.transactions.filter(
                      (transaction) => transaction.debtId !== item.id,
                    ),
                  })),
                )
              }
              accessibilityLabel={t('finance.deleteAction')}
            >
              <Ionicons name="trash-outline" size={17} color={C.red} />
            </Pressable>
          </View>
        </View>
      ))}
      {!state.debts.length && (
        <Empty title={t('finance.modules.noDebts')} body={t('finance.modules.noDebtsCopy')} />
      )}
      <AddAction
        label={t('finance.modules.addDebt')}
        onPress={() => {
          setDebt({
            name: '',
            creditor: '',
            currency: baseCurrency,
            amount: '',
            dueDate: new Date().toISOString(),
            interest: '0',
          });
          setDebtOpen(true);
        }}
      />
    </View>
  );
  const renderSavings = () => (
    <View style={styles.panel}>
      {state.savingsGoals.map((item) => (
        <View key={item.id} style={styles.module}>
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {dateText(item.deadline)} ·{' '}
                {Math.min(100, Math.round((item.balance / Math.max(1, item.targetAmount)) * 100))}%
              </Text>
            </View>
            <Text
              style={styles.positive}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {money(item.balance, item.currency)}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(0, Math.min(100, (item.balance / Math.max(1, item.targetAmount)) * 100))}%`,
                  backgroundColor: item.active ? C.gold : C.green,
                },
              ]}
            />
          </View>
          <Text style={styles.cardMeta}>
            {t('finance.modules.goalOf', { target: money(item.targetAmount, item.currency) })}
          </Text>
          {item.contributions
            .slice()
            .reverse()
            .map((contribution) => (
              <View key={contribution.id} style={styles.historyRow}>
                <Text style={styles.cardMeta}>{dateText(contribution.date)}</Text>
                <Text style={styles.positive}>+{money(contribution.amount, item.currency)}</Text>
                <Pressable
                  style={styles.smallAction}
                  onPress={() =>
                    confirmDelete(t('finance.deleteAction'), () =>
                      contribution.transferId
                        ? finance.deleteTransfer(contribution.transferId)
                        : finance.updateState((current) => ({
                            ...current,
                            savingsGoals: current.savingsGoals.map((goal) =>
                              goal.id === item.id
                                ? {
                                    ...goal,
                                    balance: Math.max(0, goal.balance - contribution.amount),
                                    active: true,
                                    contributions: goal.contributions.filter(
                                      (entry) => entry.id !== contribution.id,
                                    ),
                                  }
                                : goal,
                            ),
                          })),
                    )
                  }
                  accessibilityLabel={t('finance.deleteAction')}
                >
                  <Ionicons name="trash-outline" size={15} color={C.red} />
                </Pressable>
              </View>
            ))}
          <View style={styles.inlineActions}>
            <Pressable
              style={[styles.inlineButton, !item.active && styles.buttonDisabled]}
              disabled={!item.active}
              onPress={() => {
                setSavingsTarget(item);
                setSavingsAmount('');
                setSavingsDestinationAccountId(
                  item.accountId &&
                    operationalAccounts.some((accountItem) => accountItem.id === item.accountId)
                    ? item.accountId
                    : (operationalAccounts[0]?.id ?? ''),
                );
                setSavingsSourceAccountId(
                  operationalAccounts.find((accountItem) => accountItem.id !== item.accountId)
                    ?.id ?? '',
                );
                setLinkedActionError('');
              }}
            >
              <Text style={styles.inlineButtonText}>{t('finance.modules.addContribution')}</Text>
            </Pressable>
            <Pressable
              style={styles.smallAction}
              onPress={() =>
                confirmDelete(t('finance.modules.deleteGoal'), () =>
                  finance.updateState((current) => ({
                    ...current,
                    savingsGoals: current.savingsGoals.filter((entry) => entry.id !== item.id),
                  })),
                )
              }
              accessibilityLabel={t('finance.deleteAction')}
            >
              <Ionicons name="trash-outline" size={17} color={C.red} />
            </Pressable>
          </View>
        </View>
      ))}
      {!state.savingsGoals.length && (
        <Empty title={t('finance.modules.noGoals')} body={t('finance.modules.noGoalsCopy')} />
      )}
      <AddAction
        label={t('finance.modules.addGoal')}
        onPress={() => {
          setSavings({
            name: '',
            currency: baseCurrency,
            accountId:
              operationalAccounts.find((entry) => entry.type === 'savings')?.id ??
              operationalAccounts[0]?.id ??
              '',
            target: '',
            deadline: new Date().toISOString(),
          });
          setSavingsOpen(true);
        }}
      />
    </View>
  );
  const renderReminders = () => (
    <View style={styles.panel}>
      {sortedReminders.map((item) => {
        const overdue = !item.completed && new Date(item.date).getTime() < Date.now();
        return (
          <View key={item.id} style={styles.row}>
            <Pressable
              onPress={() => finance.updateReminder({ ...item, completed: !item.completed })}
              style={[
                styles.reminderCheck,
                item.completed && styles.reminderCheckDone,
                overdue && styles.reminderCheckOverdue,
              ]}
            >
              <Ionicons
                name={item.completed ? 'checkmark' : overdue ? 'alert' : 'notifications-outline'}
                size={15}
                color={item.completed ? C.void : overdue ? C.red : C.gold}
              />
            </Pressable>
            <View style={styles.rowMain}>
              <Text style={[styles.cardTitle, item.completed && styles.strike]}>{item.title}</Text>
              <Text style={[styles.cardMeta, overdue && styles.overdueText]}>
                {dateText(item.date)}
                {item.note ? ` · ${item.note}` : ''}
              </Text>
            </View>
            <Pressable
              style={styles.smallAction}
              onPress={() => {
                setEditingReminderId(item.id);
                setReminder({ title: item.title, date: item.date, note: item.note });
                setReminderOpen(true);
              }}
              accessibilityLabel={t('finance.editAction')}
            >
              <Ionicons name="pencil-outline" size={17} color={C.gold} />
            </Pressable>
            <Pressable
              style={styles.smallAction}
              onPress={() =>
                confirmDelete(t('finance.modules.deleteReminder'), () =>
                  finance.updateState((current) => ({
                    ...current,
                    reminders: current.reminders.filter((entry) => entry.id !== item.id),
                  })),
                )
              }
            >
              <Ionicons name="trash-outline" size={17} color={C.red} />
            </Pressable>
          </View>
        );
      })}
      {!sortedReminders.length && (
        <Empty
          title={t('finance.modules.noReminders')}
          body={t('finance.modules.noRemindersCopy')}
        />
      )}
      <AddAction
        label={t('finance.modules.addReminder')}
        onPress={() => {
          setEditingReminderId(null);
          setReminder({ title: '', date: new Date().toISOString(), note: '' });
          setReminderOpen(true);
        }}
      />
    </View>
  );
  const renderCategories = () => {
    const selectedStoreCategories = categoryType === 'store' ? sortedStoreCategories : [];
    const selectedCategories = categoryType === 'store' ? [] : state.categories[categoryType];
    return (
      <View style={styles.panel}>
        <View style={styles.categoryTabShell}>
          <View style={styles.categoryTabRow}>
            {categoryTabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.categoryTab, categoryType === tab.key && styles.categoryTabActive]}
                onPress={() => setCategoryType(tab.key)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    categoryType === tab.key && styles.categoryTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.categoryListHeader}>
          <Text style={styles.cardMeta}>
            {t('finance.modules.categoriesCount', {
              count:
                categoryType === 'store'
                  ? selectedStoreCategories.length
                  : selectedCategories.length,
            })}
          </Text>
          <Pressable
            style={styles.categoryAddButton}
            onPress={() => {
              setCategoryName('');
              setCategoryIcon('pricetag-outline');
              setCategoryError('');
              setIconPickerOpen(false);
              setCategoryCreateOpen(true);
            }}
            accessibilityLabel={t('finance.addCategory')}
          >
            <Ionicons name="add" size={17} color={C.gold} />
            <Text style={styles.addCategoryText}>{t('finance.addCategory')}</Text>
          </Pressable>
        </View>
        {categoryType === 'store' &&
          selectedStoreCategories.map((item) => {
            const label = item.builtIn
              ? t(`finance.storeCategories.${item.id}`, { defaultValue: item.name })
              : item.name;
            const locked = Boolean(item.builtIn) || item.id === 'general';
            return (
              <View key={`store-${item.id}`} style={styles.row}>
                <View style={styles.categoryRowIcon}>
                  <Ionicons
                    name={
                      (item.icon as IconName | undefined) ??
                      (locked ? 'grid-outline' : 'pricetag-outline')
                    }
                    size={18}
                    color={C.gold}
                  />
                </View>
                <Text style={[styles.cardTitle, styles.categoryRowName]}>{label}</Text>
                {!locked && (
                  <Pressable
                    onPress={() => removeCategory('store', item.id)}
                    accessibilityLabel={t('finance.deleteCategory')}
                  >
                    <Ionicons name="trash-outline" size={19} color={C.red} />
                  </Pressable>
                )}
              </View>
            );
          })}
        {categoryType !== 'store' &&
          selectedCategories.map((item) => (
            <View key={`${categoryType}-${item.id}`} style={styles.row}>
              <View style={styles.categoryRowIcon}>
                <Ionicons name={item.icon as IconName} size={18} color={C.gold} />
              </View>
              <Text style={[styles.cardTitle, styles.categoryRowName]}>
                {item.name ?? t(`finance.categories.${item.id}`, { defaultValue: item.id })}
              </Text>
              {!item.builtIn && (
                <Pressable
                  onPress={() => removeCategory(categoryType, item.id)}
                  accessibilityLabel={t('finance.deleteCategory')}
                >
                  <Ionicons name="trash-outline" size={19} color={C.red} />
                </Pressable>
              )}
            </View>
          ))}
      </View>
    );
  };
  const renderTools = () => {
    const baseAmount = toolNumber(discountAmount);
    const discount = toolNumber(discountPercent);
    const tax = toolNumber(taxPercent);
    const validDiscount = baseAmount >= 0 && discount >= 0 && discount <= 100 && tax >= 0;
    const discountValue = (baseAmount * discount) / 100;
    const taxedAmount = validDiscount ? (baseAmount - discountValue) * (1 + tax / 100) : NaN;
    const principal = toolNumber(interestPrincipal);
    const annualRate = toolNumber(interestRate) / 100;
    const years = toolNumber(interestYears);
    const compounds = toolNumber(interestCompounds);
    const validInterest =
      principal >= 0 &&
      annualRate >= 0 &&
      years >= 0 &&
      Number.isSafeInteger(compounds) &&
      compounds > 0;
    const interestTotal = validInterest
      ? principal * Math.pow(1 + annualRate / compounds, compounds * years)
      : NaN;
    const cashTotal = cashRows.reduce(
      (total, row) =>
        total + toolNumber(row.denomination) * Math.max(0, Math.floor(toolNumber(row.quantity))),
      0,
    );
    const invalidToolInput =
      activeTool === 'discountTax'
        ? !Number.isFinite(taxedAmount)
        : activeTool === 'interest'
          ? !Number.isFinite(interestTotal)
          : activeTool === 'cashCounter'
            ? !Number.isFinite(cashTotal)
            : false;
    const updateCashRow = (id: string, field: 'denomination' | 'quantity', value: string) => {
      const cleanValue =
        field === 'quantity' ? value.replace(/[^0-9]/g, '') : value.replace(/[^0-9.,]/g, '');
      setCashRows((current) =>
        current.map((row) => (row.id === id ? { ...row, [field]: cleanValue } : row)),
      );
    };

    return (
      <View style={styles.panel}>
        {activeTool === null ? (
          <View style={styles.toolGrid}>
            {TOOL_OPTIONS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setActiveTool(item.key)}
                style={styles.toolCard}
                accessibilityRole="button"
              >
                <View style={styles.toolCardIcon}>
                  <Ionicons name={item.icon} size={21} color={C.gold} />
                </View>
                <Text style={styles.toolCardTitle}>{t(`finance.toolCalculators.${item.key}`)}</Text>
                <Ionicons name="chevron-forward-outline" size={15} color="rgba(255,244,208,0.26)" />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.toolWorkspace}>
            <Pressable
              style={styles.toolBack}
              onPress={() => setActiveTool(null)}
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back-outline" size={17} color={C.gold} />
              <Text style={styles.toolBackText}>{t('finance.tools')}</Text>
            </Pressable>
            <Text style={styles.toolWorkspaceTitle}>
              {t(`finance.toolCalculators.${activeTool}`)}
            </Text>
            {invalidToolInput ? (
              <Text style={styles.pinError} accessibilityLiveRegion="polite">
                {t('finance.toolValidation')}
              </Text>
            ) : null}

            {activeTool === 'calculator' && (
              <>
                <View style={styles.calculatorDisplay}>
                  <Text style={styles.calculatorExpression} numberOfLines={1} adjustsFontSizeToFit>
                    {calculator || '0'}
                  </Text>
                  {Boolean(calculatorResult) && (
                    <Text style={styles.calculatorAnswer} numberOfLines={1} adjustsFontSizeToFit>
                      {calculatorResult}
                    </Text>
                  )}
                </View>
                <View style={styles.calculatorGrid}>
                  {[
                    'C',
                    'DEL',
                    '(',
                    '÷',
                    '7',
                    '8',
                    '9',
                    '×',
                    '4',
                    '5',
                    '6',
                    '−',
                    '1',
                    '2',
                    '3',
                    '+',
                    ')',
                    '0',
                    '.',
                    '=',
                  ].map((key) => (
                    <Pressable
                      key={key}
                      style={[
                        styles.calculatorKey,
                        ['C', 'DEL', '(', ')'].includes(key) && styles.calculatorUtilityKey,
                        ['÷', '×', '−', '+', '='].includes(key) && styles.calculatorOperatorKey,
                      ]}
                      onPress={() => pressCalculatorKey(key)}
                      accessibilityRole="button"
                      accessibilityLabel={key === 'DEL' ? t('finance.deleteAction') : key}
                    >
                      <Text
                        style={[
                          styles.calculatorKeyText,
                          ['C', 'DEL', '(', ')'].includes(key) && styles.calculatorUtilityText,
                          ['÷', '×', '−', '+', '='].includes(key) && styles.calculatorOperatorText,
                        ]}
                      >
                        {key === 'DEL' ? '⌫' : key}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {activeTool === 'cashCounter' && (
              <>
                <View style={styles.cashSummary}>
                  <Text style={styles.fieldLabel}>{t('finance.toolCalculators.cashTotal')}</Text>
                  <Text style={styles.cashTotal} numberOfLines={1} adjustsFontSizeToFit>
                    {toolMoney(cashTotal, baseCurrency)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {t('finance.toolCalculators.cashCounterCopy')}
                  </Text>
                </View>
                <View style={styles.cashTableHeader}>
                  <Text style={[styles.fieldLabel, styles.cashDenomination]}>
                    {t('finance.toolCalculators.denomination')}
                  </Text>
                  <Text style={[styles.fieldLabel, styles.cashQuantity]}>
                    {t('finance.toolCalculators.quantity')}
                  </Text>
                  <View style={styles.cashDeleteSpace} />
                </View>
                {cashRows.map((row) => (
                  <View key={row.id} style={styles.cashRow}>
                    <TextInput
                      value={row.denomination}
                      onChangeText={(value) => updateCashRow(row.id, 'denomination', value)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={C.textSubtle}
                      selectionColor={C.gold}
                      style={[styles.formInput, styles.cashDenomination]}
                    />
                    <Text style={styles.cashMultiply}>×</Text>
                    <TextInput
                      value={row.quantity}
                      onChangeText={(value) => updateCashRow(row.id, 'quantity', value)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={C.textSubtle}
                      selectionColor={C.gold}
                      style={[styles.formInput, styles.cashQuantity]}
                    />
                    <Pressable
                      style={styles.cashDelete}
                      onPress={() =>
                        setCashRows((current) => current.filter((item) => item.id !== row.id))
                      }
                      accessibilityLabel={t('finance.deleteAction')}
                    >
                      <Ionicons name="close-outline" size={17} color={C.red} />
                    </Pressable>
                  </View>
                ))}
                <AddAction
                  label={t('finance.toolCalculators.addDenomination')}
                  onPress={() =>
                    setCashRows((current) => [
                      ...current,
                      { id: uid('cash'), denomination: '', quantity: '' },
                    ])
                  }
                />
              </>
            )}

            {activeTool === 'discountTax' && (
              <>
                <Field
                  title={t('finance.toolCalculators.amount')}
                  value={discountAmount}
                  onChangeText={setDiscountAmount}
                  numeric
                />
                <Field
                  title={t('finance.toolCalculators.discount')}
                  value={discountPercent}
                  onChangeText={setDiscountPercent}
                  numeric
                />
                <Field
                  title={t('finance.toolCalculators.tax')}
                  value={taxPercent}
                  onChangeText={setTaxPercent}
                  numeric
                />
                <Text style={styles.toolResult}>{toolMoney(taxedAmount)}</Text>
                <Text style={styles.cardMeta}>
                  {t('finance.toolCalculators.discountedTotal', { amount: toolMoney(taxedAmount) })}
                </Text>
              </>
            )}

            {activeTool === 'interest' && (
              <>
                <Field
                  title={t('finance.toolCalculators.principal')}
                  value={interestPrincipal}
                  onChangeText={setInterestPrincipal}
                  numeric
                />
                <Field
                  title={t('finance.toolCalculators.annualRate')}
                  value={interestRate}
                  onChangeText={setInterestRate}
                  numeric
                />
                <Field
                  title={t('finance.toolCalculators.years')}
                  value={interestYears}
                  onChangeText={setInterestYears}
                  numeric
                />
                <Field
                  title={t('finance.toolCalculators.compounds')}
                  value={interestCompounds}
                  onChangeText={setInterestCompounds}
                  numeric
                />
                <Text style={styles.toolResult}>{toolMoney(interestTotal)}</Text>
                <Text style={styles.cardMeta}>
                  {t('finance.toolCalculators.interestEarned', {
                    amount: toolMoney(Math.max(0, interestTotal - principal)),
                  })}
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  };
  const renderSettings = () => {
    const currentLanguage = supportedLanguages.includes(
      (translationI18n.resolvedLanguage ?? 'en') as AppLanguage,
    )
      ? (translationI18n.resolvedLanguage ?? 'en')
      : 'en';
    const selectedLanguage = state.settings.language ?? currentLanguage;
    const currencyRateLabel = `1 ${currencyRateLeft} = ? ${currencyRateRight}`;
    const settingRow = (section: SettingsSection, icon: IconName, title: string, value: string) => (
      <Pressable
        key={section}
        style={styles.settingsRow}
        onPress={() => setSettingsSection(section)}
      >
        <Ionicons name={icon} size={20} color={C.gold} />
        <View style={styles.settingsRowMain}>
          <Text style={styles.settingsRowTitle}>{title}</Text>
          <Text style={styles.settingsRowValue} numberOfLines={1}>
            {value}
          </Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={18} color="rgba(255,244,208,0.35)" />
      </Pressable>
    );

    if (!settingsSection) {
      return (
        <View style={styles.panel}>
          {settingRow(
            'language',
            'language-outline',
            t('finance.language'),
            t(`finance.languages.${selectedLanguage}`),
          )}
          {settingRow(
            'currency',
            'cash-outline',
            t('finance.currency'),
            state.settings.preferredCurrency,
          )}
          {settingRow(
            'theme',
            state.settings.theme === 'light' ? 'sunny-outline' : 'moon-outline',
            t('finance.theme.title'),
            t(`finance.theme.${state.settings.theme === 'light' ? 'light' : 'dark'}`),
          )}
          {settingRow(
            'week',
            'calendar-outline',
            t('finance.weekStartsOn'),
            state.settings.firstDayOfWeek === 1 ? t('finance.monday') : t('finance.sunday'),
          )}
          {settingRow(
            'pin',
            'lock-closed-outline',
            t('finance.pin.title'),
            state.settings.pinHash ? t('finance.pin.enabled') : t('finance.pin.disabled'),
          )}
          {settingRow(
            'data',
            'archive-outline',
            t('finance.releaseExtra.dataBackups'),
            t('finance.backupArchive.copy'),
          )}
          {settingRow(
            'contact',
            'chatbubbles-outline',
            t('finance.developerContact.title'),
            t('finance.developerContact.team'),
          )}
        </View>
      );
    }

    return (
      <View style={styles.panel}>
        <View style={styles.settingsBack}>
          <BackButton onPress={() => setSettingsSection(null)} />
          <Text style={styles.settingsBackText}>
            {t('finance.navigation.items.settings.title')}
          </Text>
        </View>
        {settingsSection === 'contact' && <DeveloperContactCard embedded />}
        {settingsSection === 'language' && (
          <>
            <Text style={styles.fieldLabel}>{t('finance.language')}</Text>
            <View style={styles.settingsOptionList}>
              {supportedLanguages.map((language) => (
                <Pressable
                  key={language}
                  style={styles.settingsOption}
                  onPress={() => changeLanguage(language)}
                >
                  <Text
                    style={[
                      styles.settingsOptionText,
                      selectedLanguage === language && styles.settingsOptionTextActive,
                    ]}
                  >
                    {t(`finance.languages.${language}`)}
                  </Text>
                  {selectedLanguage === language && (
                    <Ionicons name="checkmark-outline" size={18} color={C.gold} />
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}
        {settingsSection === 'currency' && (
          <>
            <Text style={styles.fieldLabel}>{t('finance.currency')}</Text>
            <View style={styles.settingsOptionList}>
              <Pressable
                style={styles.settingsOption}
                onPress={() => {
                  setCurrencyPickerMode('primary');
                  setCurrencyQuery('');
                  setCurrencyPickerOpen(true);
                }}
              >
                <View style={styles.settingsRowMain}>
                  <Text style={styles.settingsOptionTextActive}>{currencyBaseDraft}</Text>
                  <Text style={styles.settingsRowValue}>{t('finance.selectCurrency')}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={18} color={C.gold} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>{t('finance.exchangeRate')}</Text>
            <Pressable
              style={styles.settingsOption}
              onPress={() => {
                setCurrencyPickerMode('rate');
                setCurrencyQuery('');
                setCurrencyPickerOpen(true);
              }}
            >
              <View style={styles.settingsRowMain}>
                <Text style={styles.settingsOptionTextActive}>{currencyRateCurrency}</Text>
                <Text style={styles.settingsRowValue}>{currencyRateLabel}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={C.gold} />
            </Pressable>
            <Field
              title={currencyRateLabel}
              value={currencyRate}
              onChangeText={(value) => {
                setCurrencyRate(value.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
                setCurrencyRateError('');
              }}
              numeric
              placeholder={currencyRateCurrency === currencyBaseDraft ? '0.00' : '1.00'}
            />
            <Pressable
              style={styles.rateSwap}
              onPress={() => {
                const value = Number(currencyRate);
                setCurrencyRateInverted((current) => !current);
                setCurrencyRate(
                  Number.isFinite(value) && value > 0
                    ? String(Number((1 / value).toPrecision(12)))
                    : '',
                );
                setCurrencyRateError('');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('finance.exchangeRate')}
            >
              <Ionicons name="swap-horizontal-outline" size={17} color={C.gold} />
              <Text style={styles.rateSwapText}>
                1 {currencyRateRight} = ? {currencyRateLeft}
              </Text>
            </Pressable>
            {Boolean(currencyRateError) && <Text style={styles.pinError}>{currencyRateError}</Text>}
            <Pressable style={styles.primary} onPress={saveCurrencyRate}>
              <Text style={styles.primaryText}>{t('finance.done')}</Text>
            </Pressable>
          </>
        )}
        {settingsSection === 'theme' && (
          <>
            <Text style={styles.fieldLabel}>{t('finance.theme.title')}</Text>
            <View style={styles.settingsOptionList}>
              {(['dark', 'light'] as const).map((theme) => (
                <Pressable
                  key={theme}
                  style={styles.settingsOption}
                  onPress={() =>
                    finance.updateState((current) => ({
                      ...current,
                      settings: { ...current.settings, theme },
                    }))
                  }
                >
                  <View style={styles.settingsRowMain}>
                    <Text
                      style={[
                        styles.settingsOptionText,
                        state.settings.theme === theme && styles.settingsOptionTextActive,
                      ]}
                    >
                      {t(`finance.theme.${theme}`)}
                    </Text>
                    <Text style={styles.settingsRowValue}>{t(`finance.theme.${theme}Copy`)}</Text>
                  </View>
                  {state.settings.theme === theme && (
                    <Ionicons name="checkmark-outline" size={18} color={C.gold} />
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}
        {settingsSection === 'week' && (
          <>
            <Text style={styles.fieldLabel}>{t('finance.weekStartsOn')}</Text>
            <View style={styles.settingsOptionList}>
              {([1, 0] as const).map((day) => (
                <Pressable
                  key={day}
                  style={styles.settingsOption}
                  onPress={() =>
                    finance.updateState((current) => ({
                      ...current,
                      settings: { ...current.settings, firstDayOfWeek: day },
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.settingsOptionText,
                      state.settings.firstDayOfWeek === day && styles.settingsOptionTextActive,
                    ]}
                  >
                    {day === 1 ? t('finance.monday') : t('finance.sunday')}
                  </Text>
                  {state.settings.firstDayOfWeek === day && (
                    <Ionicons name="checkmark-outline" size={18} color={C.gold} />
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}
        {settingsSection === 'pin' && (
          <>
            <Text style={styles.settingsTitle}>{t('finance.pin.title')}</Text>
            <Text style={styles.cardMeta}>
              {state.settings.pinHash ? t('finance.pin.enabled') : t('finance.pin.disabled')}
            </Text>
            <Field
              title={t('finance.pin.newPin')}
              value={pinDraft}
              onChangeText={(value) => {
                setPinDraft(value.replace(/\D/g, ''));
                setPinError('');
              }}
              placeholder="0000"
              numeric
              secureTextEntry
              maxLength={4}
            />
            <Field
              title={t('finance.pin.confirmPin')}
              value={pinConfirmation}
              onChangeText={(value) => {
                setPinConfirmation(value.replace(/\D/g, ''));
                setPinError('');
              }}
              placeholder="0000"
              numeric
              secureTextEntry
              maxLength={4}
            />
            {Boolean(pinError) && <Text style={styles.pinError}>{pinError}</Text>}
            <Pressable style={styles.primary} onPress={savePin}>
              <Text style={styles.primaryText}>
                {state.settings.pinHash ? t('finance.pin.change') : t('finance.pin.set')}
              </Text>
            </Pressable>
            {state.settings.pinHash && (
              <Pressable style={styles.danger} onPress={removePin}>
                <Text style={styles.dangerText}>{t('finance.pin.remove')}</Text>
              </Pressable>
            )}
          </>
        )}
        {settingsSection === 'data' && (
          <>
            <Text style={styles.settingsTitle}>{t('finance.releaseExtra.dataBackups')}</Text>
            <Pressable style={styles.secondary} onPress={() => void share('json')}>
              <Text style={styles.secondaryText}>{t('finance.releaseExtra.exportJson')}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void share('csv')}>
              <Text style={styles.secondaryText}>{t('finance.releaseExtra.exportCsv')}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void share('zip')}>
              <Text style={styles.secondaryText}>{t('finance.backupArchive.export')}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void pickImportFile()}>
              <Text style={styles.secondaryText}>{t('finance.backupArchive.import')}</Text>
            </Pressable>
            <Pressable
              style={styles.danger}
              onPress={() => confirmDelete(t('finance.releaseExtra.resetData'), finance.resetData)}
            >
              <Text style={styles.dangerText}>{t('finance.releaseExtra.resetData')}</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };
  const renderBudget = () => (
    <View style={styles.panel}>
      {budgetSummaries.map(
        ({ item, accountName, budgetCurrency, spent, percentage, categoryLabel }) => (
          <View key={item.id} style={styles.module}>
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.cardTitle}>{categoryLabel}</Text>
                <Text style={styles.cardMeta}>
                  {accountName} · {t(`finance.releaseFrequency.${item.period}`)}
                </Text>
              </View>
              <Text
                style={spent > item.limit ? styles.negative : styles.positive}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
              >
                {money(spent, budgetCurrency)}
              </Text>
              <Pressable
                style={styles.smallAction}
                onPress={() =>
                  confirmDelete(t('finance.modules.deleteBudget'), () =>
                    finance.deleteBudget(item.id),
                  )
                }
                accessibilityLabel={t('finance.deleteAction')}
              >
                <Ionicons name="trash-outline" size={17} color={C.red} />
              </Pressable>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${percentage}%`,
                    backgroundColor:
                      percentage >= 100 ? C.red : percentage >= 80 ? C.gold : C.goldLight,
                  },
                ]}
              />
            </View>
            <Text style={styles.cardMeta}>
              {t('finance.modules.budgetRemaining', {
                amount: money(Math.max(0, item.limit - spent), budgetCurrency),
              })}
            </Text>
          </View>
        ),
      )}
      {!budgetSummaries.length && (
        <Empty title={t('finance.modules.noBudgets')} body={t('finance.modules.noBudgetsCopy')} />
      )}
      <AddAction
        label={t('finance.modules.addBudget')}
        onPress={() => {
          setBudgetDraft((current) => ({
            ...current,
            accountId: current.accountId || accounts[0]?.id || '',
          }));
          setBudgetOpen(true);
        }}
      />
    </View>
  );
  const content =
    module === 'accounts'
      ? renderAccounts()
      : module === 'activity'
        ? renderActivity()
        : module === 'recurring'
          ? renderRecurring()
          : module === 'categories'
            ? renderCategories()
            : module === 'debt'
              ? renderDebts()
              : module === 'savings'
                ? renderSavings()
                : module === 'tools'
                  ? renderTools()
                  : module === 'settings' || module === 'notes'
                    ? renderSettings()
                    : renderBudget();
  const debtPaymentAccount = accounts.find((item) => item.id === debtPaymentAccountId);
  const debtPaymentReady = Boolean(
    debtPaymentTarget &&
    debtPaymentAccount &&
    Number(debtPaymentAmount) > 0 &&
    Number(debtPaymentAmount) <= debtPaymentTarget.balance &&
    rateBetweenCurrencies(debtPaymentTarget.currency, debtPaymentAccount.currency),
  );
  const debtPaymentValidationError =
    linkedActionError ||
    (debtPaymentTarget && Number(debtPaymentAmount) > debtPaymentTarget.balance
      ? t('finance.paymentExceedsDebt')
      : '') ||
    (debtPaymentTarget &&
    debtPaymentAccount &&
    Number(debtPaymentAmount) > 0 &&
    !rateBetweenCurrencies(debtPaymentTarget.currency, debtPaymentAccount.currency)
      ? t('finance.releaseErrors.missingRate')
      : '');
  const contributionDestinationId = savingsTarget?.accountId ?? savingsDestinationAccountId;
  const contributionDestination = accounts.find((item) => item.id === contributionDestinationId);
  const contributionSource = accounts.find((item) => item.id === savingsSourceAccountId);
  const contributionReady = Boolean(
    savingsTarget &&
    contributionDestination &&
    contributionSource &&
    contributionDestination.id !== contributionSource.id &&
    Number(savingsAmount) > 0 &&
    Number(savingsAmount) <= savingsTarget.targetAmount - savingsTarget.balance &&
    rateBetweenCurrencies(contributionDestination.currency, contributionSource.currency),
  );
  const contributionValidationError =
    linkedActionError ||
    (savingsTarget && Number(savingsAmount) > savingsTarget.targetAmount - savingsTarget.balance
      ? t('finance.contributionExceedsGoal')
      : '') ||
    (savingsTarget &&
    contributionDestination &&
    contributionSource &&
    Number(savingsAmount) > 0 &&
    !rateBetweenCurrencies(contributionDestination.currency, contributionSource.currency)
      ? t('finance.releaseErrors.missingRate')
      : '');
  const activityCategoryOptions = React.useMemo(() => {
    const categoriesById = new Map(
      [...state.categories.expense, ...state.categories.income].map((item) => [item.id, item]),
    );
    return activityCategories.map((id) => {
      const category = categoriesById.get(id);
      return {
        id,
        icon: (category?.icon as IconName) ?? 'pricetag-outline',
        label: category?.name ?? t(`finance.categories.${id}`, { defaultValue: id }),
      };
    });
  }, [activityCategories, state.categories.expense, state.categories.income, t]);

  return (
    <SafeAreaView
      style={[styles.root, styles.rootBackground]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text
          style={styles.headerTitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {titles[module]}
        </Text>
        <View style={styles.headerSpace} />
      </View>
      {module === 'activity' ? (
        <View style={[styles.content, styles.moduleContent, styles.moduleActivityContent]}>
          {content}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, styles.moduleContent]}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      )}
      <ResponsiveModal visible={activityPeriodOpen} onClose={() => setActivityPeriodOpen(false)}>
        <Text style={styles.sheetTitle}>{t('finance.date')}</Text>
        <View style={styles.activitySelectorGrid}>
          {(['today', 'week', 'month', 'year', 'all'] as ActivityPeriod[]).map((period) => {
            const selected = period === activityPeriod;
            const icon: IconName =
              period === 'today'
                ? 'sunny-outline'
                : period === 'week'
                  ? 'calendar-outline'
                  : period === 'month'
                    ? 'calendar-number-outline'
                    : period === 'year'
                      ? 'time-outline'
                      : 'infinite-outline';
            return (
              <Pressable
                key={period}
                style={[
                  styles.activitySelectorTile,
                  period === 'all' && styles.activitySelectorWide,
                  selected && styles.activitySelectorSelected,
                ]}
                onPress={() => {
                  setActivityPeriod(period);
                  setActivityPeriodOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View
                  style={[
                    styles.activitySelectorIcon,
                    selected && styles.activitySelectorIconSelected,
                  ]}
                >
                  <Ionicons name={icon} size={21} color={selected ? C.void : C.gold} />
                </View>
                <Text
                  style={[
                    styles.activitySelectorText,
                    selected && styles.activitySelectorTextSelected,
                  ]}
                >
                  {activityPeriodName(period)}
                </Text>
                {selected ? <Ionicons name="checkmark-circle" size={17} color={C.gold} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ResponsiveModal>
      <Modal
        visible={activityFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={closeActivityFilters}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.activityFilterBackdrop}
          behavior="padding"
          enabled={Platform.OS === 'ios'}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeActivityFilters}
            accessibilityLabel={t('finance.activity.closeFilters')}
          />
          <View style={styles.activityFilterSheet}>
            <View style={styles.activityDragZone}>
              <View style={styles.activityDragHandle} />
            </View>
            <View style={styles.activityFilterHeader}>
              <View style={styles.activityFilterHeaderCopy}>
                <Text style={styles.activityFilterEyebrow}>{t('finance.activity.eyebrow')}</Text>
                <Text style={styles.activityFilterTitle}>{t('finance.activity.filterTitle')}</Text>
              </View>
              <Pressable
                style={styles.activityFilterClose}
                onPress={closeActivityFilters}
                accessibilityRole="button"
                accessibilityLabel={t('finance.activity.closeFilters')}
              >
                <Ionicons name="close" size={19} color={C.goldLight} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.activityFilterScroll}
              contentContainerStyle={styles.activityFilterContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.activitySelectorLabel}>
                {t('finance.activity.operationType')}
              </Text>
              <View style={styles.activitySelectorGrid}>
                {(['expense', 'income', 'transfer', 'all'] as ActivityFilter[]).map((value) => {
                  const selected = activityFilter === value;
                  const icon: IconName =
                    value === 'all'
                      ? 'layers-outline'
                      : value === 'expense'
                        ? 'arrow-up-outline'
                        : value === 'income'
                          ? 'arrow-down-outline'
                          : 'swap-horizontal-outline';
                  return (
                    <Pressable
                      key={value}
                      style={[
                        styles.activitySelectorTile,
                        selected && styles.activitySelectorSelected,
                      ]}
                      onPress={() => {
                        setActivityFilter(value);
                        setActivityCategory('all');
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <View
                        style={[
                          styles.activitySelectorIcon,
                          selected && styles.activitySelectorIconSelected,
                        ]}
                      >
                        <Ionicons name={icon} size={20} color={selected ? C.void : C.gold} />
                      </View>
                      <Text
                        style={[
                          styles.activitySelectorText,
                          selected && styles.activitySelectorTextSelected,
                        ]}
                      >
                        {activityFilterName(value)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <SearchableSelect
                label={t('finance.category')}
                value={activityCategory}
                options={[
                  {
                    value: 'all',
                    label: t('finance.activity.allCategories'),
                    icon: 'apps-outline',
                  },
                  ...activityCategoryOptions.map((item) => ({
                    value: item.id,
                    label: item.label,
                    icon: item.icon,
                  })),
                ]}
                onChange={setActivityCategory}
                placeholder={t('finance.activity.allCategories')}
                searchPlaceholder={t('finance.activity.categorySearch')}
                closeLabel={t('finance.close')}
                emptyLabel={t('finance.modules.noResults')}
              />
              <Pressable
                style={styles.activityClearFilters}
                onPress={() => {
                  setActivityFilter('all');
                  setActivityCategory('all');
                }}
                accessibilityRole="button"
              >
                <Ionicons name="refresh-outline" size={16} color={C.gold} />
                <Text style={styles.activityClearFiltersText}>
                  {t('finance.activity.clearFilters')}
                </Text>
              </Pressable>
            </ScrollView>
            <View style={styles.activityFilterFooter}>
              <Pressable
                style={styles.activityDoneButton}
                onPress={closeActivityFilters}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{t('finance.done')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={categoryCreateOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryCreateOpen(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalBackdrop, isTablet && styles.modalBackdropTablet]}
          behavior="padding"
          enabled={Platform.OS === 'ios'}
        >
          <Sheet>
            <Text style={styles.sheetTitle}>{t('finance.newCategory')}</Text>
            <Text style={styles.cardMeta}>
              {categoryType === 'expense'
                ? t('finance.expenses')
                : categoryType === 'income'
                  ? t('finance.income')
                  : categoryType === 'store'
                    ? t('finance.workspace.store')
                    : t('finance.tags')}
            </Text>
            <Field
              title={t('finance.category')}
              value={categoryName}
              onChangeText={(value) => {
                setCategoryName(value);
                setCategoryError('');
              }}
              placeholder={
                categoryType === 'store'
                  ? t('finance.store.newCategoryPlaceholder')
                  : t('finance.categoryPlaceholder')
              }
            />
            {categoryType !== 'store' && (
              <>
                <Text style={styles.fieldLabel}>{t('finance.chooseIcon')}</Text>
                <Pressable
                  style={styles.iconPreviewRow}
                  onPress={() => setIconPickerOpen(true)}
                  accessibilityLabel={t('finance.chooseIcon')}
                >
                  <View style={styles.iconPreviewButton}>
                    <Ionicons name={categoryIcon} size={21} color={C.gold} />
                  </View>
                  <Text style={styles.iconPreviewText}>{t('finance.chooseIcon')}</Text>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={18}
                    color="rgba(255,244,208,0.35)"
                  />
                </Pressable>
              </>
            )}
            {Boolean(categoryError) && <Text style={styles.pinError}>{categoryError}</Text>}
            <Pressable
              style={[styles.primary, !categoryName.trim() && styles.buttonDisabled]}
              disabled={!categoryName.trim()}
              onPress={addCategory}
            >
              <Text style={styles.primaryText}>{t('finance.addCategory')}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setCategoryCreateOpen(false)}>
              <Text style={styles.secondaryText}>{t('finance.cancel')}</Text>
            </Pressable>
          </Sheet>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={iconPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIconPickerOpen(false)}
      >
        <View style={styles.iconPickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIconPickerOpen(false)} />
          <View style={styles.iconPickerSheet}>
            <View style={styles.iconPickerHeader}>
              <Text style={styles.sheetTitle}>{t('finance.chooseIcon')}</Text>
              <Pressable
                onPress={() => setIconPickerOpen(false)}
                accessibilityLabel={t('finance.close')}
              >
                <Ionicons name="close-outline" size={24} color={C.goldLight} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.iconPickerGrid}
              showsVerticalScrollIndicator={false}
            >
              {CATEGORY_ICON_OPTIONS.map((item) => (
                <Pressable
                  key={item.name}
                  onPress={() => {
                    setCategoryIcon(item.name);
                    setIconPickerOpen(false);
                  }}
                  style={[
                    styles.iconPickerChoice,
                    categoryIcon === item.name && styles.iconChoiceActive,
                  ]}
                  accessibilityLabel={t('finance.chooseIcon')}
                >
                  <Ionicons
                    name={item.name}
                    size={22}
                    color={categoryIcon === item.name ? C.void : C.goldLight}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={accountOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAccountEditor}
      >
        <KeyboardAvoidingView
          style={[styles.modalBackdrop, isTablet && styles.modalBackdropTablet]}
          behavior="padding"
          enabled={Platform.OS === 'ios'}
        >
          <Sheet>
            <Text style={styles.sheetTitle}>
              {editingAccount ? t('finance.release.editAccount') : t('finance.release.newAccount')}
            </Text>
            <Field
              title={t('finance.budgetName', { defaultValue: 'NAME' })}
              value={account.name}
              onChangeText={(value) => setAccount((current) => ({ ...current, name: value }))}
            />
            <Text style={[styles.fieldLabel, styles.accountTypeLabel]}>
              {t('finance.accountType')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountTypeChoices}
            >
              {ACCOUNT_TYPE_OPTIONS.map((item) => {
                const selected = account.type === item.key;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.accountTypeChoice, selected && styles.accountTypeChoiceActive]}
                    onPress={() => setAccount((current) => ({ ...current, type: item.key }))}
                  >
                    <Ionicons name={item.icon} size={18} color={selected ? C.void : C.gold} />
                    <Text
                      style={[styles.accountTypeText, selected && styles.accountTypeTextActive]}
                    >
                      {t(`finance.accountTypes.${item.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.fieldLabel}>{t('finance.currency')}</Text>
            <Pressable
              style={[
                styles.currencySelect,
                Boolean(editingAccount && accountHasHistory(state, editingAccount.id)) &&
                  styles.buttonDisabled,
              ]}
              onPress={() => {
                if (editingAccount && accountHasHistory(state, editingAccount.id)) return;
                setCurrencyPickerMode('account');
                setCurrencyQuery('');
                setCurrencyPickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('finance.currency')}
              accessibilityState={{
                disabled: Boolean(editingAccount && accountHasHistory(state, editingAccount.id)),
              }}
            >
              <View style={styles.currencySelectIcon}>
                <Ionicons name="cash-outline" size={18} color={C.gold} />
              </View>
              <View style={styles.currencySelectCopy}>
                <Text style={styles.currencySelectCode}>{account.currency}</Text>
                <Text style={styles.currencySelectHint}>{t('finance.selectCurrency')}</Text>
              </View>
              <Ionicons name="chevron-down-outline" size={17} color="rgba(255,244,208,0.38)" />
            </Pressable>
            {editingAccount && accountHasHistory(state, editingAccount.id) && (
              <Text style={styles.cardMeta}>{t('finance.accountCurrencyLocked')}</Text>
            )}
            <Field
              title={t('finance.openingBalance')}
              value={account.opening}
              onChangeText={(value) => setAccount((current) => ({ ...current, opening: value }))}
              numeric
              placeholder="0.00"
            />
            {account.currency !== baseCurrency && (
              <>
                <Field
                  title={`${t('finance.exchangeRate')} · 1 ${baseCurrency} = ? ${account.currency}`}
                  value={account.exchangeRate}
                  onChangeText={(value) => {
                    setAccount((current) => ({ ...current, exchangeRate: value }));
                    setAccountError('');
                  }}
                  numeric
                  placeholder="1.00"
                />
                {Boolean(accountError) && <Text style={styles.pinError}>{accountError}</Text>}
              </>
            )}
            <Pressable
              style={[
                styles.primary,
                (!account.name.trim() ||
                  (account.currency !== baseCurrency &&
                    (!Number.isFinite(Number(account.exchangeRate)) ||
                      Number(account.exchangeRate) <= 0))) &&
                  styles.buttonDisabled,
              ]}
              disabled={
                !account.name.trim() ||
                (account.currency !== baseCurrency &&
                  (!Number.isFinite(Number(account.exchangeRate)) ||
                    Number(account.exchangeRate) <= 0))
              }
              onPress={saveAccount}
            >
              <Text style={styles.primaryText}>
                {editingAccount ? t('finance.release.saveChanges') : t('finance.release.save')}
              </Text>
            </Pressable>
            {editingAccount && (
              <Pressable style={styles.dangerButton} onPress={() => confirmArchive(editingAccount)}>
                <Text style={styles.dangerButtonText}>{t('finance.release.archiveAccount')}</Text>
              </Pressable>
            )}
          </Sheet>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={currencyPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyPickerOpen(false)}
      >
        <View style={styles.currencyPickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCurrencyPickerOpen(false)} />
          <View style={styles.currencyPickerSheet}>
            <View style={styles.currencyPickerHeader}>
              <Text style={styles.sheetTitle}>{t('finance.selectCurrency')}</Text>
              <Pressable
                style={styles.sheetClose}
                onPress={() => setCurrencyPickerOpen(false)}
                accessibilityLabel={t('finance.close')}
              >
                <Ionicons name="close" size={18} color={C.goldLight} />
              </Pressable>
            </View>
            <View style={styles.currencySearch}>
              <Ionicons name="search-outline" size={17} color={C.textSubtle} />
              <TextInput
                value={currencyQuery}
                onChangeText={setCurrencyQuery}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t('finance.searchCurrency')}
                placeholderTextColor={C.textSubtle}
                style={styles.currencySearchInput}
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filteredAccountCurrencies.map((currency) => {
                const selectedCurrency =
                  currencyPickerMode === 'account'
                    ? account.currency
                    : currencyPickerMode === 'debt'
                      ? debt.currency
                      : currencyPickerMode === 'rate'
                        ? currencyRateCurrency
                        : currencyBaseDraft;
                return (
                  <Pressable
                    key={currency}
                    style={[
                      styles.currencyOption,
                      selectedCurrency === currency && styles.currencyOptionActive,
                    ]}
                    onPress={() => {
                      if (currencyPickerMode === 'account') {
                        const configuredRate = rateBetweenCurrencies(currency, baseCurrency);
                        setAccount((current) => ({
                          ...current,
                          currency,
                          exchangeRate:
                            currency === baseCurrency
                              ? '1'
                              : current.currency === currency
                                ? current.exchangeRate
                                : configuredRate
                                  ? String(Number((1 / configuredRate).toPrecision(12)))
                                  : '',
                        }));
                        setAccountError('');
                      } else if (currencyPickerMode === 'debt')
                        setDebt((current) => ({ ...current, currency }));
                      else if (currencyPickerMode === 'rate') chooseRateCurrency(currency);
                      else choosePrimaryCurrency(currency);
                      setCurrencyPickerOpen(false);
                    }}
                  >
                    <View style={styles.currencyOptionMark}>
                      <Text style={styles.currencyOptionMarkText}>{currency.slice(0, 1)}</Text>
                    </View>
                    <Text style={styles.currencyOptionCode}>{currency}</Text>
                    {selectedCurrency === currency && (
                      <Ionicons name="checkmark" size={18} color={C.gold} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ResponsiveModal
        visible={recurringOpen}
        onClose={() => {
          setRecurringOpen(false);
          setEditingRecurringId(null);
        }}
      >
        <Text style={styles.sheetTitle}>
          {editingRecurringId
            ? t('finance.editRecurring')
            : t('finance.modules.addRecurring').replace(/^\+\s*/, '')}
        </Text>
        <SearchableSelect
          label={t('finance.modules.account')}
          value={recurring.accountId}
          options={operationalAccounts.map((item) => ({
            value: item.id,
            label: item.name,
            description: item.currency,
            icon: 'wallet-outline',
          }))}
          onChange={(accountId) => setRecurring((current) => ({ ...current, accountId }))}
          placeholder={t('finance.modules.account')}
          searchPlaceholder={t('finance.search')}
          closeLabel={t('finance.close')}
          emptyLabel={t('finance.modules.noResults')}
          required
        />
        <Text style={styles.fieldLabel}>{t('finance.categoryType')}</Text>
        <Choice
          values={['expense', 'income']}
          value={recurring.kind}
          onChange={(kind) =>
            setRecurring((current) => ({
              ...current,
              kind: kind as 'expense' | 'income',
              category: 'other',
            }))
          }
          labels={{ expense: t('finance.expense'), income: t('finance.income') }}
        />
        <Field
          title={t('finance.amount')}
          value={recurring.amount}
          onChangeText={(value) =>
            setRecurring((current) => ({ ...current, amount: value.replace(/[^0-9.]/g, '') }))
          }
          numeric
        />
        <Field
          title={t('finance.description')}
          value={recurring.description || recurring.payee}
          onChangeText={(value) =>
            setRecurring((current) => ({ ...current, payee: value, description: value }))
          }
        />
        <Text style={styles.fieldLabel}>{t('finance.modules.period')}</Text>
        <Choice
          values={['daily', 'weekly', 'monthly', 'yearly']}
          value={recurring.frequency}
          onChange={(frequency) =>
            setRecurring((current) => ({ ...current, frequency: frequency as RecurringFrequency }))
          }
          labels={{
            daily: t('finance.releaseFrequency.daily'),
            weekly: t('finance.releaseFrequency.weekly'),
            monthly: t('finance.releaseFrequency.monthly'),
            yearly: t('finance.releaseFrequency.yearly'),
          }}
        />
        <SearchableSelect
          label={t('finance.category')}
          value={recurring.category}
          options={state.categories[recurring.kind].map((item) => ({
            value: item.id,
            label: item.name ?? t(`finance.categories.${item.id}`, { defaultValue: item.id }),
            icon: item.icon as IconName,
          }))}
          onChange={(category) => setRecurring((current) => ({ ...current, category }))}
          placeholder={t('finance.category')}
          searchPlaceholder={t('finance.search')}
          closeLabel={t('finance.close')}
          emptyLabel={t('finance.modules.noResults')}
          required
        />
        <DateSelect
          label={t('finance.date')}
          value={recurring.nextDate}
          onChange={(nextDate) => setRecurring((current) => ({ ...current, nextDate }))}
          firstDayOfWeek={state.settings.firstDayOfWeek}
        />
        <Pressable
          style={[
            styles.primary,
            (!recurring.accountId || !Number(recurring.amount)) && styles.buttonDisabled,
          ]}
          disabled={!recurring.accountId || !Number(recurring.amount)}
          onPress={addRecurring}
        >
          <Text style={styles.primaryText}>{t('finance.done')}</Text>
        </Pressable>
      </ResponsiveModal>
      <ResponsiveModal visible={debtOpen} onClose={() => setDebtOpen(false)}>
        <Text style={styles.sheetTitle}>{t('finance.release.newDebt')}</Text>
        <Field
          title={t('finance.release.name')}
          value={debt.name}
          onChangeText={(value) => setDebt((current) => ({ ...current, name: value }))}
        />
        <Field
          title={t('finance.release.creditor')}
          value={debt.creditor}
          onChangeText={(value) => setDebt((current) => ({ ...current, creditor: value }))}
        />
        <Text style={styles.fieldLabel}>{t('finance.currency')}</Text>
        <Pressable
          style={styles.currencySelect}
          onPress={() => {
            setCurrencyPickerMode('debt');
            setCurrencyQuery('');
            setCurrencyPickerOpen(true);
          }}
        >
          <Text style={styles.currencySelectCode}>{debt.currency}</Text>
          <Ionicons name="chevron-down-outline" size={17} color={C.gold} />
        </Pressable>
        <Field
          title={t('finance.amount')}
          value={debt.amount}
          onChangeText={(value) =>
            setDebt((current) => ({ ...current, amount: value.replace(/[^0-9.]/g, '') }))
          }
          numeric
          placeholder="0"
        />
        <Field
          title={t('finance.interestReference')}
          value={debt.interest}
          onChangeText={(value) =>
            setDebt((current) => ({ ...current, interest: value.replace(/[^0-9.]/g, '') }))
          }
          numeric
          placeholder="0"
        />
        <DateSelect
          label={t('finance.release.dueDate')}
          value={debt.dueDate}
          onChange={(dueDate) => setDebt((current) => ({ ...current, dueDate }))}
          firstDayOfWeek={state.settings.firstDayOfWeek}
        />
        <Pressable
          style={[
            styles.primary,
            (!debt.name.trim() ||
              !Number.isFinite(Number(debt.amount)) ||
              Number(debt.amount) <= 0 ||
              !Number.isFinite(Number(debt.interest)) ||
              Number(debt.interest) < 0) &&
              styles.buttonDisabled,
          ]}
          disabled={
            !debt.name.trim() ||
            !Number.isFinite(Number(debt.amount)) ||
            Number(debt.amount) <= 0 ||
            !Number.isFinite(Number(debt.interest)) ||
            Number(debt.interest) < 0
          }
          onPress={addDebt}
        >
          <Text style={styles.primaryText}>{t('finance.release.save')}</Text>
        </Pressable>
      </ResponsiveModal>
      <ResponsiveModal visible={savingsOpen} onClose={() => setSavingsOpen(false)}>
        <Text style={styles.sheetTitle}>{t('finance.release.newSavingsGoal')}</Text>
        <Field
          title={t('finance.release.name')}
          value={savings.name}
          onChangeText={(value) => setSavings((current) => ({ ...current, name: value }))}
        />
        <Text style={styles.fieldLabel}>{t('finance.modules.account')}</Text>
        <Choice
          values={operationalAccounts.map((item) => item.id)}
          value={savings.accountId}
          onChange={(accountId) => {
            const selected = operationalAccounts.find((item) => item.id === accountId);
            setSavings((current) => ({
              ...current,
              accountId,
              currency: selected?.currency ?? current.currency,
            }));
          }}
          labels={Object.fromEntries(
            operationalAccounts.map((item) => [item.id, `${item.name} · ${item.currency}`]),
          )}
        />
        <Field
          title={t('finance.release.target')}
          value={savings.target}
          onChangeText={(value) =>
            setSavings((current) => ({ ...current, target: value.replace(/[^0-9.]/g, '') }))
          }
          numeric
          placeholder="0"
        />
        <DateSelect
          label={t('finance.release.deadline')}
          value={savings.deadline}
          onChange={(deadline) => setSavings((current) => ({ ...current, deadline }))}
          firstDayOfWeek={state.settings.firstDayOfWeek}
        />
        <Pressable
          style={[
            styles.primary,
            (!savings.name.trim() ||
              !savings.accountId ||
              !Number.isFinite(Number(savings.target)) ||
              Number(savings.target) <= 0) &&
              styles.buttonDisabled,
          ]}
          disabled={
            !savings.name.trim() ||
            !savings.accountId ||
            !Number.isFinite(Number(savings.target)) ||
            Number(savings.target) <= 0
          }
          onPress={addSavings}
        >
          <Text style={styles.primaryText}>{t('finance.release.save')}</Text>
        </Pressable>
      </ResponsiveModal>
      <ResponsiveModal
        visible={reminderOpen}
        onClose={() => {
          setReminderOpen(false);
          setEditingReminderId(null);
        }}
      >
        <Text style={styles.sheetTitle}>
          {editingReminderId ? t('finance.editReminder') : t('finance.release.newReminder')}
        </Text>
        <Field
          title={t('finance.release.title')}
          value={reminder.title}
          onChangeText={(value) => setReminder((current) => ({ ...current, title: value }))}
        />
        <DateSelect
          label={t('finance.date')}
          value={reminder.date}
          onChange={(date) => setReminder((current) => ({ ...current, date }))}
          firstDayOfWeek={state.settings.firstDayOfWeek}
        />
        <Field
          title={t('finance.release.note')}
          value={reminder.note}
          onChangeText={(value) => setReminder((current) => ({ ...current, note: value }))}
          multiline
        />
        <Pressable
          style={[styles.primary, !reminder.title.trim() && styles.buttonDisabled]}
          disabled={!reminder.title.trim()}
          onPress={addReminder}
        >
          <Text style={styles.primaryText}>{t('finance.release.save')}</Text>
        </Pressable>
      </ResponsiveModal>
      <ResponsiveModal
        visible={Boolean(debtPaymentTarget)}
        onClose={() => {
          setDebtPaymentTarget(null);
          setLinkedActionError('');
        }}
      >
        <Text style={styles.sheetTitle}>{t('finance.modules.registerPayment')}</Text>
        {debtPaymentTarget && (
          <Text style={styles.cardMeta}>
            {debtPaymentTarget.name} ·{' '}
            {t('finance.modules.balanceDue', {
              amount: money(debtPaymentTarget.balance, debtPaymentTarget.currency),
            })}
          </Text>
        )}
        <Text style={styles.fieldLabel}>{t('finance.modules.account')}</Text>
        <Choice
          values={operationalAccounts.map((item) => item.id)}
          value={debtPaymentAccountId}
          onChange={(value) => {
            setDebtPaymentAccountId(value);
            setLinkedActionError('');
          }}
          labels={Object.fromEntries(
            operationalAccounts.map((item) => [item.id, `${item.name} · ${item.currency}`]),
          )}
        />
        <Field
          title={t('finance.amount')}
          value={debtPaymentAmount}
          onChangeText={(value) => {
            setDebtPaymentAmount(value.replace(/[^0-9.]/g, ''));
            setLinkedActionError('');
          }}
          numeric
          placeholder="0"
        />
        {Boolean(debtPaymentValidationError) && (
          <Text style={styles.pinError}>{debtPaymentValidationError}</Text>
        )}
        <Pressable
          style={[styles.primary, !debtPaymentReady && styles.buttonDisabled]}
          disabled={!debtPaymentReady}
          onPress={registerDebtPayment}
        >
          <Text style={styles.primaryText}>{t('finance.done')}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => setDebtPaymentTarget(null)}>
          <Text style={styles.secondaryText}>{t('finance.cancel')}</Text>
        </Pressable>
      </ResponsiveModal>
      <ResponsiveModal
        visible={Boolean(savingsTarget)}
        onClose={() => {
          setSavingsTarget(null);
          setLinkedActionError('');
        }}
      >
        <Text style={styles.sheetTitle}>{t('finance.modules.addContribution')}</Text>
        {savingsTarget && (
          <Text style={styles.cardMeta}>
            {savingsTarget.name} ·{' '}
            {t('finance.modules.goalOf', {
              target: money(savingsTarget.targetAmount, savingsTarget.currency),
            })}
          </Text>
        )}
        {savingsTarget && !savingsTarget.accountId && (
          <>
            <Text style={styles.fieldLabel}>{t('finance.release.destinationAccount')}</Text>
            <Choice
              values={operationalAccounts.map((item) => item.id)}
              value={savingsDestinationAccountId}
              onChange={(value) => {
                setSavingsDestinationAccountId(value);
                setLinkedActionError('');
              }}
              labels={Object.fromEntries(
                operationalAccounts.map((item) => [item.id, `${item.name} · ${item.currency}`]),
              )}
            />
          </>
        )}
        <Text style={styles.fieldLabel}>{t('finance.release.sourceAccount')}</Text>
        <Choice
          values={operationalAccounts
            .filter((item) => item.id !== contributionDestinationId)
            .map((item) => item.id)}
          value={savingsSourceAccountId}
          onChange={(value) => {
            setSavingsSourceAccountId(value);
            setLinkedActionError('');
          }}
          labels={Object.fromEntries(
            operationalAccounts.map((item) => [item.id, `${item.name} · ${item.currency}`]),
          )}
        />
        <Field
          title={t('finance.amount')}
          value={savingsAmount}
          onChangeText={(value) => {
            setSavingsAmount(value.replace(/[^0-9.]/g, ''));
            setLinkedActionError('');
          }}
          numeric
          placeholder="0"
        />
        {Boolean(contributionValidationError) && (
          <Text style={styles.pinError}>{contributionValidationError}</Text>
        )}
        <Pressable
          style={[styles.primary, !contributionReady && styles.buttonDisabled]}
          disabled={!contributionReady}
          onPress={registerSavingsContribution}
        >
          <Text style={styles.primaryText}>{t('finance.done')}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => setSavingsTarget(null)}>
          <Text style={styles.secondaryText}>{t('finance.cancel')}</Text>
        </Pressable>
      </ResponsiveModal>
      <ResponsiveModal visible={budgetOpen} onClose={() => setBudgetOpen(false)}>
        <Text style={styles.sheetTitle}>{t('finance.modules.newCategoryBudget')}</Text>
        <SearchableSelect
          label={t('finance.modules.account')}
          value={budgetDraft.accountId}
          options={accounts.map((item) => ({
            value: item.id,
            label: item.name,
            description: item.currency,
            icon: 'wallet-outline',
          }))}
          onChange={(accountId) => setBudgetDraft((current) => ({ ...current, accountId }))}
          placeholder={t('finance.modules.account')}
          searchPlaceholder={t('finance.search')}
          closeLabel={t('finance.close')}
          emptyLabel={t('finance.modules.noResults')}
          required
        />
        <SearchableSelect
          label={t('finance.category')}
          value={budgetDraft.category}
          options={[
            { value: 'all', label: t('finance.filters.all'), icon: 'apps-outline' },
            ...state.categories.expense.map((item) => ({
              value: item.id,
              label: item.name ?? t(`finance.categories.${item.id}`, { defaultValue: item.id }),
              icon: item.icon as IconName,
            })),
          ]}
          onChange={(category) => setBudgetDraft((current) => ({ ...current, category }))}
          placeholder={t('finance.category')}
          searchPlaceholder={t('finance.search')}
          closeLabel={t('finance.close')}
          emptyLabel={t('finance.modules.noResults')}
          required
        />
        <Text style={styles.fieldLabel}>{t('finance.modules.period')}</Text>
        <Choice
          values={['weekly', 'monthly']}
          value={budgetDraft.period}
          onChange={(period) =>
            setBudgetDraft((current) => ({ ...current, period: period as Budget['period'] }))
          }
          labels={{ weekly: t('finance.modules.weekly'), monthly: t('finance.modules.monthly') }}
        />
        <Field
          title={t('finance.spendingLimit')}
          value={budgetDraft.limit}
          onChangeText={(limit) =>
            setBudgetDraft((current) => ({ ...current, limit: limit.replace(/[^0-9.]/g, '') }))
          }
          numeric
          placeholder="0"
        />
        <Pressable
          style={[
            styles.primary,
            (!budgetDraft.accountId || !Number(budgetDraft.limit)) && styles.buttonDisabled,
          ]}
          disabled={!budgetDraft.accountId || !Number(budgetDraft.limit)}
          onPress={addBudget}
        >
          <Text style={styles.primaryText}>{t('finance.done')}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => setBudgetOpen(false)}>
          <Text style={styles.secondaryText}>{t('finance.cancel')}</Text>
        </Pressable>
      </ResponsiveModal>
      <ConfirmDialog
        visible={Boolean(pendingFinanceImport)}
        title={t('finance.releaseExtra.importData')}
        message={t(
          pendingFinanceImport?.kind === 'finance'
            ? 'finance.releaseImport.financeImportConfirm'
            : 'finance.releaseImport.fullImportConfirm',
        )}
        cancelLabel={t('finance.cancel')}
        confirmLabel={t('finance.releaseExtra.importData')}
        icon="cloud-download-outline"
        destructive
        onCancel={() => setPendingFinanceImport(null)}
        onConfirm={() => void confirmFinanceImport()}
      />
      <Modal visible={importBusy} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.importBackdrop}>
          <View style={styles.importCard}>
            <ActivityIndicator size="large" color={C.gold} />
            <Text style={styles.importTitle}>{t('finance.releaseImport.importing')}</Text>
            <Text style={styles.importCopy}>{t('finance.releaseImport.importingCopy')}</Text>
          </View>
        </View>
      </Modal>
      <ConfirmDialog
        visible={Boolean(confirmPrompt)}
        title={confirmPrompt?.title ?? ''}
        message={confirmPrompt?.message ?? ''}
        cancelLabel={t('finance.cancel')}
        confirmLabel={confirmPrompt?.confirmLabel ?? t('finance.done')}
        icon={confirmPrompt?.icon}
        destructive={confirmPrompt?.destructive ?? true}
        onCancel={() => setConfirmPrompt(null)}
        onConfirm={() => {
          const action = confirmPrompt?.onConfirm;
          setConfirmPrompt(null);
          action?.();
        }}
      />
    </SafeAreaView>
  );
}

const styles = createThemeStyles((C) =>
  StyleSheet.create({
    accountTypeChoices: { gap: 8, paddingBottom: 4 },
    accountTypeLabel: { marginTop: 14 },
    historyRow: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.08)',
    },
    accountTypeChoice: {
      minHeight: 44,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.035)',
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    accountTypeChoiceActive: { borderColor: C.gold, backgroundColor: C.gold },
    accountTypeText: {
      color: 'rgba(255,244,208,0.55)',
      fontFamily: SANS,
      fontSize: 9,
      fontWeight: '600',
    },
    accountTypeTextActive: { color: C.void },
    categoryListHeader: {
      minHeight: 47,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.1)',
    },
    categoryAddButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
    },
    currencySelect: {
      minHeight: 54,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.04)',
      paddingHorizontal: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 2,
    },
    currencySelectIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: 'rgba(233,200,119,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencySelectCopy: { flex: 1, minWidth: 0 },
    currencySelectCode: {
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    currencySelectHint: {
      color: 'rgba(255,244,208,0.36)',
      fontFamily: SANS,
      fontSize: 8.5,
      marginTop: 3,
    },
    currencyPickerBackdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 34,
      backgroundColor: 'rgba(0,0,0,0.78)',
    },
    currencyPickerSheet: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '82%',
      alignSelf: 'center',
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: '#0A0C14',
      padding: 16,
      overflow: 'hidden',
    },
    currencyPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    currencySearch: {
      height: 44,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: C.glass,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    currencySearchInput: {
      flex: 1,
      minWidth: 0,
      height: 43,
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: FORM_TYPOGRAPHY.input,
      paddingVertical: 0,
    },
    currencyOption: {
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.09)',
      paddingHorizontal: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    currencyOptionActive: { backgroundColor: 'rgba(233,200,119,0.055)' },
    currencyOptionMark: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencyOptionMarkText: { color: C.gold, fontFamily: SERIF, fontSize: 14 },
    currencyOptionCode: {
      flex: 1,
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.8,
    },
    settingsOptionList: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      overflow: 'hidden',
      marginBottom: 18,
    },
    fullHeightEmpty: { flex: 1, minHeight: 250, justifyContent: 'center', paddingVertical: 24 },
    activitySummaryNet: { color: C.gold, fontFamily: SERIF, fontSize: 14, marginTop: 5 },
    activitySelectorLabel: {
      color: C.textSubtle,
      fontFamily: SANS,
      fontSize: 11,
      marginBottom: 10,
    },
    activitySelectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 12 },
    activitySelectorTile: {
      flexBasis: '46%',
      flexGrow: 1,
      minWidth: 0,
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 10,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.line,
      backgroundColor: C.glass,
    },
    activitySelectorWide: { flexBasis: '100%' },
    activitySelectorSelected: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.08)' },
    activitySelectorIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.glass,
    },
    activitySelectorIconSelected: { backgroundColor: C.gold },
    activitySelectorText: { flex: 1, color: C.textSubtle, fontFamily: SANS, fontSize: 12 },
    activitySelectorTextSelected: { color: C.goldLight, fontWeight: '700' },
    activityAccountBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
    activityAccountTabs: { gap: 4 },
    activityAccountTab: {
      minHeight: 46,
      maxWidth: 190,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activityAccountTabActive: {
      borderBottomColor: C.gold,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      backgroundColor: C.glass,
    },
    activityAccountText: { flexShrink: 1, color: C.textSubtle, fontFamily: SANS, fontSize: 12 },
    activityAccountTextActive: { color: C.goldLight, fontWeight: '700' },
    activityPeriodTrigger: {
      minHeight: 44,
      maxWidth: '65%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: C.glass,
    },
    activityActiveFilters: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
    activityActiveFilterText: { color: C.gold, fontFamily: SANS, fontSize: 11, textAlign: 'right' },
    activityScopeSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 3,
      paddingVertical: 10,
    },
    activityScopeText: { flexShrink: 1, color: C.textSubtle, fontFamily: SANS, fontSize: 12 },
    activityResultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 22,
      paddingHorizontal: 3,
    },
    activityHistoryTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 15, fontWeight: '600' },
    activityAmountText: { color: C.goldLight, fontFamily: SERIF, fontSize: 16 },
    activityNotice: {
      color: C.textSubtle,
      fontFamily: SANS,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 10,
    },
    activityFilterFooter: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 28,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.line,
    },
    activityDoneButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: C.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityView: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
    activityToolbar: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
    activityListHeader: { paddingTop: 2, paddingBottom: 7 },
    activitySummaryStrip: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.line,
    },
    activitySummaryMetric: { flex: 1, minWidth: 0 },
    activitySummaryLabel: { color: C.textSubtle, fontFamily: SANS, fontSize: 10 },
    activitySummaryIncome: { color: C.goldLight, fontFamily: SERIF, fontSize: 14, marginTop: 5 },
    activitySummaryExpense: { color: C.red, fontFamily: SERIF, fontSize: 14, marginTop: 5 },
    activitySummaryDivider: {
      width: StyleSheet.hairlineWidth,
      height: 30,
      backgroundColor: C.line,
      marginHorizontal: 8,
    },
    activityResultsLabel: { color: C.textSubtle, fontFamily: SANS, fontSize: 12 },
    activitySearch: {
      flex: 1,
      minWidth: 0,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: C.glass,
      paddingHorizontal: 13,
    },
    activitySearchInput: {
      flex: 1,
      minWidth: 0,
      height: 46,
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: 12,
      paddingVertical: 0,
    },
    activityFilterButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.045)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityFilterButtonActive: { backgroundColor: C.gold, borderColor: C.gold },
    activityFilterBadge: {
      position: 'absolute',
      top: -4,
      right: -3,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.goldLight,
      borderWidth: 1,
      borderColor: C.void,
    },
    activityFilterBadgeText: { color: C.void, fontFamily: SANS, fontSize: 8, fontWeight: '800' },
    activityList: { flex: 1, paddingTop: 3 },
    activityListContent: { flexGrow: 1, paddingBottom: 24 },
    activityEmptyState: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 18,
    },
    activityGroup: { marginBottom: 18 },
    activityGroupTitle: {
      color: 'rgba(233,200,119,0.7)',
      fontFamily: SANS,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 3,
      paddingHorizontal: 3,
    },
    activityRow: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.11)',
      paddingVertical: 8,
    },
    activityRowMain: { flex: 1, minWidth: 0 },
    activityRowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 14, fontWeight: '500' },
    activityRowMeta: {
      color: 'rgba(255,244,208,0.43)',
      fontFamily: SANS,
      fontSize: 9.5,
      marginTop: 5,
    },
    activityRowAmount: { maxWidth: '42%', minWidth: 72, alignItems: 'flex-end', marginLeft: 3 },
    activityTime: {
      color: 'rgba(255,244,208,0.34)',
      fontFamily: SANS,
      fontSize: 8.5,
      marginTop: 5,
    },
    activityIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(233,200,119,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityIncomeIcon: { backgroundColor: 'rgba(183,173,132,0.08)' },
    activityFilterBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.64)',
    },
    activityFilterSheet: {
      width: '100%',
      maxWidth: 620,
      height: '86%',
      maxHeight: 720,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: '#0A0C14',
      overflow: 'hidden',
    },
    activityDragZone: { height: 28, alignItems: 'center', justifyContent: 'center' },
    activityDragHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,244,208,0.28)',
    },
    activityFilterHeader: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.13)',
    },
    activityFilterHeaderCopy: { flex: 1, minWidth: 0 },
    activityFilterEyebrow: {
      color: 'rgba(233,200,119,0.56)',
      fontFamily: SANS,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1.35,
    },
    activityFilterTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 22, marginTop: 3 },
    activityFilterClose: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.045)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityFilterScroll: { flex: 1 },
    activityFilterContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30 },
    activityClearFilters: {
      minHeight: 44,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 10,
      marginTop: 14,
    },
    activityEmptyReset: { marginTop: 22 },
    activityPagination: { alignItems: 'center', gap: 12, paddingTop: 24, paddingBottom: 12 },
    activityPaginationRange: { color: C.textSubtle, fontFamily: SANS, fontSize: 11 },
    activityPaginationControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    activityPageButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: C.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityPageLabel: {
      minWidth: 100,
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: 11,
      textAlign: 'center',
    },
    activityClearFiltersText: {
      color: C.gold,
      fontFamily: SANS,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    chartCategory: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(233,200,119,0.07)',
      padding: 14,
      marginBottom: 18,
    },
    addAction: {
      alignSelf: 'flex-start',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
      marginTop: 12,
    },
    addActionIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: C.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addActionText: {
      color: C.gold,
      fontFamily: SANS,
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    summaryAmount: { color: C.goldLight, fontFamily: SERIF, fontSize: 28 },
    smallAction: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.025)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
    inlineButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.45)',
      backgroundColor: 'rgba(233,200,119,0.055)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineButtonText: {
      color: C.gold,
      fontFamily: SANS,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    toggleRow: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    responsiveModalHeader: { height: 44, alignItems: 'flex-end', justifyContent: 'center' },
    sheetClose: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.07)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderCheck: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderCheckDone: { backgroundColor: C.green, borderColor: C.green },
    reminderCheckOverdue: {
      borderColor: 'rgba(240,139,136,0.55)',
      backgroundColor: 'rgba(240,139,136,0.08)',
    },
    overdueText: { color: C.red },
    settingsOption: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.1)',
    },
    settingsOptionText: { color: C.textMuted, fontFamily: SANS, fontSize: 11.5, lineHeight: 17 },
    settingsOptionTextActive: { color: C.goldLight, fontWeight: '700' },
    rateSwap: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 6,
      marginTop: 4,
    },
    rateSwapText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '600' },
    settingsRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.1)',
    },
    settingsRowMain: { flex: 1, minWidth: 0 },
    settingsRowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12.5, fontWeight: '600' },
    settingsRowValue: {
      color: C.textSubtle,
      fontFamily: SANS,
      fontSize: 10.5,
      lineHeight: 15,
      marginTop: 4,
    },
    settingsBack: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 10,
    },
    settingsBackText: {
      color: C.gold,
      fontFamily: SANS,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    iconPreviewRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      paddingHorizontal: 10,
      marginBottom: 8,
    },
    iconPreviewButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: 'rgba(233,200,119,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconPreviewText: { flex: 1, color: 'rgba(255,244,208,0.46)', fontFamily: SANS, fontSize: 9 },
    iconPickerBackdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: 18,
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
    iconPickerSheet: {
      maxHeight: '78%',
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: '#0A0C14',
      padding: 18,
    },
    iconPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconPickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingTop: 10,
      paddingBottom: 4,
    },
    iconPickerChoice: {
      width: 46,
      height: 46,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.045)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountAmount: { alignItems: 'flex-end', marginLeft: 8 },
    categoryTabShell: {
      height: 50,
      marginHorizontal: -14,
      marginTop: -14,
      marginBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.11)',
    },
    categoryTabRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 10 },
    categoryTab: {
      flex: 1,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    categoryTabActive: { borderBottomColor: C.gold },
    categoryTabText: {
      color: 'rgba(255,244,208,0.42)',
      fontFamily: SANS,
      fontSize: 10.5,
      letterSpacing: 0.5,
    },
    categoryTabTextActive: { color: C.goldLight, fontWeight: '600' },
    toolGrid: { gap: 8 },
    toolCard: {
      minHeight: 62,
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.16)',
      backgroundColor: 'rgba(255,255,255,0.025)',
      paddingHorizontal: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    toolCardActive: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.12)' },
    toolCardIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.2)',
      backgroundColor: 'rgba(233,200,119,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolCardIconActive: { backgroundColor: C.gold, borderColor: C.gold },
    toolCardTitle: {
      flex: 1,
      minWidth: 0,
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: 10.5,
      lineHeight: 14,
    },
    toolCardTitleActive: { color: C.goldLight, fontWeight: '700' },
    toolBack: {
      alignSelf: 'flex-start',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 10,
    },
    toolBackText: {
      color: C.gold,
      fontFamily: SANS,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
    },
    toolWorkspace: { paddingTop: 2 },
    toolWorkspaceTitle: {
      color: C.gold,
      fontFamily: SANS,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 8,
    },
    calculatorDisplay: {
      minHeight: 128,
      paddingHorizontal: 8,
      paddingVertical: 12,
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      marginBottom: 14,
    },
    calculatorExpression: {
      width: '100%',
      color: 'rgba(255,244,208,0.48)',
      fontFamily: SANS,
      fontSize: 24,
      textAlign: 'right',
    },
    calculatorAnswer: {
      width: '100%',
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: 46,
      fontWeight: '300',
      textAlign: 'right',
      marginTop: 6,
    },
    calculatorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
    },
    calculatorKey: {
      width: '22.5%',
      aspectRatio: 1,
      maxHeight: 70,
      borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.105)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    calculatorUtilityKey: { backgroundColor: 'rgba(255,244,208,0.62)' },
    calculatorOperatorKey: { backgroundColor: C.gold },
    calculatorKeyText: {
      color: '#FFF8E9',
      fontFamily: SANS,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '500',
      includeFontPadding: false,
      textAlignVertical: 'center',
      textAlign: 'center',
    },
    calculatorUtilityText: { color: C.void },
    calculatorOperatorText: {
      color: C.void,
      fontSize: 23,
      lineHeight: 27,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    cashSummary: {
      borderRadius: 17,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.2)',
      backgroundColor: 'rgba(233,200,119,0.07)',
      padding: 15,
      marginBottom: 15,
    },
    cashTotal: { color: C.goldLight, fontFamily: SERIF, fontSize: 30, marginBottom: 3 },
    cashTableHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
    cashRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cashDenomination: { flex: 1.15, minWidth: 0, marginTop: 0, marginBottom: 0 },
    cashQuantity: { flex: 0.8, minWidth: 0, marginTop: 0, marginBottom: 0 },
    cashMultiply: {
      width: 12,
      color: 'rgba(255,244,208,0.4)',
      fontFamily: SANS,
      fontSize: 14,
      textAlign: 'center',
    },
    cashDelete: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(240,139,136,0.06)',
    },
    cashDeleteSpace: { width: 44 },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    calendarArrow: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarMonth: {
      color: C.goldLight,
      fontFamily: SERIF,
      fontSize: 19,
      textTransform: 'capitalize',
    },
    calendarWeekdays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    calendarWeekday: {
      width: '13.4%',
      color: 'rgba(255,244,208,0.36)',
      fontFamily: SANS,
      fontSize: 7,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 5,
    },
    calendarCell: {
      width: '13.4%',
      minHeight: 58,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.14)',
      backgroundColor: 'rgba(255,255,255,0.025)',
      padding: 5,
    },
    calendarCellSelected: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.12)' },
    calendarCellMuted: { opacity: 0.22 },
    calendarDay: { color: C.goldLight, fontFamily: SANS, fontSize: 9, marginBottom: 4 },
    calendarIncome: { color: C.green, fontFamily: SANS, fontSize: 7, minHeight: 10 },
    calendarExpense: { color: C.red, fontFamily: SANS, fontSize: 7, minHeight: 10 },
    calendarLegend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 12 },
    calendarDetails: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.line,
      marginTop: 14,
      paddingTop: 14,
    },
    calendarDetailRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.08)',
    },
    addCategoryItem: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.line,
      marginTop: 4,
    },
    addCategoryText: { color: C.gold, fontFamily: SANS, fontSize: 10, letterSpacing: 0.8 },
    settingsDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.line,
      marginVertical: 20,
    },
    settingsTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 18, marginTop: 4 },
    pinError: { color: C.red, fontFamily: SANS, fontSize: 10, marginTop: 8 },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(233,200,119,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleContent: { paddingTop: 24 },
    moduleActivityContent: { flex: 1, paddingBottom: 0 },
    buttonDisabled: { opacity: 0.42 },
    dangerButton: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.red,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    dangerButtonText: {
      color: C.red,
      fontFamily: SANS,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    progressIntro: { paddingHorizontal: 2, marginBottom: 14 },
    progressTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 26, marginTop: 3 },
    progressCopy: {
      color: 'rgba(255,244,208,0.58)',
      fontFamily: SANS,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 7,
    },
    progressCard: {
      borderRadius: 19,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.24)',
      backgroundColor: 'rgba(233,200,119,0.07)',
      padding: 14,
    },
    progressTreeArt: {
      height: 182,
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      overflow: 'hidden',
    },
    progressCrown: {
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 1,
      borderColor: 'rgba(233,200,119,0.44)',
      backgroundColor: 'rgba(233,200,119,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    progressTrunk: {
      position: 'absolute',
      width: 2,
      height: 58,
      backgroundColor: 'rgba(233,200,119,0.4)',
      top: 88,
    },
    progressBranchLeft: {
      position: 'absolute',
      width: 54,
      height: 2,
      backgroundColor: 'rgba(233,200,119,0.3)',
      top: 120,
      left: '25%',
      transform: [{ rotate: '-27deg' }],
    },
    progressBranchRight: {
      position: 'absolute',
      width: 54,
      height: 2,
      backgroundColor: 'rgba(233,200,119,0.3)',
      top: 120,
      right: '25%',
      transform: [{ rotate: '27deg' }],
    },
    progressNodes: {
      position: 'absolute',
      top: 139,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    progressNode: {
      width: 27,
      height: 27,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.25)',
      backgroundColor: 'rgba(10,12,20,0.46)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressNodeActive: { borderColor: C.gold, backgroundColor: C.gold },
    progressSummary: {
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(233,200,119,0.16)',
      paddingTop: 14,
    },
    progressTrack: {
      width: '100%',
      height: 6,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
      marginTop: 12,
    },
    progressFill: { height: '100%', borderRadius: 4 },
    progressLevelLabel: {
      color: C.gold,
      fontFamily: SANS,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
    progressPoints: { color: C.goldLight, fontFamily: SERIF, fontSize: 34, marginTop: 3 },
    progressPointsUnit: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11 },
    progressNext: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 10, marginTop: 7 },
    progressRule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 3,
      marginTop: 14,
    },
    rootBackground: { backgroundColor: C.background },
    aboutCompact: { alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
    formSheet: {
      width: '100%',
      maxWidth: 620,
      maxHeight: '90%',
      borderRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(233,200,119,0.11)',
      backgroundColor: '#0A0C14',
    },
    formSheetContent: { paddingHorizontal: 18, paddingBottom: 22 },
    formField: { marginTop: 8 },
    formFieldLabel: {
      color: 'rgba(233,200,119,0.54)',
      fontFamily: SANS,
      fontSize: FORM_TYPOGRAPHY.label,
      lineHeight: 14,
      marginBottom: 1,
      letterSpacing: 0.25,
    },
    formInputRow: { position: 'relative' },
    formInput: {
      minHeight: 43,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.16)',
      backgroundColor: 'transparent',
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: FORM_TYPOGRAPHY.input,
      paddingHorizontal: 2,
      paddingVertical: 8,
    },
    formInputWithVisibility: { paddingRight: 42 },
    formInputFocused: { borderBottomColor: C.gold },
    formInputVisibility: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: 42,
      height: 43,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formMultiline: { minHeight: 82, textAlignVertical: 'top', paddingTop: 10 },
    formChoices: { gap: 6, paddingVertical: 7 },
    formChoice: {
      minHeight: 40,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.025)',
      paddingHorizontal: 11,
      justifyContent: 'center',
    },
    formChoiceActive: { backgroundColor: 'rgba(233,200,119,0.14)' },
    formChoiceText: {
      color: 'rgba(255,244,208,0.58)',
      fontFamily: SANS,
      fontSize: FORM_TYPOGRAPHY.option,
    },
    formChoiceTextActive: { color: C.goldLight, fontWeight: '700' },
    root: { flex: 1, backgroundColor: C.void },
    header: {
      height: 78,
      paddingTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.line,
    },
    back: { width: 42 },
    backText: { color: C.goldLight, fontSize: 34, fontWeight: '200' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: C.goldLight,
      fontFamily: SERIF,
      fontSize: 21,
    },
    headerSpace: { width: 42 },
    content: { paddingHorizontal: 18, paddingBottom: 50 },
    panel: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      borderRadius: 19,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(10,12,20,0.72)',
      padding: 14,
      marginBottom: 15,
    },
    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(233,200,119,0.1)',
    },
    rowMain: { flex: 1, minWidth: 0 },
    accountStripe: { width: 5, height: 38, borderRadius: 3 },
    cardTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13 },
    cardMeta: { color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 11, marginTop: 4 },
    positive: { color: C.goldLight, fontFamily: SERIF, fontSize: 14 },
    negative: { color: C.red, fontFamily: SERIF, fontSize: 14 },
    primary: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: C.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    primaryText: {
      color: C.void,
      fontFamily: SANS,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    secondary: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    secondaryText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' },
    danger: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.red,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    dangerText: { color: C.red, fontFamily: SANS, fontSize: 11, fontWeight: '700' },
    module: {
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.line,
    },
    body: {
      color: 'rgba(255,244,208,0.72)',
      fontFamily: SANS,
      fontSize: 13,
      lineHeight: 20,
      marginVertical: 10,
    },
    track: {
      height: 6,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
      marginVertical: 9,
    },
    fill: { height: '100%', borderRadius: 4, backgroundColor: C.gold },
    chart: { marginBottom: 14 },
    chartTop: { flexDirection: 'row', justifyContent: 'space-between' },
    check: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.gold,
      color: C.gold,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    checkDone: { backgroundColor: C.gold, borderColor: C.gold, color: C.void },
    strike: { textDecorationLine: 'line-through', opacity: 0.5 },
    toolResult: { color: C.goldLight, fontFamily: SERIF, fontSize: 29, marginBottom: 15 },
    toolChoices: { gap: 7, paddingBottom: 8 },
    toolChoice: {
      minHeight: 44,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.045)',
      paddingHorizontal: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    toolChoiceActive: { backgroundColor: C.gold, borderColor: C.gold },
    toolChoiceText: { color: 'rgba(255,244,208,0.62)', fontFamily: SANS, fontSize: 11 },
    toolChoiceTextActive: { color: C.void, fontWeight: '700' },
    menuLink: {
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.line,
    },
    field: { marginTop: 11 },
    fieldLabel: {
      color: 'rgba(233,200,119,0.72)',
      fontFamily: SANS,
      fontSize: FORM_TYPOGRAPHY.label,
      letterSpacing: 1,
      marginBottom: 6,
    },
    input: {
      minHeight: 48,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.045)',
      color: C.goldLight,
      fontFamily: SANS,
      fontSize: FORM_TYPOGRAPHY.input,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
    import: { minHeight: 210, textAlignVertical: 'top', marginTop: 12 },
    choices: { gap: 7, paddingVertical: 8 },
    choice: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      paddingHorizontal: 12,
      justifyContent: 'center',
    },
    choiceActive: { backgroundColor: 'rgba(233,200,119,0.14)', borderColor: C.gold },
    choiceText: {
      color: 'rgba(255,244,208,0.62)',
      fontFamily: SANS,
      fontSize: FORM_TYPOGRAPHY.option,
    },
    choiceTextActive: { color: C.goldLight },
    iconChoices: { gap: 8, paddingVertical: 8 },
    iconChoice: {
      width: 44,
      height: 44,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(255,255,255,0.045)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconChoiceActive: { backgroundColor: C.gold, borderColor: C.gold },
    categoryRowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: 'rgba(233,200,119,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryRowName: { flex: 1 },
    empty: { alignItems: 'center', paddingVertical: 28 },
    diamond: {
      width: 22,
      height: 22,
      borderWidth: 1,
      borderColor: C.gold,
      transform: [{ rotate: '45deg' }],
      marginBottom: 15,
    },
    emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13 },
    emptyBody: {
      color: 'rgba(255,244,208,0.52)',
      fontFamily: SANS,
      fontSize: 11,
      marginTop: 7,
      textAlign: 'center',
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
    modalBackdropTablet: { justifyContent: 'center', padding: 28 },
    sheet: {
      width: '100%',
      maxWidth: 620,
      maxHeight: '90%',
      borderRadius: 25,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: '#0A0C14',
      padding: 18,
    },
    sheetTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 23, marginBottom: 12 },
    about: { color: C.gold, fontFamily: SERIF, fontSize: 48, textAlign: 'center', marginTop: 20 },
    aboutTitle: {
      color: C.goldLight,
      fontFamily: SERIF,
      fontSize: 24,
      textAlign: 'center',
      marginBottom: 12,
    },
    importBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(0,0,0,0.76)',
    },
    importCard: {
      width: '100%',
      maxWidth: 330,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
      backgroundColor: '#0A0C14',
      padding: 24,
      alignItems: 'center',
    },
    importTitle: {
      color: C.goldLight,
      fontFamily: SERIF,
      fontSize: 21,
      marginTop: 14,
      textAlign: 'center',
    },
    importCopy: {
      color: C.textSubtle,
      fontFamily: SANS,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 7,
      textAlign: 'center',
    },
  }),
);
