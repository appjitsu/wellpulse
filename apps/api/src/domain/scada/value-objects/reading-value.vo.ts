/**
 * Reading Value Value Object
 *
 * Represents a single SCADA reading value with timestamp and quality indicator.
 * Quality indicator follows OPC-UA quality codes (Good, Bad, Uncertain).
 *
 * @example
 * const reading = ReadingValue.create({
 *   value: 1250.5,
 *   timestamp: new Date('2025-10-29T12:00:00Z'),
 *   quality: 'Good'
 * });
 */

export type ReadingQuality = 'Good' | 'Bad' | 'Uncertain';

export interface ReadingValueProps {
  value: number | string | boolean;
  timestamp: Date;
  quality: ReadingQuality;
  statusCode?: number;
}

export class ReadingValue {
  private constructor(
    private readonly _value: number | string | boolean,
    private readonly _timestamp: Date,
    private readonly _quality: ReadingQuality,
    private readonly _statusCode?: number,
  ) {}

  static create(props: ReadingValueProps): ReadingValue {
    this.validate(props);
    return new ReadingValue(
      props.value,
      props.timestamp,
      props.quality,
      props.statusCode,
    );
  }

  private static validate(props: ReadingValueProps): void {
    // Validate value
    if (props.value === null || props.value === undefined) {
      throw new Error('Reading value is required');
    }

    // Validate timestamp
    if (!(props.timestamp instanceof Date)) {
      throw new Error('Timestamp must be a Date object');
    }

    if (isNaN(props.timestamp.getTime())) {
      throw new Error('Invalid timestamp');
    }

    // Validate timestamp is not in the future
    if (props.timestamp > new Date()) {
      throw new Error('Timestamp cannot be in the future');
    }

    // Validate timestamp is not too old (more than 1 year ago)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (props.timestamp < oneYearAgo) {
      throw new Error('Timestamp cannot be more than 1 year in the past');
    }

    // Validate quality
    const validQualities: ReadingQuality[] = ['Good', 'Bad', 'Uncertain'];
    if (!validQualities.includes(props.quality)) {
      throw new Error(`Quality must be one of: ${validQualities.join(', ')}`);
    }
  }

  get value(): number | string | boolean {
    return this._value;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get quality(): ReadingQuality {
    return this._quality;
  }

  get statusCode(): number | undefined {
    return this._statusCode;
  }

  get isGood(): boolean {
    return this._quality === 'Good';
  }

  get isBad(): boolean {
    return this._quality === 'Bad';
  }

  get isUncertain(): boolean {
    return this._quality === 'Uncertain';
  }

  get numericValue(): number {
    if (typeof this._value === 'number') {
      return this._value;
    }
    if (typeof this._value === 'string') {
      const parsed = parseFloat(this._value);
      if (isNaN(parsed)) {
        throw new Error(`Cannot convert value "${this._value}" to number`);
      }
      return parsed;
    }
    if (typeof this._value === 'boolean') {
      return this._value ? 1 : 0;
    }
    throw new Error(`Cannot convert value type to number`);
  }

  get stringValue(): string {
    return String(this._value);
  }

  get booleanValue(): boolean {
    if (typeof this._value === 'boolean') {
      return this._value;
    }
    if (typeof this._value === 'number') {
      return this._value !== 0;
    }
    if (typeof this._value === 'string') {
      return this._value.toLowerCase() === 'true' || this._value === '1';
    }
    return false;
  }

  /**
   * Get age of reading in milliseconds
   */
  getAge(): number {
    return Date.now() - this._timestamp.getTime();
  }

  /**
   * Check if reading is stale (older than threshold)
   */
  isStale(thresholdMs: number): boolean {
    return this.getAge() > thresholdMs;
  }

  /**
   * Extract primitive values for persistence layer
   */
  toPrimitives(): {
    value: number | string | boolean;
    timestamp: string;
    quality: ReadingQuality;
    statusCode?: number;
  } {
    return {
      value: this._value,
      timestamp: this._timestamp.toISOString(),
      quality: this._quality,
      statusCode: this._statusCode,
    };
  }

  /**
   * Reconstruct from primitive values
   */
  static fromPrimitives(props: {
    value: number | string | boolean;
    timestamp: string;
    quality: ReadingQuality;
    statusCode?: number;
  }): ReadingValue {
    return this.create({
      value: props.value,
      timestamp: new Date(props.timestamp),
      quality: props.quality,
      statusCode: props.statusCode,
    });
  }

  equals(other: ReadingValue): boolean {
    return (
      this._value === other._value &&
      this._timestamp.getTime() === other._timestamp.getTime() &&
      this._quality === other._quality &&
      this._statusCode === other._statusCode
    );
  }

  toString(): string {
    const quality =
      this._quality === 'Good' ? '✓' : this._quality === 'Bad' ? '✗' : '?';
    return `${this._value} @ ${this._timestamp.toISOString()} [${quality}]`;
  }
}
