/**
 * Root Index - Redirects to onboarding, auth, or main app
 */

import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../src/services/auth';

const ONBOARDING_COMPLETE_KEY = 'wellpulse_onboarding_complete';

export default function Index() {
  const [isChecking, setIsChecking] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      // Check if onboarding is complete
      const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      setIsOnboardingComplete(onboardingComplete === 'true');

      // If onboarding is complete, check authentication
      if (onboardingComplete === 'true') {
        const authenticated = await authService.isAuthenticated();
        setIsLoggedIn(authenticated);
      }
    } catch (error) {
      console.error('App state check failed:', error);
      setIsOnboardingComplete(false);
      setIsLoggedIn(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Show loading spinner while checking app state
  if (isChecking) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f9fafb',
        }}
      >
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  // Redirect to onboarding if not complete
  if (!isOnboardingComplete) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // Redirect to main app if logged in
  if (isLoggedIn) {
    return <Redirect href="/(tabs)" />;
  }

  // Redirect to login
  return <Redirect href="/(auth)/login" />;
}
