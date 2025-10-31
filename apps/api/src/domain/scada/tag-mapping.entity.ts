/**
 * Tag Mapping Entity
 *
 * Represents the mapping of an OPC-UA tag to a field entry property for a SCADA connection.
 * Each SCADA connection can have multiple tag mappings (e.g., pressure, temperature, flow rate).
 *
 * Business Rules:
 * - Tag mapping must belong to a SCADA connection
 * - Node ID must be unique within a SCADA connection
 * - Field entry property must be unique within a SCADA connection
 * - Tag name must be unique within a SCADA connection
 * - At least one tag mapping must exist for a connection to be functional
 */

import { TagConfiguration } from './value-objects/tag-configuration.vo';

export interface TagMappingProps {
  id: string;
  scadaConnectionId: string;
  tenantId: string;
  configuration: TagConfiguration;
  isEnabled: boolean;
  lastValue?: number | string | boolean;
  lastReadAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateTagMappingProps {
  scadaConnectionId: string;
  tenantId: string;
  configuration: TagConfiguration;
  createdBy: string;
}

export interface UpdateTagMappingProps {
  configuration?: TagConfiguration;
  isEnabled?: boolean;
  updatedBy: string;
}

export class TagMapping {
  private constructor(
    private readonly _id: string,
    private readonly _scadaConnectionId: string,
    private readonly _tenantId: string,
    private _configuration: TagConfiguration,
    private _isEnabled: boolean,
    private _lastValue: number | string | boolean | undefined,
    private _lastReadAt: Date | undefined,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private readonly _createdBy: string,
    private _updatedBy: string,
  ) {}

  /**
   * Factory method: Create new tag mapping
   */
  static create(props: CreateTagMappingProps): TagMapping {
    this.validateCreateProps(props);

    const now = new Date();
    const id = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new TagMapping(
      id,
      props.scadaConnectionId,
      props.tenantId,
      props.configuration,
      true, // Enabled by default
      undefined, // No last value
      undefined, // Never read
      now,
      now,
      props.createdBy,
      props.createdBy,
    );
  }

  /**
   * Factory method: Reconstruct from persistence
   */
  static fromPrimitives(props: TagMappingProps): TagMapping {
    return new TagMapping(
      props.id,
      props.scadaConnectionId,
      props.tenantId,
      props.configuration,
      props.isEnabled,
      props.lastValue,
      props.lastReadAt,
      props.createdAt,
      props.updatedAt,
      props.createdBy,
      props.updatedBy,
    );
  }

  private static validateCreateProps(props: CreateTagMappingProps): void {
    if (!props.scadaConnectionId) {
      throw new Error('SCADA connection ID is required');
    }

    if (!props.tenantId) {
      throw new Error('Tenant ID is required');
    }

    if (!props.configuration) {
      throw new Error('Tag configuration is required');
    }

    if (!props.createdBy) {
      throw new Error('Created by user ID is required');
    }
  }

  /**
   * Update tag mapping configuration
   */
  update(props: UpdateTagMappingProps): void {
    if (props.configuration !== undefined) {
      this._configuration = props.configuration;
    }

    if (props.isEnabled !== undefined) {
      this._isEnabled = props.isEnabled;
    }

    this._updatedBy = props.updatedBy;
    this._updatedAt = new Date();
  }

  /**
   * Record a new reading value
   */
  recordReading(value: number | string | boolean, timestamp: Date): void {
    this._lastValue = value;
    this._lastReadAt = timestamp;
    this._updatedAt = new Date();
  }

  /**
   * Enable tag mapping
   */
  enable(userId: string): void {
    if (this._isEnabled) {
      throw new Error('Tag mapping is already enabled');
    }
    this._isEnabled = true;
    this._updatedBy = userId;
    this._updatedAt = new Date();
  }

  /**
   * Disable tag mapping
   */
  disable(userId: string): void {
    if (!this._isEnabled) {
      throw new Error('Tag mapping is already disabled');
    }
    this._isEnabled = false;
    this._updatedBy = userId;
    this._updatedAt = new Date();
  }

  /**
   * Check if tag reading is stale
   */
  isStale(staleDurationMs: number = 60000): boolean {
    if (!this._lastReadAt) {
      return true; // Never read = stale
    }

    const timeSinceLastRead = Date.now() - this._lastReadAt.getTime();
    return timeSinceLastRead > staleDurationMs;
  }

  /**
   * Check if value change is significant (exceeds deadband)
   */
  isSignificantChange(newValue: number): boolean {
    if (this._lastValue === undefined) {
      return true; // First reading is always significant
    }

    if (typeof this._lastValue !== 'number') {
      return true; // Different type = significant
    }

    return this._configuration.exceedsDeadband(newValue, this._lastValue);
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get scadaConnectionId(): string {
    return this._scadaConnectionId;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get configuration(): TagConfiguration {
    return this._configuration;
  }

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  get lastValue(): number | string | boolean | undefined {
    return this._lastValue;
  }

  get lastReadAt(): Date | undefined {
    return this._lastReadAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get updatedBy(): string {
    return this._updatedBy;
  }

  /**
   * Extract primitive values for persistence layer
   */
  toPrimitives(): TagMappingProps {
    return {
      id: this._id,
      scadaConnectionId: this._scadaConnectionId,
      tenantId: this._tenantId,
      configuration: this._configuration,
      isEnabled: this._isEnabled,
      lastValue: this._lastValue,
      lastReadAt: this._lastReadAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      createdBy: this._createdBy,
      updatedBy: this._updatedBy,
    };
  }
}
