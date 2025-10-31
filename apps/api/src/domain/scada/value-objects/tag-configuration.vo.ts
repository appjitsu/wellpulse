/**
 * Tag Configuration Value Object
 *
 * Represents the configuration for mapping an OPC-UA tag to a field entry property.
 * Each tag corresponds to a specific measurement (e.g., pressure, temperature, flow rate).
 *
 * @example
 * const tag = TagConfiguration.create({
 *   nodeId: 'ns=2;s=Pressure',
 *   tagName: 'casingPressure',
 *   fieldEntryProperty: 'casingPressure',
 *   dataType: 'Float',
 *   unit: 'psi',
 *   scalingFactor: 1.0
 * });
 */

export type OpcUaDataType =
  | 'Boolean'
  | 'SByte'
  | 'Byte'
  | 'Int16'
  | 'UInt16'
  | 'Int32'
  | 'UInt32'
  | 'Int64'
  | 'UInt64'
  | 'Float'
  | 'Double'
  | 'String'
  | 'DateTime';

export interface TagConfigurationProps {
  nodeId: string;
  tagName: string;
  fieldEntryProperty: string;
  dataType: OpcUaDataType;
  unit?: string;
  scalingFactor?: number;
  deadband?: number;
}

export class TagConfiguration {
  private constructor(
    private readonly _nodeId: string,
    private readonly _tagName: string,
    private readonly _fieldEntryProperty: string,
    private readonly _dataType: OpcUaDataType,
    private readonly _unit?: string,
    private readonly _scalingFactor: number = 1.0,
    private readonly _deadband?: number,
  ) {}

  static create(props: TagConfigurationProps): TagConfiguration {
    this.validate(props);
    return new TagConfiguration(
      props.nodeId,
      props.tagName,
      props.fieldEntryProperty,
      props.dataType,
      props.unit,
      props.scalingFactor ?? 1.0,
      props.deadband,
    );
  }

  private static validate(props: TagConfigurationProps): void {
    // Validate node ID
    if (!props.nodeId) {
      throw new Error('Node ID is required');
    }

    if (!props.nodeId.includes('ns=')) {
      throw new Error('Node ID must include namespace (e.g., ns=2;s=Pressure)');
    }

    // Validate tag name
    if (!props.tagName) {
      throw new Error('Tag name is required');
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(props.tagName)) {
      throw new Error(
        'Tag name must start with a letter and contain only alphanumeric characters and underscores',
      );
    }

    // Validate field entry property
    if (!props.fieldEntryProperty) {
      throw new Error('Field entry property is required');
    }

    const validProperties = [
      'casingPressure',
      'tubingPressure',
      'linePressure',
      'temperature',
      'flowRate',
      'oilVolume',
      'gasVolume',
      'waterVolume',
      'chokePressure',
      'separatorPressure',
    ];

    if (!validProperties.includes(props.fieldEntryProperty)) {
      throw new Error(
        `Field entry property must be one of: ${validProperties.join(', ')}`,
      );
    }

    // Validate scaling factor
    if (props.scalingFactor !== undefined && props.scalingFactor <= 0) {
      throw new Error('Scaling factor must be positive');
    }

    // Validate deadband
    if (props.deadband !== undefined && props.deadband < 0) {
      throw new Error('Deadband must be non-negative');
    }
  }

  get nodeId(): string {
    return this._nodeId;
  }

  get tagName(): string {
    return this._tagName;
  }

  get fieldEntryProperty(): string {
    return this._fieldEntryProperty;
  }

  get dataType(): OpcUaDataType {
    return this._dataType;
  }

  get unit(): string | undefined {
    return this._unit;
  }

  get scalingFactor(): number {
    return this._scalingFactor;
  }

  get deadband(): number | undefined {
    return this._deadband;
  }

  /**
   * Apply scaling factor to raw value
   */
  scaleValue(rawValue: number): number {
    return rawValue * this._scalingFactor;
  }

  /**
   * Check if value change exceeds deadband threshold
   */
  exceedsDeadband(currentValue: number, previousValue: number): boolean {
    if (this._deadband === undefined) {
      return true; // No deadband, all changes are significant
    }

    const change = Math.abs(currentValue - previousValue);
    return change >= this._deadband;
  }

  /**
   * Extract primitive values for persistence layer
   */
  toPrimitives(): TagConfigurationProps {
    return {
      nodeId: this._nodeId,
      tagName: this._tagName,
      fieldEntryProperty: this._fieldEntryProperty,
      dataType: this._dataType,
      unit: this._unit,
      scalingFactor: this._scalingFactor,
      deadband: this._deadband,
    };
  }

  /**
   * Reconstruct from primitive values
   */
  static fromPrimitives(props: TagConfigurationProps): TagConfiguration {
    return this.create(props);
  }

  equals(other: TagConfiguration): boolean {
    return (
      this._nodeId === other._nodeId &&
      this._tagName === other._tagName &&
      this._fieldEntryProperty === other._fieldEntryProperty &&
      this._dataType === other._dataType &&
      this._unit === other._unit &&
      this._scalingFactor === other._scalingFactor &&
      this._deadband === other._deadband
    );
  }

  toString(): string {
    const unit = this._unit ? ` (${this._unit})` : '';
    const scaling =
      this._scalingFactor !== 1.0 ? ` [×${this._scalingFactor}]` : '';
    return `${this._tagName}: ${this._nodeId} → ${this._fieldEntryProperty}${unit}${scaling}`;
  }
}
