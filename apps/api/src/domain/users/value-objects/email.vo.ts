/**
 * Email Value Object
 *
 * Encapsulates email validation logic and ensures email consistency.
 * Emails are normalized (lowercase, trimmed) for comparison.
 */
export class Email {
  private constructor(private readonly _value: string) {}

  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();

    // Business rule: Email must be valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error(`Invalid email format: ${value}`);
    }

    // Business rule: Email must not exceed 255 characters
    if (trimmed.length > 255) {
      throw new Error('Email must not exceed 255 characters');
    }

    return new Email(trimmed);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
