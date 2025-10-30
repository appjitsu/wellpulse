/**
 * useFieldEntry Hook - Manage field entry form state and submissions
 * Shared across all platforms
 */

import { useState, useCallback, useEffect } from 'react';
import { FieldEntryRepository } from '../repositories/FieldEntryRepository';
import type { FieldEntry, CreateFieldEntryDTO } from '../types';

export interface UseFieldEntryOptions {
  /** Database name (default: 'wellpulse.db') */
  dbName?: string;
  /** Callback after successful save */
  onSaveSuccess?: (entry: FieldEntry) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseFieldEntryReturn {
  // Form state
  wellName: string;
  setWellName: (value: string) => void;
  operatorName: string;
  setOperatorName: (value: string) => void;
  entryDate: string;
  setEntryDate: (value: string) => void;
  productionVolume: string;
  setProductionVolume: (value: string) => void;
  pressure: string;
  setPressure: (value: string) => void;
  temperature: string;
  setTemperature: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;

  // Submission state
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;

  // Data state
  entries: FieldEntry[];
  unsyncedCount: number;
  isLoading: boolean;

  // Actions
  handleSubmit: () => Promise<void>;
  resetForm: () => void;
  loadEntries: () => Promise<void>;
  clearMessages: () => void;
}

/**
 * Custom hook for field entry form management
 */
export function useFieldEntry(options: UseFieldEntryOptions = {}): UseFieldEntryReturn {
  const { dbName = 'wellpulse.db', onSaveSuccess, onError } = options;

  // Initialize repository
  const [repository] = useState(() => new FieldEntryRepository(dbName));

  // Form state
  const [wellName, setWellName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [entryDate, setEntryDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  });
  const [productionVolume, setProductionVolume] = useState('');
  const [pressure, setPressure] = useState('');
  const [temperature, setTemperature] = useState('');
  const [notes, setNotes] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data state
  const [entries, setEntries] = useState<FieldEntry[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize database and load entries
  useEffect(() => {
    const init = async () => {
      try {
        await repository.initialize();
        await loadEntries();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(`Failed to initialize database: ${error.message}`);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load recent entries and unsynced count
   */
  const loadEntries = useCallback(async () => {
    try {
      const [recentEntries, count] = await Promise.all([
        repository.findRecent(10),
        repository.countUnsynced(),
      ]);

      setEntries(recentEntries);
      setUnsyncedCount(count);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(`Failed to load entries: ${error.message}`);
      onError?.(error);
    }
  }, [repository, onError]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setWellName('');
    setOperatorName('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setProductionVolume('');
    setPressure('');
    setTemperature('');
    setNotes('');
  }, []);

  /**
   * Clear success/error messages
   */
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    // Clear previous messages
    clearMessages();

    // Validation
    if (!wellName.trim()) {
      setError('Well name is required');
      return;
    }
    if (!operatorName.trim()) {
      setError('Operator name is required');
      return;
    }
    if (!productionVolume.trim()) {
      setError('Production volume is required');
      return;
    }

    const productionVolumeNum = parseFloat(productionVolume);
    if (isNaN(productionVolumeNum) || productionVolumeNum < 0) {
      setError('Production volume must be a valid positive number');
      return;
    }

    // Optional field validation
    const pressureNum = pressure.trim() ? parseFloat(pressure) : undefined;
    if (pressureNum !== undefined && (isNaN(pressureNum) || pressureNum < 0)) {
      setError('Pressure must be a valid positive number');
      return;
    }

    const temperatureNum = temperature.trim() ? parseFloat(temperature) : undefined;
    if (temperatureNum !== undefined && (isNaN(temperatureNum) || temperatureNum < -459.67)) {
      // Absolute zero in Fahrenheit
      setError('Temperature must be a valid number');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create DTO
      const dto: CreateFieldEntryDTO = {
        wellName: wellName.trim(),
        operatorName: operatorName.trim(),
        entryDate,
        productionVolume: productionVolumeNum,
        pressure: pressureNum,
        temperature: temperatureNum,
        notes: notes.trim() || undefined,
      };

      // Save entry
      const savedEntry = await repository.save(dto);

      // Success!
      setSuccessMessage('✅ Entry saved successfully (offline)');
      onSaveSuccess?.(savedEntry);

      // Reset form
      resetForm();

      // Reload entries
      await loadEntries();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(`❌ Failed to save entry: ${error.message}`);
      onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    wellName,
    operatorName,
    entryDate,
    productionVolume,
    pressure,
    temperature,
    notes,
    repository,
    onSaveSuccess,
    onError,
    resetForm,
    loadEntries,
    clearMessages,
  ]);

  return {
    // Form state
    wellName,
    setWellName,
    operatorName,
    setOperatorName,
    entryDate,
    setEntryDate,
    productionVolume,
    setProductionVolume,
    pressure,
    setPressure,
    temperature,
    setTemperature,
    notes,
    setNotes,

    // Submission state
    isSubmitting,
    error,
    successMessage,

    // Data state
    entries,
    unsyncedCount,
    isLoading,

    // Actions
    handleSubmit,
    resetForm,
    loadEntries,
    clearMessages,
  };
}
