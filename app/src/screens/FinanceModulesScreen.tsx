import React from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../core/finance/FinanceContext';
import { DEFAULT_COLORS, exportCsv, exportJson } from '../core/finance/storage';
import { hashPin } from '../core/pin';
import { supportedLanguages } from '../core/locales/i18next';
import type { Account, AppLanguage, FinanceCategory, RecurringFrequency, RecurringTransaction } from '../core/finance/types';
import { C, SANS, SERIF } from '../theme/luxury';

export type FinanceModuleName = 'accounts' | 'reminders' | 'debt' | 'notes' | 'tools' | 'savings' | 'budget' | 'calendar' | 'charts' | 'activity' | 'recurring' | 'categories' | 'more' | 'settings' | 'about';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const money = (value: number, currency: string) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
const dateText = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ToolKey = 'calculator' | 'currency' | 'discountTax' | 'interest';
type SettingsSection = 'language' | 'currency' | 'pin' | 'data';
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
const TOOL_OPTIONS: { key: ToolKey; icon: IconName }[] = [
  { key: 'calculator', icon: 'calculator-outline' },
  { key: 'currency', icon: 'swap-horizontal-outline' },
  { key: 'discountTax', icon: 'pricetag-outline' },
  { key: 'interest', icon: 'trending-up-outline' },
];
const CURRENCY_OPTIONS = ['USD', 'CUP', 'EUR'];

function Field({ title, value, onChangeText, placeholder, multiline = false, numeric = false, secureTextEntry = false, maxLength }: { title: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; numeric?: boolean; secureTextEntry?: boolean; maxLength?: number }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{title}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,244,208,0.3)" keyboardType={numeric ? 'number-pad' : 'default'} multiline={multiline} secureTextEntry={secureTextEntry} maxLength={maxLength} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function Choice({ values, value, onChange, labels }: { values: string[]; value: string; onChange: (value: string) => void; labels?: Record<string, string> }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>{values.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[styles.choice, item === value && styles.choiceActive]}><Text style={[styles.choiceText, item === value && styles.choiceTextActive]}>{labels?.[item] ?? item}</Text></Pressable>)}</ScrollView>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><View style={styles.diamond} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function BackButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back-outline" size={19} color={C.goldLight} /></Pressable>;
}

export default function FinanceModulesScreen({ module: initialModule, onBack }: { module: FinanceModuleName; onBack: () => void }) {
  const { t, i18n: translationI18n } = useTranslation();
  const finance = useFinance();
  const { state, loaded } = finance;
  const [module, setModule] = React.useState<FinanceModuleName>(initialModule);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [account, setAccount] = React.useState({ name: '', type: 'cash' as Account['type'], currency: 'USD', opening: '', exchangeRate: '', color: DEFAULT_COLORS[0] });
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [accountError, setAccountError] = React.useState('');
  const promptedAccountRef = React.useRef<string | null>(null);
  const [recurringOpen, setRecurringOpen] = React.useState(false);
  const [recurring, setRecurring] = React.useState({ accountId: '', kind: 'expense' as 'expense' | 'income', amount: '', payee: '', category: 'other', frequency: 'monthly' as RecurringFrequency, nextDate: new Date().toISOString(), description: '' });
  const [debtOpen, setDebtOpen] = React.useState(false);
  const [debt, setDebt] = React.useState({ name: '', creditor: '', currency: 'USD', amount: '', dueDate: new Date().toISOString(), interest: '0' });
  const [savingsOpen, setSavingsOpen] = React.useState(false);
  const [savings, setSavings] = React.useState({ name: '', currency: 'USD', target: '', deadline: new Date().toISOString() });
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [reminder, setReminder] = React.useState({ title: '', date: new Date().toISOString(), note: '' });
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [note, setNote] = React.useState({ title: '', body: '', tags: '' });
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
  const [currencyAmount, setCurrencyAmount] = React.useState('');
  const [fromCurrency, setFromCurrency] = React.useState('USD');
  const [toCurrency, setToCurrency] = React.useState('EUR');
  const [rate, setRate] = React.useState('1');
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
  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date());
  const [settingsSection, setSettingsSection] = React.useState<SettingsSection | null>(null);
  const [currencyRateCurrency, setCurrencyRateCurrency] = React.useState('USD');
  const [currencyRate, setCurrencyRate] = React.useState('1');
  const [currencyRateError, setCurrencyRateError] = React.useState('');

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
  const rateBetweenCurrencies = React.useCallback((fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) return 1;
    const fromRate = currencyRates[fromCurrency] ?? (fromCurrency === 'USD' ? 1 : undefined);
    const toRate = currencyRates[toCurrency] ?? (toCurrency === 'USD' ? 1 : undefined);
    return fromRate && toRate ? fromRate / toRate : undefined;
  }, [currencyRates]);
  const accountBalance = (item: Account) => state.transactions.filter((transaction) => transaction.accountId === item.id && transaction.status !== 'void').reduce((total, transaction) => transaction.kind === 'income' || transaction.kind === 'adjustment' ? total + transaction.amount : total - transaction.amount, item.openingBalance);

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountError('');
    setAccount({ name: '', type: 'cash', currency: baseCurrency, opening: '', exchangeRate: '', color: DEFAULT_COLORS[0] });
    setAccountOpen(true);
  };
  const openAccountEditor = (item: Account) => {
    setEditingAccount(item);
    setAccountError('');
    setAccount({ name: item.name, type: item.type, currency: item.currency, opening: String(item.openingBalance), exchangeRate: item.exchangeRate ? String(item.exchangeRate) : '', color: item.color });
    setAccountOpen(true);
  };
  const closeAccountEditor = () => {
    setAccountOpen(false);
    setEditingAccount(null);
    setAccountError('');
  };
  const saveAccount = () => {
    if (!account.name.trim()) return;
    const currency = account.currency.toUpperCase() || baseCurrency;
    const exchangeRate = currency === baseCurrency ? 1 : rateBetweenCurrencies(currency, baseCurrency) ?? Number(account.exchangeRate);
    if (currency !== baseCurrency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      setAccountError(t('finance.exchangeRateRequired', { defaultValue: `Enter the exchange rate from ${currency} to ${baseCurrency}.` }));
      return;
    }
    const values = { name: account.name.trim(), type: account.type, currency, exchangeRate, openingBalance: Number(account.opening) || 0, color: account.color, archived: false };
    if (editingAccount) finance.updateAccount({ ...editingAccount, ...values });
    else finance.addAccount({ id: uid('account'), ...values });
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
  React.useEffect(() => {
    if (!loaded || module !== 'accounts') return;
    const accountNeedingRate = accounts.find((item) => item.currency !== baseCurrency && !item.exchangeRate && !rateBetweenCurrencies(item.currency, baseCurrency));
    if (accountNeedingRate && promptedAccountRef.current !== accountNeedingRate.id) {
      promptedAccountRef.current = accountNeedingRate.id;
      openAccountEditor(accountNeedingRate);
    }
  }, [accounts, baseCurrency, loaded, module, rateBetweenCurrencies]);
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
    if (!savings.name.trim() || !Number(savings.target)) return;
    finance.addSavingsGoal({ id: uid('goal'), name: savings.name.trim(), currency: savings.currency.toUpperCase(), targetAmount: Number(savings.target), balance: 0, deadline: savings.deadline, contributions: [], active: true }); setSavingsOpen(false);
  };
  const addReminder = () => {
    if (!reminder.title.trim()) return;
    finance.addReminder({ id: uid('reminder'), title: reminder.title.trim(), date: reminder.date, note: reminder.note, completed: false }); setReminderOpen(false);
  };
  const addNote = () => {
    if (!note.title.trim() && !note.body.trim()) return;
    const now = new Date().toISOString(); finance.addNote({ id: uid('note'), title: note.title || t('finance.untitled'), body: note.body, tags: note.tags.split(',').map((item) => item.trim()).filter(Boolean), createdAt: now, updatedAt: now, pinned: false }); setNoteOpen(false);
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
    finance.updateCategories({ ...state.categories, [type]: state.categories[type].filter((item) => item.id !== categoryId) });
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
      if (!finance.importJson(importText)) Alert.alert('Import failed', 'The JSON backup is invalid.'); else setImportOpen(false);
    } else if (accounts[0]) {
      const errors = finance.importCsvText(importText, accounts[0].id); setImportOpen(false); if (errors.length) Alert.alert('CSV warnings', errors.join('\n'));
    }
    setImportText('');
  };
  const share = async (format: 'json' | 'csv') => Share.share({ title: `Solid Gold Rich ${format}`, message: format === 'json' ? exportJson(state) : exportCsv(state) });

  const toolNumber = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const toolMoney = (value: number, currency = '') => Number.isFinite(value) ? `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
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

  const renderActivity = () => <View style={styles.panel}>{state.transactions.length ? state.transactions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => <View key={item.id} style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.payee || item.description || item.category}</Text><Text style={styles.cardMeta}>{item.category} · {dateText(item.date)} · {item.status}</Text></View><Text style={item.kind === 'income' ? styles.positive : styles.negative}>{item.kind === 'income' ? '+' : '-'}{money(item.amount, item.currency)}</Text></View>) : <Empty title="No activity" body="Your movements will appear here." />}</View>;
  const renderAccounts = () => (
    <View style={styles.panel}>
      {accounts.map((item) => (
        <Pressable key={item.id} style={styles.row} onPress={() => openAccountEditor(item)}>
          <View style={[styles.accountStripe, { backgroundColor: item.color }]} />
          <View style={styles.rowMain}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>{item.type.toUpperCase()} · {item.currency}{item.currency !== baseCurrency ? ` · 1 ${item.currency} = ${item.exchangeRate ?? '?'} ${baseCurrency}` : ''}</Text>
          </View>
          <View style={styles.accountAmount}>
            <Text style={styles.positive}>{money(accountBalance(item), item.currency)}</Text>
            {item.currency !== baseCurrency && <Text style={styles.cardMeta}>≈ {money(accountBalance(item) * (rateBetweenCurrencies(item.currency, baseCurrency) ?? item.exchangeRate ?? 1), baseCurrency)}</Text>}
          </View>
          <Ionicons name="chevron-forward-outline" size={17} color="rgba(255,244,208,0.35)" />
        </Pressable>
      ))}
      {!accounts.length && <Empty title="No accounts" body="Create your first account." />}
      <Pressable style={styles.primary} onPress={openNewAccount}><Text style={styles.primaryText}>+ ACCOUNT</Text></Pressable>
    </View>
  );
  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totals = new Map<string, { income: number; expense: number }>();
    state.transactions.forEach((item) => {
      const date = new Date(item.date);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      const key = `${year}-${month}-${date.getDate()}`;
      const current = totals.get(key) ?? { income: 0, expense: 0 };
      if (item.kind === 'income') current.income += item.amount;
      if (item.kind === 'expense') current.expense += item.amount;
      totals.set(key, current);
    });
    const cells = Array.from({ length: 42 }, (_, index) => {
      const day = index - firstDay + 1;
      return { date: new Date(year, month, day), inMonth: day >= 1 && day <= daysInMonth };
    });

    return (
      <View style={styles.panel}>
        <View style={styles.calendarHeader}>
          <Pressable style={styles.calendarArrow} onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><Ionicons name="chevron-back-outline" size={18} color={C.gold} /></Pressable>
          <Text style={styles.calendarMonth}>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable style={styles.calendarArrow} onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><Ionicons name="chevron-forward-outline" size={18} color={C.gold} /></Pressable>
        </View>
        <View style={styles.calendarWeekdays}>{['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => <Text key={day} style={styles.calendarWeekday}>{t(`finance.weekdays.${day}`)}</Text>)}</View>
        <View style={styles.calendarGrid}>
          {cells.map(({ date, inMonth }) => {
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const dayTotals = inMonth ? totals.get(key) : undefined;
            return <View key={key} style={[styles.calendarCell, !inMonth && styles.calendarCellMuted]}><Text style={styles.calendarDay}>{date.getDate()}</Text><Text style={styles.calendarIncome}>{dayTotals?.income ? `+${dayTotals.income.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}</Text><Text style={styles.calendarExpense}>{dayTotals?.expense ? `-${dayTotals.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}</Text></View>;
          })}
        </View>
        <View style={styles.calendarLegend}><Text style={styles.calendarIncome}>{t('finance.income')}</Text><Text style={styles.calendarExpense}>{t('finance.expenses')}</Text></View>
      </View>
    );
  };
  const renderCharts = () => { const totals = state.transactions.filter((item) => item.kind === 'expense').reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] ?? 0) + item.amount }), {}); const max = Math.max(1, ...Object.values(totals)); return <View style={styles.panel}>{Object.entries(totals).map(([category, amount]) => <View key={category} style={styles.chart}><View style={styles.chartTop}><Text style={styles.cardTitle}>{category}</Text><Text style={styles.cardMeta}>{amount.toFixed(2)}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${(amount / max) * 100}%` }]} /></View></View>)}{!Object.keys(totals).length && <Empty title="No chart data" body="Add expenses to see the breakdown." />}</View>; };
  const renderRecurring = () => <View style={styles.panel}>{state.recurring.map((item) => <View key={item.id} style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.payee || item.category}</Text><Text style={styles.cardMeta}>{item.frequency} · next {dateText(item.nextDate)}</Text></View><Pressable onPress={() => finance.updateRecurring({ ...item, active: !item.active })}><Text style={item.active ? styles.positive : styles.cardMeta}>{item.active ? 'ACTIVE' : 'PAUSED'}</Text></Pressable></View>)}{!state.recurring.length && <Empty title="No recurring" body="Create regular income or expenses." />}<Pressable style={styles.primary} onPress={() => { setRecurring((current) => ({ ...current, accountId: accounts[0]?.id ?? '' })); setRecurringOpen(true); }}><Text style={styles.primaryText}>+ RECURRING</Text></Pressable></View>;
  const renderDebts = () => <View style={styles.panel}>{state.debts.map((item) => <View key={item.id} style={styles.module}><View style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardMeta}>{item.creditor} · due {dateText(item.dueDate)}</Text></View><Text style={styles.negative}>{money(item.balance, item.currency)}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (1 - item.balance / Math.max(1, item.originalAmount)) * 100)}%`, backgroundColor: C.green }]} /></View></View>)}{!state.debts.length && <Empty title="No debts" body="Track debt balances and payments." />}<Pressable style={styles.primary} onPress={() => setDebtOpen(true)}><Text style={styles.primaryText}>+ DEBT</Text></Pressable></View>;
  const renderSavings = () => <View style={styles.panel}>{state.savingsGoals.map((item) => <View key={item.id} style={styles.module}><View style={styles.row}><View style={styles.rowMain}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardMeta}>deadline {dateText(item.deadline)}</Text></View><Text style={styles.positive}>{money(item.balance, item.currency)}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, item.balance / Math.max(1, item.targetAmount) * 100)}%`, backgroundColor: C.green }]} /></View></View>)}{!state.savingsGoals.length && <Empty title="No savings goals" body="Create a goal to track progress." />}<Pressable style={styles.primary} onPress={() => setSavingsOpen(true)}><Text style={styles.primaryText}>+ SAVINGS GOAL</Text></Pressable></View>;
  const renderReminders = () => <View style={styles.panel}>{state.reminders.map((item) => <Pressable key={item.id} style={styles.row} onPress={() => finance.updateReminder({ ...item, completed: !item.completed })}><Text style={[styles.check, item.completed && styles.checkDone]}>{item.completed ? '✓' : ''}</Text><View style={styles.rowMain}><Text style={[styles.cardTitle, item.completed && styles.strike]}>{item.title}</Text><Text style={styles.cardMeta}>{dateText(item.date)} · {item.note}</Text></View></Pressable>)}{!state.reminders.length && <Empty title="No reminders" body="Keep important dates visible here." />}<Pressable style={styles.primary} onPress={() => setReminderOpen(true)}><Text style={styles.primaryText}>+ REMINDER</Text></Pressable></View>;
  const renderNotes = () => <View style={styles.panel}>{state.notes.map((item) => <Pressable key={item.id} style={styles.module} onPress={() => finance.updateNote({ ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() })}><View style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{item.pinned ? 'PINNED' : 'PIN'}</Text></View><Text style={styles.body}>{item.body}</Text><Text style={styles.cardMeta}>{item.tags.join(' · ')}</Text></Pressable>)}{!state.notes.length && <Empty title="No notes" body="Keep plans and money context here." />}<Pressable style={styles.primary} onPress={() => setNoteOpen(true)}><Text style={styles.primaryText}>+ NOTE</Text></Pressable></View>;
  const renderCategories = () => {
    const selectedCategories = state.categories[categoryType];
    const categoryTabs = [
      { key: 'expense' as const, label: 'EXPENSES' },
      { key: 'income' as const, label: 'INCOME' },
      { key: 'tag' as const, label: 'TAGS' },
    ];
    return (
      <View style={styles.panel}>
        <View style={styles.categoryTabShell}>
          <View style={styles.categoryTabRow}>
            {categoryTabs.map((tab) => <Pressable key={tab.key} style={[styles.categoryTab, categoryType === tab.key && styles.categoryTabActive]} onPress={() => setCategoryType(tab.key)}><Text style={[styles.categoryTabText, categoryType === tab.key && styles.categoryTabTextActive]}>{tab.label}</Text></Pressable>)}
          </View>
        </View>
        {selectedCategories.map((item) => (
          <View key={`${categoryType}-${item.id}`} style={styles.row}>
            <View style={styles.categoryRowIcon}><Ionicons name={item.icon as IconName} size={18} color={C.gold} /></View>
            <Text style={[styles.cardTitle, styles.categoryRowName]}>{item.id}</Text>
            {item.id !== 'other' && <Pressable onPress={() => removeCategory(categoryType, item.id)} accessibilityLabel={t('finance.deleteCategory')}><Ionicons name="trash-outline" size={19} color={C.red} /></Pressable>}
          </View>
        ))}
        <Pressable
          style={styles.addCategoryItem}
          onPress={() => { setCategoryName(''); setCategoryIcon('pricetag-outline'); setCategoryError(''); setIconPickerOpen(false); setCategoryCreateOpen(true); }}
          accessibilityLabel={t('finance.addCategory')}
        >
          <Ionicons name="add-circle-outline" size={22} color={C.gold} />
          <Text style={styles.addCategoryText}>{t('finance.addCategory')}</Text>
        </Pressable>
      </View>
    );
  };
  const renderTools = () => {
    const convertedAmount = toolNumber(currencyAmount) * toolNumber(rate);
    const baseAmount = toolNumber(discountAmount);
    const discountValue = baseAmount * toolNumber(discountPercent) / 100;
    const taxedAmount = (baseAmount - discountValue) * (1 + toolNumber(taxPercent) / 100);
    const principal = toolNumber(interestPrincipal);
    const annualRate = toolNumber(interestRate) / 100;
    const years = toolNumber(interestYears);
    const compounds = Math.max(1, toolNumber(interestCompounds));
    const interestTotal = principal * Math.pow(1 + annualRate / compounds, compounds * years);

    return (
      <View style={styles.panel}>
        {activeTool === null ? <View style={styles.toolGrid}>
          {TOOL_OPTIONS.map((item) => (
            <Pressable key={item.key} onPress={() => setActiveTool(item.key)} style={[styles.toolCard, activeTool === item.key && styles.toolCardActive]}>
              <View style={[styles.toolCardIcon, activeTool === item.key && styles.toolCardIconActive]}><Ionicons name={item.icon} size={23} color={activeTool === item.key ? C.void : C.gold} /></View>
              <Text style={[styles.toolCardTitle, activeTool === item.key && styles.toolCardTitleActive]}>{t(`finance.toolCalculators.${item.key}`)}</Text>
            </Pressable>
          ))}
        </View> : <View style={styles.toolWorkspace}>
          <View style={styles.toolBack}>
            <BackButton onPress={() => setActiveTool(null)} />
            <Text style={styles.toolBackText}>{t('finance.tools')}</Text>
          </View>
          <Text style={styles.toolWorkspaceTitle}>{t(`finance.toolCalculators.${activeTool}`)}</Text>

        {activeTool === 'calculator' && <>
          <View style={styles.calculatorDisplay}><Text style={styles.calculatorExpression}>{calculator || '0'}</Text>{Boolean(calculatorResult) && <Text style={styles.calculatorAnswer}>{calculatorResult}</Text>}</View>
          <View style={styles.calculatorGrid}>{['C', 'DEL', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '.', '0', '=', '(', ')'].map((key) => <Pressable key={key} style={[styles.calculatorKey, ['C', 'DEL'].includes(key) && styles.calculatorUtilityKey, ['÷', '×', '−', '+', '=', '(', ')'].includes(key) && styles.calculatorOperatorKey]} onPress={() => pressCalculatorKey(key)}><Text style={styles.calculatorKeyText}>{key}</Text></Pressable>)}</View>
        </>}

        {activeTool === 'currency' && <>
          <Field title={t('finance.toolCalculators.amount')} value={currencyAmount} onChangeText={setCurrencyAmount} numeric />
          <Text style={styles.fieldLabel}>{t('finance.toolCalculators.fromCurrency')}</Text>
          <Choice values={['USD', 'EUR', 'CUP']} value={fromCurrency} onChange={setFromCurrency} />
          <Text style={styles.fieldLabel}>{t('finance.toolCalculators.toCurrency')}</Text>
          <Choice values={['USD', 'EUR', 'CUP']} value={toCurrency} onChange={setToCurrency} />
          <Field title={t('finance.toolCalculators.rate')} value={rate} onChangeText={setRate} numeric placeholder="1" />
          <Text style={styles.toolResult}>{toolMoney(convertedAmount, `${toCurrency} `)}</Text>
          <Text style={styles.cardMeta}>{t('finance.toolCalculators.offlineRate')}</Text>
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
          {settingRow('data', 'archive-outline', 'DATA & BACKUPS', 'JSON, CSV and local data')}
        </View>
      );
    }

    return (
      <View style={styles.panel}>
        <View style={styles.settingsBack}>
          <BackButton onPress={() => setSettingsSection(null)} />
          <Text style={styles.settingsBackText}>SETTINGS</Text>
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
            {CURRENCY_OPTIONS.map((currency) => <Pressable key={currency} style={styles.settingsOption} onPress={() => choosePrimaryCurrency(currency)}><View style={styles.settingsRowMain}><Text style={[styles.settingsOptionText, state.settings.preferredCurrency === currency && styles.settingsOptionTextActive]}>{currency}</Text>{currency !== 'USD' && <Text style={styles.settingsRowValue}>{t('finance.currencyRateValue', { currency, rate: state.settings.exchangeRates?.[currency] ?? '?' })}</Text>}</View>{state.settings.preferredCurrency === currency && <Ionicons name="checkmark-outline" size={18} color={C.gold} />}</Pressable>)}
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
          <Text style={styles.settingsTitle}>DATA & BACKUPS</Text>
          <Pressable style={styles.secondary} onPress={() => void share('json')}><Text style={styles.secondaryText}>EXPORT JSON BACKUP</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => void share('csv')}><Text style={styles.secondaryText}>EXPORT CSV</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => setImportOpen(true)}><Text style={styles.secondaryText}>IMPORT JSON / CSV</Text></Pressable>
          <Pressable style={styles.danger} onPress={finance.resetData}><Text style={styles.dangerText}>RESET LOCAL DATA</Text></Pressable>
        </>}
      </View>
    );
  };
  const renderMore = () => <View style={styles.panel}>{(['activity', 'recurring', 'calendar', 'charts', 'budget'] as FinanceModuleName[]).map((item) => <Pressable key={item} style={styles.menuLink} onPress={() => setModule(item)}><Text style={styles.cardTitle}>{item.toUpperCase()}</Text><Text style={styles.cardMeta}>Open module</Text></Pressable>)}</View>;
  const content = module === 'accounts' ? renderAccounts() : module === 'activity' ? renderActivity() : module === 'calendar' ? renderCalendar() : module === 'charts' ? renderCharts() : module === 'recurring' ? renderRecurring() : module === 'categories' ? renderCategories() : module === 'debt' ? renderDebts() : module === 'savings' ? renderSavings() : module === 'reminders' ? renderReminders() : module === 'notes' ? renderNotes() : module === 'tools' ? renderTools() : module === 'settings' ? renderSettings() : module === 'about' ? <View style={styles.panel}><Text style={styles.about}>SGR</Text><Text style={styles.aboutTitle}>Solid Gold Rich</Text><Text style={styles.body}>A local-first wealth manager. Your data stays on this device unless you export it.</Text></View> : module === 'budget' ? <View style={styles.panel}><Text style={styles.body}>Use the account manager and main dashboard to review current account limits. Flexible category budgets can be added from this module in the next data migration pass.</Text></View> : renderMore();
  const titles: Record<FinanceModuleName, string> = { accounts: 'ACCOUNTS', reminders: 'REMINDERS', debt: 'DEBT', notes: 'NOTES', tools: 'TOOLS', savings: 'SAVINGS', budget: 'BUDGET', calendar: 'CALENDAR', charts: 'CHARTS', activity: 'ACTIVITY', recurring: 'RECURRING', categories: 'CATEGORIES', more: 'MORE FEATURES', settings: 'SETTINGS', about: 'ABOUT' };

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}><View style={styles.header}><BackButton onPress={onBack} /><Text style={styles.headerTitle}>{titles[module]}</Text><View style={styles.headerSpace} /></View><ScrollView contentContainerStyle={[styles.content, styles.moduleContent]}>{content}</ScrollView>
    <Modal visible={categoryCreateOpen} transparent animationType="slide" onRequestClose={() => setCategoryCreateOpen(false)}>
      <KeyboardAvoidingView style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('finance.newCategory')}</Text>
          <Text style={styles.cardMeta}>{categoryType === 'expense' ? 'EXPENSES' : categoryType === 'income' ? 'INCOME' : 'TAGS'}</Text>
          <Field title={t('finance.category')} value={categoryName} onChangeText={(value) => { setCategoryName(value); setCategoryError(''); }} placeholder={t('finance.categoryPlaceholder')} />
          <Text style={styles.fieldLabel}>{t('finance.chooseIcon')}</Text>
          <Pressable style={styles.iconPreviewRow} onPress={() => setIconPickerOpen(true)} accessibilityLabel={t('finance.chooseIcon')}>
            <View style={styles.iconPreviewButton}><Ionicons name={categoryIcon} size={21} color={C.gold} /></View>
            <Text style={styles.iconPreviewText}>Tap to choose an icon</Text>
            <Ionicons name="chevron-forward-outline" size={18} color="rgba(255,244,208,0.35)" />
          </Pressable>
          {Boolean(categoryError) && <Text style={styles.pinError}>{categoryError}</Text>}
          <Pressable style={styles.primary} onPress={addCategory}><Text style={styles.primaryText}>{t('finance.addCategory')}</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => setCategoryCreateOpen(false)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable>
        </View>
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
            {CATEGORY_ICON_OPTIONS.map((item) => <Pressable key={item.name} onPress={() => { setCategoryIcon(item.name); setIconPickerOpen(false); }} style={[styles.iconPickerChoice, categoryIcon === item.name && styles.iconChoiceActive]} accessibilityLabel={item.label}><Ionicons name={item.name} size={22} color={categoryIcon === item.name ? C.void : C.goldLight} /></Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
    <Modal visible={accountOpen} transparent animationType="slide" onRequestClose={closeAccountEditor}>
      <KeyboardAvoidingView style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editingAccount ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}</Text>
          <Field title={t('finance.budgetName', { defaultValue: 'NAME' })} value={account.name} onChangeText={(value) => setAccount((current) => ({ ...current, name: value }))} />
          <Field title="TYPE" value={account.type} onChangeText={(value) => setAccount((current) => ({ ...current, type: value as Account['type'] }))} />
          <Field title={t('finance.currency')} value={account.currency} onChangeText={(value) => setAccount((current) => ({ ...current, currency: value.toUpperCase(), exchangeRate: value.toUpperCase() === baseCurrency ? '1' : current.exchangeRate }))} />
          <Field title={t('finance.openingBalance')} value={account.opening} onChangeText={(value) => setAccount((current) => ({ ...current, opening: value }))} numeric />
          {account.currency !== baseCurrency && <>
            <Field title={`${t('finance.exchangeRate')} · 1 ${account.currency} = ? ${baseCurrency}`} value={account.exchangeRate} onChangeText={(value) => { setAccount((current) => ({ ...current, exchangeRate: value })); setAccountError(''); }} numeric placeholder="0.00" />
            {Boolean(accountError) && <Text style={styles.pinError}>{accountError}</Text>}
          </>}
          <Pressable style={styles.primary} onPress={saveAccount}><Text style={styles.primaryText}>{editingAccount ? 'SAVE CHANGES' : 'SAVE'}</Text></Pressable>
          <Pressable style={styles.secondary} onPress={closeAccountEditor}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={recurringOpen} transparent animationType="slide" onRequestClose={() => setRecurringOpen(false)}><KeyboardAvoidingView style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>NEW RECURRING</Text><Field title="AMOUNT" value={recurring.amount} onChangeText={(value) => setRecurring((current) => ({ ...current, amount: value }))} numeric /><Field title="PAYEE" value={recurring.payee} onChangeText={(value) => setRecurring((current) => ({ ...current, payee: value }))} /><Field title="FREQUENCY" value={recurring.frequency} onChangeText={(value) => setRecurring((current) => ({ ...current, frequency: value as RecurringFrequency }))} /><Field title="NEXT DATE" value={recurring.nextDate} onChangeText={(value) => setRecurring((current) => ({ ...current, nextDate: value }))} /><Pressable style={styles.primary} onPress={addRecurring}><Text style={styles.primaryText}>SAVE</Text></Pressable></View></KeyboardAvoidingView></Modal>
    <Modal visible={debtOpen} transparent animationType="slide" onRequestClose={() => setDebtOpen(false)}><KeyboardAvoidingView style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>NEW DEBT</Text><Field title="NAME" value={debt.name} onChangeText={(value) => setDebt((current) => ({ ...current, name: value }))} /><Field title="CREDITOR" value={debt.creditor} onChangeText={(value) => setDebt((current) => ({ ...current, creditor: value }))} /><Field title="CURRENCY" value={debt.currency} onChangeText={(value) => setDebt((current) => ({ ...current, currency: value }))} /><Field title="AMOUNT" value={debt.amount} onChangeText={(value) => setDebt((current) => ({ ...current, amount: value }))} numeric /><Field title="DUE DATE" value={debt.dueDate} onChangeText={(value) => setDebt((current) => ({ ...current, dueDate: value }))} /><Pressable style={styles.primary} onPress={addDebt}><Text style={styles.primaryText}>SAVE</Text></Pressable></View></KeyboardAvoidingView></Modal>
    <Modal visible={savingsOpen} transparent animationType="slide" onRequestClose={() => setSavingsOpen(false)}><KeyboardAvoidingView style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>NEW SAVINGS GOAL</Text><Field title="NAME" value={savings.name} onChangeText={(value) => setSavings((current) => ({ ...current, name: value }))} /><Field title="CURRENCY" value={savings.currency} onChangeText={(value) => setSavings((current) => ({ ...current, currency: value }))} /><Field title="TARGET" value={savings.target} onChangeText={(value) => setSavings((current) => ({ ...current, target: value }))} numeric /><Field title="DEADLINE" value={savings.deadline} onChangeText={(value) => setSavings((current) => ({ ...current, deadline: value }))} /><Pressable style={styles.primary} onPress={addSavings}><Text style={styles.primaryText}>SAVE</Text></Pressable></View></KeyboardAvoidingView></Modal>
    <Modal visible={reminderOpen} transparent animationType="slide" onRequestClose={() => setReminderOpen(false)}><KeyboardAvoidingView style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>NEW REMINDER</Text><Field title="TITLE" value={reminder.title} onChangeText={(value) => setReminder((current) => ({ ...current, title: value }))} /><Field title="DATE" value={reminder.date} onChangeText={(value) => setReminder((current) => ({ ...current, date: value }))} /><Field title="NOTE" value={reminder.note} onChangeText={(value) => setReminder((current) => ({ ...current, note: value }))} multiline /><Pressable style={styles.primary} onPress={addReminder}><Text style={styles.primaryText}>SAVE</Text></Pressable></View></KeyboardAvoidingView></Modal>
    <Modal visible={noteOpen} transparent animationType="slide" onRequestClose={() => setNoteOpen(false)}><KeyboardAvoidingView style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>NEW NOTE</Text><Field title="TITLE" value={note.title} onChangeText={(value) => setNote((current) => ({ ...current, title: value }))} /><Field title="BODY" value={note.body} onChangeText={(value) => setNote((current) => ({ ...current, body: value }))} multiline /><Field title="TAGS" value={note.tags} onChangeText={(value) => setNote((current) => ({ ...current, tags: value }))} /><Pressable style={styles.primary} onPress={addNote}><Text style={styles.primaryText}>SAVE</Text></Pressable></View></KeyboardAvoidingView></Modal>
    <Modal visible={importOpen} transparent animationType="slide" onRequestClose={() => setImportOpen(false)}><KeyboardAvoidingView style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>IMPORT</Text><Text style={styles.body}>Paste a JSON backup or CSV movement list.</Text><TextInput value={importText} onChangeText={setImportText} multiline style={[styles.input, styles.import]} placeholder="JSON or CSV" placeholderTextColor="rgba(255,244,208,0.3)" /><Pressable style={styles.primary} onPress={importData}><Text style={styles.primaryText}>IMPORT</Text></Pressable></View></KeyboardAvoidingView></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  settingsOptionList: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, overflow: 'hidden', marginBottom: 14 },
  settingsOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  settingsOptionText: { color: 'rgba(255,244,208,0.55)', fontFamily: SANS, fontSize: 10 },
  settingsOptionTextActive: { color: C.goldLight, fontWeight: '700' },
  settingsRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  settingsRowMain: { flex: 1, minWidth: 0 },
  settingsRowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 11, fontWeight: '600' },
  settingsRowValue: { color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 9, marginTop: 5 },
  settingsBack: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
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
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, alignItems: 'stretch' },
  toolCard: { width: '48.5%', minHeight: 116, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.035)', padding: 14, justifyContent: 'space-between' },
  toolCardActive: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.12)' },
  toolCardIcon: { width: 40, height: 40, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.2)', alignItems: 'center', justifyContent: 'center' },
  toolCardIconActive: { backgroundColor: C.gold, borderColor: C.gold },
  toolCardTitle: { minHeight: 28, color: C.goldLight, fontFamily: SANS, fontSize: 10, lineHeight: 14 },
  toolCardTitleActive: { color: C.goldLight, fontWeight: '700' },
  toolBack: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  toolBackText: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  toolWorkspace: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 18, paddingTop: 14 },
  toolWorkspaceTitle: { color: C.gold, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  calculatorDisplay: { minHeight: 88, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.28)', padding: 14, alignItems: 'flex-end', justifyContent: 'center', marginBottom: 12 },
  calculatorExpression: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 12 },
  calculatorAnswer: { color: C.goldLight, fontFamily: SERIF, fontSize: 30, marginTop: 3 },
  calculatorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  calculatorKey: { width: '23.5%', height: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center' },
  calculatorUtilityKey: { backgroundColor: 'rgba(255,244,208,0.08)' },
  calculatorOperatorKey: { backgroundColor: 'rgba(233,200,119,0.13)', borderColor: 'rgba(233,200,119,0.32)' },
  calculatorKeyText: { color: C.goldLight, fontFamily: SANS, fontSize: 16, fontWeight: '600' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarArrow: { width: 34, height: 34, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  calendarMonth: { color: C.goldLight, fontFamily: SERIF, fontSize: 19, textTransform: 'capitalize' },
  calendarWeekdays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calendarWeekday: { width: '13.4%', color: 'rgba(255,244,208,0.36)', fontFamily: SANS, fontSize: 7, textAlign: 'center', letterSpacing: 0.5 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 5 },
  calendarCell: { width: '13.4%', minHeight: 58, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.14)', backgroundColor: 'rgba(255,255,255,0.025)', padding: 5 },
  calendarCellMuted: { opacity: 0.22 },
  calendarDay: { color: C.goldLight, fontFamily: SANS, fontSize: 9, marginBottom: 4 },
  calendarIncome: { color: C.green, fontFamily: SANS, fontSize: 7, minHeight: 10 },
  calendarExpense: { color: C.red, fontFamily: SANS, fontSize: 7, minHeight: 10 },
  calendarLegend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 12 },
  addCategoryItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, marginTop: 4 },
  addCategoryText: { color: C.gold, fontFamily: SANS, fontSize: 10, letterSpacing: 0.8 },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 20 },
  settingsTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 18, marginTop: 4 },
  pinError: { color: C.red, fontFamily: SANS, fontSize: 10, marginTop: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  moduleContent: { paddingTop: 24 },
  root: { flex: 1, backgroundColor: C.void }, header: { height: 78, paddingTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, back: { width: 42 }, backText: { color: C.goldLight, fontSize: 34, fontWeight: '200' }, headerTitle: { flex: 1, textAlign: 'center', color: C.goldLight, fontFamily: SERIF, fontSize: 21 }, headerSpace: { width: 42 }, content: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 50 }, panel: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.72)', padding: 14, marginBottom: 15 }, row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' }, rowMain: { flex: 1, minWidth: 0 }, accountStripe: { width: 5, height: 38, borderRadius: 3 }, cardTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12 }, cardMeta: { color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 9, marginTop: 4 }, positive: { color: C.green, fontFamily: SERIF, fontSize: 14 }, negative: { color: C.red, fontFamily: SERIF, fontSize: 14 }, primary: { minHeight: 46, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1 }, secondary: { minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, secondaryText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700' }, danger: { minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, dangerText: { color: C.red, fontFamily: SANS, fontSize: 10, fontWeight: '700' }, module: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, body: { color: 'rgba(255,244,208,0.66)', fontFamily: SANS, fontSize: 11, lineHeight: 18, marginVertical: 10 }, track: { height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginVertical: 9 }, fill: { height: '100%', borderRadius: 4, backgroundColor: C.gold }, chart: { marginBottom: 14 }, chartTop: { flexDirection: 'row', justifyContent: 'space-between' }, check: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: C.gold, color: C.gold, textAlign: 'center', textAlignVertical: 'center' }, checkDone: { backgroundColor: C.green, borderColor: C.green, color: C.void }, strike: { textDecorationLine: 'line-through', opacity: 0.5 }, toolResult: { color: C.goldLight, fontFamily: SERIF, fontSize: 29, marginBottom: 15 }, toolChoices: { gap: 7, paddingBottom: 8 }, toolChoice: { minHeight: 42, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 }, toolChoiceActive: { backgroundColor: C.gold, borderColor: C.gold }, toolChoiceText: { color: 'rgba(255,244,208,0.55)', fontFamily: SANS, fontSize: 8.5 }, toolChoiceTextActive: { color: C.void, fontWeight: '700' }, menuLink: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, field: { marginTop: 11 }, fieldLabel: { color: 'rgba(233,200,119,0.62)', fontFamily: SANS, fontSize: 9, letterSpacing: 1, marginBottom: 6 }, input: { minHeight: 45, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', color: C.goldLight, fontFamily: SANS, fontSize: 12, paddingHorizontal: 12, paddingVertical: 10 }, multiline: { minHeight: 80, textAlignVertical: 'top' }, import: { minHeight: 210, textAlignVertical: 'top', marginTop: 12 }, choices: { gap: 7, paddingVertical: 8 }, choice: { minHeight: 34, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 12, justifyContent: 'center' }, choiceActive: { backgroundColor: 'rgba(233,200,119,0.14)', borderColor: C.gold }, choiceText: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 9 }, choiceTextActive: { color: C.goldLight }, iconChoices: { gap: 8, paddingVertical: 8 }, iconChoice: { width: 44, height: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center' }, iconChoiceActive: { backgroundColor: C.gold, borderColor: C.gold }, categoryRowIcon: { width: 34, height: 34, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.06)', alignItems: 'center', justifyContent: 'center' }, categoryRowName: { flex: 1 }, empty: { alignItems: 'center', paddingVertical: 28 }, diamond: { width: 22, height: 22, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 15 }, emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12 }, emptyBody: { color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 9, marginTop: 7, textAlign: 'center' }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' }, sheet: { maxHeight: '90%', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 18 }, sheetTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 23, marginBottom: 12 }, about: { color: C.gold, fontFamily: SERIF, fontSize: 48, textAlign: 'center', marginTop: 20 }, aboutTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 24, textAlign: 'center', marginBottom: 12 },
});
