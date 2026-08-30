import React from 'react';
import { KeyboardAvoidingView, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, SANS, SERIF, createThemeStyles } from '@/shared/theme/luxury';
import { useFinance } from '@/features/app-state/presentation/components/AppStateContext';
import i18n, { getPhoneLanguage, supportedLanguages, type SupportedLanguage } from '@/shared/i18n/i18next';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const CURRENCY_OPTIONS = [
  'AED', 'ARS', 'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CZK', 'DKK', 'DOP', 'EGP', 'EUR', 'GBP', 'GTQ', 'HKD', 'HNL', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'NIO', 'NOK', 'NZD', 'PAB', 'PEN', 'PHP', 'PLN', 'PYG', 'RON', 'RUB', 'SEK', 'SGD', 'THB', 'TRY', 'UAH', 'USD', 'UYU', 'VES', 'VND', 'ZAR',
] as const;
const PAGES: { key: 'accounts' | 'operations' | 'statistics' | 'organize' | 'store' | 'privacy' | 'currency'; icon: IconName }[] = [
  { key: 'accounts', icon: 'wallet-outline' },
  { key: 'operations', icon: 'receipt-outline' },
  { key: 'statistics', icon: 'analytics-outline' },
  { key: 'organize', icon: 'folder-open-outline' },
  { key: 'store', icon: 'storefront-outline' },
  { key: 'privacy', icon: 'shield-checkmark-outline' },
  { key: 'currency', icon: 'cash-outline' },
];

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const { state, updateState } = useFinance();
  const { width, height } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView>(null);
  const [page, setPage] = React.useState(0);
  const [currency, setCurrency] = React.useState(state.settings.preferredCurrency || 'USD');
  const [customCurrencies, setCustomCurrencies] = React.useState<string[]>(() => {
    const preferred = (state.settings.preferredCurrency || 'USD').toUpperCase();
    return (CURRENCY_OPTIONS as readonly string[]).includes(preferred) ? [] : [preferred];
  });
  const [currencyPickerOpen, setCurrencyPickerOpen] = React.useState(false);
  const [currencyQuery, setCurrencyQuery] = React.useState('');
  const [languagePickerOpen, setLanguagePickerOpen] = React.useState(false);
  const [language, setLanguage] = React.useState<SupportedLanguage>(() => state.settings.language ?? getPhoneLanguage());
  const [onboardingCategoryType, setOnboardingCategoryType] = React.useState<'expense' | 'income'>('expense');
  const [onboardingCategoryName, setOnboardingCategoryName] = React.useState('');
  const [onboardingCategoryError, setOnboardingCategoryError] = React.useState('');
  const compact = height < 700;
  const veryCompact = height < 620;
  const lastPage = page === PAGES.length - 1;
  const availableCurrencies = React.useMemo(() => Array.from(new Set([...CURRENCY_OPTIONS, ...customCurrencies, currency])).sort(), [currency, customCurrencies]);
  const normalizedCurrencyQuery = currencyQuery.trim().toUpperCase();
  const filteredCurrencies = availableCurrencies.filter((item) => !normalizedCurrencyQuery || item.includes(normalizedCurrencyQuery));
  const canAddCustomCurrency = /^[A-Z]{3}$/.test(normalizedCurrencyQuery) && !availableCurrencies.includes(normalizedCurrencyQuery);

  const addOnboardingCategory = () => {
    const name = onboardingCategoryName.trim();
    if (!name) {
      setOnboardingCategoryError(t('finance.storeUnits.categoryRequired'));
      return;
    }
    const id = name.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id) return;
    const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    if (state.categories[onboardingCategoryType].some((item) => {
      const label = item.name ?? t(`finance.categories.${item.id}`, { defaultValue: item.id });
      return item.id === id || label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase() === normalizedName;
    })) {
      setOnboardingCategoryError(t('finance.categoryExists'));
      return;
    }
    updateState((current) => ({
      ...current,
      categories: {
        ...current.categories,
        [onboardingCategoryType]: [...current.categories[onboardingCategoryType], { id, icon: 'pricetag-outline', name, builtIn: false }],
      },
    }));
    setOnboardingCategoryName('');
    setOnboardingCategoryError('');
  };

  const addCustomCurrency = () => {
    if (!canAddCustomCurrency) return;
    setCustomCurrencies((current) => current.includes(normalizedCurrencyQuery) ? current : [...current, normalizedCurrencyQuery]);
    setCurrency(normalizedCurrencyQuery);
    setCurrencyQuery('');
    setCurrencyPickerOpen(false);
  };

  const completeOnboarding = () => {
    updateState((current) => {
      const storeHasHistory = current.store.products.length > 0 || current.store.sales.length > 0 || current.store.stockMovements.length > 0 || current.store.cashMovements.length > 0;
      return {
        ...current,
        settings: { ...current.settings, preferredCurrency: currency, language, exchangeRates: { ...(current.settings.exchangeRates ?? {}), USD: 1 } },
        store: storeHasHistory ? current.store : { ...current.store, currency, businessAccount: { ...current.store.businessAccount, currency } },
      };
    });
    onComplete();
  };

  const selectLanguage = (nextLanguage: SupportedLanguage) => {
    setLanguage(nextLanguage);
    void i18n.changeLanguage(nextLanguage);
    setLanguagePickerOpen(false);
  };

  const updatePage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.max(0, Math.min(PAGES.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))));
  };

  const continueFlow = () => {
    if (lastPage) {
      completeOnboarding();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage((current) => Math.min(PAGES.length - 1, current + 1));
  };

  const skipToCurrency = () => {
    const target = PAGES.length - 1;
    scrollRef.current?.scrollTo({ x: width * target, animated: true });
    setPage(target);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.brandMark}><View style={styles.brandDiamond} /></View>
        <Text style={styles.brand}>SOLID GOLD RICH</Text>
        <Pressable style={styles.languageButton} onPress={() => setLanguagePickerOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('finance.language')}><Ionicons name="globe-outline" size={14} color={C.gold} /><Text style={styles.languageButtonText}>{language.toUpperCase()}</Text></Pressable>
        {!lastPage ? <Pressable onPress={skipToCurrency} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('app.onboarding.skip')}><Text style={styles.skip}>{t('app.onboarding.skip')}</Text></Pressable> : <View style={styles.topSpacer} />}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={updatePage}
        scrollEventThrottle={16}
      >
        {PAGES.map((item) => (
          <View key={item.key} style={[styles.page, { width }, compact && styles.pageCompact]}>
            <View style={[styles.visualStage, compact && styles.visualStageCompact, veryCompact && styles.visualStageVeryCompact]}>
              <LinearGradient colors={['rgba(233,200,119,0.17)', 'rgba(233,200,119,0.025)']} style={styles.visualGlow} />
              <View style={styles.orbitOuter} />
              <View style={styles.orbitInner} />
              <View style={[styles.iconShell, veryCompact && styles.iconShellVeryCompact]}><Ionicons name={item.icon} size={veryCompact ? 31 : compact ? 38 : 44} color={C.goldLight} /></View>
            </View>
            <Text style={styles.eyebrow}>{item.key === 'currency' ? t('app.onboarding.currency.eyebrow') : item.key === 'store' ? t('app.onboardingStore.eyebrow') : t(`app.onboarding.pages.${item.key}.eyebrow`)}</Text>
            <Text style={[styles.title, compact && styles.titleCompact, veryCompact && styles.titleVeryCompact]}>{item.key === 'currency' ? t('app.onboarding.currency.title') : item.key === 'store' ? t('app.onboardingStore.title') : t(`app.onboarding.pages.${item.key}.title`)}</Text>
            <Text style={[styles.body, veryCompact && styles.bodyVeryCompact]}>{item.key === 'currency' ? t('app.onboarding.currency.body') : item.key === 'store' ? t('app.onboardingStore.body') : t(`app.onboarding.pages.${item.key}.body`)}</Text>
            {item.key === 'organize' && <View style={styles.onboardingCategoryCard}>
              <View style={styles.onboardingCategoryHeader}><Text style={styles.onboardingCategoryLabel}>{t('finance.category')}</Text><View style={styles.onboardingCategoryTabs}>{(['expense', 'income'] as const).map((type) => <Pressable key={type} style={[styles.onboardingCategoryTab, onboardingCategoryType === type && styles.onboardingCategoryTabActive]} onPress={() => { setOnboardingCategoryType(type); setOnboardingCategoryError(''); }} accessibilityRole="tab" accessibilityState={{ selected: onboardingCategoryType === type }}><Text style={[styles.onboardingCategoryTabText, onboardingCategoryType === type && styles.onboardingCategoryTabTextActive]}>{t(type === 'expense' ? 'finance.expenses' : 'finance.income')}</Text></Pressable>)}</View></View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.onboardingCategoryList}>{state.categories[onboardingCategoryType].map((category) => <View key={category.id} style={styles.onboardingCategoryChip}><Text style={styles.onboardingCategoryChipText} numberOfLines={1}>{category.name ?? t(`finance.categories.${category.id}`, { defaultValue: category.id })}</Text></View>)}</ScrollView>
              <View style={styles.onboardingCategoryAddRow}><TextInput value={onboardingCategoryName} onChangeText={(value) => { setOnboardingCategoryName(value); setOnboardingCategoryError(''); }} placeholder={t('finance.categoryPlaceholder')} placeholderTextColor={C.textSubtle} style={styles.onboardingCategoryInput} returnKeyType="done" maxLength={32} onSubmitEditing={addOnboardingCategory} /><Pressable style={[styles.onboardingCategoryAddButton, !onboardingCategoryName.trim() && styles.onboardingCategoryAddButtonDisabled]} onPress={addOnboardingCategory} accessibilityRole="button" accessibilityLabel={t('finance.addCategory')}><Ionicons name="add" size={19} color={C.void} /></Pressable></View>
              {onboardingCategoryError ? <Text style={styles.onboardingCategoryError}>{onboardingCategoryError}</Text> : null}
            </View>}
            {item.key === 'currency' && <Pressable style={styles.currencySelect} onPress={() => { setCurrencyQuery(''); setCurrencyPickerOpen(true); }} accessibilityRole="button" accessibilityLabel={t('app.onboarding.currency.select')}><View><Text style={styles.currencyCode}>{currency}</Text><Text style={styles.currencyHint}>{t('app.onboarding.currency.select')}</Text></View><Ionicons name="chevron-down-outline" size={18} color={C.gold} /></Pressable>}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>{PAGES.map((item, index) => <View key={item.key} style={[styles.dot, index === page && styles.dotActive]} />)}</View>
        <Pressable style={styles.continueButton} onPress={continueFlow} accessibilityRole="button" accessibilityLabel={lastPage ? t('app.onboarding.start') : t('app.onboarding.next')}>
          <Text style={styles.continueText}>{lastPage ? t('app.onboarding.start') : t('app.onboarding.next')}</Text>
          <Ionicons name={lastPage ? 'checkmark' : 'arrow-forward'} size={18} color={C.void} />
        </Pressable>
      </View>
      <Modal visible={currencyPickerOpen} transparent animationType="fade" onRequestClose={() => setCurrencyPickerOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding" enabled={Platform.OS === 'ios'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCurrencyPickerOpen(false)} />
          <View style={styles.currencySheet}>
            <View style={styles.currencyHeader}><Text style={styles.currencyTitle}>{t('app.onboarding.currency.select')}</Text><Pressable style={styles.closeButton} onPress={() => setCurrencyPickerOpen(false)} accessibilityLabel={t('app.onboarding.currency.close')}><Ionicons name="close" size={18} color={C.goldLight} /></Pressable></View>
            <View style={styles.currencySearch}><Ionicons name="search-outline" size={17} color={C.textSubtle} /><TextInput value={currencyQuery} onChangeText={(value) => setCurrencyQuery(value.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={3} placeholder={t('app.onboarding.currency.search')} placeholderTextColor={C.textSubtle} style={styles.currencySearchInput} /></View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {canAddCustomCurrency && <Pressable style={styles.currencyOption} onPress={addCustomCurrency} accessibilityRole="button" accessibilityLabel={t('app.onboarding.currency.add', { currency: normalizedCurrencyQuery })}><View><Text style={styles.currencyOptionText}>{t('app.onboarding.currency.add', { currency: normalizedCurrencyQuery })}</Text><Text style={styles.currencyCustomHint}>{t('app.onboarding.currency.custom')}</Text></View><Ionicons name="add" size={18} color={C.gold} /></Pressable>}
              {filteredCurrencies.map((item) => <Pressable key={item} style={[styles.currencyOption, currency === item && styles.currencyOptionActive]} onPress={() => { setCurrency(item); setCurrencyQuery(''); setCurrencyPickerOpen(false); }}><Text style={styles.currencyOptionText}>{item}</Text>{currency === item && <Ionicons name="checkmark" size={18} color={C.gold} />}</Pressable>)}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={languagePickerOpen} transparent animationType="fade" onRequestClose={() => setLanguagePickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLanguagePickerOpen(false)} />
          <View style={styles.languageSheet}>
            <View style={styles.currencyHeader}><Text style={styles.currencyTitle}>{t('finance.language')}</Text><Pressable style={styles.closeButton} onPress={() => setLanguagePickerOpen(false)} accessibilityLabel={t('finance.close')}><Ionicons name="close" size={18} color={C.goldLight} /></Pressable></View>
            <Text style={styles.languageCopy}>{t('app.onboarding.pages.privacy.body')}</Text>
            <View style={styles.languageOptions}>{supportedLanguages.map((item) => <Pressable key={item} style={[styles.languageOption, language === item && styles.currencyOptionActive]} onPress={() => selectLanguage(item)} accessibilityRole="radio" accessibilityState={{ selected: language === item }}><View style={styles.languageOptionCopy}><Text style={styles.currencyOptionText}>{t(`finance.languages.${item}`)}</Text><Text style={styles.languageCode}>{item.toUpperCase()}</Text></View>{language === item && <Ionicons name="checkmark" size={18} color={C.gold} />}</Pressable>)}</View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = createThemeStyles((C) => StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,5,10,0.9)' },
  topBar: { height: 62, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  brandDiamond: { width: 12, height: 12, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }] },
  brand: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 8.5, fontWeight: '700', letterSpacing: 1.8 },
  languageButton: { minHeight: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.025)', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 9 },
  languageButtonText: { color: C.goldLight, fontFamily: SANS, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  skip: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '600' },
  topSpacer: { width: 40 },
  page: { paddingHorizontal: 27, paddingTop: 20, alignItems: 'center' },
  pageCompact: { paddingTop: 4 },
  visualStage: { width: 236, height: 236, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  visualStageCompact: { width: 184, height: 184, marginBottom: 18 },
  visualStageVeryCompact: { width: 138, height: 138, marginBottom: 10 },
  visualGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 118 },
  orbitOuter: { position: 'absolute', width: '86%', height: '86%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.18)' },
  orbitInner: { position: 'absolute', width: '60%', height: '60%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,244,208,0.12)' },
  iconShell: { width: 92, height: 92, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.34)', backgroundColor: 'rgba(10,12,20,0.76)', alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  iconShellVeryCompact: { width: 68, height: 68, borderRadius: 23 },
  eyebrow: { color: 'rgba(233,200,119,0.64)', fontFamily: SANS, fontSize: 8, fontWeight: '700', letterSpacing: 2.1, textAlign: 'center' },
  title: { maxWidth: 330, color: C.goldLight, fontFamily: SERIF, fontSize: 34, lineHeight: 40, textAlign: 'center', marginTop: 11 },
  titleCompact: { fontSize: 29, lineHeight: 34 },
  titleVeryCompact: { fontSize: 25, lineHeight: 29, marginTop: 8 },
  body: { maxWidth: 330, color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 14 },
  bodyVeryCompact: { fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  onboardingCategoryCard: { width: '100%', maxWidth: 330, marginTop: 16, padding: 11, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.16)', backgroundColor: 'rgba(10,12,20,0.5)' },
  onboardingCategoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  onboardingCategoryLabel: { color: C.goldLight, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  onboardingCategoryTabs: { flexDirection: 'row', gap: 5 },
  onboardingCategoryTab: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.035)' },
  onboardingCategoryTabActive: { backgroundColor: 'rgba(233,200,119,0.16)' },
  onboardingCategoryTabText: { color: 'rgba(255,244,208,0.45)', fontFamily: SANS, fontSize: 8, fontWeight: '700' },
  onboardingCategoryTabTextActive: { color: C.goldLight },
  onboardingCategoryList: { gap: 6, paddingVertical: 10 },
  onboardingCategoryChip: { maxWidth: 130, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.035)' },
  onboardingCategoryChipText: { color: 'rgba(255,244,208,0.62)', fontFamily: SANS, fontSize: 9 },
  onboardingCategoryAddRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7 },
  onboardingCategoryInput: { flex: 1, minHeight: 36, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 0, color: C.goldLight, fontFamily: SANS, fontSize: 10, backgroundColor: 'rgba(255,255,255,0.045)' },
  onboardingCategoryAddButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gold },
  onboardingCategoryAddButtonDisabled: { opacity: 0.38 },
  onboardingCategoryError: { color: C.red, fontFamily: SANS, fontSize: 9, marginTop: 6 },
  currencySelect: { width: '100%', maxWidth: 300, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.32)', backgroundColor: 'transparent', paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  currencyCode: { color: C.goldLight, fontFamily: SERIF, fontSize: 22 },
  currencyHint: { color: 'rgba(255,244,208,0.48)', fontFamily: SANS, fontSize: 9, marginTop: 2 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.76)' },
  currencySheet: { width: '100%', maxWidth: 430, maxHeight: '76%', alignSelf: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.11)', backgroundColor: '#0A0C14', padding: 16 },
  currencyHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencyTitle: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SERIF, fontSize: 22 },
  closeButton: { flexShrink: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  currencySearch: { height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.035)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  currencySearchInput: { flex: 1, height: 43, color: C.goldLight, fontFamily: SANS, fontSize: 12, paddingVertical: 0 },
  currencyOption: { minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)', paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currencyOptionActive: { backgroundColor: 'rgba(233,200,119,0.06)' },
  currencyOptionText: { color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  currencyCustomHint: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 9, marginTop: 3 },
  languageSheet: { width: '100%', maxWidth: 430, alignSelf: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.11)', backgroundColor: '#0A0C14', padding: 16 },
  languageCopy: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 10 },
  languageOptions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  languageOption: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)', paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  languageOptionCopy: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  languageCode: { color: 'rgba(255,244,208,0.35)', fontFamily: SANS, fontSize: 9, letterSpacing: 1 },
  footer: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  dots: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(233,200,119,0.22)' },
  dotActive: { width: 22, backgroundColor: C.gold },
  continueButton: { width: '100%', minHeight: 52, borderRadius: 17, backgroundColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  continueText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
}));
