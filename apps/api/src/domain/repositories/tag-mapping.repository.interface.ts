/**
 * Tag Mapping Repository Interface
 *
 * Defines the contract for tag mapping persistence operations.
 * This interface lives in the domain layer and is implemented by the infrastructure layer.
 */

import { TagMapping } from '../scada/tag-mapping.entity';

export interface ITagMappingRepository {
  /**
   * Find tag mapping by ID
   */
  findById(tenantId: string, tagMappingId: string): Promise<TagMapping | null>;

  /**
   * Find all tag mappings for a SCADA connection
   */
  findByConnectionId(
    tenantId: string,
    connectionId: string,
  ): Promise<TagMapping[]>;

  /**
   * Find all enabled tag mappings for a SCADA connection
   */
  findEnabledByConnectionId(
    tenantId: string,
    connectionId: string,
  ): Promise<TagMapping[]>;

  /**
   * Find tag mapping by node ID within a connection
   */
  findByNodeId(
    tenantId: string,
    connectionId: string,
    nodeId: string,
  ): Promise<TagMapping | null>;

  /**
   * Find tag mapping by field entry property within a connection
   */
  findByFieldProperty(
    tenantId: string,
    connectionId: string,
    fieldProperty: string,
  ): Promise<TagMapping | null>;

  /**
   * Check if node ID exists within a connection
   */
  existsByNodeId(
    tenantId: string,
    connectionId: string,
    nodeId: string,
  ): Promise<boolean>;

  /**
   * Check if field entry property exists within a connection
   */
  existsByFieldProperty(
    tenantId: string,
    connectionId: string,
    fieldProperty: string,
  ): Promise<boolean>;

  /**
   * Save (create or update) tag mapping
   */
  save(tagMapping: TagMapping): Promise<void>;

  /**
   * Save multiple tag mappings
   */
  saveMany(tagMappings: TagMapping[]): Promise<void>;

  /**
   * Delete tag mapping
   */
  delete(tenantId: string, tagMappingId: string): Promise<void>;

  /**
   * Delete all tag mappings for a connection
   */
  deleteByConnectionId(tenantId: string, connectionId: string): Promise<void>;
}
