export type MaintenanceType =
  | 'PREVENTIVE'
  | 'CORRECTIVE'
  | 'EMERGENCY'
  | 'PREDICTIVE';

export type WorkStatus = 'COMPLETED' | 'PARTIAL' | 'DEFERRED' | 'FAILED';

export interface MaintenanceDataProps {
  maintenanceType: MaintenanceType;
  workStatus: WorkStatus;
  workPerformed: string;
  partsReplaced?: {
    partName: string;
    partNumber?: string;
    quantity: number;
    cost?: number;
  }[];
  laborHours: number;
  totalCost?: number;
  nextMaintenanceDue?: Date;
  workOrderNumber?: string;
  technicianName?: string;
  equipmentDowntime?: number; // hours
}

export class MaintenanceData {
  private constructor(
    private readonly _maintenanceType: MaintenanceType,
    private readonly _workStatus: WorkStatus,
    private readonly _workPerformed: string,
    private readonly _laborHours: number,
    private readonly _partsReplaced?: MaintenanceDataProps['partsReplaced'],
    private readonly _totalCost?: number,
    private readonly _nextMaintenanceDue?: Date,
    private readonly _workOrderNumber?: string,
    private readonly _technicianName?: string,
    private readonly _equipmentDowntime?: number,
  ) {}

  static create(props: MaintenanceDataProps): MaintenanceData {
    const validMaintenanceTypes: MaintenanceType[] = [
      'PREVENTIVE',
      'CORRECTIVE',
      'EMERGENCY',
      'PREDICTIVE',
    ];

    if (!validMaintenanceTypes.includes(props.maintenanceType)) {
      throw new Error(`Invalid maintenance type: ${props.maintenanceType}`);
    }

    const validWorkStatuses: WorkStatus[] = [
      'COMPLETED',
      'PARTIAL',
      'DEFERRED',
      'FAILED',
    ];

    if (!validWorkStatuses.includes(props.workStatus)) {
      throw new Error(`Invalid work status: ${props.workStatus}`);
    }

    if (!props.workPerformed || props.workPerformed.trim().length === 0) {
      throw new Error('Work performed description is required');
    }

    if (props.laborHours < 0) {
      throw new Error('Labor hours cannot be negative');
    }

    if (props.laborHours > 24) {
      throw new Error('Labor hours cannot exceed 24 hours for a single entry');
    }

    if (props.totalCost !== undefined && props.totalCost < 0) {
      throw new Error('Total cost cannot be negative');
    }

    if (props.equipmentDowntime !== undefined && props.equipmentDowntime < 0) {
      throw new Error('Equipment downtime cannot be negative');
    }

    // Business rule: Emergency work should typically be completed or failed, not deferred
    if (
      props.maintenanceType === 'EMERGENCY' &&
      props.workStatus === 'DEFERRED'
    ) {
      console.warn(
        'Emergency maintenance is marked as deferred - verify this is correct',
      );
    }

    // Business rule: Preventive maintenance should have next maintenance due date
    if (
      props.maintenanceType === 'PREVENTIVE' &&
      props.workStatus === 'COMPLETED' &&
      !props.nextMaintenanceDue
    ) {
      console.warn(
        'Preventive maintenance completed but no next maintenance date scheduled',
      );
    }

    // Validate parts replaced
    if (props.partsReplaced) {
      for (const part of props.partsReplaced) {
        if (part.quantity <= 0) {
          throw new Error(
            `Invalid quantity for part ${part.partName}: must be greater than 0`,
          );
        }
        if (part.cost !== undefined && part.cost < 0) {
          throw new Error(
            `Invalid cost for part ${part.partName}: cannot be negative`,
          );
        }
      }
    }

    // Business rule: If parts replaced, work type should typically be corrective or emergency
    if (props.partsReplaced && props.partsReplaced.length > 0) {
      if (props.maintenanceType === 'PREVENTIVE') {
        console.warn(
          'Parts replaced during preventive maintenance - may indicate underlying issue',
        );
      }
    }

    return new MaintenanceData(
      props.maintenanceType,
      props.workStatus,
      props.workPerformed,
      props.laborHours,
      props.partsReplaced,
      props.totalCost,
      props.nextMaintenanceDue,
      props.workOrderNumber,
      props.technicianName,
      props.equipmentDowntime,
    );
  }

  get maintenanceType(): MaintenanceType {
    return this._maintenanceType;
  }

  get workStatus(): WorkStatus {
    return this._workStatus;
  }

  get workPerformed(): string {
    return this._workPerformed;
  }

  get partsReplaced(): MaintenanceDataProps['partsReplaced'] {
    return this._partsReplaced ?? [];
  }

  get laborHours(): number {
    return this._laborHours;
  }

  get totalCost(): number | undefined {
    return this._totalCost;
  }

  get nextMaintenanceDue(): Date | undefined {
    return this._nextMaintenanceDue;
  }

  get workOrderNumber(): string | undefined {
    return this._workOrderNumber;
  }

  get technicianName(): string | undefined {
    return this._technicianName;
  }

  get equipmentDowntime(): number | undefined {
    return this._equipmentDowntime;
  }

  get isEmergencyWork(): boolean {
    return this._maintenanceType === 'EMERGENCY';
  }

  get isComplete(): boolean {
    return this._workStatus === 'COMPLETED';
  }

  get partsCost(): number {
    if (!this._partsReplaced) return 0;

    return this._partsReplaced.reduce(
      (total, part) => total + (part.cost ?? 0) * part.quantity,
      0,
    );
  }
}
