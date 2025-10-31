/**
 * Commodity Pricing Module
 *
 * Unified module following Pattern #89: NestJS CQRS Module Organization Pattern.
 * Provides commodity pricing capabilities via CQRS pattern with EIA API integration.
 *
 * Pattern: Single module with controllers and handlers sharing the same QueryBus/CommandBus instance.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CommodityPricingController } from './commodity-pricing.controller';

// Commands
import { SyncPricesFromEiaHandler } from '../../application/commodity-pricing/commands/sync-prices-from-eia.command';

// Queries
import { GetLatestPricesHandler } from '../../application/commodity-pricing/queries/get-latest-prices.query';
import { GetHistoricalPricesHandler } from '../../application/commodity-pricing/queries/get-historical-prices.query';

// Infrastructure
import { PriceQuoteRepository } from '../../infrastructure/database/repositories/price-quote.repository';
import { EiaApiService } from '../../infrastructure/services/eia-api.service';

/**
 * Command Handlers
 */
const CommandHandlers = [SyncPricesFromEiaHandler];

/**
 * Query Handlers
 */
const QueryHandlers = [GetLatestPricesHandler, GetHistoricalPricesHandler];

/**
 * Repositories
 */
const Repositories = [
  {
    provide: 'IPriceQuoteRepository',
    useClass: PriceQuoteRepository,
  },
];

/**
 * Commodity Pricing Module (Unified)
 *
 * Single CqrsModule import ensures controllers and handlers share the same QueryBus/CommandBus.
 * Prevents "No handler found" errors by keeping everything in one module scope.
 */
@Module({
  imports: [
    CqrsModule, // ← Single CqrsModule import
    DatabaseModule,
  ],
  controllers: [
    CommodityPricingController, // ← Controllers in same module
  ],
  providers: [
    // Command Handlers
    ...CommandHandlers, // ← Handlers in same module

    // Query Handlers
    ...QueryHandlers, // ← All share the same QueryBus instance

    // Infrastructure Services
    EiaApiService,

    // Repositories
    ...Repositories,
  ],
  exports: [EiaApiService, 'IPriceQuoteRepository'],
})
export class CommodityPricingModule {}
