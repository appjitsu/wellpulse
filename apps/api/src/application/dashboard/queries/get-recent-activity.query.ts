/**
 * Get Recent Activity Query and Handler
 *
 * Retrieves recent well events (field entries, anomalies, maintenance).
 * Returns the 10 most recent activities.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IFieldEntryRepository } from '../../../domain/repositories/field-entry.repository.interface';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { RecentActivityDto, ActivityItemDto } from '../dto';
import { FieldEntry } from '../../../domain/field-data/field-entry.entity';

/**
 * Get Recent Activity Query
 */
export class GetRecentActivityQuery {
  constructor(public readonly tenantId: string) {}
}

/**
 * Get Recent Activity Query Handler
 */
@Injectable()
@QueryHandler(GetRecentActivityQuery)
export class GetRecentActivityHandler
  implements IQueryHandler<GetRecentActivityQuery>
{
  constructor(
    @Inject('IFieldEntryRepository')
    private readonly fieldEntryRepository: IFieldEntryRepository,
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(query: GetRecentActivityQuery): Promise<RecentActivityDto> {
    const { tenantId } = query;

    // Get most recent field entries (limit to 10)
    const recentEntries = await this.fieldEntryRepository.findAll(
      tenantId,
      {},
      10, // limit
      0, // offset
    );

    // Get well information for each entry
    const activities: ActivityItemDto[] = [];

    for (const entry of recentEntries) {
      const well = await this.wellRepository.findById(tenantId, entry.wellId);

      if (!well) {
        continue; // Skip if well not found
      }

      const activity = this.toActivityDto(entry, well.name);
      activities.push(activity);
    }

    return {
      activities,
    };
  }

  /**
   * Convert field entry to activity DTO
   */
  private toActivityDto(entry: FieldEntry, wellName: string): ActivityItemDto {
    // Determine event description based on entry type
    let event = '';
    let severity: 'success' | 'warning' | 'info' = 'info';

    switch (entry.entryType) {
      case 'PRODUCTION':
        event = 'Production entry recorded';
        severity = 'success';
        break;
      case 'INSPECTION':
        event = 'Inspection completed';
        severity = 'info';
        break;
      case 'MAINTENANCE':
        event = 'Maintenance performed';
        severity = 'warning';
        break;
    }

    // Calculate time ago
    const timeAgo = this.calculateTimeAgo(entry.recordedAt);

    return {
      id: entry.id,
      wellName,
      wellId: entry.wellId,
      event,
      eventType: entry.entryType,
      severity,
      timestamp: entry.recordedAt.toISOString(),
      timeAgo,
    };
  }

  /**
   * Calculate human-readable time ago string
   */
  private calculateTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
  }
}
