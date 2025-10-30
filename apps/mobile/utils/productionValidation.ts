/**
 * Production Value Validation Thresholds
 * Based on industry standards for oil & gas field operations
 */

export type ValidationLevel = 'normal' | 'warning' | 'critical';

export interface ValidationResult {
  level: ValidationLevel;
  message?: string;
}

/**
 * BS&W (Basic Sediment & Water) Validation
 * - Normal: ≤1% (required for oil sales)
 * - Warning: 1-8% (treatable but requires attention)
 * - Critical: >8% (exceeds tank bottom acceptable level)
 */
export function validateBSW(value: string | undefined): ValidationResult {
  if (!value || value === '') return { level: 'normal' };

  const num = parseFloat(value);
  if (isNaN(num)) return { level: 'normal' };

  if (num <= 1) {
    return { level: 'normal' };
  } else if (num <= 8) {
    return {
      level: 'warning',
      message: 'BS&W 1-8%: Treatable but needs attention',
    };
  } else {
    return {
      level: 'critical',
      message: 'BS&W >8%: Exceeds acceptable level - immediate action required',
    };
  }
}

/**
 * Water Cut Validation
 * - Normal: 0-30% (early/mid-life production)
 * - Warning: 30-70% (declining economics)
 * - Critical: >70% (high water cut - remediation needed)
 */
export function validateWaterCut(value: string | undefined): ValidationResult {
  if (!value || value === '') return { level: 'normal' };

  const num = parseFloat(value);
  if (isNaN(num)) return { level: 'normal' };

  if (num < 30) {
    return { level: 'normal' };
  } else if (num <= 70) {
    return {
      level: 'warning',
      message: 'Water cut 30-70%: Monitor well economics',
    };
  } else if (num <= 95) {
    return {
      level: 'critical',
      message: 'Water cut >70%: High water production - consider remediation',
    };
  } else {
    return {
      level: 'critical',
      message: 'Water cut >95%: Well approaching shut-in threshold',
    };
  }
}

/**
 * Temperature Validation (Wellhead Temperature)
 * - Normal: 80-200°F typical wellhead range
 * - Warning: <80°F or >200°F (may indicate flow/equipment issues)
 */
export function validateTemperature(value: string | undefined): ValidationResult {
  if (!value || value === '') return { level: 'normal' };

  const num = parseFloat(value);
  if (isNaN(num)) return { level: 'normal' };

  if (num < 80) {
    return {
      level: 'warning',
      message: 'Temperature <80°F: Lower than typical - check flow',
    };
  } else if (num > 200) {
    return {
      level: 'warning',
      message: 'Temperature >200°F: Higher than typical - verify equipment',
    };
  } else {
    return { level: 'normal' };
  }
}

/**
 * Casing Pressure Validation
 * - Normal: Should be zero (cemented or fluid-filled annulus)
 * - Critical: Any sustained pressure (tubing leak, packer failure, cement issues)
 */
export function validateCasingPressure(value: string | undefined): ValidationResult {
  if (!value || value === '') return { level: 'normal' };

  const num = parseFloat(value);
  if (isNaN(num)) return { level: 'normal' };

  if (num > 0) {
    return {
      level: 'critical',
      message: 'Sustained casing pressure detected - report to supervisor immediately',
    };
  } else {
    return { level: 'normal' };
  }
}

/**
 * Production Decline Validation (Month-over-Month)
 * Compares current value against previous reading
 * - Normal: Within ±10% of previous reading
 * - Warning: 10-20% decline
 * - Critical: >20% decline
 */
export function validateProductionDecline(
  currentValue: string | undefined,
  previousValue: string | undefined,
): ValidationResult {
  if (!currentValue || !previousValue || currentValue === '' || previousValue === '') {
    return { level: 'normal' };
  }

  const current = parseFloat(currentValue);
  const previous = parseFloat(previousValue);

  if (isNaN(current) || isNaN(previous) || previous === 0) {
    return { level: 'normal' };
  }

  const declinePercent = ((previous - current) / previous) * 100;

  if (declinePercent < 10) {
    return { level: 'normal' };
  } else if (declinePercent <= 20) {
    return {
      level: 'warning',
      message: `Production declined ${declinePercent.toFixed(1)}% - monitor trend`,
    };
  } else {
    return {
      level: 'critical',
      message: `Production declined ${declinePercent.toFixed(1)}% - investigate immediately`,
    };
  }
}

/**
 * GOR (Gas-to-Oil Ratio) Validation
 * - Normal: <6,000 cf/bbl (oil well classification)
 * - Warning: 6,000-10,000 cf/bbl
 * - Critical: >10,000 cf/bbl (well may be classified as gas well)
 */
export function validateGOR(value: string | undefined): ValidationResult {
  if (!value || value === '') return { level: 'normal' };

  const num = parseFloat(value);
  if (isNaN(num)) return { level: 'normal' };

  if (num < 6000) {
    return { level: 'normal' };
  } else if (num <= 10000) {
    return {
      level: 'warning',
      message: 'GOR approaching gas well classification threshold (6,000 cf/bbl)',
    };
  } else {
    return {
      level: 'critical',
      message: 'GOR >10,000: Well may be reclassified as gas well',
    };
  }
}

/**
 * Pressure Differential Validation (Flowing Wells)
 * Increasing differential between tubing and casing pressure indicates liquid loading
 */
export function validatePressureDifferential(
  tubingPressure: string | undefined,
  casingPressure: string | undefined,
  previousDifferential?: number,
): ValidationResult {
  if (!tubingPressure || !casingPressure || tubingPressure === '' || casingPressure === '') {
    return { level: 'normal' };
  }

  const tubing = parseFloat(tubingPressure);
  const casing = parseFloat(casingPressure);

  if (isNaN(tubing) || isNaN(casing)) return { level: 'normal' };

  const differential = Math.abs(tubing - casing);

  if (previousDifferential && differential > previousDifferential * 1.2) {
    return {
      level: 'warning',
      message: 'Increasing pressure differential - possible liquid loading',
    };
  }

  return { level: 'normal' };
}

/**
 * Nominal Range structure (matching backend DTO)
 */
export interface NominalRange {
  fieldName: string;
  min: number;
  max: number;
  unit: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message?: string | null;
}

/**
 * Validate a field value against nominal ranges
 * @param fieldName - Field name to validate (e.g., 'oilRate', 'gasRate')
 * @param value - Current value as number
 * @param ranges - Array of nominal ranges
 * @returns Validation result with level and message
 */
export function validateWithNominalRanges(
  fieldName: string,
  value: number,
  ranges: NominalRange[],
): ValidationResult {
  if (isNaN(value)) {
    return { level: 'normal' };
  }

  // Find matching nominal range for this field
  const range = ranges.find((r) => r.fieldName === fieldName);
  if (!range) {
    return { level: 'normal' }; // No range defined for this field
  }

  // Check if value is within range
  if (value >= range.min && value <= range.max) {
    return { level: 'normal' };
  }

  // Map severity to validation level
  const levelMap: Record<string, ValidationLevel> = {
    LOW: 'warning',
    MEDIUM: 'warning',
    HIGH: 'critical',
    CRITICAL: 'critical',
  };

  const level = levelMap[range.severity] || 'warning';

  // Generate message
  const message =
    range.message ||
    `${fieldName} out of range: ${value} ${range.unit} (expected: ${range.min}-${range.max} ${range.unit})`;

  return { level, message };
}

/**
 * Get all validation warnings for a set of production values
 */
export interface ProductionValues {
  bsw?: string;
  waterCut?: string;
  temperature?: string;
  casingPressure?: string;
  productionVolume?: string;
  previousProductionVolume?: string;
  gor?: string;
  tubingPressure?: string;
}

export interface ValidationWarnings {
  bsw?: ValidationResult;
  waterCut?: ValidationResult;
  temperature?: ValidationResult;
  casingPressure?: ValidationResult;
  productionDecline?: ValidationResult;
  gor?: ValidationResult;
  pressureDifferential?: ValidationResult;
}

export function validateProductionValues(values: ProductionValues): ValidationWarnings {
  const warnings: ValidationWarnings = {};

  const bswResult = validateBSW(values.bsw);
  if (bswResult.level !== 'normal') warnings.bsw = bswResult;

  const waterCutResult = validateWaterCut(values.waterCut);
  if (waterCutResult.level !== 'normal') warnings.waterCut = waterCutResult;

  const temperatureResult = validateTemperature(values.temperature);
  if (temperatureResult.level !== 'normal') warnings.temperature = temperatureResult;

  const casingPressureResult = validateCasingPressure(values.casingPressure);
  if (casingPressureResult.level !== 'normal') warnings.casingPressure = casingPressureResult;

  if (values.productionVolume && values.previousProductionVolume) {
    const declineResult = validateProductionDecline(
      values.productionVolume,
      values.previousProductionVolume,
    );
    if (declineResult.level !== 'normal') warnings.productionDecline = declineResult;
  }

  const gorResult = validateGOR(values.gor);
  if (gorResult.level !== 'normal') warnings.gor = gorResult;

  if (values.tubingPressure && values.casingPressure) {
    const diffResult = validatePressureDifferential(values.tubingPressure, values.casingPressure);
    if (diffResult.level !== 'normal') warnings.pressureDifferential = diffResult;
  }

  return warnings;
}
