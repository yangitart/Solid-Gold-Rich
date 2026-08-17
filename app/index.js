import React, { useEffect } from 'react';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppRoot from './src/screens/AppRoot';
import { C } from './src/theme/luxury';

SplashScreen.preventAutoHideAsync();

function Root() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: C.void }}>
      <StatusBar style="light" backgroundColor={C.void} />
      <AppRoot />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
