export type EquipmentStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'FAILED'
  | 'NEEDS_MAINTENANCE';

export type InspectionType =
  | 'DAILY_WALKTHROUGH'
  | 'WEEKLY_INSPECTION'
  | 'MONTHLY_INSPECTION'
  | 'SAFETY_INSPECTION'
  | 'ENVIRONMENTAL_INSPECTION';

export interface InspectionDataProps {
  inspectionType: InspectionType;
  equipmentStatus: EquipmentStatus;
  leaksDetected: boolean;
  abnormalNoises: boolean;
  visualDamage: boolean;
  safetyHazards: boolean;
  gaugeReadings?: {
    name: string;
    value: number;
    unit: string;
    normal: boolean;
  }[];
  issuesFound?: string[];
  correctiveActions?: string[];
}

export class InspectionData {
  private constructor(
    private readonly _inspectionType: InspectionType,
    private readonly _equipmentStatus: EquipmentStatus,
    private readonly _leaksDetected: boolean,
    private readonly _abnormalNoises: boolean,
    private readonly _visualDamage: boolean,
    private readonly _safetyHazards: boolean,
    private readonly _gaugeReadings?: InspectionDataProps['gaugeReadings'],
    private readonly _issuesFound?: string[],
    private readonly _correctiveActions?: string[],
  ) {}

  static create(props: InspectionDataProps): InspectionData {
    const validInspectionTypes: InspectionType[] = [
      'DAILY_WALKTHROUGH',
      'WEEKLY_INSPECTION',
      'MONTHLY_INSPECTION',
      'SAFETY_INSPECTION',
      'ENVIRONMENTAL_INSPECTION',
    ];

    if (!validInspectionTypes.includes(props.inspectionType)) {
      throw new Error(`Invalid inspection type: ${props.inspectionType}`);
    }

    const validStatuses: EquipmentStatus[] = [
      'OPERATIONAL',
      'DEGRADED',
      'FAILED',
      'NEEDS_MAINTENANCE',
    ];

    if (!validStatuses.includes(props.equipmentStatus)) {
      throw new Error(`Invalid equipment status: ${props.equipmentStatus}`);
    }

    // Business rule: If safety hazards detected, must have corrective actions
    if (
      props.safetyHazards &&
      (!props.correctiveActions || props.correctiveActions.length === 0)
    ) {
      throw new Error(
        'Safety hazards detected but no corrective actions specified',
      );
    }

    // Business rule: If leaks detected, must have issues documented
    if (
      props.leaksDetected &&
      (!props.issuesFound || props.issuesFound.length === 0)
    ) {
      throw new Error('Leaks detected but no issues documented');
    }

    // Business rule: Failed equipment must have corrective actions
    if (
      props.equipmentStatus === 'FAILED' &&
      (!props.correctiveActions || props.correctiveActions.length === 0)
    ) {
      throw new Error('Failed equipment status requires corrective actions');
    }

    return new InspectionData(
      props.inspectionType,
      props.equipmentStatus,
      props.leaksDetected,
      props.abnormalNoises,
      props.visualDamage,
      props.safetyHazards,
      props.gaugeReadings,
      props.issuesFound,
      props.correctiveActions,
    );
  }

  get inspectionType(): InspectionType {
    return this._inspectionType;
  }

  get equipmentStatus(): EquipmentStatus {
    return this._equipmentStatus;
  }

  get leaksDetected(): boolean {
    return this._leaksDetected;
  }

  get abnormalNoises(): boolean {
    return this._abnormalNoises;
  }

  get visualDamage(): boolean {
    return this._visualDamage;
  }

  get safetyHazards(): boolean {
    return this._safetyHazards;
  }

  get gaugeReadings(): InspectionDataProps['gaugeReadings'] {
    return this._gaugeReadings;
  }

  get issuesFound(): string[] {
    return this._issuesFound ?? [];
  }

  get correctiveActions(): string[] {
    return this._correctiveActions ?? [];
  }

  get requiresImmediateAttention(): boolean {
    return (
      this._safetyHazards ||
      this._equipmentStatus === 'FAILED' ||
      this._leaksDetected
    );
  }

  get isPassing(): boolean {
    return (
      !this._leaksDetected &&
      !this._abnormalNoises &&
      !this._visualDamage &&
      !this._safetyHazards &&
      this._equipmentStatus === 'OPERATIONAL'
    );
  }
}
