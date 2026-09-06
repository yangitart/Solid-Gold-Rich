import { useEffect } from 'react';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppRoot from './src/components/AppRoot';
import { C } from './src/shared/ui/theme/luxury';

void SplashScreen.preventAutoHideAsync();

function Root() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: C.void }}>
      <StatusBar style="light" />
      <AppRoot />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
