/**
 * Commodity Pricing Background Job
 *
 * Synchronizes commodity prices from EIA API daily at 6 AM CT (after EIA publishes new data).
 * Stores prices in the master database for all tenants to access.
 *
 * Features:
 * - Daily scheduled sync at 6 AM Central Time
 * - Fetches WTI Crude Oil and Henry Hub Natural Gas spot prices
 * - Caches prices for 24 hours
 * - Graceful error handling with retry logic
 * - Tracks sync status and last update timestamp
 *
 * Pattern References:
 * - Background Job Pattern (docs/patterns/45-Background-Job-Patterns.md)
 * - Retry Pattern (docs/patterns/15-Retry-Pattern.md)
 *
 * @see docs/sprints/sprint-5-implementation-spec.md:1169-1179
 */

import { Process, Processor } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EiaApiService } from '../services/eia-api.service';
import { IPriceQuoteRepository } from '../../domain/repositories/price-quote.repository.interface';
import { PriceQuote } from '../../domain/commodity-pricing/price-quote.entity';
import { CommodityType } from '../../domain/commodity-pricing/value-objects/commodity-type.vo';

/**
 * Job processor for commodity pricing sync
 */
@Processor('commodity-pricing')
@Injectable()
export class CommodityPricingProcessor {
  private readonly logger = new Logger(CommodityPricingProcessor.name);

  constructor(
    @InjectQueue('commodity-pricing')
    private readonly pricingQueue: Queue,
    private readonly eiaApiService: EiaApiService,
    @Inject('IPriceQuoteRepository')
    private readonly priceQuoteRepository: IPriceQuoteRepository,
  ) {}

  /**
   * Scheduled job: Daily commodity price sync at 6 AM CT
   *
   * EIA publishes new data around 5 PM ET (4 PM CT) on business days.
   * We sync at 6 AM CT the next day to ensure data is available.
   */
  @Cron('0 6 * * *', {
    name: 'commodity-pricing-daily-sync',
    timeZone: 'America/Chicago',
  })
  async scheduleDailySync() {
    this.logger.log('Scheduling daily commodity pricing sync');

    await this.pricingQueue.add(
      'sync-prices',
      { syncDate: new Date() },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );
  }

  /**
   * Process job: Sync commodity prices from EIA API
   */
  @Process('sync-prices')
  async handleSyncPrices(job: Job<{ syncDate: Date }>): Promise<void> {
    this.logger.log(
      `[Job] Starting commodity pricing sync for ${String(job.data.syncDate.toISOString())}`,
    );

    try {
      // Sync WTI Crude Oil price
      const oilPriceQuote = await this.syncOilPrice();
      this.logger.log(
        `[Job] Synced WTI Crude Oil: ${oilPriceQuote.formatPrice()} (${oilPriceQuote.priceDate.toDateString()})`,
      );

      // Sync Henry Hub Natural Gas price
      const gasPriceQuote = await this.syncGasPrice();
      this.logger.log(
        `[Job] Synced Henry Hub Natural Gas: ${gasPriceQuote.formatPrice()} (${gasPriceQuote.priceDate.toDateString()})`,
      );

      this.logger.log('[Job] Commodity pricing sync complete');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[Job] Commodity pricing sync failed: ${errorMessage}`,
        errorStack,
      );
      throw error; // Fail job for retry
    }
  }

  /**
   * Sync WTI Crude Oil price from EIA API
   */
  private async syncOilPrice(): Promise<PriceQuote> {
    try {
      const commodityType = CommodityType.create('WTI_CRUDE');
      const priceQuote =
        await this.eiaApiService.fetchLatestPrice(commodityType);

      if (!priceQuote) {
        throw new Error('No WTI Crude Oil price data available from EIA API');
      }

      await this.priceQuoteRepository.save(priceQuote);

      return priceQuote;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to sync WTI oil price: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Sync Henry Hub Natural Gas price from EIA API
   */
  private async syncGasPrice(): Promise<PriceQuote> {
    try {
      const commodityType = CommodityType.create('HENRY_HUB_GAS');
      const priceQuote =
        await this.eiaApiService.fetchLatestPrice(commodityType);

      if (!priceQuote) {
        throw new Error(
          'No Henry Hub Natural Gas price data available from EIA API',
        );
      }

      await this.priceQuoteRepository.save(priceQuote);

      return priceQuote;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to sync Henry Hub gas price: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Manual sync trigger (for testing or immediate updates)
   */
  async triggerManualSync(): Promise<void> {
    this.logger.log('Triggering manual commodity pricing sync');

    await this.pricingQueue.add(
      'sync-prices',
      { syncDate: new Date() },
      {
        priority: 1, // High priority
        attempts: 1, // No retries for manual sync
      },
    );
  }
}
