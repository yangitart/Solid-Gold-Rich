import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from '../src/theme/luxury';

// La splash se mantiene hasta el primer frame: así no se ve el flash blanco
// entre el icono y el fondo negro de la app.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // No se carga ninguna fuente propia — la app tira de serif/sans del sistema,
  // así que no hay nada que esperar y arranca directo.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.void }}>
        <StatusBar style="light" backgroundColor={C.void} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.void },
          }}
        />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
