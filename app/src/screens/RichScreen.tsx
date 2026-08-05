import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Gem, { diamondLevel, DIAMOND_LEVELS } from '../components/Gem';
import { C, SANS, SERIF } from '../theme/luxury';
import type { FinanceModuleName } from './FinanceModulesScreen';

type TransactionKind = 'expense' | 'income';
type ScreenMode = 'budget' | 'allActivity';

const CATEGORIES = ['food', 'housing', 'transport', 'shopping', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

type Transaction = {
  id: string;
  title: string;
  category: Category;
  amount: number;
  kind: TransactionKind;
  date: string;
};

type BudgetAccount = {
  id: string;
  name: string;
  openingBalance: number;
  limit: number;
  color: string;
  transactions: Transaction[];
};

type PortfolioTransaction = Transaction & { budgetId: string; budgetName: string; budgetColor: string };

const BUDGETS_KEY = '@solid-gold/budget-accounts-v1';
const ACTIVE_BUDGET_KEY = '@solid-gold/active-budget-v1';
const LEGACY_TRANSACTIONS_KEY = '@solid-gold/transactions';
const LEGACY_BUDGET_KEY = '@solid-gold/monthly-budget';
const DEFAULT_LIMIT = 2500;
const ACCOUNT_COLORS = ['#E9C877', '#7DD9B2', '#80B9FF', '#D99BEF', '#F08B88'];

function createDefaultBudget(name: string): BudgetAccount {
  return {
    id: 'personal',
    name,
    openingBalance: 0,
    limit: DEFAULT_LIMIT,
    color: ACCOUNT_COLORS[0],
    transactions: [],
  };
}

function parseAmount(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function incomeFor(budget: BudgetAccount) {
  return budget.transactions
    .filter((item) => item.kind === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
}

function expensesFor(budget: BudgetAccount) {
  return budget.transactions
    .filter((item) => item.kind === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
}

function balanceFor(budget: BudgetAccount) {
  return budget.openingBalance + incomeFor(budget) - expensesFor(budget);
}

function formatMoney(value: number, language: string) {
  return value.toLocaleString(language, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
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

function Metric({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'green' | 'red' }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === 'green' && styles.incomeText,
          tone === 'red' && styles.expenseText,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.68}
      >
        {value}
      </Text>
    </View>
  );
}

function PeriodCard({
  label,
  income,
  expenses,
  language,
}: {
  label: string;
  income: number;
  expenses: number;
  language: string;
}) {
  const net = income - expenses;
  return (
    <View style={styles.periodCard}>
      <View style={styles.periodTop}>
        <Text style={styles.periodLabel} numberOfLines={1}>{label}</Text>
        <Text style={[styles.periodNet, net < 0 ? styles.expenseText : styles.incomeText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {formatMoney(net, language)}
        </Text>
      </View>
      <View style={styles.periodValues}>
        <Text style={[styles.periodValue, styles.incomeText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>+{formatMoney(income, language)}</Text>
        <View style={styles.periodDivider} />
        <Text style={[styles.periodValue, styles.expenseText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>-{formatMoney(expenses, language)}</Text>
      </View>
    </View>
  );
}

export default function RichScreen({ onOpenModule }: { onOpenModule?: (module: FinanceModuleName) => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const { height } = useWindowDimensions();
  const initialBudgetName = React.useRef(t('finance.defaultBudget'));
  const [budgets, setBudgets] = React.useState<BudgetAccount[]>(() => [createDefaultBudget(initialBudgetName.current)]);
  const [activeBudgetId, setActiveBudgetId] = React.useState('personal');
  const [loaded, setLoaded] = React.useState(false);
  const [screenMode, setScreenMode] = React.useState<ScreenMode>('budget');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [entryOpen, setEntryOpen] = React.useState(false);
  const [entryKind, setEntryKind] = React.useState<TransactionKind>('expense');
  const [entryTitle, setEntryTitle] = React.useState('');
  const [entryAmount, setEntryAmount] = React.useState('');
  const [entryCategory, setEntryCategory] = React.useState<Category>('other');
  const [newBudgetName, setNewBudgetName] = React.useState('');
  const [newBudgetBalance, setNewBudgetBalance] = React.useState('');
  const [newBudgetLimit, setNewBudgetLimit] = React.useState(`${DEFAULT_LIMIT}`);
  const [newBudgetColor, setNewBudgetColor] = React.useState(ACCOUNT_COLORS[0]);


  React.useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(BUDGETS_KEY),
      AsyncStorage.getItem(ACTIVE_BUDGET_KEY),
      AsyncStorage.getItem(LEGACY_TRANSACTIONS_KEY),
      AsyncStorage.getItem(LEGACY_BUDGET_KEY),
    ])
      .then(([savedBudgets, savedActiveId, legacyTransactions, legacyLimit]) => {
        if (savedBudgets) {
          try {
            const parsed = JSON.parse(savedBudgets) as BudgetAccount[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              const normalized = parsed.map((budget, index) => ({
                ...budget,
                name: !budget.name || budget.name.startsWith('finance.')
                  ? (index === 0 ? initialBudgetName.current : `${initialBudgetName.current} ${index + 1}`)
                  : budget.name,
                openingBalance: Number.isFinite(Number(budget.openingBalance)) ? Number(budget.openingBalance) : 0,
                limit: Number.isFinite(Number(budget.limit)) && Number(budget.limit) > 0 ? Number(budget.limit) : DEFAULT_LIMIT,
                color: budget.color || ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
                transactions: Array.isArray(budget.transactions) ? budget.transactions : [],
              }));
              setBudgets(normalized);
              const validActiveId = normalized.some((budget) => budget.id === savedActiveId)
                ? savedActiveId
                : normalized[0].id;
              setActiveBudgetId(validActiveId ?? normalized[0].id);
              return;
            }
          } catch {
            // A malformed saved value falls through to the safe default below.
          }
        }

        const fallback = createDefaultBudget(initialBudgetName.current);
        if (legacyTransactions) {
          try {
            const parsedTransactions = JSON.parse(legacyTransactions) as Transaction[];
            if (Array.isArray(parsedTransactions)) fallback.transactions = parsedTransactions;
          } catch {
            fallback.transactions = [];
          }
        }
        fallback.limit = parseAmount(legacyLimit ?? '') || DEFAULT_LIMIT;
        setBudgets([fallback]);
        setActiveBudgetId(fallback.id);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
    void AsyncStorage.setItem(ACTIVE_BUDGET_KEY, activeBudgetId);
  }, [activeBudgetId, budgets, loaded]);

  const activeBudget = budgets.find((budget) => budget.id === activeBudgetId) ?? budgets[0];
  const expenses = activeBudget ? expensesFor(activeBudget) : 0;
  const balance = activeBudget ? balanceFor(activeBudget) : 0;
  const positiveBalance = Math.max(0, balance);
  const level = diamondLevel(positiveBalance);
  const budgetProgress = activeBudget?.limit ? expenses / activeBudget.limit : 0;
  const portfolioBalance = budgets.reduce((sum, budget) => sum + balanceFor(budget), 0);
  const portfolioIncome = budgets.reduce((sum, budget) => sum + incomeFor(budget), 0);
  const portfolioExpenses = budgets.reduce((sum, budget) => sum + expensesFor(budget), 0);
  const allTransactions: PortfolioTransaction[] = budgets
    .flatMap((budget) => budget.transactions.map((transaction) => ({
      ...transaction,
      budgetId: budget.id,
      budgetName: budget.name,
      budgetColor: budget.color,
    })))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - todayStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const periodTotals = (start: Date) => {
    const items = activeBudget?.transactions.filter((item) => new Date(item.date).getTime() >= start.getTime()) ?? [];
    return {
      income: items.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0),
      expenses: items.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0),
    };
  };
  const periods = [
    { key: 'today', label: t('finance.today'), ...periodTotals(todayStart) },
    { key: 'week', label: t('finance.thisWeek'), ...periodTotals(weekStart) },
    { key: 'month', label: t('finance.thisMonth'), ...periodTotals(monthStart) },
    { key: 'year', label: t('finance.yearToDate'), ...periodTotals(yearStart) },
  ];
  const recentOperationLimit = height < 700 ? 1 : height < 760 ? 2 : height < 850 ? 3 : 4;

  const selectBudget = React.useCallback((budgetId: string) => {
    setActiveBudgetId(budgetId);
    setScreenMode('budget');
  }, []);


  const closeEntry = React.useCallback(() => {
    setEntryOpen(false);
    setEntryTitle('');
    setEntryAmount('');
    setEntryCategory('other');
  }, []);

  const openEntry = React.useCallback((kind: TransactionKind) => {
    setEntryKind(kind);
    setEntryOpen(true);
  }, []);

  const addTransaction = React.useCallback(() => {
    const amount = parseAmount(entryAmount);
    if (!activeBudget || amount <= 0) return;

    const transaction: Transaction = {
      id: `${Date.now()}`,
      title: entryTitle.trim() || t('finance.untitled'),
      category: entryCategory,
      amount,
      kind: entryKind,
      date: new Date().toISOString(),
    };

    setBudgets((current) => current.map((budget) => (
      budget.id === activeBudget.id
        ? { ...budget, transactions: [transaction, ...budget.transactions] }
        : budget
    )));
    closeEntry();
  }, [activeBudget, closeEntry, entryAmount, entryCategory, entryKind, entryTitle, t]);

  const createBudget = React.useCallback(() => {
    const name = newBudgetName.trim();
    if (!name) return;

    const budget: BudgetAccount = {
      id: `budget-${Date.now()}`,
      name,
      openingBalance: parseAmount(newBudgetBalance),
      limit: parseAmount(newBudgetLimit) || DEFAULT_LIMIT,
      color: newBudgetColor,
      transactions: [],
    };

    setBudgets((current) => [...current, budget]);
    setActiveBudgetId(budget.id);
    setScreenMode('budget');
    setNewBudgetName('');
    setNewBudgetBalance('');
    setNewBudgetLimit(`${DEFAULT_LIMIT}`);
    setManagerOpen(false);
  }, [newBudgetBalance, newBudgetColor, newBudgetLimit, newBudgetName]);

  const openManagerFromDrawer = React.useCallback(() => {
    setDrawerOpen(false);
    requestAnimationFrame(() => setManagerOpen(true));
  }, []);

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
      const categoryLabel = t(`finance.categories.${item.category}`);
      const detail = showBudgetName
        ? `${portfolioItem.budgetName} / ${categoryLabel}`
        : `${categoryLabel} / ${new Date(item.date).toLocaleDateString(language, { month: 'short', day: 'numeric' })}`;

      return (
        <View style={styles.transactionRow} key={`${showBudgetName ? portfolioItem.budgetId : activeBudgetId}-${item.id}`}>
          <View
            style={[
              styles.categoryIcon,
              { borderColor: showBudgetName ? portfolioItem.budgetColor : activeBudget?.color ?? C.gold },
              item.kind === 'income' && styles.incomeIcon,
            ]}
          >
            <Text style={styles.categoryLetter}>{categoryLabel.slice(0, 1).toLocaleUpperCase(language)}</Text>
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
            {item.kind === 'income' ? '+' : '-'}{formatMoney(item.amount, language)}
          </Text>
        </View>
      );
    });
  };

  const renderBudgetView = () => {
    if (!activeBudget) return null;

    return (
      <View style={styles.fixedBudgetView}>
        <View style={styles.compactHero}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[`${activeBudget.color}22`, 'rgba(10,12,20,0.25)', 'rgba(10,12,20,0.72)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.compactHeroInfo}>
            <View>
              <Text style={styles.eyebrow}>{t('finance.availableBalance')}</Text>
              <Text style={styles.compactBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>
                {formatMoney(balance, language)}
              </Text>
            </View>

            <View style={styles.compactTierBlock}>
              <Text style={styles.microLabel}>{t('finance.currentTier')}</Text>
              <Text style={[styles.tierName, { color: level.accent }]} numberOfLines={1}>
                {t(`app.diamonds.${level.key}`)} / {DIAMOND_LEVELS.indexOf(level) + 1}/{DIAMOND_LEVELS.length}
              </Text>
            </View>

            <View style={styles.compactLimitTop}>
              <Text style={styles.compactLimitLabel}>{t('finance.budgetLimit')}</Text>
              <Text style={[styles.compactLimitValue, budgetProgress > 1 && styles.expenseText]}>
                {formatMoney(expenses, language)} / {formatMoney(activeBudget.limit, language)}
              </Text>
            </View>
            <ProgressBar progress={budgetProgress} color={budgetProgress > 1 ? '#F08B88' : activeBudget.color} />
          </View>

          <View style={styles.compactGemWindow} pointerEvents="box-none">
            <View style={styles.compactGemCanvas}>
              <Gem netWorth={positiveBalance} accessibilityLabel={t(`app.diamonds.${level.key}`)} />
            </View>
          </View>
        </View>

        <View style={styles.periodGrid}>
          {periods.map((period) => (
            <PeriodCard
              key={period.key}
              label={period.label}
              income={period.income}
              expenses={period.expenses}
              language={language}
            />
          ))}
        </View>

        <View style={styles.fixedSectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>{t('finance.thisBudget')}</Text>
            <Text style={styles.sectionTitle}>{t('finance.operations')}</Text>
          </View>
          <Text style={styles.operationCount}>{activeBudget.transactions.length}</Text>
        </View>
        <View style={[styles.panel, styles.fixedOperationsPanel]}>
          {renderTransactions(activeBudget.transactions.slice(0, recentOperationLimit))}
        </View>

        <Pressable style={[styles.floatingAdd, { backgroundColor: activeBudget.color }]} onPress={() => openEntry('expense')}>
          <Text style={styles.floatingAddText}>+</Text>
        </Pressable>
      </View>
    );
  };

  const renderPortfolioActivity = () => (
    <>
      <View style={styles.portfolioCard}>
        <Text style={styles.eyebrow}>{t('finance.totalAcrossBudgets')}</Text>
        <Text style={styles.portfolioBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>
          {formatMoney(portfolioBalance, language)}
        </Text>
        <View style={styles.portfolioMetrics}>
          <Metric label={t('finance.income')} value={formatMoney(portfolioIncome, language)} tone="green" />
          <Metric label={t('finance.expenses')} value={formatMoney(portfolioExpenses, language)} tone="red" />
        </View>
      </View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>{t('finance.portfolio')}</Text>
          <Text style={styles.sectionTitle}>{t('finance.allActivity')}</Text>
        </View>
        <Text style={styles.operationCount}>{allTransactions.length}</Text>
      </View>

      <View style={styles.panel}>{renderTransactions(allTransactions, true)}</View>
    </>
  );

  const headerTitle = screenMode === 'allActivity' ? t('finance.allActivity') : activeBudget?.name ?? '';
  const headerSubtitle = screenMode === 'allActivity' ? t('finance.portfolio') : t('finance.budgetAccount');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.root}>
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
            onPress={() => onOpenModule ? onOpenModule('accounts') : setManagerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('finance.manageBudgets')}
          >
            <AccountsGlyph />
          </Pressable>
        </View>

        <View style={styles.tabShell}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.budgetTabs}
          >
            {budgets.map((budget) => {
              const active = screenMode === 'budget' && budget.id === activeBudgetId;
              return (
                <Pressable
                  key={budget.id}
                  onPress={() => selectBudget(budget.id)}
                  style={[styles.budgetTab, active && styles.budgetTabActive]}
                >
                  <View style={[styles.budgetTabDot, { backgroundColor: budget.color }]} />
                  <Text style={[styles.budgetTabText, active && styles.budgetTabTextActive]} numberOfLines={1}>
                    {budget.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {screenMode === 'budget' ? (
          <View style={styles.fixedContent}>{renderBudgetView()}</View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderPortfolioActivity()}
          </ScrollView>
        )}
      </View>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
          <SafeAreaView style={styles.drawer} edges={['top', 'bottom']}>
            <View style={styles.drawerBrand}>
              <View style={styles.drawerMonogram}><Text style={styles.drawerMonogramText}>SG</Text></View>
              <View>
                <Text style={styles.drawerBrandName}>{t('finance.brandName')}</Text>
                <Text style={styles.drawerBrandCopy}>{t('finance.wealthManager')}</Text>
              </View>
            </View>

            <View style={styles.drawerBalanceCard}>
              <Text style={styles.microLabel}>{t('finance.totalAcrossBudgets')}</Text>
              <Text style={styles.drawerBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                {formatMoney(portfolioBalance, language)}
              </Text>
              <Text style={styles.drawerBudgetCount}>{budgets.length} {t('finance.budgetAccounts')}</Text>
            </View>

            <View style={styles.drawerNav}>
              <Pressable
                style={[styles.drawerItem, screenMode === 'budget' && styles.drawerItemActive]}
                onPress={() => { setScreenMode('budget'); setDrawerOpen(false); }}
              >
                <View style={styles.drawerItemIcon}><View style={styles.drawerHomeIcon} /></View>
                <Text style={styles.drawerItemText}>{t('finance.dashboard')}</Text>
              </Pressable>
              <Pressable

                style={[styles.drawerItem, screenMode === 'allActivity' && styles.drawerItemActive]}
                onPress={() => { setScreenMode('allActivity'); setDrawerOpen(false); }}
              >
                <View style={styles.drawerItemIcon}>
                  <View style={styles.drawerActivityIcon}>
                    <View style={styles.drawerActivityIconRow} />
                    <View style={styles.drawerActivityIconRow} />
                    <View style={styles.drawerActivityIconRow} />
                  </View>
                </View>
                <Text style={styles.drawerItemText}>{t('finance.allActivity')}</Text>
              </Pressable>
              <Pressable style={styles.drawerItem} onPress={openManagerFromDrawer}>
                <View style={styles.drawerItemIcon}><AccountsGlyph /></View>
                <Text style={styles.drawerItemText}>{t('finance.manageBudgets')}</Text>
              </Pressable>
              {[
                ['reminders', 'Reminder'],
                ['debt', 'Debt'],
                ['notes', 'Note'],
                ['tools', 'Tools'],
                ['savings', 'Savings'],
                ['budget', 'Budget'],
                ['calendar', 'Calendar'],
                ['charts', 'Charts'],
                ['settings', 'Settings'],
                ['about', 'About'],
              ].map(([module, title]) => (
                <Pressable key={module} style={styles.drawerItem} onPress={() => onOpenModule?.(module as FinanceModuleName)}>
                  <View style={styles.drawerItemIcon}><View style={styles.drawerActivityIcon}><View style={styles.drawerActivityIconRow} /></View></View>
                  <Text style={styles.drawerItemText}>{title}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.drawerSectionLabel}>{t('finance.yourBudgets')}</Text>
            <ScrollView style={styles.drawerBudgets} showsVerticalScrollIndicator={false}>
              {budgets.map((budget) => (
                <Pressable
                  key={budget.id}
                  style={styles.drawerBudgetRow}
                  onPress={() => { selectBudget(budget.id); setDrawerOpen(false); }}
                >
                  <View style={[styles.drawerBudgetDot, { backgroundColor: budget.color }]} />
                  <Text style={styles.drawerBudgetName} numberOfLines={1}>{budget.name}</Text>
                  <Text style={styles.drawerBudgetValue}>{formatMoney(balanceFor(budget), language)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.drawerPrivacy}>{t('finance.privacyCopy')}</Text>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={managerOpen} animationType="slide" onRequestClose={() => setManagerOpen(false)}>
        <View style={styles.managerRoot}>
          <LinearGradient colors={['rgba(233,200,119,0.12)', 'transparent']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.managerSafe} edges={['top', 'bottom']}>
            <View style={styles.managerHeader}>
              <Pressable onPress={() => setManagerOpen(false)} style={styles.managerHeaderSide}>
                <Text style={styles.managerHeaderAction}>{t('finance.cancel')}</Text>
              </Pressable>
              <Text style={styles.managerHeaderTitle}>{t('finance.manageBudgets')}</Text>
              <Pressable onPress={() => setManagerOpen(false)} style={[styles.managerHeaderSide, styles.managerHeaderRight]}>
                <Text style={styles.managerHeaderAction}>{t('finance.done')}</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.managerContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.managerEyebrow}>{t('finance.yourBudgets')}</Text>
              <View style={styles.managerAccounts}>
                {budgets.map((budget) => {
                  const selected = budget.id === activeBudgetId;
                  return (
                    <Pressable
                      key={budget.id}
                      style={[styles.managerAccount, selected && styles.managerAccountSelected]}
                      onPress={() => { selectBudget(budget.id); setManagerOpen(false); }}
                    >
                      <View style={[styles.managerAccountMark, { backgroundColor: `${budget.color}22`, borderColor: budget.color }]}>
                        <View style={[styles.managerAccountMarkDot, { backgroundColor: budget.color }]} />
                      </View>
                      <View style={styles.managerAccountMain}>
                        <Text style={styles.managerAccountName}>{budget.name}</Text>
                        <Text style={styles.managerAccountMeta}>{budget.transactions.length} {t('finance.operations')}</Text>
                      </View>
                      <View style={styles.managerAccountRight}>
                        <Text style={styles.managerAccountBalance}>{formatMoney(balanceFor(budget), language)}</Text>
                        <Text style={[styles.managerSelected, selected && { color: budget.color }]}>
                          {selected ? t('finance.selected') : t('finance.select')}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.createCard}>
                <Text style={styles.createEyebrow}>{t('finance.newBudget')}</Text>
                <Text style={styles.createTitle}>{t('finance.createBudget')}</Text>

                <Text style={styles.inputLabel}>{t('finance.budgetName')}</Text>
                <TextInput
                  value={newBudgetName}
                  onChangeText={setNewBudgetName}
                  placeholder={t('finance.budgetNamePlaceholder')}
                  placeholderTextColor="rgba(255,244,208,0.28)"
                  style={styles.textInput}
                  maxLength={24}
                />

                <View style={styles.managerInputRow}>
                  <View style={styles.managerInputColumn}>
                    <Text style={styles.inputLabel}>{t('finance.openingBalance')}</Text>
                    <View style={styles.moneyInputShell}>
                      <Text style={styles.moneyInputCurrency}>$</Text>

                      <TextInput
                        value={newBudgetBalance}
                        onChangeText={(value) => setNewBudgetBalance(value.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="rgba(255,244,208,0.28)"
                        style={styles.moneyInput}
                      />
                    </View>
                  </View>
                  <View style={styles.managerInputColumn}>
                    <Text style={styles.inputLabel}>{t('finance.spendingLimit')}</Text>
                    <View style={styles.moneyInputShell}>
                      <Text style={styles.moneyInputCurrency}>$</Text>
                      <TextInput
                        value={newBudgetLimit}
                        onChangeText={(value) => setNewBudgetLimit(value.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder={`${DEFAULT_LIMIT}`}
                        placeholderTextColor="rgba(255,244,208,0.28)"
                        style={styles.moneyInput}
                      />
                    </View>
                  </View>
                </View>

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
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={entryOpen} transparent animationType="slide" onRequestClose={closeEntry}>
        <KeyboardAvoidingView style={styles.entryBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEntry} />
          <View style={styles.entrySheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.entryHeader}>
              <View>
                <Text style={styles.createEyebrow}>{activeBudget?.name}</Text>
                <Text style={styles.entryTitle}>{t('finance.newEntry')}</Text>
              </View>
              <Pressable style={styles.entryClose} onPress={closeEntry}><Text style={styles.entryCloseText}>x</Text></Pressable>
            </View>

            <View style={styles.kindControl}>
              {(['expense', 'income'] as TransactionKind[]).map((kind) => (
                <Pressable
                  key={kind}
                  onPress={() => setEntryKind(kind)}
                  style={[styles.kindOption, entryKind === kind && styles.kindOptionActive]}
                >
                  <Text style={[styles.kindText, entryKind === kind && styles.kindTextActive]}>
                    {kind === 'expense' ? t('finance.expense') : t('finance.income')}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>{t('finance.amount')}</Text>
            <View style={styles.amountInputShell}>
              <Text style={styles.amountCurrency}>$</Text>
              <TextInput
                value={entryAmount}
                onChangeText={(value) => setEntryAmount(value.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                autoFocus
                placeholder="0"
                placeholderTextColor="rgba(255,244,208,0.25)"
                style={styles.amountInput}
              />
            </View>

            <Text style={styles.inputLabel}>{t('finance.description')}</Text>
            <TextInput
              value={entryTitle}
              onChangeText={setEntryTitle}
              placeholder={t('finance.descriptionPlaceholder')}
              placeholderTextColor="rgba(255,244,208,0.28)"
              style={styles.textInput}

            />

            <Text style={styles.inputLabel}>{t('finance.category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
              {CATEGORIES.map((category) => (
                <Pressable
                  key={category}
                  onPress={() => setEntryCategory(category)}
                  style={[styles.categoryChip, entryCategory === category && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, entryCategory === category && styles.categoryChipTextActive]}>
                    {t(`finance.categories.${category}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.saveButton, parseAmount(entryAmount) <= 0 && styles.disabledButton]}
              onPress={addTransaction}
              disabled={parseAmount(entryAmount) <= 0}
            >
              <Text style={styles.saveButtonText}>{t('finance.saveEntry')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  root: { flex: 1 },
  header: { height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { maxWidth: 220, color: C.goldLight, fontFamily: SANS, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  headerSubtitle: { color: 'rgba(255,244,208,0.34)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.7, marginTop: 4 },
  menuGlyph: { width: 18, gap: 3.5 },
  menuLineWide: { width: 18, height: 1.5, borderRadius: 2, backgroundColor: C.goldLight },
  menuLine: { width: 12, height: 1.5, borderRadius: 2, backgroundColor: C.goldLight },
  accountsGlyph: { width: 19, gap: 3 },
  accountGlyphRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  accountGlyphDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.gold },
  accountGlyphLine: { width: 13, height: 1.5, borderRadius: 2, backgroundColor: C.goldLight },
  tabShell: { height: 50, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.11)', overflow: 'hidden' },
  budgetTabs: { alignItems: 'center', gap: 7, paddingHorizontal: 14 },
  budgetTab: { maxWidth: 170, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.15)', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.025)' },
  budgetTabActive: { borderColor: 'rgba(233,200,119,0.46)', backgroundColor: 'rgba(233,200,119,0.13)' },
  budgetTabDot: { width: 6, height: 6, borderRadius: 3, marginRight: 7 },
  budgetTabText: { flexShrink: 1, color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 10, letterSpacing: 0.5 },
  budgetTabTextActive: { color: C.goldLight, fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 34 },
  fixedContent: { flex: 1, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 9 },
  fixedBudgetView: { flex: 1 },
  compactHero: { height: 146, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(10,12,20,0.66)' },
  compactHeroInfo: { flex: 1, minWidth: 0, paddingLeft: 16, paddingTop: 14, paddingBottom: 14, justifyContent: 'space-between' },
  compactBalance: { maxWidth: 205, color: C.goldLight, fontFamily: SERIF, fontSize: 30, letterSpacing: 0.3, marginTop: 5 },
  compactTierBlock: { marginTop: 3 },
  compactLimitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7, paddingRight: 3 },
  compactLimitLabel: { flex: 1, color: 'rgba(255,244,208,0.34)', fontFamily: SANS, fontSize: 7, letterSpacing: 0.8 },
  compactLimitValue: { maxWidth: 116, color: 'rgba(255,244,208,0.6)', fontFamily: SERIF, fontSize: 9.5, textAlign: 'right' },
  compactGemWindow: { width: 130, height: 145, overflow: 'hidden' },
  compactGemCanvas: { position: 'absolute', width: 300, height: 288, left: -85, top: -71, transform: [{ scale: 0.45 }] },
  periodGrid: { height: 116, flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  periodCard: { width: '48.7%', height: 54.5, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.52)', paddingHorizontal: 10, paddingVertical: 8 },
  periodTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabel: { flex: 1, minWidth: 0, color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 7.5, letterSpacing: 0.6 },
  periodNet: { width: 66, fontFamily: SERIF, fontSize: 10.5, textAlign: 'right' },
  periodValues: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  periodValue: { flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 8.5 },
  periodDivider: { width: StyleSheet.hairlineWidth, height: 9, backgroundColor: C.line, marginHorizontal: 6 },
  fixedSectionHeader: { height: 43, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 7 },
  fixedOperationsPanel: { flex: 1, minHeight: 96, paddingBottom: 49 },
  floatingAdd: { position: 'absolute', right: 13, bottom: 12, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 12 },
  floatingAddText: { color: C.void, fontFamily: SANS, fontSize: 29, fontWeight: '300', lineHeight: 31 },
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
  microLabel: { color: 'rgba(255,244,208,0.34)', fontFamily: SANS, fontSize: 7.5, letterSpacing: 1.4, marginBottom: 5 },
  tierName: { maxWidth: 180, color: C.goldLight, fontFamily: SANS, fontSize: 9, letterSpacing: 1.1 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 11 },
  actionButton: { flex: 1, height: 54, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  expenseButton: { borderColor: 'rgba(240,139,136,0.32)', backgroundColor: 'rgba(240,139,136,0.075)' },
  incomeButton: { borderColor: 'rgba(125,217,178,0.32)', backgroundColor: 'rgba(125,217,178,0.075)' },
  actionCircle: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  expenseCircle: { backgroundColor: 'rgba(240,139,136,0.15)' },
  incomeCircle: { backgroundColor: 'rgba(125,217,178,0.15)' },
  expenseSymbol: { color: '#F08B88', fontFamily: SANS, fontSize: 18, lineHeight: 20 },
  incomeSymbol: { color: '#7DD9B2', fontFamily: SANS, fontSize: 17, lineHeight: 19 },
  actionText: { color: C.goldLight, fontFamily: SANS, fontSize: 9, letterSpacing: 0.8 },

  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metric: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.5)', paddingHorizontal: 11, paddingVertical: 12 },
  metricLabel: { color: 'rgba(255,244,208,0.34)', fontFamily: SANS, fontSize: 7.5, letterSpacing: 0.8, marginBottom: 7 },
  metricValue: { color: C.gold, fontFamily: SERIF, fontSize: 16 },
  incomeText: { color: '#7DD9B2' },
  expenseText: { color: '#F08B88' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24, marginBottom: 9 },
  sectionEyebrow: { color: 'rgba(233,200,119,0.45)', fontFamily: SANS, fontSize: 7.5, letterSpacing: 1.7, marginBottom: 5 },
  sectionTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '600', letterSpacing: 0.7 },
  operationCount: { minWidth: 27, height: 27, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, color: C.gold, fontFamily: SANS, fontSize: 9, textAlign: 'center', textAlignVertical: 'center', paddingHorizontal: 7 },
  panel: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.53)', paddingHorizontal: 13, overflow: 'hidden' },
  transactionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.09)' },
  categoryIcon: { width: 38, height: 38, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(233,200,119,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  incomeIcon: { backgroundColor: 'rgba(125,217,178,0.08)' },
  categoryLetter: { color: C.goldLight, fontFamily: SERIF, fontSize: 15 },
  transactionMain: { flex: 1, minWidth: 0 },
  transactionTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 11.5, letterSpacing: 0.2 },
  transactionMeta: { color: 'rgba(255,244,208,0.33)', fontFamily: SANS, fontSize: 8.5, letterSpacing: 0.3, marginTop: 5 },
  transactionAmount: { width: 91, fontFamily: SERIF, fontSize: 14, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 31 },
  emptyDiamond: { width: 19, height: 19, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 13, opacity: 0.75 },
  emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 11, letterSpacing: 0.8 },
  emptyCopy: { color: 'rgba(255,244,208,0.36)', fontFamily: SANS, fontSize: 9.5, lineHeight: 15, textAlign: 'center', marginTop: 7 },
  limitCard: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.53)', padding: 16 },
  limitAmounts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  limitSpent: { color: C.goldLight, fontFamily: SERIF, fontSize: 21 },
  limitTotal: { color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 9 },
  limitPercent: { color: C.gold, fontFamily: SANS, fontSize: 10, letterSpacing: 0.5 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  portfolioCard: { borderRadius: 25, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.6)', padding: 19 },
  portfolioBalance: { color: C.goldLight, fontFamily: SERIF, fontSize: 39, marginTop: 8, marginBottom: 14 },
  portfolioMetrics: { flexDirection: 'row', gap: 8 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  drawer: { width: '84%', height: '100%', backgroundColor: '#090B12', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.line, paddingHorizontal: 18 },
  drawerBrand: { height: 77, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  drawerMonogram: { width: 39, height: 39, borderRadius: 13, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: 11, backgroundColor: 'rgba(233,200,119,0.07)' },
  drawerMonogramText: { color: C.gold, fontFamily: SERIF, fontSize: 16 },
  drawerBrandName: { color: C.goldLight, fontFamily: SANS, fontSize: 11, letterSpacing: 2.2 },
  drawerBrandCopy: { color: 'rgba(255,244,208,0.32)', fontFamily: SANS, fontSize: 7, letterSpacing: 1.3, marginTop: 4 },
  drawerBalanceCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, padding: 15, marginTop: 17, backgroundColor: 'rgba(233,200,119,0.045)' },
  drawerBalance: { color: C.goldLight, fontFamily: SERIF, fontSize: 28, marginTop: 3 },
  drawerBudgetCount: { color: 'rgba(255,244,208,0.32)', fontFamily: SANS, fontSize: 8, letterSpacing: 0.8, marginTop: 7 },
  drawerNav: { marginTop: 18, gap: 4 },
  drawerItem: { height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  drawerItemActive: { backgroundColor: 'rgba(233,200,119,0.09)' },
  drawerItemIcon: { width: 31, alignItems: 'flex-start' },
  drawerItemText: { color: C.goldLight, fontFamily: SANS, fontSize: 10, letterSpacing: 0.6 },
  drawerHomeIcon: { width: 14, height: 14, borderWidth: 1, borderColor: C.gold, borderRadius: 3 },
  drawerActivityIcon: { width: 15, gap: 2.5 },
  drawerActivityIconRow: { width: 15, height: 1, backgroundColor: C.gold },
  drawerSectionLabel: { color: 'rgba(233,200,119,0.43)', fontFamily: SANS, fontSize: 7.5, letterSpacing: 1.7, marginTop: 24, marginBottom: 7, marginLeft: 6 },
  drawerBudgets: { maxHeight: 190 },
  drawerBudgetRow: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 },
  drawerBudgetDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  drawerBudgetName: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SANS, fontSize: 10 },
  drawerBudgetValue: { width: 86, color: 'rgba(255,244,208,0.48)', fontFamily: SERIF, fontSize: 11, textAlign: 'right' },
  drawerPrivacy: { color: 'rgba(255,244,208,0.24)', fontFamily: SANS, fontSize: 8.5, lineHeight: 13, marginTop: 'auto', marginBottom: 14 },
  managerRoot: { flex: 1, backgroundColor: C.void },
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
  createCard: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.62)', padding: 17, marginTop: 22 },
  createEyebrow: { color: 'rgba(233,200,119,0.55)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.7 },
  createTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 27, marginTop: 7, marginBottom: 8 },
  inputLabel: { color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.3, marginTop: 13, marginBottom: 7 },
  textInput: { height: 51, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)', color: C.goldLight, fontFamily: SANS, fontSize: 12, paddingHorizontal: 14 },
  managerInputRow: { flexDirection: 'row', gap: 9 },
  managerInputColumn: { flex: 1, minWidth: 0 },
  moneyInputShell: { height: 51, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  moneyInputCurrency: { color: C.gold, fontFamily: SERIF, fontSize: 17, marginRight: 5 },
  moneyInput: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SERIF, fontSize: 17, paddingVertical: 0 },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorButton: { width: 37, height: 37, borderRadius: 19, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  colorButtonSelected: { borderColor: C.goldLight },
  colorDot: { width: 25, height: 25, borderRadius: 13 },
  createButton: { height: 53, borderRadius: 16, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  createButtonText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 },
  disabledButton: { opacity: 0.35 },
  entryBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.66)' },
  entrySheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', paddingHorizontal: 19, paddingBottom: 28 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,244,208,0.2)', alignSelf: 'center', marginTop: 9, marginBottom: 13 },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  entryTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 27, marginTop: 5 },

  entryClose: { width: 31, height: 31, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  entryCloseText: { color: 'rgba(255,244,208,0.55)', fontFamily: SANS, fontSize: 13 },
  kindControl: { height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.055)', flexDirection: 'row', padding: 3, marginTop: 18 },
  kindOption: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kindOptionActive: { backgroundColor: 'rgba(233,200,119,0.17)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  kindText: { color: 'rgba(255,244,208,0.36)', fontFamily: SANS, fontSize: 9, letterSpacing: 0.9 },
  kindTextActive: { color: C.goldLight },
  amountInputShell: { height: 60, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  amountCurrency: { color: C.gold, fontFamily: SERIF, fontSize: 26, marginRight: 7 },
  amountInput: { flex: 1, color: C.goldLight, fontFamily: SERIF, fontSize: 27, paddingVertical: 0 },
  categoryChips: { gap: 7, paddingBottom: 2 },
  categoryChip: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 9 },
  categoryChipActive: { borderColor: C.gold, backgroundColor: 'rgba(233,200,119,0.13)' },
  categoryChipText: { color: 'rgba(255,244,208,0.43)', fontFamily: SANS, fontSize: 9 },
  categoryChipTextActive: { color: C.goldLight },
  saveButton: { height: 54, borderRadius: 17, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 21 },
  saveButtonText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
});
