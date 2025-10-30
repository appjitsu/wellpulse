/**
 * Conflict Resolution Modal
 * Displays conflicting field values side-by-side for user to resolve
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { ConflictInfo } from '../src/utils/conflict-resolution';

interface ConflictResolutionModalProps {
  visible: boolean;
  conflictInfo: ConflictInfo | null;
  onResolve: (choice: 'local' | 'server' | 'merge') => void;
  onCancel: () => void;
}

export function ConflictResolutionModal({
  visible,
  conflictInfo,
  onResolve,
  onCancel,
}: ConflictResolutionModalProps) {
  if (!conflictInfo) {
    return null;
  }

  const { localVersion, serverVersion, conflictFields } = conflictInfo;

  const renderFieldComparison = (fieldName: string) => {
    // Handle nested checklist fields
    if (fieldName.startsWith('checklist.')) {
      const checklistKey = fieldName.split('.')[1] as keyof typeof localVersion.checklist;
      const localValue = localVersion.checklist[checklistKey];
      const serverValue = serverVersion.checklist?.[checklistKey];

      return (
        <View key={fieldName} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}</Text>
          <View style={styles.valuesContainer}>
            <View style={styles.valueBox}>
              <Text style={styles.valueLabel}>Local</Text>
              <Text style={[styles.valueText, localValue === false && styles.alertValue]}>
                {localValue ? '✓ Yes' : '✗ No'}
              </Text>
            </View>
            <View style={styles.valueBox}>
              <Text style={styles.valueLabel}>Server</Text>
              <Text style={[styles.valueText, serverValue === false && styles.alertValue]}>
                {serverValue ? '✓ Yes' : '✗ No'}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // Handle location field
    if (fieldName === 'location') {
      const localLoc = localVersion.location;
      const serverLoc = serverVersion.location;

      return (
        <View key={fieldName} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}</Text>
          <View style={styles.valuesContainer}>
            <View style={styles.valueBox}>
              <Text style={styles.valueLabel}>Local</Text>
              <Text style={styles.valueText}>
                {localLoc
                  ? `${localLoc.latitude.toFixed(6)}, ${localLoc.longitude.toFixed(6)}`
                  : 'N/A'}
              </Text>
              {localLoc?.accuracy && <Text style={styles.accuracyText}>±{localLoc.accuracy}m</Text>}
            </View>
            <View style={styles.valueBox}>
              <Text style={styles.valueLabel}>Server</Text>
              <Text style={styles.valueText}>
                {serverLoc
                  ? `${serverLoc.latitude.toFixed(6)}, ${serverLoc.longitude.toFixed(6)}`
                  : 'N/A'}
              </Text>
              {serverLoc?.accuracy && (
                <Text style={styles.accuracyText}>±{serverLoc.accuracy}m</Text>
              )}
            </View>
          </View>
        </View>
      );
    }

    // Handle regular fields
    const localValue = localVersion[fieldName as keyof typeof localVersion];
    const serverValue = serverVersion[fieldName as keyof typeof serverVersion];

    // Highlight potentially critical differences (safety-related fields)
    const isSafetyCritical =
      fieldName === 'pressure' || fieldName === 'temperature' || fieldName === 'waterCut';

    return (
      <View key={fieldName} style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}</Text>
        <View style={styles.valuesContainer}>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Local</Text>
            <Text style={[styles.valueText, isSafetyCritical && styles.criticalValue]}>
              {String(localValue || 'N/A')}
            </Text>
          </View>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Server</Text>
            <Text style={[styles.valueText, isSafetyCritical && styles.criticalValue]}>
              {String(serverValue || 'N/A')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const formatFieldName = (fieldName: string): string => {
    // Convert camelCase to Title Case
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace('checklist.', 'Checklist: ');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onCancel}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Resolve Sync Conflict</Text>
            <Text style={styles.subtitle}>
              This entry was modified both locally and on the server. Choose how to resolve:
            </Text>
          </View>

          <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={true}>
            <View style={styles.entryInfo}>
              <Text style={styles.infoText}>
                Well: <Text style={styles.boldText}>{localVersion.wellName}</Text>
              </Text>
              <Text style={styles.infoText}>
                Recorded: {new Date(localVersion.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.infoText}>
                Conflicts: <Text style={styles.conflictCount}>{conflictFields.length}</Text>
              </Text>
            </View>

            <View style={styles.conflictsSection}>
              <Text style={styles.sectionTitle}>Conflicting Fields</Text>
              {conflictFields.map((field) => renderFieldComparison(field))}
            </View>
          </ScrollView>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.localButton]}
              onPress={() => onResolve('local')}
            >
              <Text style={styles.buttonText}>Keep Local</Text>
              <Text style={styles.buttonSubtext}>Use my changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.serverButton]}
              onPress={() => onResolve('server')}
            >
              <Text style={styles.buttonText}>Use Server</Text>
              <Text style={styles.buttonSubtext}>Accept server version</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.mergeButton]}
              onPress={() => onResolve('merge')}
            >
              <Text style={styles.buttonText}>Smart Merge</Text>
              <Text style={styles.buttonSubtext}>Safety-bias resolution</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  contentContainer: {
    maxHeight: 400,
  },
  entryInfo: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: '600',
    color: '#1f2937',
  },
  conflictCount: {
    fontWeight: '600',
    color: '#dc2626',
  },
  conflictsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  fieldRow: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  valuesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  valueBox: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  valueLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  alertValue: {
    color: '#dc2626',
    fontWeight: '600',
  },
  criticalValue: {
    color: '#2563eb',
    fontWeight: '600',
  },
  accuracyText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  actionsContainer: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  localButton: {
    backgroundColor: '#3b82f6',
  },
  serverButton: {
    backgroundColor: '#10b981',
  },
  mergeButton: {
    backgroundColor: '#8b5cf6',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  buttonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
});
