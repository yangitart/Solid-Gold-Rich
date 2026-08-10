import React from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuroraBackground from '../components/AuroraBackground';
import BootScreen from './BootScreen';
import RichScreen from './RichScreen';
import PinScreen from './PinScreen';
import { C } from '../theme/luxury';
import i18n, { getPhoneLanguage } from '../core/locales/i18next';
import { FinanceProvider, useFinance } from '../core/finance/FinanceContext';
import FinanceModulesScreen, { type FinanceModuleName } from './FinanceModulesScreen';
import NotesFoldersScreen from './NotesFoldersScreen';
import OnboardingScreen from './OnboardingScreen';
import StoreScreen from './StoreScreen';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';

const ONBOARDING_KEY = '@solid-gold/onboarding-v1';

// The background is mounted once so the transition from loading to the card
// stays continuous and the ambient animation never restarts.
function AppContent() {
  const { t } = useTranslation();
  const { state, loaded, persistenceStatus, persistenceErrorPhase, retryPersistence } = useFinance();
  const [booted, setBooted] = React.useState(false);
  const [onboardingReady, setOnboardingReady] = React.useState(false);
  const [onboardingComplete, setOnboardingComplete] = React.useState(false);
  const [unlocked, setUnlocked] = React.useState(false);
  const [moduleScreen, setModuleScreen] = React.useState<FinanceModuleName | null>(null);
  const [reopenDrawerAfterModule, setReopenDrawerAfterModule] = React.useState(false);
  const [drawerReopenSignal, setDrawerReopenSignal] = React.useState(0);
  const initializedLock = React.useRef(false);
  const onDone = React.useCallback(() => setBooted(true), []);
  const hasPin = Boolean(state.settings.pinHash);
  const preferredLanguage = state.settings.language;

  React.useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => { if (active) setOnboardingComplete(value === 'complete'); })
      .finally(() => { if (active) setOnboardingReady(true); });
    return () => { active = false; };
  }, []);

  const finishOnboarding = React.useCallback(() => {
    setOnboardingComplete(true);
    void AsyncStorage.setItem(ONBOARDING_KEY, 'complete');
  }, []);

  const openModule = React.useCallback((module: FinanceModuleName, returnToDrawer = false) => {
    setReopenDrawerAfterModule(returnToDrawer);
    setModuleScreen(module);
  }, []);

  const closeModule = React.useCallback(() => {
    setModuleScreen(null);
    if (reopenDrawerAfterModule) setDrawerReopenSignal((current) => current + 1);
    setReopenDrawerAfterModule(false);
  }, [reopenDrawerAfterModule]);

  React.useEffect(() => {
    const syncLanguage = () => {
      const nextLanguage = preferredLanguage ?? getPhoneLanguage();

      if (i18n.resolvedLanguage !== nextLanguage) {
        void i18n.changeLanguage(nextLanguage);
      }
    };

    syncLanguage();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncLanguage();
        if (initializedLock.current && hasPin) setUnlocked(false);
      }
    });

    return () => subscription.remove();
  }, [hasPin, preferredLanguage]);

  React.useEffect(() => {
    if (!loaded || initializedLock.current) return;
    initializedLock.current = true;
    setUnlocked(!hasPin);
  }, [hasPin, loaded]);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      {!booted ? <BootScreen ready={loaded && onboardingReady} onDone={onDone} /> : persistenceStatus === 'error' && persistenceErrorPhase === 'load' ? <View style={styles.errorState}><View style={styles.errorCard}><Text style={styles.errorTitle}>{t('finance.releaseErrors.loadError')}</Text><Text style={styles.errorCopy}>{t('finance.releaseErrors.loadErrorCopy')}</Text><Pressable style={styles.retryButton} onPress={retryPersistence}><Text style={styles.retryText}>{t('finance.releaseErrors.retry')}</Text></Pressable></View></View> : !loaded || !onboardingReady ? null : !onboardingComplete ? <OnboardingScreen onComplete={finishOnboarding} /> : hasPin && !unlocked ? <PinScreen pinHash={state.settings.pinHash ?? ''} onUnlock={() => setUnlocked(true)} /> : <>
        <Animated.View key={state.settings.activeWorkspace} entering={FadeIn.duration(260).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(170).easing(Easing.in(Easing.cubic))} style={styles.mainLayer} pointerEvents={moduleScreen ? 'none' : 'auto'} importantForAccessibility={moduleScreen ? 'no-hide-descendants' : 'auto'}>
          {state.settings.activeWorkspace === 'store' ? <StoreScreen /> : <RichScreen onOpenModule={openModule} drawerReopenSignal={drawerReopenSignal} />}
        </Animated.View>
        {moduleScreen && <Animated.View key={moduleScreen} entering={SlideInRight.duration(280).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(170).easing(Easing.in(Easing.cubic))} style={styles.moduleLayer}>
          {moduleScreen === 'notes'
            ? <NotesFoldersScreen onBack={closeModule} />
            : <FinanceModulesScreen module={moduleScreen} onBack={closeModule} />}
        </Animated.View>}
        {persistenceStatus === 'error' && persistenceErrorPhase === 'save' && <View style={styles.saveBanner} accessibilityRole="alert">
          <View style={styles.saveBannerCopy}><Text style={styles.saveBannerTitle}>{t('finance.releaseErrors.saveError')}</Text><Text style={styles.saveBannerText}>{t('finance.releaseErrors.saveErrorCopy')}</Text></View>
          <Pressable style={styles.bannerRetry} onPress={retryPersistence} accessibilityLabel={t('finance.releaseErrors.retry')}><Text style={styles.bannerRetryText}>{t('finance.releaseErrors.retry')}</Text></Pressable>
        </View>}
      </>}
    </View>
  );
}

export default function AppRoot() {
  return <FinanceProvider><AppContent /></FinanceProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  mainLayer: { flex: 1 },
  moduleLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, backgroundColor: C.void },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorCard: { width: '100%', maxWidth: 430, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.25)', backgroundColor: 'rgba(10,12,20,0.94)', padding: 22 },
  errorTitle: { color: C.goldLight, fontSize: 21, textAlign: 'center', fontWeight: '600' },
  errorCopy: { color: 'rgba(255,244,208,0.62)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  retryButton: { minHeight: 48, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  retryText: { color: C.void, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  saveBanner: { position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 30, minHeight: 68, maxWidth: 620, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(240,139,136,0.42)', backgroundColor: 'rgba(22,13,17,0.98)', paddingHorizontal: 15, paddingVertical: 12 },
  saveBannerCopy: { flex: 1, minWidth: 0 },
  saveBannerTitle: { color: C.goldLight, fontSize: 13, fontWeight: '700' },
  saveBannerText: { color: 'rgba(255,244,208,0.58)', fontSize: 11, lineHeight: 16, marginTop: 3 },
  bannerRetry: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  bannerRetryText: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
});
