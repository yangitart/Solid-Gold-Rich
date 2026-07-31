import React from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import AuroraBackground from '../components/AuroraBackground';
import GoldDust from '../components/GoldDust';
import BootScreen from './BootScreen';
import RichScreen from './RichScreen';
import AuthLockScreen from './AuthLockScreen';
import { C } from '../theme/luxury';

const AUTH_KEY = '@im-rich/auth-enabled';

async function promptDeviceAuth() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock I\'m Rich',
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use device passcode',
  });
  return result.success;
}

// Contenedor de la app. Su único trabajo es ser dueño del FONDO: la aurora y el
// polvo de oro se montan una sola vez y siguen animándose durante la carga y
// después de ella. Por eso el paso de una pantalla a otra no se siente como un
// cambio de pantalla, sino como que la joya aparece sobre la misma escena.
export default function AppRoot() {
  const [booted, setBooted] = React.useState(false);
  const [authReady, setAuthReady] = React.useState(false);
  const [authEnabled, setAuthEnabled] = React.useState(false);
  const [unlocked, setUnlocked] = React.useState(false);
  const onDone = React.useCallback(() => setBooted(true), []);

  React.useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY).then((value) => {
      const enabled = value === '1';
      setAuthEnabled(enabled);
      setUnlocked(!enabled);
      setAuthReady(true);
    });
  }, []);

  const unlock = React.useCallback(async () => {
    try {
      const success = await promptDeviceAuth();
      if (success) setUnlocked(true);
      return success;
    } catch {
      return false;
    }
  }, []);

  const toggleAuth = React.useCallback(async () => {
    const success = await promptDeviceAuth();
    if (!success) return false;
    const nextValue = !authEnabled;
    await AsyncStorage.setItem(AUTH_KEY, nextValue ? '1' : '0');
    setAuthEnabled(nextValue);
    setUnlocked(true);
    return true;
  }, [authEnabled]);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <GoldDust />
      {!booted ? <BootScreen onDone={onDone} /> : !authReady ? <View style={styles.waiting} /> : authEnabled && !unlocked ? (
        <AuthLockScreen onUnlock={unlock} />
      ) : (
        <RichScreen authEnabled={authEnabled} onToggleAuth={toggleAuth} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  waiting: { flex: 1, backgroundColor: C.void },
});
