/**
 * Report Problem Modal
 * Allows field operators to report equipment or safety problems
 * with photo attachments and problem categorization
 */

import React, { useState, useMemo, useRef } from 'react';
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
import SearchableDropdown from './SearchableDropdown';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';

// Problem categories for oil & gas field operations
const PROBLEM_CATEGORIES = [
  { value: 'leak', label: '💧 Leak Detected' },
  { value: 'pressure', label: '⚠️ Pressure Abnormal' },
  { value: 'temperature', label: '🌡️ Temperature Issue' },
  { value: 'pump-failure', label: '⚙️ Pump Failure' },
  { value: 'gauge-malfunction', label: '📊 Gauge Malfunction' },
  { value: 'safety-hazard', label: '🚨 Safety Hazard' },
  { value: 'unusual-noise', label: '🔊 Unusual Noise' },
  { value: 'vibration', label: '📳 Excessive Vibration' },
  { value: 'valve-issue', label: '🔧 Valve Issue' },
  { value: 'corrosion', label: '🦠 Corrosion' },
  { value: 'electrical', label: '⚡ Electrical Problem' },
  { value: 'environmental', label: '🌍 Environmental Concern' },
  { value: 'other', label: '❓ Other' },
];

interface ReportProblemModalProps {
  visible: boolean;
  wellName?: string;
  availablePhotos: Photo[];
  onClose: () => void;
  onSubmit: (data: {
    problemType: string;
    description: string;
    selectedPhotoIndices: number[];
  }) => Promise<void>;
}

export function ReportProblemModal({
  visible,
  wellName,
  availablePhotos,
  onClose,
  onSubmit,
}: ReportProblemModalProps) {
  const [problemType, setProblemType] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [newPhotos, setNewPhotos] = useState<Photo[]>([]); // Photos added specifically for this problem report
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if form is complete (all required fields filled)
  const isFormComplete = useMemo(() => {
    const hasProblemType = problemType.trim().length > 0;
    const hasDescription = description.trim().length >= 30;
    return hasProblemType && hasDescription;
  }, [problemType, description]);

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

  // Get the selected problem type label for display
  const selectedProblemLabel = useMemo(() => {
    const category = PROBLEM_CATEGORIES.find((cat) => cat.value === problemType);
    return category?.label || '';
  }, [problemType]);

  // Combine available photos and newly added photos (for future use)
  // const allPhotos = useMemo(() => {
  //   return [...availablePhotos, ...newPhotos];
  // }, [availablePhotos, newPhotos]);

  // Take photo with camera
  const handleTakePhoto = async () => {
    try {
      if (!cameraPermission?.granted) {
        const { granted } = await requestCameraPermission();
        if (!granted) {
          toast.error('Camera permission is required to take photos', { duration: 3000 });
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto: Photo = {
          localUri: result.assets[0].uri,
          remoteUrl: undefined,
          uploadStatus: 'pending',
          uploadedAt: undefined,
          error: undefined,
        };
        setNewPhotos([...newPhotos, newPhoto]);

        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        toast.success('Photo added successfully', { duration: 2000 });
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Failed to take photo', { duration: 3000 });
    }
  };

  // Pick photo from gallery
  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const photos: Photo[] = result.assets.map((asset) => ({
          localUri: asset.uri,
          remoteUrl: undefined,
          uploadStatus: 'pending',
          uploadedAt: undefined,
          error: undefined,
        }));
        setNewPhotos([...newPhotos, ...photos]);

        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        toast.success(`${photos.length} photo(s) added`, { duration: 2000 });
      }
    } catch (error) {
      console.error('Gallery error:', error);
      toast.error('Failed to select photos', { duration: 3000 });
    }
  };

  // Handle file selection for web/desktop
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const photos = Array.from(files).map((file: File) => {
      const uri = URL.createObjectURL(file);
      return {
        localUri: uri,
        remoteUrl: undefined,
        uploadStatus: 'pending' as const,
        uploadedAt: undefined,
        error: undefined,
      };
    });

    setNewPhotos([...newPhotos, ...photos]);

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    toast.success(`${photos.length} photo(s) added`, { duration: 2000 });
  };

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Remove a new photo
  const handleRemoveNewPhoto = (index: number) => {
    const updatedPhotos = newPhotos.filter((_, i) => i !== index);
    setNewPhotos(updatedPhotos);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // The form validation via isFormComplete already ensures required fields are filled
    try {
      setIsSubmitting(true);

      await onSubmit({
        problemType,
        description: description.trim(),
        selectedPhotoIndices: Array.from(selectedPhotos),
      });

      // Success - show confirmation
      toast.success('Problem report submitted successfully', { duration: 4000 });

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Reset and close
      resetForm();
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit problem report', {
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setProblemType('');
    setDescription('');
    setSelectedPhotos(new Set());
    setNewPhotos([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🚨 Report Problem</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Well Name (if provided) */}
            {wellName && (
              <View style={styles.wellBadge}>
                <Text style={styles.wellBadgeText}>{wellName}</Text>
              </View>
            )}

            {/* Problem Type Dropdown */}
            <View style={styles.section}>
              <Text style={styles.label}>Problem Type *</Text>
              <Text style={styles.hint}>Select or search for the problem type</Text>
              <SearchableDropdown
                items={PROBLEM_CATEGORIES}
                value={selectedProblemLabel}
                onChange={(label) => {
                  // Find the matching category value from label
                  const category = PROBLEM_CATEGORIES.find((cat) => cat.label === label);
                  if (category) {
                    setProblemType(category.value);
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }
                }}
                placeholder="Select problem type..."
              />
            </View>

            {/* Problem Description */}
            <View style={styles.section}>
              <Text style={styles.label}>Problem Description *</Text>
              <Text style={styles.hint}>
                Provide detailed information about the problem (min 30 characters)
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe what you observed, when it started, severity, etc."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>

            {/* Photo Attachment */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Attach Photos ({selectedPhotos.size + newPhotos.length} attached)
              </Text>
              <Text style={styles.hint}>Take new photos or select from entry photos</Text>

              {/* Photo Action Buttons */}
              {Platform.OS !== 'web' && Platform.OS !== 'macos' && Platform.OS !== 'windows' ? (
                <View style={styles.photoActions}>
                  <TouchableOpacity style={styles.photoActionButton} onPress={handleTakePhoto}>
                    <Text style={styles.photoActionText}>📷 Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoActionButton}
                    onPress={handlePickFromGallery}
                  >
                    <Text style={styles.photoActionText}>🖼️ Gallery</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Hidden file input for web/desktop */}
                  <input
                    ref={fileInputRef as React.RefObject<HTMLInputElement> | null}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <View style={styles.photoActions}>
                    <TouchableOpacity style={styles.photoActionButton} onPress={handleAttachClick}>
                      <Text style={styles.photoActionText}>📎 Attach Photos</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Newly Added Photos */}
              {newPhotos.length > 0 && (
                <View style={styles.photosGroup}>
                  <Text style={styles.photosGroupLabel}>New Photos ({newPhotos.length})</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ overflow: 'visible' }}
                    contentContainerStyle={{ paddingVertical: 12 }}
                  >
                    {newPhotos.map((photo, index) => (
                      <View key={`new-${index}`} style={styles.photoItem}>
                        <Image source={{ uri: photo.localUri }} style={styles.photoImage} />
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => handleRemoveNewPhoto(index)}
                        >
                          <Text style={styles.photoRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Field Entry Photos (Optional Selection) */}
              {availablePhotos.length > 0 && (
                <View style={styles.photosGroup}>
                  <Text style={styles.photosGroupLabel}>
                    From Entry ({selectedPhotos.size} selected)
                  </Text>
                  <Text style={styles.photosGroupHint}>Tap to select/deselect</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {availablePhotos.map((photo, index) => (
                      <TouchableOpacity
                        key={`entry-${index}`}
                        style={styles.photoItem}
                        onPress={() => handleTogglePhoto(index)}
                      >
                        <Image source={{ uri: photo.localUri }} style={styles.photoImage} />
                        {/* Selection Checkbox */}
                        <View
                          style={[
                            styles.photoCheckbox,
                            selectedPhotos.has(index) && styles.photoCheckboxSelected,
                          ]}
                        >
                          {selectedPhotos.has(index) && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Required Fields Notice */}
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                * Required fields. This report will be saved locally and synced when online.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (!isFormComplete || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isFormComplete || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
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
  wellBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  wellBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
  section: {
    marginBottom: 24,
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
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoActionButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  photoActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  photosGroup: {
    marginTop: 16,
    overflow: 'visible',
  },
  photosGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  photosGroupHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  photoItem: {
    width: 100,
    height: 100,
    marginRight: 12,
    position: 'relative',
    overflow: 'visible',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  photoCheckbox: {
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
  photoCheckboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  noticeBox: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  noticeText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
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
  submitButton: {
    backgroundColor: '#DC2626',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
