/**
 * Notes and Media Section Component
 * Handles notes textarea, photo upload/gallery, location capture, GPS display
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useFieldEntry } from './FieldEntryContext';
import { SharePhotosModal } from '../SharePhotosModal';

export function NotesAndMediaSection() {
  const {
    wellName,
    productionVolume,
    pressure,
    temperature,
    gasVolume,
    waterCut,
    notes,
    setNotes,
    photos,
    setPhotos,
    checklist,
    location,
    notesRef,
    handleTakePhoto,
    handlePickFromGallery,
    handleRemovePhoto,
    handleGetLocation,
    handleCopyLocation,
  } = useFieldEntry();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Responsive layout
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Tablet and above

  // Handle file selection for web/desktop
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newPhotos = Array.from(files).map((file: File) => {
      const uri = URL.createObjectURL(file);
      return {
        localUri: uri,
        remoteUrl: undefined,
        uploadStatus: 'pending' as const,
        uploadedAt: undefined,
        error: undefined,
      };
    });

    setPhotos([...photos, ...newPhotos]);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Notes & Observations</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          ref={notesRef}
          style={[styles.input, styles.textArea]}
          placeholder="Equipment observations, maintenance notes, issues..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="done"
        />
      </View>

      {/* Responsive wrapper for Photos and GPS sections */}
      <View style={isLargeScreen ? styles.responsiveRow : styles.responsiveColumn}>
        {/* Photos Section */}
        <View style={isLargeScreen ? styles.responsiveHalf : styles.responsiveFull}>
          {/* Mobile: Camera and Gallery buttons */}
          {Platform.OS !== 'web' && Platform.OS !== 'macos' && Platform.OS !== 'windows' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleTakePhoto}>
                <Text style={styles.secondaryButtonText}>📷 Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePickFromGallery}>
                <Text style={styles.secondaryButtonText}>🖼️ Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Web/Desktop: File attachment button */}
          {(Platform.OS === 'web' || Platform.OS === 'macos' || Platform.OS === 'windows') && (
            <>
              {/* Hidden file input */}
              <input
                ref={fileInputRef as React.RefObject<HTMLInputElement> | null}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleAttachClick}>
                  <Text style={styles.secondaryButtonText}>📎 Attach Photos</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Display Photos */}
          {photos.length > 0 && (
            <View style={styles.photosContainer}>
              <Text style={styles.photosLabel}>Photos ({photos.length})</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
              >
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoWrapper}>
                    <Image source={{ uri: photo.localUri }} style={styles.photoThumbnail} />
                    <TouchableOpacity
                      style={styles.photoRemoveButton}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              {/* Share Photos Button - Below Photos */}
              <TouchableOpacity
                style={[styles.shareButton, photos.length === 0 && styles.shareButtonDisabled]}
                onPress={() => setShowShareModal(true)}
                disabled={photos.length === 0}
              >
                <Text
                  style={[
                    styles.shareButtonText,
                    photos.length === 0 && styles.shareButtonTextDisabled,
                  ]}
                >
                  📤 Share Photos via Email {photos.length === 0 && '(Take photos first)'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* GPS Section */}
        <View style={isLargeScreen ? styles.responsiveHalf : styles.responsiveFull}>
          {/* GPS Tag Button - Always visible */}
          <View style={[styles.actionRow, isLargeScreen ? {} : { marginTop: 24 }]}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleGetLocation}>
              <Text style={styles.secondaryButtonText}>
                {location ? '✓ GPS Tagged' : '📍 GPS Tag'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Display GPS Location */}
          {location && (
            <View style={styles.locationContainer}>
              <View style={styles.locationHeader}>
                <Text style={styles.locationLabel}>📍 GPS Location</Text>
                <TouchableOpacity style={styles.copyButton} onPress={handleCopyLocation}>
                  <Text style={styles.copyButtonText}>📋 Copy</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.locationText}>
                Lat: {location.coords.latitude.toFixed(6)}, Lon:{' '}
                {location.coords.longitude.toFixed(6)}
              </Text>
              <Text style={styles.locationAccuracy}>
                Accuracy: ±{location.coords.accuracy?.toFixed(1)}m
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Share Photos Modal */}
      <SharePhotosModal
        visible={showShareModal}
        photos={photos}
        wellName={wellName}
        entryData={{
          productionVolume: productionVolume ? parseFloat(productionVolume) : undefined,
          pressure: pressure ? parseFloat(pressure) : undefined,
          temperature: temperature ? parseFloat(temperature) : undefined,
          gasVolume: gasVolume ? parseFloat(gasVolume) : undefined,
          waterCut: waterCut ? parseFloat(waterCut) : undefined,
          notes: notes || undefined,
          recordedAt: new Date().toISOString(),
          latitude: location?.coords.latitude,
          longitude: location?.coords.longitude,
        }}
        checklist={Object.entries(checklist).map(([label, checked]) => ({
          label,
          checked,
        }))}
        onClose={() => setShowShareModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  photosContainer: {
    marginTop: 16,
    overflow: 'visible',
  },
  photosLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  photosScroll: {
    marginTop: 8,
    overflow: 'visible',
    paddingTop: 12,
    paddingBottom: 4,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 12,
    overflow: 'visible',
  },
  photoThumbnail: {
    width: 100,
    height: 100,
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
  locationContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1E40AF',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#1E3A8A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  copyButton: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  shareButton: {
    marginTop: 12,
    height: 48,
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shareButtonTextDisabled: {
    fontSize: 13,
  },
  responsiveRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 0,
  },
  responsiveColumn: {
    flexDirection: 'column',
  },
  responsiveHalf: {
    flex: 1,
  },
  responsiveFull: {
    width: '100%',
  },
});
