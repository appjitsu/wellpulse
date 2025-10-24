/**
 * API Number Value Object
 *
 * Encapsulates Texas Railroad Commission (RRC) API well number validation.
 * API numbers uniquely identify oil/gas wells in Texas.
 *
 * Format: XX-XXX-XXXXX (e.g., 42-165-12345)
 * - First 2 digits: District number (01-99)
 * - Next 3 digits: County code (001-999)
 * - Last 5 digits: Well sequence number (00001-99999)
 *
 * Business Rules:
 * - Must match format: \d{2}-\d{3}-\d{5}
 * - Immutable once created
 * - Used for regulatory compliance and well identification
 */
export class ApiNumber {
  private static readonly API_NUMBER_REGEX = /^\d{2}-\d{3}-\d{5}$/;

  private constructor(private readonly _value: string) {}

  static create(value: string): ApiNumber {
    const trimmed = value.trim();

    // Business rule: Must match Texas RRC API number format
    if (!ApiNumber.API_NUMBER_REGEX.test(trimmed)) {
      throw new Error(
        `Invalid API number format: ${value}. Expected format: XX-XXX-XXXXX (e.g., 42-165-12345)`,
      );
    }

    return new ApiNumber(trimmed);
  }

  get value(): string {
    return this._value;
  }

  /**
   * Extract district number (first 2 digits)
   */
  get district(): string {
    return this._value.substring(0, 2);
  }

  /**
   * Extract county code (middle 3 digits)
   */
  get countyCode(): string {
    return this._value.substring(3, 6);
  }

  /**
   * Extract well sequence number (last 5 digits)
   */
  get sequenceNumber(): string {
    return this._value.substring(7);
  }

  equals(other: ApiNumber): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
