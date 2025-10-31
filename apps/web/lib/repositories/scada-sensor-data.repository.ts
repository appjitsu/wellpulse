/**
 * SCADA Sensor Data Repository
 *
 * Data access layer for real-time SCADA sensor readings.
 * Aggregates data from all active SCADA connections.
 *
 * Pattern References:
 * - Repository Pattern (data access abstraction)
 * - Error Handling Pattern (user-friendly error messages)
 */

import { apiClient } from '../api/client';
import type { SensorReading } from '@/components/scada/scada-sensor-dashboard';

/**
 * SCADA Sensor Data Repository
 */
class ScadaSensorDataRepository {
  private readonly basePath = '/scada/sensor-data';

  /**
   * Fetch current sensor readings from all active SCADA connections
   */
  async getCurrentReadings(): Promise<SensorReading[]> {
    try {
      const response = await apiClient.get<SensorReading[]>(`${this.basePath}/current`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch SCADA sensor data:', error);
      throw new Error('Failed to load sensor data. Please try again.');
    }
  }
}

export const scadaSensorDataRepository = new ScadaSensorDataRepository();
