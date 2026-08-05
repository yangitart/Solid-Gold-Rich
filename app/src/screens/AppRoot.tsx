import React from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import AuroraBackground from '../components/AuroraBackground';
import BootScreen from './BootScreen';
import RichScreen from './RichScreen';
import PinScreen from './PinScreen';
import { C } from '../theme/luxury';
import i18n, { getPhoneLanguage } from '../core/locales/i18next';
import { FinanceProvider, useFinance } from '../core/finance/FinanceContext';
import FinanceModulesScreen, { type FinanceModuleName } from './FinanceModulesScreen';

// The background is mounted once so the transition from loading to the card
// stays continuous and the ambient animation never restarts.
function AppContent() {
  const { state, loaded } = useFinance();
  const [booted, setBooted] = React.useState(false);
  const [unlocked, setUnlocked] = React.useState(false);
  const [moduleScreen, setModuleScreen] = React.useState<FinanceModuleName | null>(null);
  const initializedLock = React.useRef(false);
  const onDone = React.useCallback(() => setBooted(true), []);
  const hasPin = Boolean(state.settings.pinHash);
  const preferredLanguage = state.settings.language;

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
      {booted && loaded && hasPin && !unlocked ? <PinScreen pinHash={state.settings.pinHash ?? ''} onUnlock={() => setUnlocked(true)} /> : booted ? (
        moduleScreen ? <FinanceModulesScreen module={moduleScreen} onBack={() => setModuleScreen(null)} /> : <RichScreen onOpenModule={setModuleScreen} />
      ) : <BootScreen onDone={onDone} />}
    </View>
  );
}

export default function AppRoot() {
  return <FinanceProvider><AppContent /></FinanceProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
});
