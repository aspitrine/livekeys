import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootEngine } from '../engine/boot';
import { colors } from '../theme';

export default function RootLayout() {
  useEffect(() => {
    bootEngine();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.panel },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="layer/[id]" options={{ presentation: 'modal', title: 'Layer' }} />
        <Stack.Screen name="sound/[layerId]" options={{ presentation: 'modal', title: 'Choisir un son' }} />
        <Stack.Screen name="effect/[layerId]" options={{ presentation: 'modal', title: 'Ajouter un effet' }} />
        <Stack.Screen name="plugin/[layerId]" options={{ presentation: 'fullScreenModal', title: 'Plugin' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Réglages' }} />
        <Stack.Screen name="stage" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="credits" options={{ presentation: 'modal', title: 'Crédits' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
