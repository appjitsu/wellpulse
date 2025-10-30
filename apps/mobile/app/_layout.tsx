import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toasts } from '@backpackapp-io/react-native-toast';
import { db } from '../src/db/database';
import { authService } from '../src/services/auth';
import { ErrorBoundary } from '../components/ErrorBoundary';

const ONBOARDING_COMPLETE_KEY = 'wellpulse_onboarding_complete';

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Initialize SQLite database on app start
    db.initialize().catch((error) => {
      console.error('Failed to initialize database:', error);
    });

    // Listen for app state changes (background/foreground)
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    // Check if app is coming to foreground from background
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[App] App has come to the foreground - checking auth...');

      // First check segments - most reliable for current screen
      const segmentsArray = segments as string[];
      const isOnOnboarding =
        segmentsArray.length >= 2 &&
        segmentsArray[0] === '(auth)' &&
        segmentsArray[1] === 'onboarding';

      if (isOnOnboarding) {
        console.log('[App] User on onboarding screen (via segments), skipping auth check');
        appState.current = nextAppState;
        return;
      }

      // Check if onboarding is complete - if not, skip auth check
      const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      console.log('[App] Onboarding complete status:', onboardingComplete);

      if (onboardingComplete !== 'true') {
        console.log('[App] Onboarding not complete (via AsyncStorage), skipping auth check');
        appState.current = nextAppState;
        return;
      }

      // Check if user is authenticated and token is valid
      const isAuthenticated = await authService.isAuthenticated();

      if (!isAuthenticated) {
        // Token expired or invalid - redirect to login
        console.log('[App] Token expired or invalid, redirecting to login...');

        // Only redirect if not already on auth screens
        const inAuthGroup = (segments as string[])[0] === '(auth)';
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
      }
    }

    appState.current = nextAppState;
  };

  const content = (
    <ErrorBoundary>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* Cross-platform toast notifications (works on iOS, Android, Web, Desktop) */}
      <Toasts />
    </ErrorBoundary>
  );

  // Wrap with SafeAreaProvider (required for all platforms, especially web)
  // Then wrap with GestureHandlerRootView only on native platforms
  if (Platform.OS === 'web') {
    return <SafeAreaProvider>{content}</SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>{content}</GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
