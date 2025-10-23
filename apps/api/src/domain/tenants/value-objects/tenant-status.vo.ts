/**
 * Tenant Status Value Object
 *
 * Represents the lifecycle status of a tenant in the platform.
 * Immutable value object with business logic for status transitions.
 */

export type TenantStatusType = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'DELETED';

export class TenantStatus {
  private constructor(private readonly value: TenantStatusType) {}

  // Factory methods
  static active(): TenantStatus {
    return new TenantStatus('ACTIVE');
  }

  static suspended(): TenantStatus {
    return new TenantStatus('SUSPENDED');
  }

  static trial(): TenantStatus {
    return new TenantStatus('TRIAL');
  }

  static deleted(): TenantStatus {
    return new TenantStatus('DELETED');
  }

  static fromString(value: string): TenantStatus {
    const normalized = value.toUpperCase() as TenantStatusType;

    if (!['ACTIVE', 'SUSPENDED', 'TRIAL', 'DELETED'].includes(normalized)) {
      throw new Error(`Invalid tenant status: ${value}`);
    }

    return new TenantStatus(normalized);
  }

  // Predicates
  isActive(): boolean {
    return this.value === 'ACTIVE';
  }

  isSuspended(): boolean {
    return this.value === 'SUSPENDED';
  }

  isTrial(): boolean {
    return this.value === 'TRIAL';
  }

  isDeleted(): boolean {
    return this.value === 'DELETED';
  }

  canAccess(): boolean {
    return this.isActive() || this.isTrial();
  }

  // Value extraction
  toString(): string {
    return this.value;
  }

  equals(other: TenantStatus): boolean {
    return this.value === other.value;
  }
}
