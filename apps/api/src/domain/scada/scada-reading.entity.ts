/**
 * SCADA Reading Entity
 *
 * Represents a single time-series reading from a SCADA system.
 * Readings are immutable once created and stored in TimescaleDB for time-series analytics.
 *
 * Business Rules:
 * - Readings are immutable (append-only time-series data)
 * - Each reading must have a valid timestamp, value, and quality indicator
 * - Readings must be associated with a tenant, well, connection, and tag
 * - Out-of-range values should be flagged (quality = 'OUT_OF_RANGE')
 * - Stale readings (no update for 60s) should be flagged (quality = 'STALE')
 * - Readings are stored indefinitely for historical analysis
 */

export type ReadingQuality =
  | 'GOOD'
  | 'BAD'
  | 'UNCERTAIN'
  | 'OUT_OF_RANGE'
  | 'STALE';
export type ReadingDataType = 'number' | 'string' | 'boolean';

export interface ScadaReadingProps {
  id: string;
  tenantId: string;
  wellId: string;
  scadaConnectionId: string;
  tagName: string;
  value: number | string | boolean;
  dataType: ReadingDataType;
  quality: ReadingQuality;
  timestamp: Date;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateScadaReadingProps {
  tenantId: string;
  wellId: string;
  scadaConnectionId: string;
  tagName: string;
  value: number | string | boolean;
  quality?: ReadingQuality;
  timestamp?: Date;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  metadata?: Record<string, unknown>;
}

export class ScadaReading {
  private constructor(
    private readonly _id: string,
    private readonly _tenantId: string,
    private readonly _wellId: string,
    private readonly _scadaConnectionId: string,
    private readonly _tagName: string,
    private readonly _value: number | string | boolean,
    private readonly _dataType: ReadingDataType,
    private readonly _quality: ReadingQuality,
    private readonly _timestamp: Date,
    private readonly _unit: string | undefined,
    private readonly _minValue: number | undefined,
    private readonly _maxValue: number | undefined,
    private readonly _metadata: Record<string, unknown>,
  ) {}

  /**
   * Factory method: Create new SCADA reading
   */
  static create(props: CreateScadaReadingProps): ScadaReading {
    this.validateCreateProps(props);

    const id = `reading_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = props.timestamp ?? new Date();
    const dataType = this.inferDataType(props.value);

    // Auto-detect quality based on value and range
    let quality = props.quality ?? 'GOOD';
    if (props.minValue !== undefined && props.maxValue !== undefined) {
      if (typeof props.value === 'number') {
        if (props.value < props.minValue || props.value > props.maxValue) {
          quality = 'OUT_OF_RANGE';
        }
      }
    }

    return new ScadaReading(
      id,
      props.tenantId,
      props.wellId,
      props.scadaConnectionId,
      props.tagName,
      props.value,
      dataType,
      quality,
      timestamp,
      props.unit,
      props.minValue,
      props.maxValue,
      props.metadata ?? {},
    );
  }

  /**
   * Factory method: Reconstruct from persistence
   */
  static fromPrimitives(props: ScadaReadingProps): ScadaReading {
    return new ScadaReading(
      props.id,
      props.tenantId,
      props.wellId,
      props.scadaConnectionId,
      props.tagName,
      props.value,
      props.dataType,
      props.quality,
      props.timestamp,
      props.unit,
      props.minValue,
      props.maxValue,
      props.metadata ?? {},
    );
  }

  private static validateCreateProps(props: CreateScadaReadingProps): void {
    if (!props.tenantId) {
      throw new Error('Tenant ID is required');
    }

    if (!props.wellId) {
      throw new Error('Well ID is required');
    }

    if (!props.scadaConnectionId) {
      throw new Error('SCADA connection ID is required');
    }

    if (!props.tagName) {
      throw new Error('Tag name is required');
    }

    if (props.tagName.length < 1 || props.tagName.length > 100) {
      throw new Error('Tag name must be between 1 and 100 characters');
    }

    if (props.value === undefined || props.value === null) {
      throw new Error('Reading value is required');
    }

    // Validate numeric ranges if provided
    if (props.minValue !== undefined && props.maxValue !== undefined) {
      if (props.minValue >= props.maxValue) {
        throw new Error('Min value must be less than max value');
      }
    }
  }

  private static inferDataType(
    value: number | string | boolean,
  ): ReadingDataType {
    if (typeof value === 'number') {
      return 'number';
    } else if (typeof value === 'string') {
      return 'string';
    } else {
      return 'boolean';
    }
  }

  /**
   * Check if reading is within acceptable range
   */
  isInRange(): boolean {
    if (this._minValue === undefined || this._maxValue === undefined) {
      return true; // No range defined = always in range
    }

    if (typeof this._value !== 'number') {
      return true; // Non-numeric values don't have ranges
    }

    return this._value >= this._minValue && this._value <= this._maxValue;
  }

  /**
   * Check if reading quality is acceptable
   */
  isGoodQuality(): boolean {
    return this._quality === 'GOOD';
  }

  /**
   * Check if reading is stale (older than threshold)
   */
  isStale(thresholdMs: number = 60000): boolean {
    const age = Date.now() - this._timestamp.getTime();
    return age > thresholdMs;
  }

  /**
   * Get reading age in milliseconds
   */
  getAge(): number {
    return Date.now() - this._timestamp.getTime();
  }

  /**
   * Format reading as human-readable string
   */
  formatValue(): string {
    let formattedValue: string;

    if (typeof this._value === 'number') {
      formattedValue = this._value.toFixed(2);
    } else {
      formattedValue = String(this._value);
    }

    if (this._unit) {
      return `${formattedValue} ${this._unit}`;
    }

    return formattedValue;
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

  get scadaConnectionId(): string {
    return this._scadaConnectionId;
  }

  get tagName(): string {
    return this._tagName;
  }

  get value(): number | string | boolean {
    return this._value;
  }

  get dataType(): ReadingDataType {
    return this._dataType;
  }

  get quality(): ReadingQuality {
    return this._quality;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get unit(): string | undefined {
    return this._unit;
  }

  get minValue(): number | undefined {
    return this._minValue;
  }

  get maxValue(): number | undefined {
    return this._maxValue;
  }

  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  /**
   * Extract primitive values for persistence layer
   */
  toPrimitives(): ScadaReadingProps {
    return {
      id: this._id,
      tenantId: this._tenantId,
      wellId: this._wellId,
      scadaConnectionId: this._scadaConnectionId,
      tagName: this._tagName,
      value: this._value,
      dataType: this._dataType,
      quality: this._quality,
      timestamp: this._timestamp,
      unit: this._unit,
      minValue: this._minValue,
      maxValue: this._maxValue,
      metadata: this._metadata,
    };
  }

  /**
   * Compare with another reading (for sorting)
   */
  isNewerThan(other: ScadaReading): boolean {
    return this._timestamp.getTime() > other._timestamp.getTime();
  }

  /**
   * Calculate change from previous reading (for numeric values only)
   */
  calculateChange(previous: ScadaReading): number | null {
    if (
      typeof this._value !== 'number' ||
      typeof previous._value !== 'number'
    ) {
      return null;
    }

    return this._value - previous._value;
  }

  /**
   * Calculate percentage change from previous reading (for numeric values only)
   */
  calculatePercentageChange(previous: ScadaReading): number | null {
    if (
      typeof this._value !== 'number' ||
      typeof previous._value !== 'number'
    ) {
      return null;
    }

    if (previous._value === 0) {
      return null; // Avoid division by zero
    }

    return ((this._value - previous._value) / previous._value) * 100;
  }
}
