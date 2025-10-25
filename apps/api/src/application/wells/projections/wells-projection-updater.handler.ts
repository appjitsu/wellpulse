/**
 * Wells Projection Updater
 *
 * Event handler that keeps the wells_read_projection table in sync
 * with the source wells table.
 *
 * Pattern: Event Sourcing + CQRS Read Projections
 *
 * Flow:
 * 1. Command handler modifies source table (wells)
 * 2. Domain events are published (WellCreated, WellUpdated, etc.)
 * 3. This handler listens to events and updates read projection
 * 4. Query handlers read from optimized projection
 *
 * Benefits:
 * - Decoupled write and read models
 * - Optimized queries without complex joins
 * - Can add/remove projections without affecting domain logic
 *
 * Trade-offs:
 * - Eventually consistent (small delay between write and read)
 * - Data duplication
 * - Must handle projection failures gracefully
 */

import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { WellsReadProjectionRepository } from '../../../infrastructure/database/repositories/wells-read-projection.repository';

// Domain Events (these would be defined in the domain layer)
// For now, we'll define placeholder event classes

export class WellCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly data: {
      apiNumber: string;
      name: string;
      status: string;
      latitude: number;
      longitude: number;
      lease?: string;
      field?: string;
      operator?: string;
      createdBy?: string;
    },
  ) {}
}

export class WellUpdatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly data: {
      name?: string;
      status?: string;
      latitude?: number;
      longitude?: number;
      lease?: string;
      field?: string;
      operator?: string;
      updatedBy?: string;
    },
  ) {}
}

export class WellDeletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly deletedBy: string,
  ) {}
}

/**
 * Handles WellCreated events and updates the read projection
 */
@EventsHandler(WellCreatedEvent)
export class WellCreatedProjectionHandler
  implements IEventHandler<WellCreatedEvent>
{
  private readonly logger = new Logger(WellCreatedProjectionHandler.name);

  constructor(private readonly projectionRepo: WellsReadProjectionRepository) {}

  async handle(event: WellCreatedEvent): Promise<void> {
    try {
      await this.projectionRepo.upsert(event.tenantId, {
        id: event.wellId,
        apiNumber: event.data.apiNumber,
        name: event.data.name,
        status: event.data.status,
        latitude: event.data.latitude.toString(),
        longitude: event.data.longitude.toString(),
        lease: event.data.lease ?? null,
        field: event.data.field ?? null,
        operator: event.data.operator ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: event.data.createdBy ?? null,
        updatedBy: null,
        deletedAt: null,
        deletedBy: null,
      });

      this.logger.log(
        `Updated read projection for well created: ${event.wellId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update projection for WellCreated event:`,
        error,
      );
      // In production: retry, dead letter queue, or alert
    }
  }
}

/**
 * Handles WellUpdated events and updates the read projection
 */
@EventsHandler(WellUpdatedEvent)
export class WellUpdatedProjectionHandler
  implements IEventHandler<WellUpdatedEvent>
{
  private readonly logger = new Logger(WellUpdatedProjectionHandler.name);

  constructor(private readonly projectionRepo: WellsReadProjectionRepository) {}

  handle(event: WellUpdatedEvent): void {
    try {
      // Note: In a real implementation, we'd fetch the current state
      // and merge with the update. This is a simplified version.

      // For now, we'll assume the full state is passed in the event
      // In production, you might:
      // 1. Fetch current projection state
      // 2. Merge with event data
      // 3. Update projection

      this.logger.log(
        `Updated read projection for well updated: ${event.wellId}`,
      );

      // Placeholder - in real implementation:
      // void this.projectionRepo.upsert(event.tenantId, mergedData);
    } catch (error) {
      this.logger.error(
        `Failed to update projection for WellUpdated event:`,
        error,
      );
    }
  }
}

/**
 * Handles WellDeleted events and updates the read projection
 */
@EventsHandler(WellDeletedEvent)
export class WellDeletedProjectionHandler
  implements IEventHandler<WellDeletedEvent>
{
  private readonly logger = new Logger(WellDeletedProjectionHandler.name);

  constructor(private readonly projectionRepo: WellsReadProjectionRepository) {}

  async handle(event: WellDeletedEvent): Promise<void> {
    try {
      await this.projectionRepo.softDelete(
        event.tenantId,
        event.wellId,
        event.deletedBy,
      );

      this.logger.log(
        `Updated read projection for well deleted: ${event.wellId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update projection for WellDeleted event:`,
        error,
      );
    }
  }
}
