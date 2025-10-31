/**
 * Jobs Module
 *
 * Registers all background job processors (Bull queues + cron schedules).
 * Provides necessary dependencies for job execution.
 *
 * Background Jobs:
 * - Commodity Pricing Daily Sync (6 AM CT daily)
 *
 * Note: SCADA connection management is now handled by the Rust ingestion service
 * which provides its own automatic reconnection and health monitoring.
 *
 * Dependencies:
 * - BullModule (must be configured in AppModule)
 * - ScheduleModule (must be configured in AppModule)
 * - Redis connection (for queue persistence)
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CommodityPricingProcessor } from './commodity-pricing.processor';
import { CommodityPricingModule } from '../../presentation/commodity-pricing/commodity-pricing.module';

@Module({
  imports: [
    // Import queue modules (already registered in AppModule, just importing here for injection)
    BullModule.registerQueue({ name: 'commodity-pricing' }),

    // Import commodity pricing module for repository and services
    CommodityPricingModule,
  ],
  providers: [
    // Job processors
    CommodityPricingProcessor,
  ],
  exports: [CommodityPricingProcessor],
})
export class JobsModule {}
