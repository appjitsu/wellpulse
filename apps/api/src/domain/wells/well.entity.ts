import * as crypto from 'crypto';
import { ApiNumber } from './value-objects/api-number.vo';
import { Location } from './value-objects/location.vo';

export type WellStatus = 'ACTIVE' | 'INACTIVE' | 'PLUGGED';

export interface CreateWellParams {
  name: string;
  apiNumber: string;
  latitude: number;
  longitude: number;
  status?: WellStatus;
  lease?: string;
  field?: string;
  operator?: string;
  spudDate?: Date;
  completionDate?: Date;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

/**
 * Well Domain Entity
 *
 * Represents an oil/gas well in the field.
 * Aggregate root for well-related operations.
 *
 * Business Rules:
 * - API number must be unique and immutable (Texas RRC format)
 * - Location coordinates must be valid
 * - Cannot activate a plugged well (plugged is terminal state)
 * - Well name cannot be empty
 * - All well operations are tenant-scoped
 */
export class Well {
  private constructor(
    public readonly id: string,
    private _name: string,
    private readonly _apiNumber: ApiNumber,
    private _location: Location,
    private _status: WellStatus,
    private _lease: string | null,
    private _field: string | null,
    private _operator: string | null,
    private _spudDate: Date | null,
    private _completionDate: Date | null,
    private _metadata: Record<string, unknown>,
    private readonly _createdBy: string | null,
    private _updatedBy: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  /**
   * Create a new Well entity
   */
  static create(params: CreateWellParams, id?: string): Well {
    // Validate and create value objects
    const apiNumber = ApiNumber.create(params.apiNumber);
    const location = Location.create(params.latitude, params.longitude);

    // Validate name
    if (!params.name || params.name.trim().length === 0) {
      throw new Error('Well name cannot be empty');
    }

    const now = new Date();

    return new Well(
      id ?? crypto.randomUUID(),
      params.name.trim(),
      apiNumber,
      location,
      params.status ?? 'ACTIVE',
      params.lease ?? null,
      params.field ?? null,
      params.operator ?? null,
      params.spudDate ?? null,
      params.completionDate ?? null,
      params.metadata ?? {},
      params.createdBy ?? null,
      null, // updatedBy
      now,
      now,
    );
  }

  /**
   * Reconstitute Well entity from persistence
   */
  static reconstitute(data: {
    id: string;
    name: string;
    apiNumber: string;
    latitude: number;
    longitude: number;
    status: WellStatus;
    lease: string | null;
    field: string | null;
    operator: string | null;
    spudDate: Date | null;
    completionDate: Date | null;
    metadata: Record<string, unknown>;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Well {
    return new Well(
      data.id,
      data.name,
      ApiNumber.create(data.apiNumber),
      Location.create(data.latitude, data.longitude),
      data.status,
      data.lease,
      data.field,
      data.operator,
      data.spudDate,
      data.completionDate,
      data.metadata,
      data.createdBy,
      data.updatedBy,
      data.createdAt,
      data.updatedAt,
    );
  }

  // Getters - Extract value object primitives

  get name(): string {
    return this._name;
  }

  get apiNumber(): string {
    return this._apiNumber.value;
  }

  get status(): WellStatus {
    return this._status;
  }

  get latitude(): number {
    return this._location.latitude;
  }

  get longitude(): number {
    return this._location.longitude;
  }

  get location(): { latitude: number; longitude: number } {
    return this._location.toJSON();
  }

  get lease(): string | null {
    return this._lease;
  }

  get field(): string | null {
    return this._field;
  }

  get operator(): string | null {
    return this._operator;
  }

  get spudDate(): Date | null {
    return this._spudDate;
  }

  get completionDate(): Date | null {
    return this._completionDate;
  }

  get metadata(): Record<string, unknown> {
    return { ...this._metadata }; // Return copy to maintain immutability
  }

  get createdBy(): string | null {
    return this._createdBy;
  }

  get updatedBy(): string | null {
    return this._updatedBy;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business Logic Methods

  /**
   * Activate well
   *
   * Business rule: Cannot activate a plugged well
   */
  activate(userId?: string): void {
    if (this._status === 'PLUGGED') {
      throw new Error(
        'Cannot activate a plugged well. Plugged is a terminal state.',
      );
    }

    if (this._status === 'ACTIVE') {
      return; // Already active, no-op
    }

    this._status = 'ACTIVE';
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Deactivate well
   */
  deactivate(userId?: string): void {
    if (this._status === 'INACTIVE') {
      return; // Already inactive, no-op
    }

    this._status = 'INACTIVE';
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Plug well (terminal state)
   *
   * Business rule: Once plugged, well cannot be reactivated
   */
  plug(userId?: string): void {
    if (this._status === 'PLUGGED') {
      return; // Already plugged, no-op
    }

    this._status = 'PLUGGED';
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update well location
   */
  updateLocation(latitude: number, longitude: number, userId?: string): void {
    this._location = Location.create(latitude, longitude);
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update well name
   */
  updateName(newName: string, userId?: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Well name cannot be empty');
    }

    this._name = newName.trim();
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update lease information
   */
  updateLease(lease: string, userId?: string): void {
    this._lease = lease;
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update field information
   */
  updateField(field: string, userId?: string): void {
    this._field = field;
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update operator information
   */
  updateOperator(operator: string, userId?: string): void {
    this._operator = operator;
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update spud date (date drilling began)
   */
  updateSpudDate(date: Date, userId?: string): void {
    this._spudDate = date;
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update completion date
   */
  updateCompletionDate(date: Date, userId?: string): void {
    this._completionDate = date;
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Update metadata (custom fields)
   */
  updateMetadata(metadata: Record<string, unknown>, userId?: string): void {
    this._metadata = { ...metadata };
    this._updatedBy = userId ?? null;
    this._updatedAt = new Date();
  }

  /**
   * Calculate distance to another well
   * Returns distance in miles
   */
  distanceTo(other: Well): number {
    const otherLocation = Location.create(other.latitude, other.longitude);
    return this._location.distanceTo(otherLocation);
  }
}
