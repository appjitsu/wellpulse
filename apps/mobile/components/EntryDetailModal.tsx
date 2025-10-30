/**
 * Entry Detail Modal - View/Edit entry in a modal overlay
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { db } from '../src/db/database';
import { FieldEntry } from '../src/db/schema';

interface EntryDetailModalProps {
  visible: boolean;
  entryId: string | null;
  onClose: () => void;
  onSave?: () => void;
}

export function EntryDetailModal({ visible, entryId, onClose, onSave }: EntryDetailModalProps) {
  const [entry, setEntry] = useState<FieldEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [wellName, setWellName] = useState('');
  const [productionVolume, setProductionVolume] = useState('');
  const [gasVolume, setGasVolume] = useState('');
  const [waterVolume, setWaterVolume] = useState('');
  const [waterCut, setWaterCut] = useState('');
  const [pressure, setPressure] = useState('');
  const [temperature, setTemperature] = useState('');
  const [tankLevel, setTankLevel] = useState('');
  const [bsw, setBsw] = useState('');
  const [gor, setGor] = useState('');
  const [fluidLevel, setFluidLevel] = useState('');
  const [casingPressure, setCasingPressure] = useState('');
  const [tubingPressure, setTubingPressure] = useState('');
  const [pumpStatus, setPumpStatus] = useState('');
  const [downtimeHours, setDowntimeHours] = useState('');
  const [downtimeReason, setDowntimeReason] = useState('');
  const [runTicket, setRunTicket] = useState('');
  const [waterHaul, setWaterHaul] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible && entryId) {
      loadEntry();
    }
  }, [visible, entryId]);

  const loadEntry = async () => {
    if (!entryId) return;

    setLoading(true);
    try {
      const loadedEntry = await db.getEntryById(entryId);
      if (loadedEntry) {
        setEntry(loadedEntry);
        setWellName(loadedEntry.wellName);
        setProductionVolume(loadedEntry.productionVolume);
        setGasVolume(loadedEntry.gasVolume || '');
        setWaterVolume(loadedEntry.waterVolume || '');
        setWaterCut(loadedEntry.waterCut || '');
        setPressure(loadedEntry.pressure || '');
        setTemperature(loadedEntry.temperature || '');
        setTankLevel(loadedEntry.tankLevel || '');
        setBsw(loadedEntry.bsw || '');
        setGor(loadedEntry.gor || '');
        setFluidLevel(loadedEntry.fluidLevel || '');
        setCasingPressure(loadedEntry.casingPressure || '');
        setTubingPressure(loadedEntry.tubingPressure || '');
        setPumpStatus(loadedEntry.pumpStatus || 'operating');
        setDowntimeHours(loadedEntry.downtimeHours || '');
        setDowntimeReason(loadedEntry.downtimeReason || '');
        setRunTicket(loadedEntry.runTicket || '');
        setWaterHaul(loadedEntry.waterHaul || '');
        setNotes(loadedEntry.notes || '');
      }
    } catch (error) {
      console.error('Failed to load entry:', error);
      Alert.alert('Error', 'Failed to load entry details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!entry) return;

    try {
      await db.updateEntry(entry.id, {
        wellName,
        productionVolume,
        gasVolume: gasVolume || undefined,
        waterVolume: waterVolume || undefined,
        waterCut: waterCut || undefined,
        pressure: pressure || undefined,
        temperature: temperature || undefined,
        tankLevel: tankLevel || undefined,
        bsw: bsw || undefined,
        gor: gor || undefined,
        fluidLevel: fluidLevel || undefined,
        casingPressure: casingPressure || undefined,
        tubingPressure: tubingPressure || undefined,
        pumpStatus: pumpStatus ? (pumpStatus as 'operating' | 'down' | 'maintenance') : undefined,
        downtimeHours: downtimeHours || undefined,
        downtimeReason: downtimeReason || undefined,
        runTicket: runTicket || undefined,
        waterHaul: waterHaul || undefined,
        notes: notes || undefined,
        photos: entry.photos,
        checklist: entry.checklist,
      });

      Alert.alert('Success', 'Entry updated successfully');
      setIsEditing(false);
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to update entry:', error);
      Alert.alert('Error', 'Failed to update entry');
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Entry Details</Text>
          {entry && entry.syncStatus !== 'synced' && (
            <>
              {!isEditing ? (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {entry && entry.syncStatus === 'synced' && <View style={styles.placeholderButton} />}
        </View>

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1E40AF" />
              <Text style={styles.loadingText}>Loading entry...</Text>
            </View>
          ) : entry ? (
            <>
              {/* Entry Metadata */}
              <View style={styles.metadataCard}>
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>Created:</Text>
                  <Text style={styles.metadataValue}>{formatDate(entry.createdAt)}</Text>
                </View>
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>Status:</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      entry.syncStatus === 'synced' && styles.statusSynced,
                      entry.syncStatus === 'pending' && styles.statusPending,
                      entry.syncStatus === 'failed' && styles.statusFailed,
                    ]}
                  >
                    {entry.syncStatus.toUpperCase()}
                  </Text>
                </View>
                {entry.syncError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorLabel}>Sync Error:</Text>
                    <Text style={styles.errorText}>{entry.syncError}</Text>
                  </View>
                )}
              </View>

              {/* Entry Data */}
              <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>Production Data</Text>

                <FormField
                  label="Well Name *"
                  isEditing={isEditing}
                  value={wellName}
                  onChangeText={setWellName}
                />
                <FormField
                  label="Oil Production (bbl) *"
                  isEditing={isEditing}
                  value={productionVolume}
                  onChangeText={setProductionVolume}
                  keyboardType="decimal-pad"
                  unit="bbl"
                />
                <FormField
                  label="Gas Production (mcf)"
                  isEditing={isEditing}
                  value={gasVolume}
                  onChangeText={setGasVolume}
                  keyboardType="decimal-pad"
                  unit="mcf"
                />
                <FormField
                  label="Water Production (bbl)"
                  isEditing={isEditing}
                  value={waterVolume}
                  onChangeText={setWaterVolume}
                  keyboardType="decimal-pad"
                  unit="bbl"
                />
                <FormField
                  label="Water Cut (%)"
                  isEditing={isEditing}
                  value={waterCut}
                  onChangeText={setWaterCut}
                  keyboardType="decimal-pad"
                  unit="%"
                />
                <FormField
                  label="Pressure (psi)"
                  isEditing={isEditing}
                  value={pressure}
                  onChangeText={setPressure}
                  keyboardType="decimal-pad"
                  unit="psi"
                />
                <FormField
                  label="Temperature (°F)"
                  isEditing={isEditing}
                  value={temperature}
                  onChangeText={setTemperature}
                  keyboardType="decimal-pad"
                  unit="°F"
                />

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Additional Metrics</Text>

                <FormField
                  label="Tank Level (in or %)"
                  isEditing={isEditing}
                  value={tankLevel}
                  onChangeText={setTankLevel}
                  keyboardType="decimal-pad"
                />
                <FormField
                  label="BS&W (%)"
                  isEditing={isEditing}
                  value={bsw}
                  onChangeText={setBsw}
                  keyboardType="decimal-pad"
                  unit="%"
                />
                <FormField
                  label="GOR (MCF/BBL)"
                  isEditing={isEditing}
                  value={gor}
                  onChangeText={setGor}
                  keyboardType="decimal-pad"
                />
                <FormField
                  label="Fluid Level (ft)"
                  isEditing={isEditing}
                  value={fluidLevel}
                  onChangeText={setFluidLevel}
                  keyboardType="decimal-pad"
                  unit="ft"
                />

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Pressure Readings</Text>

                <FormField
                  label="Casing Pressure (psi)"
                  isEditing={isEditing}
                  value={casingPressure}
                  onChangeText={setCasingPressure}
                  keyboardType="decimal-pad"
                  unit="psi"
                />
                <FormField
                  label="Tubing Pressure (psi)"
                  isEditing={isEditing}
                  value={tubingPressure}
                  onChangeText={setTubingPressure}
                  keyboardType="decimal-pad"
                  unit="psi"
                />

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Operations</Text>

                <FormField
                  label="Run Ticket #"
                  isEditing={isEditing}
                  value={runTicket}
                  onChangeText={setRunTicket}
                />
                <FormField
                  label="Water Haul (bbl)"
                  isEditing={isEditing}
                  value={waterHaul}
                  onChangeText={setWaterHaul}
                  keyboardType="decimal-pad"
                  unit="bbl"
                />
                <FormField
                  label="Downtime (hours)"
                  isEditing={isEditing}
                  value={downtimeHours}
                  onChangeText={setDowntimeHours}
                  keyboardType="decimal-pad"
                  unit="hrs"
                />
                <FormField
                  label="Downtime Reason"
                  isEditing={isEditing}
                  value={downtimeReason}
                  onChangeText={setDowntimeReason}
                />

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Notes</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add notes..."
                      multiline
                      numberOfLines={4}
                    />
                  ) : (
                    <Text style={styles.value}>{notes || '—'}</Text>
                  )}
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.errorText}>Entry not found</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// Helper component for form fields
function FormField({
  label,
  isEditing,
  value,
  onChangeText,
  keyboardType = 'default',
  unit,
}: {
  label: string;
  isEditing: boolean;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  unit?: string;
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      {isEditing ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="Enter value"
          keyboardType={keyboardType}
        />
      ) : (
        <Text style={styles.value}>{value ? `${value}${unit ? ` ${unit}` : ''}` : '—'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderButton: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  metadataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  metadataValue: {
    fontSize: 14,
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  statusSynced: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  statusFailed: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  errorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#111827',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
