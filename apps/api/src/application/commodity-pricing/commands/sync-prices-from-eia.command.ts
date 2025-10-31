/**
 * Sync Prices from EIA Command
 *
 * Fetches latest commodity prices from EIA API and stores them in database.
 * Designed to run as a scheduled job (hourly/daily) via cron.
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { IPriceQuoteRepository } from '../../../domain/repositories/price-quote.repository.interface';
import { EiaApiService } from '../../../infrastructure/services/eia-api.service';
import { CommodityType } from '../../../domain/commodity-pricing/value-objects/commodity-type.vo';

/**
 * Sync Prices from EIA Command
 */
export class SyncPricesFromEiaCommand {
  constructor(
    public readonly commodityTypes?: string[], // Optional: sync specific commodities
    public readonly daysToFetch = 7, // How many days of historical data to fetch
  ) {}
}

/**
 * Sync Result
 */
export interface SyncPricesResult {
  success: boolean;
  pricesSynced: number;
  commoditiesSynced: string[];
  errors: string[];
}

/**
 * Sync Prices from EIA Command Handler
 */
@CommandHandler(SyncPricesFromEiaCommand)
export class SyncPricesFromEiaHandler
  implements ICommandHandler<SyncPricesFromEiaCommand>
{
  private readonly logger = new Logger(SyncPricesFromEiaHandler.name);

  constructor(
    @Inject('IPriceQuoteRepository')
    private readonly priceQuoteRepo: IPriceQuoteRepository,
    private readonly eiaApiService: EiaApiService,
  ) {}

  async execute(command: SyncPricesFromEiaCommand): Promise<SyncPricesResult> {
    this.logger.log('Starting EIA price sync');

    // Check if EIA API is configured
    if (!this.eiaApiService.isConfigured()) {
      this.logger.warn('EIA API key not configured - skipping sync');
      return {
        success: false,
        pricesSynced: 0,
        commoditiesSynced: [],
        errors: ['EIA_API_KEY not configured'],
      };
    }

    // Determine which commodities to sync
    const commodityTypesToSync = command.commodityTypes
      ? command.commodityTypes
      : [
          'WTI_CRUDE',
          'BRENT_CRUDE',
          'HENRY_HUB_GAS',
          'NY_HARBOR_HEATING_OIL',
          'GULF_COAST_GASOLINE',
        ];

    let totalPricesSynced = 0;
    const commoditiesSynced: string[] = [];
    const errors: string[] = [];

    // Sync each commodity
    for (const typeStr of commodityTypesToSync) {
      try {
        const commodityType = CommodityType.fromString(typeStr);

        this.logger.log(
          `Syncing ${commodityType.name} (last ${command.daysToFetch} days)`,
        );

        // Fetch prices from EIA API
        const priceQuotes = await this.eiaApiService.fetchPrices(
          commodityType,
          command.daysToFetch,
        );

        if (priceQuotes.length === 0) {
          this.logger.warn(`No price data returned for ${typeStr}`);
          errors.push(`No data returned for ${typeStr}`);
          continue;
        }

        // Save prices to database (bulk insert/upsert)
        await this.priceQuoteRepo.saveMany(priceQuotes);

        totalPricesSynced += priceQuotes.length;
        commoditiesSynced.push(typeStr);

        this.logger.log(
          `Synced ${priceQuotes.length} prices for ${commodityType.name}`,
        );
      } catch (error) {
        this.logger.error(`Failed to sync ${typeStr}`, error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${typeStr}: ${errorMessage}`);
      }
    }

    const success = commoditiesSynced.length > 0;

    this.logger.log(
      `EIA sync complete: ${totalPricesSynced} prices synced across ${commoditiesSynced.length} commodities`,
    );

    return {
      success,
      pricesSynced: totalPricesSynced,
      commoditiesSynced,
      errors,
    };
  }
}
