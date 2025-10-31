/**
 * CSV Parser Service
 *
 * Parses CSV files and converts them to JSON with validation.
 * Uses papaparse for robust CSV parsing with error handling.
 */

import { Injectable, Logger } from '@nestjs/common';
import Papa from 'papaparse';

export interface CsvRow {
  [key: string]: string | number | null;
}

export interface CsvParseResult {
  data: CsvRow[];
  errors: Array<{
    row: number;
    message: string;
    code: string;
  }>;
  meta: {
    fields: string[];
    rowCount: number;
    delimiter: string;
  };
}

export interface CsvParseOptions {
  delimiter?: string; // Auto-detect if not specified
  skipEmptyLines?: boolean;
  trimFields?: boolean;
}

@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name);

  /**
   * Parse CSV file content into structured data
   *
   * @param content CSV file content as string
   * @param options Parsing options
   * @returns Parsed rows, errors, and metadata
   */
  async parse(
    content: string,
    options: CsvParseOptions = {},
  ): Promise<CsvParseResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const parseErrors: Array<{ row: number; message: string; code: string }> =
        [];

      Papa.parse<CsvRow>(content, {
        header: true, // First row contains column names
        delimiter: options.delimiter ?? '', // Auto-detect
        skipEmptyLines: options.skipEmptyLines ?? true,
        transformHeader: (header: string) => {
          // Normalize headers: trim and convert to lowercase
          return header.trim();
        },
        transform: (value: string) => {
          // Trim field values
          if (options.trimFields !== false) {
            return value.trim();
          }
          return value;
        },
        complete: (results) => {
          const parseTime = Date.now() - startTime;
          this.logger.log(
            `CSV parsed: ${results.data.length} rows in ${parseTime}ms`,
          );

          // Collect papaparse errors
          if (results.errors && results.errors.length > 0) {
            results.errors.forEach((error) => {
              parseErrors.push({
                row: error.row ?? -1,
                message: error.message,
                code: error.code ?? 'UNKNOWN_ERROR',
              });
            });
          }

          resolve({
            data: results.data,
            errors: parseErrors,
            meta: {
              fields: results.meta.fields ?? [],
              rowCount: results.data.length,
              delimiter: results.meta.delimiter ?? ',',
            },
          });
        },
        error: (error: Error) => {
          this.logger.error(`CSV parsing failed: ${error.message}`);
          parseErrors.push({
            row: -1,
            message: error.message,
            code: 'PARSE_ERROR',
          });

          // Return empty result with error
          resolve({
            data: [],
            errors: parseErrors,
            meta: {
              fields: [],
              rowCount: 0,
              delimiter: ',',
            },
          });
        },
      });
    });
  }

  /**
   * Detect CSV delimiter from file content
   *
   * @param content CSV file content sample (first few lines)
   * @returns Detected delimiter
   */
  detectDelimiter(content: string): string {
    // Try common delimiters
    const delimiters = [',', ';', '\t', '|'];
    const sampleLines = content.split('\n').slice(0, 5);

    let maxScore = 0;
    let bestDelimiter = ',';

    for (const delimiter of delimiters) {
      let score = 0;

      for (const line of sampleLines) {
        const fields = line.split(delimiter);
        // Prefer delimiter that gives consistent field counts
        score += fields.length;
      }

      if (score > maxScore) {
        maxScore = score;
        bestDelimiter = delimiter;
      }
    }

    this.logger.debug(`Detected CSV delimiter: "${bestDelimiter}"`);
    return bestDelimiter;
  }

  /**
   * Validate CSV structure before full parsing
   *
   * @param content CSV file content
   * @returns Validation result with errors if any
   */
  validateStructure(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if file is empty
    if (!content || content.trim().length === 0) {
      errors.push('CSV file is empty');
      return { valid: false, errors };
    }

    // Parse first few lines to validate structure
    const lines = content.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      errors.push(
        'CSV file must contain at least a header row and one data row',
      );
      return { valid: false, errors };
    }

    // Check for consistent column counts
    const delimiter = this.detectDelimiter(content);
    const headerColumns = lines[0].split(delimiter).length;

    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const dataColumns = lines[i].split(delimiter).length;
      if (dataColumns !== headerColumns) {
        errors.push(
          `Row ${i + 1} has ${dataColumns} columns, expected ${headerColumns}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
