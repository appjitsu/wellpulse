/**
 * Production Data Validator Service
 *
 * Validates CSV row data according to Oil & Gas production data business rules.
 * Ensures data quality before importing into the system.
 */

import { Injectable, Logger } from '@nestjs/common';
import { CsvRow } from './csv-parser.service';

export interface ValidationError {
  field: string;
  value: unknown;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

@Injectable()
export class ProductionDataValidatorService {
  private readonly logger = new Logger(ProductionDataValidatorService.name);

  /**
   * Validate a single CSV row
   *
   * @param row CSV row data with mapped field names
   * @param rowNumber Row number for error reporting
   * @returns Validation result
   */
  validate(row: CsvRow, rowNumber: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required field validation
    this.validateRequiredFields(row, errors);

    // Data type validation
    this.validateDataTypes(row, errors);

    // Business rule validation
    this.validateBusinessRules(row, errors, warnings);

    // Range validation
    this.validateRanges(row, errors, warnings);

    if (errors.length > 0) {
      this.logger.debug(
        `Row ${rowNumber} has ${errors.length} validation errors`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate required fields are present
   */
  private validateRequiredFields(row: CsvRow, errors: ValidationError[]): void {
    const requiredFields = ['wellId', 'date'];

    for (const field of requiredFields) {
      const value = row[field];
      if (value === null || value === undefined || value === '') {
        errors.push({
          field,
          value,
          message: `Required field "${field}" is missing or empty`,
          code: 'REQUIRED_FIELD_MISSING',
        });
      }
    }
  }

  /**
   * Validate data types
   */
  private validateDataTypes(row: CsvRow, errors: ValidationError[]): void {
    // Numeric fields
    const numericFields = [
      'oil',
      'gas',
      'water',
      'tubingPressure',
      'casingPressure',
      'runtime',
    ];

    for (const field of numericFields) {
      const value = row[field];
      if (value !== null && value !== undefined && value !== '') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push({
            field,
            value,
            message: `Field "${field}" must be a number, got "${value}"`,
            code: 'INVALID_NUMBER',
          });
        }
      }
    }

    // Date validation
    if (row.date) {
      const dateValue = new Date(row.date as string);
      if (isNaN(dateValue.getTime())) {
        errors.push({
          field: 'date',
          value: row.date,
          message: `Invalid date format: "${row.date}"`,
          code: 'INVALID_DATE',
        });
      }
    }
  }

  /**
   * Validate business rules
   */
  private validateBusinessRules(
    row: CsvRow,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    // Date must not be in the future
    if (row.date) {
      const dateValue = new Date(row.date as string);
      if (!isNaN(dateValue.getTime())) {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today

        if (dateValue > today) {
          errors.push({
            field: 'date',
            value: row.date,
            message: 'Production date cannot be in the future',
            code: 'FUTURE_DATE',
          });
        }

        // Warn if date is very old (> 5 years)
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

        if (dateValue < fiveYearsAgo) {
          warnings.push({
            field: 'date',
            value: row.date,
            message: 'Production date is more than 5 years old',
            code: 'OLD_DATE',
          });
        }
      }
    }

    // At least one production metric must be present
    const hasProduction =
      this.hasValue(row.oil) ||
      this.hasValue(row.gas) ||
      this.hasValue(row.water);

    if (!hasProduction) {
      warnings.push({
        field: 'production',
        value: null,
        message:
          'No production volumes (oil, gas, water) provided - entry may be incomplete',
        code: 'NO_PRODUCTION_DATA',
      });
    }
  }

  /**
   * Validate value ranges
   */
  private validateRanges(
    row: CsvRow,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    // Production volumes must be non-negative
    const volumeFields = ['oil', 'gas', 'water'];

    for (const field of volumeFields) {
      const value = row[field];
      if (this.hasValue(value)) {
        const numValue = Number(value);
        if (numValue < 0) {
          errors.push({
            field,
            value,
            message: `${field} volume cannot be negative: ${numValue}`,
            code: 'NEGATIVE_VOLUME',
          });
        }

        // Warn on unusually high values
        const maxValues = { oil: 10000, gas: 100000, water: 50000 };
        if (numValue > maxValues[field as keyof typeof maxValues]) {
          warnings.push({
            field,
            value,
            message: `${field} volume is unusually high: ${numValue}`,
            code: 'HIGH_VOLUME',
          });
        }
      }
    }

    // Pressure ranges
    const pressureFields = ['tubingPressure', 'casingPressure'];

    for (const field of pressureFields) {
      const value = row[field];
      if (this.hasValue(value)) {
        const numValue = Number(value);
        if (numValue < 0) {
          errors.push({
            field,
            value,
            message: `${field} cannot be negative: ${numValue}`,
            code: 'NEGATIVE_PRESSURE',
          });
        }

        if (numValue > 5000) {
          warnings.push({
            field,
            value,
            message: `${field} is unusually high: ${numValue} PSI`,
            code: 'HIGH_PRESSURE',
          });
        }
      }
    }

    // Runtime validation
    if (this.hasValue(row.runtime)) {
      const runtime = Number(row.runtime);
      if (runtime < 0) {
        errors.push({
          field: 'runtime',
          value: row.runtime,
          message: `Runtime cannot be negative: ${runtime}`,
          code: 'NEGATIVE_RUNTIME',
        });
      }

      if (runtime > 24) {
        errors.push({
          field: 'runtime',
          value: row.runtime,
          message: `Runtime cannot exceed 24 hours: ${runtime}`,
          code: 'EXCESSIVE_RUNTIME',
        });
      }
    }
  }

  /**
   * Batch validate multiple rows
   *
   * @param rows Array of CSV rows
   * @returns Array of validation results
   */
  validateBatch(rows: CsvRow[]): ValidationResult[] {
    return rows.map((row, index) => this.validate(row, index + 1));
  }

  /**
   * Get validation statistics
   *
   * @param results Array of validation results
   * @returns Summary statistics
   */
  getValidationStats(results: ValidationResult[]): {
    total: number;
    valid: number;
    invalid: number;
    totalErrors: number;
    totalWarnings: number;
  } {
    const total = results.length;
    const valid = results.filter((r) => r.valid).length;
    const invalid = total - valid;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce(
      (sum, r) => sum + r.warnings.length,
      0,
    );

    return {
      total,
      valid,
      invalid,
      totalErrors,
      totalWarnings,
    };
  }

  /**
   * Check if value exists and is not empty
   */
  private hasValue(value: unknown): boolean {
    return value !== null && value !== undefined && value !== '';
  }
}
