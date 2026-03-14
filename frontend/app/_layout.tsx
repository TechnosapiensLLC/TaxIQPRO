import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0F' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="signup" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="add-receipt" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="add-mileage" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="add-income" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="tax-coach" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="export-report" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
