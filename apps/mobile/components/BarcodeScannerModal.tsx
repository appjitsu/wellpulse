/**
 * Enhanced Barcode Scanner Modal
 *
 * Professional-grade barcode scanner with:
 * - Animated scan line for visual feedback
 * - Torch/flashlight toggle for low-light conditions
 * - Manual barcode entry fallback
 * - Backend API integration for well lookup
 * - Comprehensive error handling
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { toast } from '@backpackapp-io/react-native-toast';
import { authService } from '../src/services/auth';

export interface BarcodeScanResult {
  wellId: string;
  wellName: string;
  apiNumber: string;
  latitude: number;
  longitude: number;
}

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (result: BarcodeScanResult) => void;
}

export function BarcodeScannerModal({ visible, onClose, onScanSuccess }: BarcodeScannerModalProps) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Position barcode in the frame');

  // Animated scan line
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Start scan line animation
  useEffect(() => {
    if (visible && !showManualEntry) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [visible, showManualEntry]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setTorchEnabled(false);
      setShowManualEntry(false);
      setManualCode('');
      setIsProcessing(false);
      setScanningEnabled(true);
      setStatusMessage('Position barcode in the frame');
    }
  }, [visible]);

  /**
   * Lookup well by barcode via backend API
   */
  const lookupWellByBarcode = async (code: string): Promise<BarcodeScanResult | null> => {
    try {
      const headers = await authService.getAuthHeaders();
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

      const response = await fetch(`${API_URL}/api/wells/barcode/${encodeURIComponent(code)}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Well not found
        }
        throw new Error(`API error: ${response.status}`);
      }

      const wellData = await response.json();

      return {
        wellId: wellData.id,
        wellName: wellData.name,
        apiNumber: wellData.apiNumber,
        latitude: wellData.latitude,
        longitude: wellData.longitude,
      };
    } catch (error) {
      console.error('[BarcodeScanner] API lookup error:', error);
      throw error;
    }
  };

  /**
   * Handle successful barcode scan
   */
  const handleBarcodeScan = async (code: string) => {
    if (!scanningEnabled || isProcessing) {
      return; // Prevent double-scanning
    }

    setScanningEnabled(false);
    setIsProcessing(true);
    setStatusMessage('Looking up well...');

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await lookupWellByBarcode(code);

      if (!result) {
        // Well not found
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setStatusMessage('Barcode not found');

        // Show cross-platform toast notification
        toast.error(`No well found with barcode "${code}"`, { duration: 4000 });

        // Reset state to allow retry
        setIsProcessing(false);
        setScanningEnabled(true);
        setManualCode(code); // Pre-fill for manual entry if user switches
        return;
      }

      // Success!
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatusMessage('Well found!');
      onScanSuccess(result);
      onClose();
    } catch (error) {
      console.error('[BarcodeScanner] Scan error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Show cross-platform toast notification
      const errorMessage = error instanceof Error ? error.message : 'Failed to lookup well';
      toast.error(errorMessage, { duration: 4000 });

      // Reset state to allow retry
      setIsProcessing(false);
      setScanningEnabled(true);
      setStatusMessage('Position barcode in the frame');
    }
  };

  /**
   * Handle camera barcode detection
   */
  const handleBarcodeScanned = ({ data }: { type: string; data: string }) => {
    handleBarcodeScan(data);
  };

  /**
   * Handle manual barcode entry submission
   */
  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      // Show cross-platform toast notification
      toast.error('Please enter a barcode or API number', { duration: 3000 });
      return;
    }

    handleBarcodeScan(manualCode.trim());
  };

  /**
   * Toggle torch/flashlight
   */
  const toggleTorch = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTorchEnabled((prev) => !prev);
  };

  /**
   * Request camera permission if not granted
   */
  const ensureCameraPermission = async () => {
    if (!cameraPermission?.granted) {
      const { status } = await requestCameraPermission();
      if (status !== 'granted') {
        // Show cross-platform toast notification
        toast.error('Camera permission is required to scan barcodes', { duration: 4000 });
        onClose();
        return false;
      }
    }
    return true;
  };

  // Check camera permission when modal opens
  useEffect(() => {
    if (visible) {
      ensureCameraPermission();
    }
  }, [visible]);

  // Calculate scan line position animation
  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250], // Height of scan box
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Manual Entry Mode */}
        {showManualEntry ? (
          <View style={styles.manualEntryContainer}>
            <Text style={styles.title}>Manual Barcode Entry</Text>
            <Text style={styles.subtitle}>
              Enter the barcode or API number from the well marker
            </Text>

            <TextInput
              style={styles.manualInput}
              placeholder="Enter barcode or API number"
              placeholderTextColor="#9CA3AF"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleManualSubmit}
            />

            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleManualSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>🔍 Lookup Well</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={() => setShowManualEntry(false)}
              disabled={isProcessing}
            >
              <Text style={styles.backButtonText}>← Back to Scanner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Camera Scanner Mode */}
            {cameraPermission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                enableTorch={torchEnabled}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'qr',
                    'code128',
                    'code39',
                    'code93',
                    'ean13',
                    'ean8',
                    'upc_a',
                    'upc_e',
                    'pdf417',
                    'aztec',
                    'datamatrix',
                  ],
                }}
                onBarcodeScanned={scanningEnabled ? handleBarcodeScanned : undefined}
              />
            ) : (
              <View style={styles.permissionDenied}>
                <Text style={styles.permissionText}>📷</Text>
                <Text style={styles.permissionMessage}>Camera permission required</Text>
                <TouchableOpacity
                  style={[styles.button, styles.permissionButton]}
                  onPress={requestCameraPermission}
                >
                  <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Scanner Overlay */}
            <View style={styles.overlay}>
              {/* Top Section */}
              <View style={styles.topSection}>
                <Text style={styles.title}>Scan Well Barcode</Text>
                <Text style={styles.statusMessage}>{statusMessage}</Text>
              </View>

              {/* Scan Frame */}
              <View style={styles.scanFrame}>
                <View style={styles.scanBox}>
                  {/* Corner Brackets */}
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />

                  {/* Animated Scan Line */}
                  {!isProcessing && scanningEnabled && (
                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          transform: [{ translateY: scanLineTranslateY }],
                        },
                      ]}
                    />
                  )}

                  {/* Processing Indicator */}
                  {isProcessing && (
                    <View style={styles.processingOverlay}>
                      <ActivityIndicator size="large" color="#10B981" />
                    </View>
                  )}
                </View>
              </View>

              {/* Bottom Controls */}
              <View style={styles.controls}>
                {/* Torch Toggle */}
                <TouchableOpacity
                  style={[styles.controlButton, torchEnabled && styles.controlButtonActive]}
                  onPress={toggleTorch}
                  disabled={isProcessing}
                >
                  <Text style={styles.controlIcon}>{torchEnabled ? '🔦' : '💡'}</Text>
                  <Text style={styles.controlLabel}>{torchEnabled ? 'Torch On' : 'Torch Off'}</Text>
                </TouchableOpacity>

                {/* Manual Entry */}
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => setShowManualEntry(true)}
                  disabled={isProcessing}
                >
                  <Text style={styles.controlIcon}>⌨️</Text>
                  <Text style={styles.controlLabel}>Manual</Text>
                </TouchableOpacity>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={isProcessing}
              >
                <Text style={styles.closeButtonText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  topSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
  },
  statusMessage: {
    fontSize: 16,
    color: '#10B981',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  scanFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#10B981',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 90,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  controlIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  controlLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignSelf: 'center',
    minWidth: 200,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  manualEntryContainer: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 24,
    justifyContent: 'center',
  },
  manualInput: {
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  backButton: {
    backgroundColor: '#374151',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  permissionDenied: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 64,
    marginBottom: 16,
  },
  permissionMessage: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#10B981',
    minWidth: 200,
  },
});
