import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

const PUBLIC_ROUTES = ['index', 'login', 'signup'];

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const route = segments[0] ?? 'index';
    const isPublic = PUBLIC_ROUTES.includes(route);
    if (!isAuthenticated && !isPublic) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return null;
}

function ThemedStack() {
  const { colors: c, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
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
        <Stack.Screen name="pricing" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="swipe-classify" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import-csv" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="bank-statement" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="auto-trip" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="coa-mapping" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="qbo-sync" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="store-chain" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="barcode-scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate />
          <ThemedStack />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
