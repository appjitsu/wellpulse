/**
 * Onboarding Wizard
 * Multi-step introduction to WellPulse with permission requests
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showErrorAlert } from '../../src/utils/error-alert';

const ONBOARDING_COMPLETE_KEY = 'wellpulse_onboarding_complete';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  action?: () => Promise<void>;
  actionLabel?: string;
  skipLabel?: string;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [photosGranted, setPhotosGranted] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();

  // Build steps array with platform-specific permissions
  const allSteps: OnboardingStep[] = [
    {
      title: 'Welcome to WellPulse',
      description:
        "Track field data, monitor well production, and sync your work across devices. Let's get you set up in just a few steps.",
      icon: '👋',
    },
    {
      title: 'Location Services',
      description:
        'WellPulse uses your location to automatically tag field entries with GPS coordinates, making it easy to track where readings were taken.',
      icon: '📍',
      action: requestLocationPermission,
      actionLabel: locationGranted ? 'Location Enabled ✓' : 'Enable Location',
      skipLabel: 'Skip',
    },
    {
      title: Platform.OS === 'web' ? 'Camera Access' : 'Camera Access',
      description:
        Platform.OS === 'web'
          ? 'Allow camera access to take photos of equipment and capture visual documentation (requires browser camera permission).'
          : 'Take photos of equipment, scan QR codes on wellheads, and capture visual documentation of field conditions.',
      icon: '📷',
      action: requestCameraPermissionHandler,
      actionLabel: cameraGranted ? 'Camera Enabled ✓' : 'Enable Camera',
      skipLabel: 'Skip',
    },
    // Only show Photo Library permission on mobile (iOS/Android)
    // Web/Desktop use standard file pickers which don't require permission
    ...(Platform.OS !== 'web'
      ? [
          {
            title: 'Photo Library',
            description:
              'Access your photo library to attach existing images to field reports and maintenance logs.',
            icon: '🖼️',
            action: requestPhotoLibraryPermission,
            actionLabel: photosGranted ? 'Photos Enabled ✓' : 'Enable Photo Library',
            skipLabel: 'Skip',
          } as OnboardingStep,
        ]
      : []),
    {
      title: 'Stay Informed',
      description:
        Platform.OS === 'web'
          ? 'Enable browser notifications for sync updates, well alerts, and maintenance reminders. You can customize these later in settings.'
          : 'Get notified about sync updates, well alerts, and maintenance reminders. You can customize these later in settings.',
      icon: '🔔',
      action: requestNotificationPermission,
      actionLabel: notificationsGranted ? 'Notifications Enabled ✓' : 'Enable Notifications',
      skipLabel: 'Skip',
    },
    // Biometric login only makes sense on mobile devices
    ...(Platform.OS !== 'web'
      ? [
          {
            title: 'Quick & Secure Access',
            description:
              'WellPulse supports biometric login (Face ID/Touch ID) for fast, secure access. Enroll biometrics on your device now, then enable this feature in Settings after logging in.',
            icon: '👆',
            action: openBiometricSettings,
            actionLabel: 'Open Settings',
            skipLabel: 'Next',
          } as OnboardingStep,
        ]
      : []),
    {
      title: "You're All Set!",
      description:
        'WellPulse is ready to help you manage your field operations. Log in to start tracking well data.',
      icon: '✅',
    },
  ];

  const steps = allSteps;

  async function requestLocationPermission() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        Alert.alert('Success', 'Location services enabled');
      } else {
        Alert.alert('Permission Denied', 'You can enable location services later in Settings');
      }
    } catch (error) {
      console.error('Failed to request location permission:', error);
      showErrorAlert({
        title: 'Permission Error',
        message: 'Failed to request location permission. You can enable it later in Settings.',
        error,
        technicalDetails: 'Check device location settings and app permissions.',
      });
    }
  }

  async function requestCameraPermissionHandler() {
    try {
      const { status } = await requestCameraPermission();
      if (status === 'granted') {
        setCameraGranted(true);
        Alert.alert('Success', 'Camera access enabled');
      } else {
        Alert.alert('Permission Denied', 'You can enable camera access later in Settings');
      }
    } catch (error) {
      console.error('Failed to request camera permission:', error);
      showErrorAlert({
        title: 'Permission Error',
        message: 'Failed to request camera permission. You can enable it later in Settings.',
        error,
        technicalDetails: 'Check device camera settings and app permissions.',
      });
    }
  }

  async function requestPhotoLibraryPermission() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status === 'granted') {
        setPhotosGranted(true);
        Alert.alert('Success', 'Photo library access enabled');
      } else {
        Alert.alert('Permission Denied', 'You can enable photo library access later in Settings');
      }
    } catch (error) {
      console.error('Failed to request photo library permission:', error);
      showErrorAlert({
        title: 'Permission Error',
        message: 'Failed to request photo library permission. You can enable it later in Settings.',
        error,
        technicalDetails: 'Check device photo library settings and app permissions.',
      });
    }
  }

  async function requestNotificationPermission() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsGranted(true);
        Alert.alert('Success', 'Notifications enabled');
      } else {
        Alert.alert('Permission Denied', 'You can enable notifications later in Settings');
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      showErrorAlert({
        title: 'Permission Error',
        message: 'Failed to request notification permission. You can enable it later in Settings.',
        error,
        technicalDetails: 'Check device notification settings and app permissions.',
      });
    }
  }

  async function openBiometricSettings() {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Failed to open settings:', error);
      showErrorAlert({
        title: 'Settings Error',
        message: 'Could not open device settings. Please open Settings manually.',
        error,
        technicalDetails: 'Deep linking to Settings app may not be supported on this device.',
      });
    }
  }

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      await completeOnboarding();
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleAction = async () => {
    const step = steps[currentStep];
    if (step.action) {
      await step.action();
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');

      // Set initial notification preferences based on onboarding choice
      const notificationPrefs = {
        pushEnabled: notificationsGranted,
        emailEnabled: false,
        syncAlerts: notificationsGranted,
        maintenanceReminders: notificationsGranted,
      };
      await AsyncStorage.setItem('wellpulse_notification_prefs', JSON.stringify(notificationPrefs));

      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      router.replace('/(auth)/login');
    }
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === currentStep && styles.progressDotActive,
              index < currentStep && styles.progressDotComplete,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.icon}>{step.icon}</Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {step.action && (
          <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
            <Text style={styles.actionButtonText}>{step.actionLabel}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.nextButton, !isLastStep && styles.nextButtonSecondary]}
          onPress={handleNext}
        >
          <Text style={[styles.nextButtonText, !isLastStep && styles.nextButtonTextSecondary]}>
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {step.skipLabel && !isLastStep && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>{step.skipLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#4F46E5',
  },
  progressDotComplete: {
    backgroundColor: '#10B981',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  icon: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#E0E7FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  nextButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonSecondary: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  nextButtonTextSecondary: {
    color: '#374151',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
