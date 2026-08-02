import React from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import AuroraBackground from '../components/AuroraBackground';
import GoldDust from '../components/GoldDust';
import BootScreen from './BootScreen';
import RichScreen from './RichScreen';
import { C } from '../theme/luxury';
import i18n, { getPhoneLanguage } from '../core/locales/i18next';

// The background is mounted once so the transition from loading to the card
// stays continuous and the ambient animation never restarts.
export default function AppRoot() {
  const [booted, setBooted] = React.useState(false);
  const onDone = React.useCallback(() => setBooted(true), []);

  React.useEffect(() => {
    const syncLanguage = () => {
      const phoneLanguage = getPhoneLanguage();

      if (i18n.resolvedLanguage !== phoneLanguage) {
        void i18n.changeLanguage(phoneLanguage);
      }
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncLanguage();
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <GoldDust />
      {booted ? <RichScreen /> : <BootScreen onDone={onDone} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
});
