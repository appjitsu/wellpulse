import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { ITagMappingRepository } from '../../../domain/repositories/tag-mapping.repository.interface';
import { TagMapping } from '../../../domain/scada/tag-mapping.entity';
import { TagConfiguration } from '../../../domain/scada/value-objects/tag-configuration.vo';
import { TenantDatabaseService } from '../tenant-database.service';
import * as tenantSchema from '../schema/tenant';

/**
 * Tag Mapping Repository Implementation
 *
 * Implements tag mapping data access layer with:
 * - Tenant-isolated tag mapping management
 * - OPC-UA tag configuration storage
 * - Connection-scoped tag queries
 * - Bulk tag operations
 *
 * Architecture:
 * - All tag mappings stored in tenant database (tenant-isolated)
 * - JSON storage for tag configuration
 * - Optimized indexes for connection and property queries
 * - Cascade delete when connection is deleted
 */
@Injectable()
export class TagMappingRepository implements ITagMappingRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  async findById(
    tenantId: string,
    tagMappingId: string,
  ): Promise<TagMapping | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.tagMappings)
      .where(
        and(
          eq(tenantSchema.tagMappings.id, tagMappingId),
          eq(tenantSchema.tagMappings.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findByConnectionId(
    tenantId: string,
    connectionId: string,
  ): Promise<TagMapping[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.tagMappings)
      .where(
        and(
          eq(tenantSchema.tagMappings.tenantId, tenantId),
          eq(tenantSchema.tagMappings.scadaConnectionId, connectionId),
        ),
      );

    return rows.map((row) => this.toDomain(row));
  }

  async findEnabledByConnectionId(
    tenantId: string,
    connectionId: string,
  ): Promise<TagMapping[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.tagMappings)
      .where(
        and(
          eq(tenantSchema.tagMappings.tenantId, tenantId),
          eq(tenantSchema.tagMappings.scadaConnectionId, connectionId),
          eq(tenantSchema.tagMappings.isEnabled, true),
        ),
      );

    return rows.map((row) => this.toDomain(row));
  }

  async findByNodeId(
    tenantId: string,
    connectionId: string,
    nodeId: string,
  ): Promise<TagMapping | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Query JSON configuration.nodeId field
    const rows = await db
      .select()
      .from(tenantSchema.tagMappings)
      .where(
        and(
          eq(tenantSchema.tagMappings.tenantId, tenantId),
          eq(tenantSchema.tagMappings.scadaConnectionId, connectionId),
        ),
      );

    // Filter in-memory for nodeId in JSON configuration
    const matchingRows = rows.filter((row) => {
      const config = row.configuration as Record<string, unknown>;
      return config.nodeId === nodeId;
    });

    if (matchingRows.length === 0) return null;

    return this.toDomain(matchingRows[0]);
  }

  async findByFieldProperty(
    tenantId: string,
    connectionId: string,
    fieldProperty: string,
  ): Promise<TagMapping | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Query all tags for connection
    const rows = await db
      .select()
      .from(tenantSchema.tagMappings)
      .where(
        and(
          eq(tenantSchema.tagMappings.tenantId, tenantId),
          eq(tenantSchema.tagMappings.scadaConnectionId, connectionId),
        ),
      );

    // Filter in-memory for fieldEntryProperty in JSON configuration
    const matchingRows = rows.filter((row) => {
      const config = row.configuration as Record<string, unknown>;
      return config.fieldEntryProperty === fieldProperty;
    });

    if (matchingRows.length === 0) return null;

    return this.toDomain(matchingRows[0]);
  }

  async existsByNodeId(
    tenantId: string,
    connectionId: string,
    nodeId: string,
  ): Promise<boolean> {
    const tag = await this.findByNodeId(tenantId, connectionId, nodeId);
    return tag !== null;
  }

  async existsByFieldProperty(
    tenantId: string,
    connectionId: string,
    fieldProperty: string,
  ): Promise<boolean> {
    const tag = await this.findByFieldProperty(
      tenantId,
      connectionId,
      fieldProperty,
    );
    return tag !== null;
  }

  async save(tagMapping: TagMapping): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tagMapping.tenantId);

    const row = this.toRow(tagMapping);

    // Upsert: insert or update if exists
    await db
      .insert(tenantSchema.tagMappings)
      .values(row)
      .onConflictDoUpdate({
        target: tenantSchema.tagMappings.id,
        set: {
          configuration: row.configuration,
          isEnabled: row.isEnabled,
          lastValue: row.lastValue,
          lastReadAt: row.lastReadAt,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
        },
      });
  }

  async saveMany(tagMappings: TagMapping[]): Promise<void> {
    if (tagMappings.length === 0) return;

    const tenantId = tagMappings[0].tenantId;
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = tagMappings.map((tag) => this.toRow(tag));

    // Bulk insert with conflict handling
    for (const row of rows) {
      await db
        .insert(tenantSchema.tagMappings)
        .values(row)
        .onConflictDoUpdate({
          target: tenantSchema.tagMappings.id,
          set: {
            configuration: row.configuration,
            isEnabled: row.isEnabled,
            lastValue: row.lastValue,
            lastReadAt: row.lastReadAt,
            updatedAt: row.updatedAt,
            updatedBy: row.updatedBy,
          },
        });
    }
  }

  async delete(tenantId: string, tagMappingId: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(tenantSchema.tagMappings)
      .where(
        and(
          eq(tenantSchema.tagMappings.id, tagMappingId),
          eq(tenantSchema.tagMappings.tenantId, tenantId),
        ),
      );
  }

  async deleteByConnectionId(
    tenantId: string,
    connectionId: string,
  ): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(tenantSchema.tagMappings)
      .where(
        and(
          eq(tenantSchema.tagMappings.tenantId, tenantId),
          eq(tenantSchema.tagMappings.scadaConnectionId, connectionId),
        ),
      );
  }

  // ============================================================================
  // Mappers (Domain ↔ Database)
  // ============================================================================

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: tenantSchema.TagMapping): TagMapping {
    const configData = row.configuration as Record<string, unknown>;

    return TagMapping.fromPrimitives({
      id: row.id,
      scadaConnectionId: row.scadaConnectionId,
      tenantId: row.tenantId,
      configuration: TagConfiguration.fromPrimitives({
        nodeId: configData.nodeId as string,
        tagName: configData.tagName as string,
        fieldEntryProperty: configData.fieldEntryProperty as string,
        dataType: configData.dataType as
          | 'Boolean'
          | 'SByte'
          | 'Byte'
          | 'Int16'
          | 'UInt16'
          | 'Int32'
          | 'UInt32'
          | 'Int64'
          | 'UInt64'
          | 'Float'
          | 'Double'
          | 'String'
          | 'DateTime',
        unit: configData.unit as string | undefined,
        scalingFactor: configData.scalingFactor as number | undefined,
        deadband: configData.deadband as number | undefined,
      }),
      isEnabled: row.isEnabled,
      lastValue:
        row.lastValue !== null ? this.parseLastValue(row.lastValue) : undefined,
      lastReadAt: row.lastReadAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
    });
  }

  /**
   * Convert domain entity to database row
   */
  private toRow(tagMapping: TagMapping): tenantSchema.NewTagMapping {
    const primitives = tagMapping.toPrimitives();
    const configPrimitives = primitives.configuration.toPrimitives();

    return {
      id: primitives.id,
      tenantId: primitives.tenantId,
      scadaConnectionId: primitives.scadaConnectionId,
      configuration: configPrimitives,
      isEnabled: primitives.isEnabled,
      lastValue:
        primitives.lastValue !== undefined
          ? String(primitives.lastValue)
          : null,
      lastReadAt: primitives.lastReadAt ?? null,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
      createdBy: primitives.createdBy,
      updatedBy: primitives.updatedBy,
    };
  }

  /**
   * Parse last value from string storage
   */
  private parseLastValue(value: string): number | string | boolean {
    // Try parsing as number
    const num = Number(value);
    if (!isNaN(num)) return num;

    // Try parsing as boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Return as string
    return value;
  }
}
