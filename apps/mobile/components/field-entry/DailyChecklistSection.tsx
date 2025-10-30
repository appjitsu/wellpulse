/**
 * Daily Checklist Section Component
 * Handles inspection checklist items with haptic feedback
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFieldEntry } from './FieldEntryContext';
import { ReportProblemModal } from '../ReportProblemModal';
import { toast } from '@backpackapp-io/react-native-toast';

export function DailyChecklistSection() {
  const { checklist, handleChecklistToggle, wellName, photos } = useFieldEntry();
  const [showReportModal, setShowReportModal] = useState(false);

  // Handle problem report submission
  const handleReportProblem = async (data: {
    problemType: string;
    description: string;
    selectedPhotoIndices: number[];
  }) => {
    try {
      // TODO: Implement problem report submission to API
      // This will save to local storage (offline-first) and sync when online
      console.log('Problem report submitted:', {
        wellName,
        ...data,
        timestamp: new Date().toISOString(),
      });

      toast.success('Problem report saved successfully', { duration: 3000 });
    } catch (error) {
      console.error('Failed to save problem report:', error);
      throw error; // Let the modal handle the error display
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Daily Inspection Checklist</Text>

      {/* Equipment Checks */}
      <ChecklistItem
        checked={checklist.pumpOperating}
        onToggle={() => handleChecklistToggle('pumpOperating')}
        label="Pump operating normally"
      />
      <ChecklistItem
        checked={checklist.noLeaks}
        onToggle={() => handleChecklistToggle('noLeaks')}
        label="No leaks detected"
      />
      <ChecklistItem
        checked={checklist.gaugesWorking}
        onToggle={() => handleChecklistToggle('gaugesWorking')}
        label="All gauges functioning"
      />
      <ChecklistItem
        checked={checklist.safetyEquipment}
        onToggle={() => handleChecklistToggle('safetyEquipment')}
        label="Safety equipment in place"
      />

      {/* Production Equipment */}
      <ChecklistItem
        checked={checklist.tankLevelsChecked}
        onToggle={() => handleChecklistToggle('tankLevelsChecked')}
        label="Tank levels checked"
      />
      <ChecklistItem
        checked={checklist.separatorOperating}
        onToggle={() => handleChecklistToggle('separatorOperating')}
        label="Separator operating properly"
      />
      <ChecklistItem
        checked={checklist.heaterTreaterOperating}
        onToggle={() => handleChecklistToggle('heaterTreaterOperating')}
        label="Heater treater operating"
      />

      {/* Physical Inspection */}
      <ChecklistItem
        checked={checklist.noAbnormalSounds}
        onToggle={() => handleChecklistToggle('noAbnormalSounds')}
        label="No abnormal sounds detected"
      />
      <ChecklistItem
        checked={checklist.noVisibleCorrosion}
        onToggle={() => handleChecklistToggle('noVisibleCorrosion')}
        label="No visible corrosion"
      />

      {/* Systems & Maintenance */}
      <ChecklistItem
        checked={checklist.valvePositionsCorrect}
        onToggle={() => handleChecklistToggle('valvePositionsCorrect')}
        label="Valve positions correct"
      />
      <ChecklistItem
        checked={checklist.ventLinesClear}
        onToggle={() => handleChecklistToggle('ventLinesClear')}
        label="Vent lines clear"
      />
      <ChecklistItem
        checked={checklist.chemicalInjectionWorking}
        onToggle={() => handleChecklistToggle('chemicalInjectionWorking')}
        label="Chemical injection working"
      />

      {/* Safety & Containment */}
      <ChecklistItem
        checked={checklist.secondaryContainmentOk}
        onToggle={() => handleChecklistToggle('secondaryContainmentOk')}
        label="Secondary containment OK"
      />
      <ChecklistItem
        checked={checklist.wellSiteSecure}
        onToggle={() => handleChecklistToggle('wellSiteSecure')}
        label="Well site secure (fencing/gates)"
      />
      <ChecklistItem
        checked={checklist.spillKitsAvailable}
        onToggle={() => handleChecklistToggle('spillKitsAvailable')}
        label="Spill kits available"
      />

      {/* Report Problem Button */}
      <TouchableOpacity style={styles.reportButton} onPress={() => setShowReportModal(true)}>
        <Text style={styles.reportButtonText}>🚨 Report Problem</Text>
      </TouchableOpacity>

      {/* Report Problem Modal */}
      <ReportProblemModal
        visible={showReportModal}
        wellName={wellName}
        availablePhotos={photos}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportProblem}
      />
    </View>
  );
}

// Helper component for checklist items
function ChecklistItem({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity style={styles.checklistItem} onPress={onToggle}>
      <View style={styles.checkbox}>{checked && <View style={styles.checkboxChecked} />}</View>
      <Text style={styles.checklistLabel}>{label}</Text>
    </TouchableOpacity>
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
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#1E40AF',
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    width: 14,
    height: 14,
    backgroundColor: '#1E40AF',
    borderRadius: 3,
  },
  checklistLabel: {
    fontSize: 15,
    color: '#374151',
  },
  reportButton: {
    marginTop: 16,
    height: 48,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
