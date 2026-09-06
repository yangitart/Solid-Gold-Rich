import React from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { StoreCashMovement, StoreState } from '@/features/store/domain/entities/Store';
import { cashMovementTotals, filterCashMovements, type CashFlowFilter } from '@/features/store/domain/services/storeCashMovements';
import { periodBounds } from '@/features/finance/domain/services/financeDomain';
import { SegmentedControl } from '@/shared/ui/FormKit';
import { useCurrentDate } from '@/shared/ui/useCurrentDate';
import ActionPressable from '@/shared/ui/ActionPressable';
import { C, SANS, SERIF, createThemeStyles } from '@/shared/theme/luxury';

type Period = 'all' | 'today' | 'week' | 'month' | 'year';
const movementTypes = ['opening', 'funding', 'withdrawal', 'sale', 'saleReversal', 'purchase', 'purchaseReversal', 'salary'] as const;
const dayKey = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export default function StoreMoneyMovements({ store, firstDayOfWeek }: { store: StoreState; firstDayOfWeek: 0 | 1 }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const compact = useWindowDimensions().width < 380;
  const [query, setQuery] = React.useState('');
  const [flow, setFlow] = React.useState<CashFlowFilter>('all');
  const [period, setPeriod] = React.useState<Period>('all');
  const now = useCurrentDate();
  const list = React.useRef<SectionList<StoreCashMovement>>(null);
  const money = (amount: number) => amount.toLocaleString(language, { maximumFractionDigits: 2 });
  const labels = React.useMemo(() => Object.fromEntries(movementTypes.map((type) => [type, t(type === 'salary' ? 'finance.payroll.salary' : `finance.store.cashMovement.${type}`)])), [t]);
  const context = React.useMemo(() => {
    const products = new Map(store.products.map((product) => [product.id, product.name]));
    const clients = new Map(store.clients.map((client) => [client.id, client.name]));
    const sales = new Map(store.sales.map((sale) => [sale.id, [sale.clientId ? clients.get(sale.clientId) : '', ...sale.items.map((item) => products.get(item.productId) ?? item.name)].filter(Boolean).join(' ')]));
    return Object.fromEntries(store.cashMovements.map((movement) => [movement.id, [movement.saleId ? sales.get(movement.saleId) : '', movement.productId ? products.get(movement.productId) : ''].filter(Boolean).join(' ')]));
  }, [store.cashMovements, store.clients, store.products, store.sales]);
  const visible = React.useMemo(() => filterCashMovements(store.cashMovements, {
    query, flow, currency: store.currency, labels, context,
    range: period === 'all' ? undefined : periodBounds(period, now, firstDayOfWeek),
  }), [store.cashMovements, store.currency, query, flow, labels, context, period, now, firstDayOfWeek]);
  const totals = React.useMemo(() => cashMovementTotals(visible, store.currency), [visible, store.currency]);
  const sections = React.useMemo(() => {
    const groups = new Map<string, { key: string; date: string; data: StoreCashMovement[] }>();
    visible.forEach((movement) => {
      const key = dayKey(movement.date);
      const group = groups.get(key) ?? { key, date: movement.date, data: [] };
      group.data.push(movement);
      groups.set(key, group);
    });
    return [...groups.values()];
  }, [visible]);
  const filtered = Boolean(query.trim() || flow !== 'all' || period !== 'all');
  const reset = () => { setQuery(''); setFlow('all'); setPeriod('all'); };
  React.useEffect(() => { list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false }); }, [query, flow, period]);

  return <View style={styles.root}>
    <View style={styles.controls}>
      <View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={query} onChangeText={setQuery} placeholder={t('finance.storeMovements.search')} accessibilityLabel={t('finance.storeMovements.search')} placeholderTextColor={C.textSubtle} style={styles.input} autoCorrect={false} returnKeyType="search" />{query.length > 0 && <Pressable style={styles.clear} onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('finance.activityUx.clearSearch')}><Ionicons name="close-circle" size={19} color={C.gold} /></Pressable>}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>{(['all', 'today', 'week', 'month', 'year'] as Period[]).map((value) => <ActionPressable key={value} style={[styles.period, value === period && styles.periodSelected]} onPress={() => setPeriod(value)} accessibilityRole="radio" accessibilityState={{ selected: value === period }}><Text style={[styles.periodText, value === period && styles.periodTextSelected]}>{t(`finance.storeMovements.period.${value}`)}</Text></ActionPressable>)}</ScrollView>
      <SegmentedControl label={t('finance.workspace.resourceFlow')} options={[{ value: 'all', label: t('finance.filters.all') }, { value: 'income', label: t('finance.storeMovements.inflows') }, { value: 'expense', label: t('finance.storeMovements.outflows') }]} value={flow} onChange={(value) => setFlow(value as CashFlowFilter)} />
    </View>
    <SectionList ref={list} style={styles.root} sections={sections} keyExtractor={(item) => item.id} stickySectionHeadersEnabled={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={16} contentContainerStyle={styles.content}
      ListHeaderComponent={<View>
        <View style={styles.results}><Text style={styles.heading}>{t('finance.storeMovements.results', { count: visible.length })}</Text>{filtered && <Pressable onPress={reset} style={styles.reset} accessibilityRole="button"><Text style={styles.resetText}>{t('finance.activity.clearFilters')}</Text></Pressable>}</View>
        {totals.length > 0 && <><Text style={styles.copy}>{t('finance.storeMovements.summaryCopy')}</Text>{totals.map((total) => <View key={total.currency} style={styles.summary}>
          <Text style={styles.currency}>{total.currency}</Text><View style={[styles.metrics, compact && styles.metricsCompact]}>{(['income', 'expense', 'net'] as const).map((metric) => <View key={metric} style={styles.metric}><Text style={styles.label}>{t(`finance.storeMovements.${metric === 'income' ? 'inflows' : metric === 'expense' ? 'outflows' : 'net'}`)}</Text><Text style={[styles.metricValue, (metric === 'expense' || total[metric] < 0) && styles.negative]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{money(total[metric])}</Text></View>)}</View>
        </View>)}</>}
      </View>}
      renderSectionHeader={({ section }) => <Text style={styles.day}>{dayKey(section.date) === dayKey(now) ? t('finance.activity.today') : new Date(section.date).toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text>}
      renderItem={({ item }) => {
        const positive = item.amount > 0;
        const label = labels[item.type];
        const detail = context[item.id];
        return <View style={styles.row}>
          <View style={[styles.icon, item.amount < 0 && styles.iconExpense]}><Ionicons name={item.amount === 0 ? 'remove-outline' : positive ? 'arrow-down-outline' : 'arrow-up-outline'} size={18} color={item.amount < 0 ? C.red : C.gold} /></View>
          <View style={styles.rowBody}><Text style={styles.rowTitle} numberOfLines={2}>{item.note.trim() || label}</Text><Text style={styles.meta} numberOfLines={2}>{[label, detail, item.currency ?? store.currency].filter(Boolean).join(' · ')}</Text><View style={styles.amountLine}><Text style={styles.time}>{new Date(item.date).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}</Text><Text style={[styles.amount, item.amount < 0 && styles.negative]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{positive ? '+' : ''}{money(item.amount)}</Text></View></View>
        </View>;
      }}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name={filtered ? 'search-outline' : 'wallet-outline'} size={30} color={C.gold} /><Text style={styles.emptyTitle}>{t(filtered ? 'finance.modules.noResults' : 'finance.store.noBusinessMovements')}</Text><Text style={styles.emptyCopy}>{t(filtered ? 'finance.storeFilters.noResults' : 'finance.store.noBusinessMovementsCopy')}</Text></View>}
    />
  </View>;
}

const styles = createThemeStyles((C) => StyleSheet.create({
  root: { flex: 1 }, controls: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  periods: { gap: 7, paddingTop: 12 }, period: { minHeight: 44, minWidth: 56, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.glass }, periodSelected: { backgroundColor: C.gold }, periodText: { color: C.textSubtle, fontFamily: SANS, fontSize: 11 }, periodTextSelected: { color: C.void, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass },
  input: { flex: 1, minWidth: 0, minHeight: 46, color: C.goldLight, fontFamily: SANS, fontSize: 12, paddingRight: 8 }, clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 110, width: '100%', maxWidth: 760, alignSelf: 'center' },
  results: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }, heading: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '600' }, reset: { minHeight: 44, justifyContent: 'center', maxWidth: '48%' }, resetText: { color: C.gold, fontFamily: SANS, fontSize: 11 },
  copy: { color: C.textSubtle, fontFamily: SANS, fontSize: 11, lineHeight: 16, marginBottom: 12 }, summary: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 14, marginBottom: 10 }, currency: { color: C.gold, fontFamily: SANS, fontWeight: '600', fontSize: 11, marginBottom: 10 }, metrics: { flexDirection: 'row', gap: 12 }, metricsCompact: { flexDirection: 'column' }, metric: { flex: 1, minWidth: 0 }, label: { color: C.textSubtle, fontFamily: SANS, fontSize: 10, marginBottom: 5 }, metricValue: { color: C.goldLight, fontFamily: SERIF, fontSize: 17 },
  day: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '600', marginTop: 20, marginBottom: 6 }, row: { flexDirection: 'row', gap: 11, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, icon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(233,200,119,0.1)' }, iconExpense: { backgroundColor: 'rgba(240,139,136,0.1)' }, rowBody: { flex: 1, minWidth: 0 }, rowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 13, lineHeight: 18 }, meta: { color: C.textSubtle, fontFamily: SANS, fontSize: 10, lineHeight: 15, marginTop: 3 }, amountLine: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 8 }, time: { color: C.textSubtle, fontFamily: SANS, fontSize: 10 }, amount: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SERIF, fontSize: 18, textAlign: 'right' }, negative: { color: C.red },
  empty: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 50, gap: 12 }, emptyTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 20, textAlign: 'center' }, emptyCopy: { color: C.textSubtle, fontFamily: SANS, fontSize: 12, lineHeight: 18, textAlign: 'center' },
}));
