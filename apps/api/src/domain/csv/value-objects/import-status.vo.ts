/**
 * Import Status Value Object
 *
 * Represents the current state of a CSV import job.
 * Valid transitions: queued → processing → completed/failed
 *
 * Pattern: Value Object
 * @see docs/patterns/07-Domain-Driven-Design-Pattern.md
 */

export type ImportStatusValue =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export class ImportStatus {
  private constructor(public readonly value: ImportStatusValue) {}

  static queued(): ImportStatus {
    return new ImportStatus('queued');
  }

  static processing(): ImportStatus {
    return new ImportStatus('processing');
  }

  static completed(): ImportStatus {
    return new ImportStatus('completed');
  }

  static failed(): ImportStatus {
    return new ImportStatus('failed');
  }

  static fromString(value: string): ImportStatus {
    if (!this.isValid(value)) {
      throw new Error(`Invalid import status: ${value}`);
    }
    return new ImportStatus(value);
  }

  private static isValid(value: string): value is ImportStatusValue {
    return ['queued', 'processing', 'completed', 'failed'].includes(value);
  }

  isQueued(): boolean {
    return this.value === 'queued';
  }

  isProcessing(): boolean {
    return this.value === 'processing';
  }

  isCompleted(): boolean {
    return this.value === 'completed';
  }

  isFailed(): boolean {
    return this.value === 'failed';
  }

  isTerminal(): boolean {
    return this.isCompleted() || this.isFailed();
  }

  canTransitionTo(next: ImportStatus): boolean {
    const transitions: Record<ImportStatusValue, ImportStatusValue[]> = {
      queued: ['processing'],
      processing: ['completed', 'failed'],
      completed: [],
      failed: [],
    };

    return transitions[this.value].includes(next.value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ImportStatus): boolean {
    return this.value === other.value;
  }
}
