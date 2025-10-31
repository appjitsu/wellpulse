/**
 * Column Mapping Value Object
 *
 * Maps CSV column headers to standard field names.
 * Supports fuzzy matching and confidence scores.
 *
 * Pattern: Value Object
 * @see docs/patterns/07-Domain-Driven-Design-Pattern.md
 */

export interface FieldMapping {
  csvColumn: string;
  standardField: string;
  confidence: number; // 0-1
}

export interface ColumnMappingProps {
  mappings: FieldMapping[];
  detectedFormat?: string; // e.g., 'Prophet', 'Enveyo', 'Custom'
}

export class ColumnMapping {
  private constructor(private readonly props: ColumnMappingProps) {}

  static create(
    mappings: FieldMapping[],
    detectedFormat?: string,
  ): ColumnMapping {
    return new ColumnMapping({
      mappings,
      detectedFormat,
    });
  }

  static fromPersistence(props: ColumnMappingProps): ColumnMapping {
    return new ColumnMapping(props);
  }

  get mappings(): FieldMapping[] {
    return [...this.props.mappings];
  }

  get detectedFormat(): string | undefined {
    return this.props.detectedFormat;
  }

  /**
   * Get standard field name for a CSV column
   */
  getStandardField(csvColumn: string): string | undefined {
    const mapping = this.props.mappings.find((m) => m.csvColumn === csvColumn);
    return mapping?.standardField;
  }

  /**
   * Get CSV column name for a standard field
   */
  getCsvColumn(standardField: string): string | undefined {
    const mapping = this.props.mappings.find(
      (m) => m.standardField === standardField,
    );
    return mapping?.csvColumn;
  }

  /**
   * Get confidence score for a mapping
   */
  getConfidence(csvColumn: string): number | undefined {
    const mapping = this.props.mappings.find((m) => m.csvColumn === csvColumn);
    return mapping?.confidence;
  }

  /**
   * Check if all mappings have high confidence (>= 0.8)
   */
  isConfident(): boolean {
    return this.props.mappings.every((m) => m.confidence >= 0.8);
  }

  /**
   * Get low-confidence mappings (< 0.8) that need user review
   */
  getLowConfidenceMappings(): FieldMapping[] {
    return this.props.mappings.filter((m) => m.confidence < 0.8);
  }

  /**
   * Get list of standard fields that are mapped
   */
  getMappedFields(): string[] {
    return this.props.mappings.map((m) => m.standardField);
  }

  /**
   * Check if a required field is mapped
   */
  hasMappingFor(standardField: string): boolean {
    return this.props.mappings.some((m) => m.standardField === standardField);
  }

  /**
   * Get missing required fields
   */
  getMissingRequiredFields(requiredFields: string[]): string[] {
    const mapped = new Set(this.getMappedFields());
    return requiredFields.filter((field) => !mapped.has(field));
  }

  /**
   * Convert to JSON for persistence/transmission
   */
  toJSON(): ColumnMappingProps {
    return {
      mappings: this.props.mappings,
      detectedFormat: this.props.detectedFormat,
    };
  }

  /**
   * Create a copy with updated mapping
   */
  withMapping(
    csvColumn: string,
    standardField: string,
    confidence: number = 1.0,
  ): ColumnMapping {
    const existingIndex = this.props.mappings.findIndex(
      (m) => m.csvColumn === csvColumn,
    );

    const newMappings = [...this.props.mappings];

    if (existingIndex >= 0) {
      newMappings[existingIndex] = { csvColumn, standardField, confidence };
    } else {
      newMappings.push({ csvColumn, standardField, confidence });
    }

    return new ColumnMapping({
      ...this.props,
      mappings: newMappings,
    });
  }

  equals(other: ColumnMapping): boolean {
    if (this.props.mappings.length !== other.props.mappings.length) {
      return false;
    }

    return this.props.mappings.every((mapping) => {
      const otherMapping = other.props.mappings.find(
        (m) => m.csvColumn === mapping.csvColumn,
      );
      return (
        otherMapping &&
        otherMapping.standardField === mapping.standardField &&
        Math.abs(otherMapping.confidence - mapping.confidence) < 0.001
      );
    });
  }
}
