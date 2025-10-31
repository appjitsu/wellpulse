/**
 * SCADA Connection Repository Interface
 *
 * Defines the contract for SCADA connection persistence operations.
 * This interface lives in the domain layer and is implemented by the infrastructure layer.
 */

import { ScadaConnection } from '../scada/scada-connection.entity';

export interface IScadaConnectionRepository {
  /**
   * Find SCADA connection by ID
   */
  findById(
    tenantId: string,
    connectionId: string,
  ): Promise<ScadaConnection | null>;

  /**
   * Find SCADA connection by well ID
   */
  findByWellId(
    tenantId: string,
    wellId: string,
  ): Promise<ScadaConnection | null>;

  /**
   * Find all SCADA connections for tenant
   */
  findAll(tenantId: string): Promise<ScadaConnection[]>;

  /**
   * Find all active SCADA connections for tenant
   */
  findActive(tenantId: string): Promise<ScadaConnection[]>;

  /**
   * Find all enabled SCADA connections for tenant
   */
  findEnabled(tenantId: string): Promise<ScadaConnection[]>;

  /**
   * Check if connection name exists within tenant
   */
  existsByName(tenantId: string, name: string): Promise<boolean>;

  /**
   * Check if well already has a SCADA connection
   */
  existsByWellId(tenantId: string, wellId: string): Promise<boolean>;

  /**
   * Save (create or update) SCADA connection
   */
  save(connection: ScadaConnection): Promise<void>;

  /**
   * Delete SCADA connection
   */
  delete(tenantId: string, connectionId: string): Promise<void>;
}
