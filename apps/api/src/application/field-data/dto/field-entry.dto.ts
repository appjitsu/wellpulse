import {
  FieldEntry,
  EntryType,
} from '../../../domain/field-data/field-entry.entity';

export class FieldEntryDto {
  id: string;
  tenantId: string;
  wellId: string;
  entryType: EntryType;
  productionData?: {
    oilVolume: number;
    gasVolume: number;
    waterVolume: number;
    runHours?: number;
    casingPressure?: number;
    tubingPressure?: number;
    chokeSize?: number;
    totalFluidVolume: number;
    waterCut: number;
    gasOilRatio: number;
  };
  inspectionData?: {
    inspectionType: string;
    equipmentStatus: string;
    leaksDetected: boolean;
    abnormalNoises: boolean;
    visualDamage: boolean;
    safetyHazards: boolean;
    gaugeReadings?: Array<{
      name: string;
      value: number;
      unit: string;
      normal: boolean;
    }>;
    issuesFound: string[];
    correctiveActions: string[];
    requiresImmediateAttention: boolean;
    isPassing: boolean;
  };
  maintenanceData?: {
    maintenanceType: string;
    workStatus: string;
    workPerformed: string;
    partsReplaced: Array<{
      partName: string;
      partNumber?: string;
      quantity: number;
      cost?: number;
    }>;
    laborHours: number;
    totalCost?: number;
    nextMaintenanceDue?: string;
    workOrderNumber?: string;
    technicianName?: string;
    equipmentDowntime?: number;
    isEmergencyWork: boolean;
    isComplete: boolean;
    partsCost: number;
  };
  recordedAt: string;
  syncedAt?: string;
  createdBy: string;
  deviceId: string;
  latitude?: number;
  longitude?: number;
  photos: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;

  static fromDomain(entry: FieldEntry): FieldEntryDto {
    const dto = new FieldEntryDto();

    dto.id = entry.id;
    dto.tenantId = entry.tenantId;
    dto.wellId = entry.wellId;
    dto.entryType = entry.entryType;
    dto.recordedAt = entry.recordedAt.toISOString();
    dto.syncedAt = entry.syncedAt?.toISOString();
    dto.createdBy = entry.createdBy;
    dto.deviceId = entry.deviceId;
    dto.latitude = entry.latitude;
    dto.longitude = entry.longitude;
    dto.photos = entry.photos;
    dto.notes = entry.notes;
    dto.createdAt = entry.createdAt.toISOString();
    dto.updatedAt = entry.updatedAt.toISOString();

    // Extract production data if present
    if (entry.productionData) {
      dto.productionData = {
        oilVolume: entry.productionData.oilVolume,
        gasVolume: entry.productionData.gasVolume,
        waterVolume: entry.productionData.waterVolume,
        runHours: entry.productionData.runHours,
        casingPressure: entry.productionData.casingPressure,
        tubingPressure: entry.productionData.tubingPressure,
        chokeSize: entry.productionData.chokeSize,
        totalFluidVolume: entry.productionData.totalFluidVolume,
        waterCut: entry.productionData.waterCut,
        gasOilRatio: entry.productionData.gasOilRatio,
      };
    }

    // Extract inspection data if present
    if (entry.inspectionData) {
      dto.inspectionData = {
        inspectionType: entry.inspectionData.inspectionType,
        equipmentStatus: entry.inspectionData.equipmentStatus,
        leaksDetected: entry.inspectionData.leaksDetected,
        abnormalNoises: entry.inspectionData.abnormalNoises,
        visualDamage: entry.inspectionData.visualDamage,
        safetyHazards: entry.inspectionData.safetyHazards,
        gaugeReadings: entry.inspectionData.gaugeReadings,
        issuesFound: entry.inspectionData.issuesFound,
        correctiveActions: entry.inspectionData.correctiveActions,
        requiresImmediateAttention:
          entry.inspectionData.requiresImmediateAttention,
        isPassing: entry.inspectionData.isPassing,
      };
    }

    // Extract maintenance data if present
    if (entry.maintenanceData) {
      dto.maintenanceData = {
        maintenanceType: entry.maintenanceData.maintenanceType,
        workStatus: entry.maintenanceData.workStatus,
        workPerformed: entry.maintenanceData.workPerformed,
        partsReplaced: entry.maintenanceData.partsReplaced ?? [],
        laborHours: entry.maintenanceData.laborHours,
        totalCost: entry.maintenanceData.totalCost,
        nextMaintenanceDue:
          entry.maintenanceData.nextMaintenanceDue?.toISOString(),
        workOrderNumber: entry.maintenanceData.workOrderNumber,
        technicianName: entry.maintenanceData.technicianName,
        equipmentDowntime: entry.maintenanceData.equipmentDowntime,
        isEmergencyWork: entry.maintenanceData.isEmergencyWork,
        isComplete: entry.maintenanceData.isComplete,
        partsCost: entry.maintenanceData.partsCost,
      };
    }

    return dto;
  }
}
