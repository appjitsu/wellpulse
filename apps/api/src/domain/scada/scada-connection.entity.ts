/**
 * SCADA Connection Entity
 *
 * Represents a connection configuration to a SCADA system (RTU/PLC) for a specific well.
 * Each well can have one active SCADA connection.
 *
 * Business Rules:
 * - Connection must have a valid OPC-UA endpoint
 * - Connection must belong to a tenant and be associated with a well
 * - Connection must have at least one tag mapping configured
 * - Poll interval must be between 1-300 seconds
 * - Connection name must be unique within tenant
 */

import { OpcUaEndpoint } from './value-objects/opc-ua-endpoint.vo';

export type ConnectionStatus = 'active' | 'inactive' | 'error' | 'connecting';

export interface ScadaConnectionProps {
  id: string;
  tenantId: string;
  wellId: string;
  name: string;
  description?: string;
  endpoint: OpcUaEndpoint;
  pollIntervalSeconds: number;
  status: ConnectionStatus;
  lastConnectedAt?: Date;
  lastErrorMessage?: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateScadaConnectionProps {
  tenantId: string;
  wellId: string;
  name: string;
  description?: string;
  endpoint: OpcUaEndpoint;
  pollIntervalSeconds?: number;
  createdBy: string;
}

export interface UpdateScadaConnectionProps {
  name?: string;
  description?: string;
  endpoint?: OpcUaEndpoint;
  pollIntervalSeconds?: number;
  isEnabled?: boolean;
  updatedBy: string;
}

export class ScadaConnection {
  private constructor(
    private _id: string,
    private readonly _tenantId: string,
    private readonly _wellId: string,
    private _name: string,
    private _description: string | undefined,
    private _endpoint: OpcUaEndpoint,
    private _pollIntervalSeconds: number,
    private _status: ConnectionStatus,
    private _lastConnectedAt: Date | undefined,
    private _lastErrorMessage: string | undefined,
    private _isEnabled: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private readonly _createdBy: string,
    private _updatedBy: string,
  ) {}

  /**
   * Factory method: Create new SCADA connection
   */
  static create(props: CreateScadaConnectionProps): ScadaConnection {
    this.validateCreateProps(props);

    const now = new Date();
    const id = `scada_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new ScadaConnection(
      id,
      props.tenantId,
      props.wellId,
      props.name,
      props.description,
      props.endpoint,
      props.pollIntervalSeconds ?? 5, // Default 5 seconds
      'inactive', // Start as inactive
      undefined, // Never connected
      undefined, // No errors
      true, // Enabled by default
      now,
      now,
      props.createdBy,
      props.createdBy,
    );
  }

  /**
   * Factory method: Reconstruct from persistence
   */
  static fromPrimitives(props: ScadaConnectionProps): ScadaConnection {
    return new ScadaConnection(
      props.id,
      props.tenantId,
      props.wellId,
      props.name,
      props.description,
      props.endpoint,
      props.pollIntervalSeconds,
      props.status,
      props.lastConnectedAt,
      props.lastErrorMessage,
      props.isEnabled,
      props.createdAt,
      props.updatedAt,
      props.createdBy,
      props.updatedBy,
    );
  }

  private static validateCreateProps(props: CreateScadaConnectionProps): void {
    if (!props.tenantId) {
      throw new Error('Tenant ID is required');
    }

    if (!props.wellId) {
      throw new Error('Well ID is required');
    }

    if (!props.name) {
      throw new Error('Connection name is required');
    }

    if (props.name.length < 3 || props.name.length > 100) {
      throw new Error('Connection name must be between 3 and 100 characters');
    }

    if (!props.endpoint) {
      throw new Error('OPC-UA endpoint is required');
    }

    if (
      props.pollIntervalSeconds !== undefined &&
      (props.pollIntervalSeconds < 1 || props.pollIntervalSeconds > 300)
    ) {
      throw new Error('Poll interval must be between 1 and 300 seconds');
    }

    if (!props.createdBy) {
      throw new Error('Created by user ID is required');
    }
  }

  /**
   * Update connection configuration
   */
  update(props: UpdateScadaConnectionProps): void {
    if (props.name !== undefined) {
      if (props.name.length < 3 || props.name.length > 100) {
        throw new Error('Connection name must be between 3 and 100 characters');
      }
      this._name = props.name;
    }

    if (props.description !== undefined) {
      this._description = props.description;
    }

    if (props.endpoint !== undefined) {
      this._endpoint = props.endpoint;
      // Reset status when endpoint changes
      this._status = 'inactive';
      this._lastConnectedAt = undefined;
      this._lastErrorMessage = undefined;
    }

    if (props.pollIntervalSeconds !== undefined) {
      if (props.pollIntervalSeconds < 1 || props.pollIntervalSeconds > 300) {
        throw new Error('Poll interval must be between 1 and 300 seconds');
      }
      this._pollIntervalSeconds = props.pollIntervalSeconds;
    }

    if (props.isEnabled !== undefined) {
      this._isEnabled = props.isEnabled;
      if (!props.isEnabled) {
        this._status = 'inactive';
      }
    }

    this._updatedBy = props.updatedBy;
    this._updatedAt = new Date();
  }

  /**
   * Mark connection as active
   */
  markConnected(): void {
    this._status = 'active';
    this._lastConnectedAt = new Date();
    this._lastErrorMessage = undefined;
    this._updatedAt = new Date();
  }

  /**
   * Mark connection as connecting
   */
  markConnecting(): void {
    this._status = 'connecting';
    this._updatedAt = new Date();
  }

  /**
   * Mark connection as failed with error
   */
  markError(errorMessage: string): void {
    this._status = 'error';
    this._lastErrorMessage = errorMessage;
    this._updatedAt = new Date();
  }

  /**
   * Enable connection
   */
  enable(userId: string): void {
    if (this._isEnabled) {
      throw new Error('Connection is already enabled');
    }
    this._isEnabled = true;
    this._status = 'inactive'; // Will transition to connecting/active when started
    this._updatedBy = userId;
    this._updatedAt = new Date();
  }

  /**
   * Disable connection
   */
  disable(userId: string): void {
    if (!this._isEnabled) {
      throw new Error('Connection is already disabled');
    }
    this._isEnabled = false;
    this._status = 'inactive';
    this._updatedBy = userId;
    this._updatedAt = new Date();
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(staleDurationMs: number = 60000): boolean {
    if (!this._isEnabled) {
      return false;
    }

    if (this._status === 'error') {
      return false;
    }

    if (this._status !== 'active') {
      return false;
    }

    if (!this._lastConnectedAt) {
      return false;
    }

    // Check if last connection is stale
    const timeSinceLastConnection =
      Date.now() - this._lastConnectedAt.getTime();
    return timeSinceLastConnection < staleDurationMs;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get wellId(): string {
    return this._wellId;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | undefined {
    return this._description;
  }

  get endpoint(): OpcUaEndpoint {
    return this._endpoint;
  }

  get pollIntervalSeconds(): number {
    return this._pollIntervalSeconds;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get lastConnectedAt(): Date | undefined {
    return this._lastConnectedAt;
  }

  get lastErrorMessage(): string | undefined {
    return this._lastErrorMessage;
  }

  get isEnabled(): boolean {
    return this._isEnabled;
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
  toPrimitives(): ScadaConnectionProps {
    return {
      id: this._id,
      tenantId: this._tenantId,
      wellId: this._wellId,
      name: this._name,
      description: this._description,
      endpoint: this._endpoint,
      pollIntervalSeconds: this._pollIntervalSeconds,
      status: this._status,
      lastConnectedAt: this._lastConnectedAt,
      lastErrorMessage: this._lastErrorMessage,
      isEnabled: this._isEnabled,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      createdBy: this._createdBy,
      updatedBy: this._updatedBy,
    };
  }
}
