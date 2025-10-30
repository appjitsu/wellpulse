/**
 * Share Photos Modal
 * Allows user to select photos and enter email addresses to share field entry photos
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { Photo } from '../src/db/schema';
import * as Haptics from 'expo-haptics';
import { toast } from '@backpackapp-io/react-native-toast';
import { authService } from '../src/services/auth';

interface SharePhotosModalProps {
  visible: boolean;
  photos: Photo[];
  wellName?: string;
  entryData?: {
    productionVolume?: number;
    pressure?: number;
    temperature?: number;
    gasVolume?: number;
    waterCut?: number;
    notes?: string;
    recordedAt?: string;
    latitude?: number;
    longitude?: number;
  };
  checklist?: Array<{
    label: string;
    checked: boolean;
  }>;
  onClose: () => void;
}

export function SharePhotosModal({
  visible,
  photos,
  wellName,
  entryData,
  checklist,
  onClose,
}: SharePhotosModalProps) {
  const [emails, setEmails] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [isSending, setIsSending] = useState(false);

  // Select/deselect all photos
  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map((_, index) => index)));
    }
  };

  // Toggle photo selection
  const handleTogglePhoto = (index: number) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPhotos(newSelected);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Validate email addresses
  const validateEmails = (emailString: string): string[] => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailList = emailString
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const validEmails = emailList.filter((email) => emailRegex.test(email));
    const invalidEmails = emailList.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }

    return validEmails;
  };

  // Handle share action via API
  const handleShare = async () => {
    try {
      // Validate inputs
      if (selectedPhotos.size === 0) {
        toast.error('Please select at least one photo to share', { duration: 3000 });
        return;
      }

      if (!emails.trim()) {
        toast.error('Please enter at least one email address', { duration: 3000 });
        return;
      }

      const validEmails = validateEmails(emails);
      if (validEmails.length === 0) {
        toast.error('Please enter at least one valid email address', { duration: 3000 });
        return;
      }

      setIsSending(true);

      // Get selected photos
      const photosToShare = Array.from(selectedPhotos).map((index) => photos[index]);

      // Get API URL based on platform
      const API_URL =
        Platform.OS === 'web'
          ? 'http://localhost:4000'
          : process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

      // Get authentication headers
      const headers = await authService.getAuthHeaders();

      // Prepare request payload
      const payload = {
        recipients: validEmails,
        photos: photosToShare.map((photo) => ({
          localUri: photo.localUri,
          remoteUrl: photo.remoteUrl,
        })),
        ...(wellName && { wellName }),
        ...(entryData && { entryData }),
        ...(checklist && checklist.length > 0 && { checklist }),
      };

      // Call API endpoint
      const response = await fetch(`${API_URL}/api/field-data/share-photos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to share photos');
      }

      // Success - show confirmation and close
      toast.success(result.message || 'Photos shared successfully!', { duration: 4000 });

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Reset and close
      setEmails('');
      setSelectedPhotos(new Set());
      onClose();
    } catch (error) {
      console.error('Share error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to share photos. Please try again.',
        { duration: 4000 },
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setEmails('');
    setSelectedPhotos(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share Photos</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Email Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Email Addresses</Text>
              <Text style={styles.hint}>Enter one or more emails (comma or space separated)</Text>
              <TextInput
                style={styles.emailInput}
                placeholder="email@example.com, another@example.com"
                value={emails}
                onChangeText={setEmails}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Photo Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>
                  Select Photos ({selectedPhotos.size}/{photos.length})
                </Text>
                <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>
                    {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoItem}
                    onPress={() => handleTogglePhoto(index)}
                  >
                    <Image source={{ uri: photo.localUri }} style={styles.photoImage} />
                    {/* Selection Checkbox */}
                    <View
                      style={[
                        styles.checkbox,
                        selectedPhotos.has(index) && styles.checkboxSelected,
                      ]}
                    >
                      {selectedPhotos.has(index) && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSending}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.shareButton, isSending && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={isSending}
            >
              <Text style={styles.shareButtonText}>
                {isSending ? 'Sharing...' : `Share (${selectedPhotos.size})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  emailInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  selectAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  checkbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  shareButton: {
    backgroundColor: '#1E40AF',
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
