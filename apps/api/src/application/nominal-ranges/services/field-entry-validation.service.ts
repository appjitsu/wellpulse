/**
 * Field Entry Validation Service
 *
 * Validates field data entries against nominal ranges and creates alerts for violations.
 * This service is called when field data is submitted from the field (Electron/Mobile apps).
 */

import { Injectable, Inject } from '@nestjs/common';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';
import { IAlertRepository } from '../../../domain/repositories/alert.repository.interface';
import { Alert } from '../../../domain/alert/alert.entity';
import { NominalRangeViolation } from '../../../domain/nominal-range/nominal-range.entity';
import { randomUUID } from 'crypto';

/**
 * Field Entry Validation Data
 * Represents the production data submitted from the field.
 */
export interface FieldEntryData {
  tenantId: string;
  wellId: string;
  wellType: string | null;
  fieldEntryId: string;
  fields: {
    [fieldName: string]: number | null; // e.g., { oilProduction: 120, gasProduction: 500 }
  };
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  violations: NominalRangeViolation[];
  alertsCreated: string[]; // Alert IDs created for violations
}

/**
 * Field Entry Validation Service
 *
 * Validates field data against nominal ranges and creates alerts for violations.
 *
 * Business Rules:
 * - Uses effective nominal ranges (cascade: well-specific > org-level > global)
 * - Creates alerts for values outside nominal ranges
 * - Alert severity matches the nominal range severity
 * - Only creates alerts for fields with configured nominal ranges
 * - Skips validation for null/undefined values
 */
@Injectable()
export class FieldEntryValidationService {
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
    @Inject('IAlertRepository')
    private readonly alertRepository: IAlertRepository,
  ) {}

  /**
   * Validates a field entry against nominal ranges.
   * Creates alerts for any violations.
   *
   * @param data - Field entry data with all field values
   * @returns Validation result with violations and created alerts
   */
  async validateFieldEntry(data: FieldEntryData): Promise<ValidationResult> {
    const violations: NominalRangeViolation[] = [];
    const alertsCreated: string[] = [];

    // 1. Get effective nominal ranges for this well
    const effectiveRanges =
      await this.nominalRangeRepository.getEffectiveRangesForWell(
        data.tenantId,
        data.wellId,
        data.wellType,
      );

    // 2. Validate each field value against its nominal range
    for (const [fieldName, fieldValue] of Object.entries(data.fields)) {
      // Skip null/undefined values
      if (fieldValue === null || fieldValue === undefined) {
        continue;
      }

      // Check if this field has a nominal range configured
      const nominalRange = effectiveRanges.get(fieldName);
      if (!nominalRange) {
        continue; // No range configured for this field, skip validation
      }

      // Validate the value
      const violation = nominalRange.validate(fieldValue);

      if (violation) {
        // Value is outside nominal range
        violations.push(violation);

        // Create an alert for this violation
        const alert = await this.createViolationAlert(
          data.tenantId,
          data.wellId,
          data.fieldEntryId,
          violation,
        );

        alertsCreated.push(alert.id);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      alertsCreated,
    };
  }

  /**
   * Validates a single field value against its nominal range.
   * Useful for real-time validation in the UI.
   *
   * @param tenantId - Tenant ID
   * @param wellId - Well ID
   * @param wellType - Well type (e.g., "Horizontal Oil Well")
   * @param fieldName - Field name (e.g., "oilProduction")
   * @param fieldValue - Field value to validate
   * @returns Validation result or null if no range configured
   */
  async validateSingleField(
    tenantId: string,
    wellId: string,
    wellType: string | null,
    fieldName: string,
    fieldValue: number,
  ): Promise<NominalRangeViolation | null> {
    // Get effective range for this specific field
    const nominalRange =
      await this.nominalRangeRepository.getEffectiveRangeForField(
        tenantId,
        wellId,
        wellType,
        fieldName,
      );

    if (!nominalRange) {
      return null; // No range configured
    }

    return nominalRange.validate(fieldValue);
  }

  /**
   * Creates an alert for a nominal range violation.
   *
   * @private
   */
  private async createViolationAlert(
    tenantId: string,
    wellId: string,
    fieldEntryId: string,
    violation: NominalRangeViolation,
  ): Promise<Alert> {
    const alert = Alert.createNominalRangeViolation({
      id: randomUUID(),
      tenantId,
      wellId,
      fieldEntryId,
      fieldName: violation.fieldName,
      actualValue: violation.actualValue,
      expectedMin: violation.expectedMin,
      expectedMax: violation.expectedMax,
      severity: violation.severity,
      message: violation.message,
      metadata: {
        validatedAt: new Date().toISOString(),
        violationType:
          violation.actualValue < (violation.expectedMin ?? -Infinity)
            ? 'below_minimum'
            : 'above_maximum',
      },
    });

    return await this.alertRepository.create(alert);
  }

  /**
   * Batch validates multiple field entries (useful for offline sync).
   *
   * @param entries - Array of field entries to validate
   * @returns Array of validation results
   */
  async validateBatch(entries: FieldEntryData[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const entry of entries) {
      const result = await this.validateFieldEntry(entry);
      results.push(result);
    }

    return results;
  }
}
