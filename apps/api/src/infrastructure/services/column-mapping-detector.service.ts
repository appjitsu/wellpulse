/**
 * Column Mapping Detector Service
 *
 * Automatically detects CSV column mappings to standard fields
 * using fuzzy string matching (fuse.js).
 *
 * Standard Fields (Oil & Gas Production Data):
 * - wellId / wellName / api
 * - date / reportDate / productionDate
 * - oil / oilProduction / bbls
 * - gas / gasProduction / mcf
 * - water / waterProduction / bwpd
 * - pressure / tubingPressure / casingPressure
 * - runtime / uptime / hours
 * - status / wellStatus
 */

import { Injectable, Logger } from '@nestjs/common';
import Fuse from 'fuse.js';

export interface FieldMapping {
  csvColumn: string;
  standardField: string;
  confidence: number; // 0-1
}

export interface MappingDetectionResult {
  mappings: FieldMapping[];
  unmappedColumns: string[];
  detectedFormat: string; // e.g., "production", "inspection", "maintenance"
}

/**
 * Standard field definitions for Oil & Gas data
 */
const STANDARD_FIELDS = {
  // Well identification
  wellId: {
    aliases: [
      'well id',
      'wellid',
      'well_id',
      'id',
      'well number',
      'well #',
      'api',
      'api number',
      'well name',
      'wellname',
    ],
    required: true,
  },
  // Date fields
  date: {
    aliases: [
      'date',
      'report date',
      'reportdate',
      'production date',
      'productiondate',
      'entry date',
      'timestamp',
    ],
    required: true,
  },
  // Production volumes
  oil: {
    aliases: [
      'oil',
      'oil production',
      'oilproduction',
      'bbls',
      'barrels',
      'bopd',
      'oil volume',
      'crude',
    ],
    required: false,
  },
  gas: {
    aliases: [
      'gas',
      'gas production',
      'gasproduction',
      'mcf',
      'mscf',
      'gas volume',
      'natural gas',
    ],
    required: false,
  },
  water: {
    aliases: [
      'water',
      'water production',
      'waterproduction',
      'bwpd',
      'water volume',
      'produced water',
    ],
    required: false,
  },
  // Pressure readings
  tubingPressure: {
    aliases: [
      'tubing pressure',
      'tubingpressure',
      'tp',
      'tbg pressure',
      'tubing psi',
      'flowing tubing pressure',
    ],
    required: false,
  },
  casingPressure: {
    aliases: [
      'casing pressure',
      'casingpressure',
      'cp',
      'csg pressure',
      'casing psi',
      'annulus pressure',
    ],
    required: false,
  },
  // Runtime / Status
  runtime: {
    aliases: [
      'runtime',
      'run time',
      'uptime',
      'hours',
      'operating hours',
      'run hours',
    ],
    required: false,
  },
  status: {
    aliases: [
      'status',
      'well status',
      'wellstatus',
      'operating status',
      'condition',
    ],
    required: false,
  },
  // Inspection fields
  inspectorName: {
    aliases: [
      'inspector',
      'inspector name',
      'inspectorname',
      'operator',
      'operator name',
      'pumper',
    ],
    required: false,
  },
  notes: {
    aliases: ['notes', 'comments', 'remarks', 'observations', 'description'],
    required: false,
  },
};

@Injectable()
export class ColumnMappingDetectorService {
  private readonly logger = new Logger(ColumnMappingDetectorService.name);

  /**
   * Auto-detect column mappings from CSV headers
   *
   * @param csvColumns Array of CSV column names
   * @param confidenceThreshold Minimum confidence score (0-1) to accept mapping
   * @returns Detection result with mappings and unmapped columns
   */
  detectMappings(
    csvColumns: string[],
    confidenceThreshold = 0.4,
  ): MappingDetectionResult {
    const mappings: FieldMapping[] = [];
    const unmappedColumns: string[] = [];

    // Normalize CSV column names
    const normalizedColumns = csvColumns.map((col) => col.toLowerCase().trim());

    // For each CSV column, find best matching standard field
    normalizedColumns.forEach((csvColumn, index) => {
      const originalColumn = csvColumns[index];
      const bestMatch = this.findBestMatch(csvColumn);

      if (bestMatch && bestMatch.confidence >= confidenceThreshold) {
        mappings.push({
          csvColumn: originalColumn,
          standardField: bestMatch.field,
          confidence: bestMatch.confidence,
        });
        this.logger.debug(
          `Mapped "${originalColumn}" → ${bestMatch.field} (${(bestMatch.confidence * 100).toFixed(0)}%)`,
        );
      } else {
        unmappedColumns.push(originalColumn);
        this.logger.warn(
          `No mapping found for column "${originalColumn}" (best: ${bestMatch?.field ?? 'none'} at ${(bestMatch?.confidence ?? 0) * 100}%)`,
        );
      }
    });

    const detectedFormat = this.detectDataFormat(mappings);

    this.logger.log(
      `Detected ${mappings.length} mappings, ${unmappedColumns.length} unmapped columns (format: ${detectedFormat})`,
    );

    return {
      mappings,
      unmappedColumns,
      detectedFormat,
    };
  }

  /**
   * Find best matching standard field for a CSV column
   *
   * @param csvColumn Normalized CSV column name
   * @returns Best match with confidence score
   */
  private findBestMatch(csvColumn: string): {
    field: string;
    confidence: number;
  } | null {
    let bestMatch: { field: string; confidence: number } | null = null;

    // Check each standard field
    for (const [fieldName, fieldDef] of Object.entries(STANDARD_FIELDS)) {
      // Create fuse instance for this field's aliases
      const fuse = new Fuse(fieldDef.aliases, {
        includeScore: true,
        threshold: 0.6, // Lower = stricter matching
        distance: 100,
        ignoreLocation: true,
      });

      const results = fuse.search(csvColumn);

      if (results.length > 0) {
        // Fuse.js score is 0 (perfect) to 1 (poor), convert to confidence
        const confidence = 1 - (results[0].score ?? 1);

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { field: fieldName, confidence };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Detect data format based on mapped fields
   *
   * @param mappings Detected field mappings
   * @returns Format type
   */
  private detectDataFormat(mappings: FieldMapping[]): string {
    const mappedFields = new Set(mappings.map((m) => m.standardField));

    // Production data: has oil/gas/water
    const hasProduction =
      mappedFields.has('oil') ||
      mappedFields.has('gas') ||
      mappedFields.has('water');

    // Inspection data: has inspector or notes
    const hasInspection =
      mappedFields.has('inspectorName') || mappedFields.has('notes');

    // Pressure data: has pressure readings
    const hasPressure =
      mappedFields.has('tubingPressure') || mappedFields.has('casingPressure');

    if (hasProduction) return 'production';
    if (hasInspection) return 'inspection';
    if (hasPressure) return 'pressure-test';

    return 'unknown';
  }

  /**
   * Validate required fields are mapped
   *
   * @param mappings Detected field mappings
   * @returns Validation result with missing required fields
   */
  validateRequiredFields(mappings: FieldMapping[]): {
    valid: boolean;
    missingFields: string[];
  } {
    const mappedFields = new Set(mappings.map((m) => m.standardField));
    const missingFields: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(STANDARD_FIELDS)) {
      if (fieldDef.required && !mappedFields.has(fieldName)) {
        missingFields.push(fieldName);
      }
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Get standard field aliases for reference
   *
   * @param fieldName Standard field name
   * @returns Array of aliases or null if field not found
   */
  getFieldAliases(fieldName: string): string[] | null {
    const fieldDef = STANDARD_FIELDS[fieldName as keyof typeof STANDARD_FIELDS];
    return fieldDef ? fieldDef.aliases : null;
  }
}
