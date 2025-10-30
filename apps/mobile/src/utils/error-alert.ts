/**
 * Error Alert Utility with Copy Functionality
 * Shows user-friendly error messages with option to copy full error details
 */

import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export interface ErrorDetails {
  title: string;
  message: string;
  error?: Error | unknown;
  technicalDetails?: string;
}

/**
 * Shows an error alert with a copy button to save error details to clipboard
 */
export function showErrorAlert(details: ErrorDetails): void {
  const { title, message, error, technicalDetails } = details;

  // Build full error details for copying
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const fullDetails = [
    `Error: ${title}`,
    `Message: ${message}`,
    errorMessage ? `Details: ${errorMessage}` : null,
    technicalDetails ? `Technical: ${technicalDetails}` : null,
    errorStack ? `\nStack Trace:\n${errorStack}` : null,
    `\nTimestamp: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  Alert.alert(
    title,
    message,
    [
      {
        text: 'Copy Error',
        onPress: async () => {
          try {
            await Clipboard.setStringAsync(fullDetails);
            Alert.alert('Copied', 'Error details copied to clipboard');
          } catch (err) {
            console.error('Failed to copy error to clipboard:', err);
          }
        },
        style: 'default',
      },
      {
        text: 'OK',
        style: 'cancel',
      },
    ],
    { cancelable: true },
  );
}

/**
 * Quick error alert for simple errors (with copy functionality)
 */
export function showQuickError(title: string, message: string, error?: Error | unknown): void {
  showErrorAlert({ title, message, error });
}
