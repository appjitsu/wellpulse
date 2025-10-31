/**
 * Create Tag Mappings Command and Handler
 *
 * Creates multiple tag mappings for a SCADA connection to map OPC-UA tags
 * to field entry properties.
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITagMappingRepository } from '../../../domain/repositories/tag-mapping.repository.interface';
import { IScadaConnectionRepository } from '../../../domain/repositories/scada-connection.repository.interface';
import {
  TagMapping,
  CreateTagMappingProps,
} from '../../../domain/scada/tag-mapping.entity';
import {
  TagConfiguration,
  OpcUaDataType,
} from '../../../domain/scada/value-objects/tag-configuration.vo';

/**
 * Tag Configuration Input
 */
export interface TagConfigInput {
  nodeId: string;
  tagName: string;
  fieldEntryProperty: string;
  dataType: OpcUaDataType;
  unit?: string;
  scalingFactor?: number;
  deadband?: number;
}

/**
 * Create Tag Mappings Command
 */
export class CreateTagMappingsCommand {
  constructor(
    public readonly tenantId: string,
    public readonly scadaConnectionId: string,
    public readonly tags: TagConfigInput[],
    public readonly userId: string,
  ) {}
}

/**
 * Tag Mapping DTO for response
 */
export interface TagMappingDto {
  id: string;
  tenantId: string;
  scadaConnectionId: string;
  nodeId: string;
  tagName: string;
  fieldEntryProperty: string;
  dataType: string;
  unit?: string;
  scalingFactor: number;
  deadband?: number;
  isEnabled: boolean;
  lastValue?: string | number | boolean;
  lastReadAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Tag Mappings Result
 */
export interface CreateTagMappingsResult {
  tagMappings: TagMappingDto[];
  count: number;
}

/**
 * Create Tag Mappings Command Handler
 *
 * Business Rules:
 * - SCADA connection must exist and belong to tenant
 * - Node ID must be unique within connection
 * - Field entry property must be unique within connection
 * - Tag name must be unique within connection
 * - All tag configurations must be valid
 * - Only Admin and Manager roles can create tag mappings (enforced at controller level)
 */
@Injectable()
@CommandHandler(CreateTagMappingsCommand)
export class CreateTagMappingsHandler
  implements ICommandHandler<CreateTagMappingsCommand, CreateTagMappingsResult>
{
  constructor(
    @Inject('ITagMappingRepository')
    private readonly tagMappingRepository: ITagMappingRepository,
    @Inject('IScadaConnectionRepository')
    private readonly scadaConnectionRepository: IScadaConnectionRepository,
  ) {}

  async execute(
    command: CreateTagMappingsCommand,
  ): Promise<CreateTagMappingsResult> {
    // 1. Validate SCADA connection exists
    const connection = await this.scadaConnectionRepository.findById(
      command.tenantId,
      command.scadaConnectionId,
    );

    if (!connection) {
      throw new NotFoundException(
        `SCADA connection with ID ${command.scadaConnectionId} not found`,
      );
    }

    // 2. Validate no duplicate node IDs or field properties in request
    const nodeIds = new Set<string>();
    const fieldProperties = new Set<string>();
    const tagNames = new Set<string>();

    for (const tagInput of command.tags) {
      if (nodeIds.has(tagInput.nodeId)) {
        throw new ConflictException(
          `Duplicate node ID in request: ${tagInput.nodeId}`,
        );
      }
      nodeIds.add(tagInput.nodeId);

      if (fieldProperties.has(tagInput.fieldEntryProperty)) {
        throw new ConflictException(
          `Duplicate field entry property in request: ${tagInput.fieldEntryProperty}`,
        );
      }
      fieldProperties.add(tagInput.fieldEntryProperty);

      if (tagNames.has(tagInput.tagName)) {
        throw new ConflictException(
          `Duplicate tag name in request: ${tagInput.tagName}`,
        );
      }
      tagNames.add(tagInput.tagName);
    }

    // 3. Check for existing tag mappings with same node IDs or field properties
    for (const tagInput of command.tags) {
      const existingByNodeId = await this.tagMappingRepository.existsByNodeId(
        command.tenantId,
        command.scadaConnectionId,
        tagInput.nodeId,
      );

      if (existingByNodeId) {
        throw new ConflictException(
          `Tag mapping with node ID "${tagInput.nodeId}" already exists for this connection`,
        );
      }

      const existingByProperty =
        await this.tagMappingRepository.existsByFieldProperty(
          command.tenantId,
          command.scadaConnectionId,
          tagInput.fieldEntryProperty,
        );

      if (existingByProperty) {
        throw new ConflictException(
          `Tag mapping with field entry property "${tagInput.fieldEntryProperty}" already exists for this connection`,
        );
      }
    }

    // 4. Create tag configurations and mappings
    const tagMappings: TagMapping[] = [];

    for (const tagInput of command.tags) {
      // Create tag configuration value object (validates configuration)
      let configuration: TagConfiguration;
      try {
        configuration = TagConfiguration.create({
          nodeId: tagInput.nodeId,
          tagName: tagInput.tagName,
          fieldEntryProperty: tagInput.fieldEntryProperty,
          dataType: tagInput.dataType,
          unit: tagInput.unit,
          scalingFactor: tagInput.scalingFactor,
          deadband: tagInput.deadband,
        });
      } catch (error) {
        throw new BadRequestException(
          `Invalid tag configuration for ${tagInput.tagName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Create tag mapping entity
      const props: CreateTagMappingProps = {
        scadaConnectionId: command.scadaConnectionId,
        tenantId: command.tenantId,
        configuration,
        createdBy: command.userId,
      };

      try {
        const tagMapping = TagMapping.create(props);
        tagMappings.push(tagMapping);
      } catch (error) {
        throw new BadRequestException(
          `Failed to create tag mapping for ${tagInput.tagName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // 5. Save all tag mappings
    await this.tagMappingRepository.saveMany(tagMappings);

    // 6. Return DTOs
    const dtos = tagMappings.map((mapping) => this.toDto(mapping));

    return {
      tagMappings: dtos,
      count: dtos.length,
    };
  }

  /**
   * Convert domain entity to DTO
   */
  private toDto(tagMapping: TagMapping): TagMappingDto {
    return {
      id: tagMapping.id,
      tenantId: tagMapping.tenantId,
      scadaConnectionId: tagMapping.scadaConnectionId,
      nodeId: tagMapping.configuration.nodeId,
      tagName: tagMapping.configuration.tagName,
      fieldEntryProperty: tagMapping.configuration.fieldEntryProperty,
      dataType: tagMapping.configuration.dataType,
      unit: tagMapping.configuration.unit,
      scalingFactor: tagMapping.configuration.scalingFactor,
      deadband: tagMapping.configuration.deadband,
      isEnabled: tagMapping.isEnabled,
      lastValue: tagMapping.lastValue,
      lastReadAt: tagMapping.lastReadAt?.toISOString(),
      createdAt: tagMapping.createdAt.toISOString(),
      updatedAt: tagMapping.updatedAt.toISOString(),
    };
  }
}
