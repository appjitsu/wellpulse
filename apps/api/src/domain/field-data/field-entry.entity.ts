import { ProductionData } from './value-objects/production-data.vo';
import { InspectionData } from './value-objects/inspection-data.vo';
import { MaintenanceData } from './value-objects/maintenance-data.vo';

export type EntryType = 'PRODUCTION' | 'INSPECTION' | 'MAINTENANCE';

export interface FieldEntryProps {
  id: string;
  tenantId: string;
  wellId: string;
  entryType: EntryType;
  productionData?: ProductionData;
  inspectionData?: InspectionData;
  maintenanceData?: MaintenanceData;
  recordedAt: Date; // When operator recorded it (offline time)
  syncedAt?: Date; // When it synced to cloud
  createdBy: string; // User ID
  deviceId: string; // For conflict resolution
  latitude?: number;
  longitude?: number;
  photos?: string[]; // URLs or file paths
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

/**
 * FieldEntry Domain Entity
 *
 * Represents a field data entry (production, inspection, or maintenance)
 * recorded at a well site. Supports offline data entry with sync tracking.
 *
 * Business Rules:
 * - Entry type must match the data provided (production/inspection/maintenance)
 * - Only one type of data can be present per entry
 * - Recorded date cannot be in the future
 * - Location coordinates (if provided) must be valid and complete
 * - Maximum 10 photos per entry
 * - Notes cannot exceed 2000 characters
 * - Deleted entries cannot be modified
 * - All entry operations are tenant-scoped
 */
export class FieldEntry {
  private constructor(
    public readonly id: string,
    private readonly _tenantId: string,
    private readonly _wellId: string,
    private readonly _entryType: EntryType,
    private readonly _productionData: ProductionData | undefined,
    private readonly _inspectionData: InspectionData | undefined,
    private readonly _maintenanceData: MaintenanceData | undefined,
    private readonly _recordedAt: Date,
    private _syncedAt: Date | undefined,
    private readonly _createdBy: string,
    private readonly _deviceId: string,
    private readonly _latitude: number | undefined,
    private readonly _longitude: number | undefined,
    private _photos: string[],
    private _notes: string | undefined,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | undefined,
    private _deletedBy: string | undefined,
  ) {
    this.validate();
  }

  /**
   * Create a new FieldEntry entity
   */
  static create(
    props: Omit<
      FieldEntryProps,
      'createdAt' | 'updatedAt' | 'deletedAt' | 'deletedBy' | 'syncedAt'
    >,
  ): FieldEntry {
    const now = new Date();

    return new FieldEntry(
      props.id,
      props.tenantId,
      props.wellId,
      props.entryType,
      props.productionData,
      props.inspectionData,
      props.maintenanceData,
      props.recordedAt,
      undefined, // syncedAt
      props.createdBy,
      props.deviceId,
      props.latitude,
      props.longitude,
      props.photos ?? [],
      props.notes,
      now,
      now,
      undefined, // deletedAt
      undefined, // deletedBy
    );
  }

  /**
   * Reconstitute FieldEntry entity from persistence
   */
  static reconstitute(props: FieldEntryProps): FieldEntry {
    return new FieldEntry(
      props.id,
      props.tenantId,
      props.wellId,
      props.entryType,
      props.productionData,
      props.inspectionData,
      props.maintenanceData,
      props.recordedAt,
      props.syncedAt,
      props.createdBy,
      props.deviceId,
      props.latitude,
      props.longitude,
      props.photos ?? [],
      props.notes,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
      props.deletedBy,
    );
  }

  // Getters

  get tenantId(): string {
    return this._tenantId;
  }

  get wellId(): string {
    return this._wellId;
  }

  get entryType(): EntryType {
    return this._entryType;
  }

  get productionData(): ProductionData | undefined {
    return this._productionData;
  }

  get inspectionData(): InspectionData | undefined {
    return this._inspectionData;
  }

  get maintenanceData(): MaintenanceData | undefined {
    return this._maintenanceData;
  }

  get recordedAt(): Date {
    return this._recordedAt;
  }

  get syncedAt(): Date | undefined {
    return this._syncedAt;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get deviceId(): string {
    return this._deviceId;
  }

  get latitude(): number | undefined {
    return this._latitude;
  }

  get longitude(): number | undefined {
    return this._longitude;
  }

  get photos(): string[] {
    return [...this._photos]; // Return copy to maintain immutability
  }

  get notes(): string | undefined {
    return this._notes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get deletedAt(): Date | undefined {
    return this._deletedAt;
  }

  get deletedBy(): string | undefined {
    return this._deletedBy;
  }

  get isSynced(): boolean {
    return this._syncedAt !== undefined;
  }

  get hasLocation(): boolean {
    return this._latitude !== undefined && this._longitude !== undefined;
  }

  get isDeleted(): boolean {
    return this._deletedAt !== undefined;
  }

  // Business Logic Methods

  /**
   * Mark entry as synced to cloud
   *
   * Business rule: Entry can only be synced once
   */
  public markAsSynced(): void {
    if (this._syncedAt) {
      throw new Error('Entry is already synced');
    }

    this._syncedAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Update notes field
   *
   * Business rule: Cannot update deleted entries
   */
  public updateNotes(notes: string): void {
    if (this.isDeleted) {
      throw new Error('Cannot update a deleted entry');
    }

    if (notes && notes.length > 2000) {
      throw new Error('Notes cannot exceed 2000 characters');
    }

    this._notes = notes;
    this._updatedAt = new Date();
  }

  /**
   * Add a photo to the entry
   *
   * Business rule: Maximum 10 photos per entry, cannot modify deleted entries
   */
  public addPhoto(photoUrl: string): void {
    if (this.isDeleted) {
      throw new Error('Cannot add photo to a deleted entry');
    }

    if (!photoUrl || photoUrl.trim().length === 0) {
      throw new Error('Photo URL cannot be empty');
    }

    if (this._photos.length >= 10) {
      throw new Error('Cannot have more than 10 photos per entry');
    }

    this._photos.push(photoUrl);
    this._updatedAt = new Date();
  }

  /**
   * Soft delete the entry
   *
   * Business rule: Deleted entries cannot be modified further
   */
  public softDelete(deletedBy: string): void {
    if (this.isDeleted) {
      throw new Error('Entry is already deleted');
    }

    this._deletedAt = new Date();
    this._deletedBy = deletedBy;
    this._updatedAt = new Date();
  }

  /**
   * Validate entity invariants
   */
  private validate(): void {
    // Validate required fields
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Field entry ID is required');
    }

    if (!this._tenantId || this._tenantId.trim().length === 0) {
      throw new Error('Tenant ID is required');
    }

    if (!this._wellId || this._wellId.trim().length === 0) {
      throw new Error('Well ID is required');
    }

    if (!this._createdBy || this._createdBy.trim().length === 0) {
      throw new Error('Created by user ID is required');
    }

    if (!this._deviceId || this._deviceId.trim().length === 0) {
      throw new Error('Device ID is required');
    }

    // Validate entry type
    const validEntryTypes: EntryType[] = [
      'PRODUCTION',
      'INSPECTION',
      'MAINTENANCE',
    ];
    if (!validEntryTypes.includes(this._entryType)) {
      throw new Error(`Invalid entry type: ${this._entryType}`);
    }

    // Business rule: Entry type must match the data provided
    if (this._entryType === 'PRODUCTION' && !this._productionData) {
      throw new Error('Production entry must have production data');
    }

    if (this._entryType === 'INSPECTION' && !this._inspectionData) {
      throw new Error('Inspection entry must have inspection data');
    }

    if (this._entryType === 'MAINTENANCE' && !this._maintenanceData) {
      throw new Error('Maintenance entry must have maintenance data');
    }

    // Business rule: Should only have data for the specified entry type
    if (
      this._entryType === 'PRODUCTION' &&
      (this._inspectionData || this._maintenanceData)
    ) {
      throw new Error(
        'Production entry cannot have inspection or maintenance data',
      );
    }

    if (
      this._entryType === 'INSPECTION' &&
      (this._productionData || this._maintenanceData)
    ) {
      throw new Error(
        'Inspection entry cannot have production or maintenance data',
      );
    }

    if (
      this._entryType === 'MAINTENANCE' &&
      (this._productionData || this._inspectionData)
    ) {
      throw new Error(
        'Maintenance entry cannot have production or inspection data',
      );
    }

    // Validate dates
    if (this._recordedAt > new Date()) {
      throw new Error('Recorded date cannot be in the future');
    }

    if (this._syncedAt && this._syncedAt < this._recordedAt) {
      throw new Error('Sync date cannot be before recorded date');
    }

    if (this._createdAt > new Date()) {
      throw new Error('Created date cannot be in the future');
    }

    if (this._updatedAt < this._createdAt) {
      throw new Error('Updated date cannot be before created date');
    }

    // Validate location (if provided)
    if (this._latitude !== undefined) {
      if (this._latitude < -90 || this._latitude > 90) {
        throw new Error('Latitude must be between -90 and 90');
      }
    }

    if (this._longitude !== undefined) {
      if (this._longitude < -180 || this._longitude > 180) {
        throw new Error('Longitude must be between -180 and 180');
      }
    }

    // Business rule: If latitude is provided, longitude should be too (and vice versa)
    if ((this._latitude !== undefined) !== (this._longitude !== undefined)) {
      throw new Error('Both latitude and longitude must be provided together');
    }

    // Validate soft delete consistency
    if (this._deletedAt && !this._deletedBy) {
      throw new Error('Deleted by user ID is required when entry is deleted');
    }

    if (!this._deletedAt && this._deletedBy) {
      throw new Error('Cannot have deleted by user without deleted date');
    }

    // Validate photos array
    if (this._photos) {
      if (this._photos.length > 10) {
        throw new Error('Cannot have more than 10 photos per entry');
      }

      for (const photo of this._photos) {
        if (!photo || photo.trim().length === 0) {
          throw new Error('Photo URL cannot be empty');
        }
      }
    }

    // Validate notes length
    if (this._notes && this._notes.length > 2000) {
      throw new Error('Notes cannot exceed 2000 characters');
    }
  }
}
