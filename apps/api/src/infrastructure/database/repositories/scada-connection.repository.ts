import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { IScadaConnectionRepository } from '../../../domain/repositories/scada-connection.repository.interface';
import { ScadaConnection } from '../../../domain/scada/scada-connection.entity';
import { OpcUaEndpoint } from '../../../domain/scada/value-objects/opc-ua-endpoint.vo';
import { TenantDatabaseService } from '../tenant-database.service';
import * as tenantSchema from '../schema/tenant';

/**
 * SCADA Connection Repository Implementation
 *
 * Implements SCADA connection data access layer with:
 * - Tenant-isolated connection management
 * - OPC-UA endpoint configuration storage
 * - Connection status tracking
 * - Well-to-connection association
 *
 * Architecture:
 * - All connections stored in tenant database (tenant-isolated)
 * - JSON storage for OPC-UA endpoint configuration
 * - Optimized indexes for well and status queries
 */
@Injectable()
export class ScadaConnectionRepository implements IScadaConnectionRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  async findById(
    tenantId: string,
    connectionId: string,
  ): Promise<ScadaConnection | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.scadaConnections)
      .where(
        and(
          eq(tenantSchema.scadaConnections.id, connectionId),
          eq(tenantSchema.scadaConnections.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findByWellId(
    tenantId: string,
    wellId: string,
  ): Promise<ScadaConnection | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.scadaConnections)
      .where(
        and(
          eq(tenantSchema.scadaConnections.wellId, wellId),
          eq(tenantSchema.scadaConnections.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findAll(tenantId: string): Promise<ScadaConnection[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.scadaConnections)
      .where(eq(tenantSchema.scadaConnections.tenantId, tenantId));

    return rows.map((row) => this.toDomain(row));
  }

  async findActive(tenantId: string): Promise<ScadaConnection[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.scadaConnections)
      .where(
        and(
          eq(tenantSchema.scadaConnections.tenantId, tenantId),
          eq(tenantSchema.scadaConnections.status, 'active'),
        ),
      );

    return rows.map((row) => this.toDomain(row));
  }

  async findEnabled(tenantId: string): Promise<ScadaConnection[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.scadaConnections)
      .where(
        and(
          eq(tenantSchema.scadaConnections.tenantId, tenantId),
          eq(tenantSchema.scadaConnections.isEnabled, true),
        ),
      );

    return rows.map((row) => this.toDomain(row));
  }

  async existsByName(tenantId: string, name: string): Promise<boolean> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select({ id: tenantSchema.scadaConnections.id })
      .from(tenantSchema.scadaConnections)
      .where(
        and(
          eq(tenantSchema.scadaConnections.tenantId, tenantId),
          eq(tenantSchema.scadaConnections.name, name),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async existsByWellId(tenantId: string, wellId: string): Promise<boolean> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select({ id: tenantSchema.scadaConnections.id })
      .from(tenantSchema.scadaConnections)
      .where(
        and(
          eq(tenantSchema.scadaConnections.tenantId, tenantId),
          eq(tenantSchema.scadaConnections.wellId, wellId),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async save(connection: ScadaConnection): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(connection.tenantId);

    const row = this.toRow(connection);

    // Upsert: insert or update if exists
    await db
      .insert(tenantSchema.scadaConnections)
      .values(row)
      .onConflictDoUpdate({
        target: tenantSchema.scadaConnections.id,
        set: {
          name: row.name,
          description: row.description,
          endpointConfig: row.endpointConfig,
          pollIntervalSeconds: row.pollIntervalSeconds,
          status: row.status,
          lastConnectedAt: row.lastConnectedAt,
          lastErrorMessage: row.lastErrorMessage,
          isEnabled: row.isEnabled,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
        },
      });
  }

  async delete(tenantId: string, connectionId: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(tenantSchema.scadaConnections)
      .where(
        and(
          eq(tenantSchema.scadaConnections.id, connectionId),
          eq(tenantSchema.scadaConnections.tenantId, tenantId),
        ),
      );
  }

  // ============================================================================
  // Mappers (Domain ↔ Database)
  // ============================================================================

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: tenantSchema.ScadaConnection): ScadaConnection {
    const endpointConfig = row.endpointConfig as Record<string, unknown>;

    return ScadaConnection.fromPrimitives({
      id: row.id,
      tenantId: row.tenantId,
      wellId: row.wellId,
      name: row.name,
      description: row.description ?? undefined,
      endpoint: OpcUaEndpoint.fromPrimitives({
        url: endpointConfig.url as string,
        securityMode: endpointConfig.securityMode as
          | 'None'
          | 'Sign'
          | 'SignAndEncrypt',
        securityPolicy: endpointConfig.securityPolicy as
          | 'None'
          | 'Basic128Rsa15'
          | 'Basic256'
          | 'Basic256Sha256'
          | 'Aes128_Sha256_RsaOaep'
          | 'Aes256_Sha256_RsaPss',
        username: endpointConfig.username as string | undefined,
        password: endpointConfig.password as string | undefined,
      }),
      pollIntervalSeconds: row.pollIntervalSeconds,
      status: row.status as 'active' | 'inactive' | 'error' | 'connecting',
      lastConnectedAt: row.lastConnectedAt ?? undefined,
      lastErrorMessage: row.lastErrorMessage ?? undefined,
      isEnabled: row.isEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
    });
  }

  /**
   * Convert domain entity to database row
   */
  private toRow(connection: ScadaConnection): tenantSchema.NewScadaConnection {
    const primitives = connection.toPrimitives();
    const endpointPrimitives = primitives.endpoint.toPrimitives();

    return {
      id: primitives.id,
      tenantId: primitives.tenantId,
      wellId: primitives.wellId,
      name: primitives.name,
      description: primitives.description ?? null,
      endpointConfig: endpointPrimitives,
      pollIntervalSeconds: primitives.pollIntervalSeconds,
      status: primitives.status,
      lastConnectedAt: primitives.lastConnectedAt ?? null,
      lastErrorMessage: primitives.lastErrorMessage ?? null,
      isEnabled: primitives.isEnabled,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
      createdBy: primitives.createdBy,
      updatedBy: primitives.updatedBy,
    };
  }
}
