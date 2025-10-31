/**
 * CSV Import Domain Entity
 *
 * Represents a file import job for production data.
 * Tracks status, validation results, and provides business logic for import lifecycle.
 *
 * Pattern: Domain-Driven Design (Entity)
 * @see docs/patterns/07-Domain-Driven-Design-Pattern.md
 */

import { randomUUID } from 'node:crypto';
import type { ColumnMapping } from './value-objects/column-mapping.vo';
import { ImportStatus } from './value-objects/import-status.vo';

export interface CsvImportProps {
  id: string;
  tenantId: string;
  fileName: string;
  fileSizeBytes: number;
  status: ImportStatus;
  totalRows: number;
  rowsProcessed: number;
  rowsFailed: number;
  rowsSkipped: number;
  columnMapping: ColumnMapping;
  conflictStrategy: 'skip' | 'overwrite' | 'merge';
  errorSummary?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
}

export class CsvImport {
  private constructor(private readonly props: CsvImportProps) {}

  static create(input: Omit<CsvImportProps, 'id' | 'createdAt'>): CsvImport {
    return new CsvImport({
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: CsvImportProps): CsvImport {
    return new CsvImport(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get fileSizeBytes(): number {
    return this.props.fileSizeBytes;
  }

  get status(): ImportStatus {
    return this.props.status;
  }

  get totalRows(): number {
    return this.props.totalRows;
  }

  get rowsProcessed(): number {
    return this.props.rowsProcessed;
  }

  get rowsFailed(): number {
    return this.props.rowsFailed;
  }

  get rowsSkipped(): number {
    return this.props.rowsSkipped;
  }

  get columnMapping(): ColumnMapping {
    return this.props.columnMapping;
  }

  get conflictStrategy(): 'skip' | 'overwrite' | 'merge' {
    return this.props.conflictStrategy;
  }

  get errorSummary(): string | undefined {
    return this.props.errorSummary;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get startedAt(): Date | undefined {
    return this.props.startedAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  // Business logic

  /**
   * Start processing the import
   */
  startProcessing(): void {
    if (this.props.status.value !== 'queued') {
      throw new Error(
        `Cannot start import in ${this.props.status.value} state`,
      );
    }

    this.props.status = ImportStatus.processing();
    this.props.startedAt = new Date();
  }

  /**
   * Mark import as complete
   */
  markComplete(): void {
    if (this.props.status.value !== 'processing') {
      throw new Error(
        `Cannot complete import in ${this.props.status.value} state`,
      );
    }

    this.props.status = ImportStatus.completed();
    this.props.completedAt = new Date();
  }

  /**
   * Mark import as failed with error summary
   */
  markFailed(errorSummary: string): void {
    this.props.status = ImportStatus.failed();
    this.props.errorSummary = errorSummary;
    this.props.completedAt = new Date();
  }

  /**
   * Update progress during processing
   */
  updateProgress(processed: number, failed: number, skipped: number): void {
    if (this.props.status.value !== 'processing') {
      throw new Error(
        `Cannot update progress in ${this.props.status.value} state`,
      );
    }

    this.props.rowsProcessed = processed;
    this.props.rowsFailed = failed;
    this.props.rowsSkipped = skipped;
  }

  /**
   * Calculate completion percentage
   */
  getProgress(): number {
    if (this.props.totalRows === 0) return 0;
    const totalProcessed =
      this.props.rowsProcessed + this.props.rowsFailed + this.props.rowsSkipped;
    return Math.round((totalProcessed / this.props.totalRows) * 100);
  }

  /**
   * Check if import has errors
   */
  hasErrors(): boolean {
    return this.props.rowsFailed > 0;
  }

  /**
   * Calculate success rate
   */
  getSuccessRate(): number {
    const totalProcessed =
      this.props.rowsProcessed + this.props.rowsFailed + this.props.rowsSkipped;
    if (totalProcessed === 0) return 0;
    return Math.round((this.props.rowsProcessed / totalProcessed) * 100);
  }

  /**
   * Get estimated time remaining (simple heuristic)
   */
  getEstimatedSecondsRemaining(): number | null {
    if (!this.props.startedAt || this.props.status.value !== 'processing') {
      return null;
    }

    const elapsed = Date.now() - this.props.startedAt.getTime();
    const processed =
      this.props.rowsProcessed + this.props.rowsFailed + this.props.rowsSkipped;

    if (processed === 0) return null;

    const timePerRow = elapsed / processed;
    const remaining = this.props.totalRows - processed;

    return Math.round((remaining * timePerRow) / 1000); // Convert to seconds
  }

  /**
   * Check if can retry (failed imports can be retried)
   */
  canRetry(): boolean {
    return this.props.status.value === 'failed' && this.props.rowsFailed > 0;
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): CsvImportProps {
    return { ...this.props };
  }
}
