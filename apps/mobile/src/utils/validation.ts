/**
 * Form Validation Utilities
 * Validates field data before saving to ensure data integrity
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface FieldEntryData {
  wellName: string;
  productionVolume: string;
  gasVolume?: string;
  pressure?: string;
  temperature?: string;
  waterCut?: string;
  notes?: string;
}

/**
 * Validate field entry data before saving
 * Returns array of validation errors (empty if valid)
 */
export function validateFieldEntry(data: FieldEntryData): ValidationError[] {
  const errors: ValidationError[] = [];

  // Well Name - Required
  if (!data.wellName || data.wellName.trim() === '') {
    errors.push({
      field: 'wellName',
      message: 'Well name is required',
    });
  }

  // Production Volume - Required, must be positive number
  if (!data.productionVolume || data.productionVolume.trim() === '') {
    errors.push({
      field: 'productionVolume',
      message: 'Production volume is required',
    });
  } else {
    const volume = parseFloat(data.productionVolume);
    if (isNaN(volume)) {
      errors.push({
        field: 'productionVolume',
        message: 'Production volume must be a number',
      });
    } else if (volume < 0) {
      errors.push({
        field: 'productionVolume',
        message: 'Production volume cannot be negative',
      });
    } else if (volume > 10000) {
      errors.push({
        field: 'productionVolume',
        message: 'Production volume seems unusually high (max 10,000 bbl)',
      });
    }
  }

  // Gas Volume - Optional, but must be valid number if provided
  if (data.gasVolume && data.gasVolume.trim() !== '') {
    const gasVol = parseFloat(data.gasVolume);
    if (isNaN(gasVol)) {
      errors.push({
        field: 'gasVolume',
        message: 'Gas volume must be a number',
      });
    } else if (gasVol < 0) {
      errors.push({
        field: 'gasVolume',
        message: 'Gas volume cannot be negative',
      });
    } else if (gasVol > 50000) {
      errors.push({
        field: 'gasVolume',
        message: 'Gas volume seems unusually high (max 50,000 Mcf)',
      });
    }
  }

  // Pressure - Optional, must be valid number if provided
  if (data.pressure && data.pressure.trim() !== '') {
    const psi = parseFloat(data.pressure);
    if (isNaN(psi)) {
      errors.push({
        field: 'pressure',
        message: 'Pressure must be a number',
      });
    } else if (psi < 0) {
      errors.push({
        field: 'pressure',
        message: 'Pressure cannot be negative',
      });
    } else if (psi > 5000) {
      errors.push({
        field: 'pressure',
        message: 'Pressure seems unusually high (max 5,000 psi)',
      });
    }
  }

  // Temperature - Optional, must be valid number if provided
  if (data.temperature && data.temperature.trim() !== '') {
    const temp = parseFloat(data.temperature);
    if (isNaN(temp)) {
      errors.push({
        field: 'temperature',
        message: 'Temperature must be a number',
      });
    } else if (temp < -50) {
      errors.push({
        field: 'temperature',
        message: 'Temperature seems unusually low (min -50°F)',
      });
    } else if (temp > 500) {
      errors.push({
        field: 'temperature',
        message: 'Temperature seems unusually high (max 500°F)',
      });
    }
  }

  // Water Cut - Optional, must be valid percentage if provided
  if (data.waterCut && data.waterCut.trim() !== '') {
    const waterCutVal = parseFloat(data.waterCut);
    if (isNaN(waterCutVal)) {
      errors.push({
        field: 'waterCut',
        message: 'Water cut must be a number',
      });
    } else if (waterCutVal < 0) {
      errors.push({
        field: 'waterCut',
        message: 'Water cut cannot be negative',
      });
    } else if (waterCutVal > 100) {
      errors.push({
        field: 'waterCut',
        message: 'Water cut cannot exceed 100%',
      });
    }
  }

  // Notes - Optional, but limit length to prevent API payload issues
  if (data.notes && data.notes.length > 1000) {
    errors.push({
      field: 'notes',
      message: 'Notes cannot exceed 1,000 characters',
    });
  }

  return errors;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';

  if (errors.length === 1) {
    return errors[0].message;
  }

  return 'Please fix the following:\n' + errors.map((e) => `• ${e.message}`).join('\n');
}
