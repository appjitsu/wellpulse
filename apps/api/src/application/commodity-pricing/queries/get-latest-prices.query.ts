/**
 * Get Latest Prices Query
 *
 * Retrieves the most recent commodity prices from cache or database.
 * Used by dashboards to display current market prices.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { IPriceQuoteRepository } from '../../../domain/repositories/price-quote.repository.interface';
import { CommodityType } from '../../../domain/commodity-pricing/value-objects/commodity-type.vo';

/**
 * Get Latest Prices Query
 */
export class GetLatestPricesQuery {
  constructor(
    public readonly commodityTypes?: string[], // Optional: filter by specific commodities
  ) {}
}

/**
 * Price Quote Response DTO
 */
export interface PriceQuoteDto {
  commodityType: string;
  commodityName: string;
  price: number;
  unit: string;
  priceDate: Date;
  source: 'EIA_API' | 'MANUAL';
  isStale: boolean; // True if older than 24 hours
}

/**
 * Get Latest Prices Response
 */
export interface GetLatestPricesResult {
  prices: PriceQuoteDto[];
  lastUpdated: Date | null;
}

/**
 * Get Latest Prices Query Handler
 */
@QueryHandler(GetLatestPricesQuery)
export class GetLatestPricesHandler
  implements IQueryHandler<GetLatestPricesQuery>
{
  private readonly logger = new Logger(GetLatestPricesHandler.name);

  constructor(
    @Inject('IPriceQuoteRepository')
    private readonly priceQuoteRepo: IPriceQuoteRepository,
  ) {}

  async execute(query: GetLatestPricesQuery): Promise<GetLatestPricesResult> {
    this.logger.log('Fetching latest commodity prices');

    // Determine which commodities to fetch
    const commodityTypesToFetch = query.commodityTypes
      ? query.commodityTypes
      : [
          'WTI_CRUDE',
          'BRENT_CRUDE',
          'HENRY_HUB_GAS',
          'NY_HARBOR_HEATING_OIL',
          'GULF_COAST_GASOLINE',
        ];

    const prices: PriceQuoteDto[] = [];
    let mostRecentDate: Date | null = null;

    // Fetch latest price for each commodity
    for (const typeStr of commodityTypesToFetch) {
      try {
        const commodityType = CommodityType.fromString(typeStr);
        const priceQuote = await this.priceQuoteRepo.findLatest(commodityType);

        if (priceQuote) {
          prices.push({
            commodityType: priceQuote.commodityType.type,
            commodityName: priceQuote.commodityType.name,
            price: priceQuote.price,
            unit: priceQuote.commodityType.unit,
            priceDate: priceQuote.priceDate,
            source: priceQuote.source,
            isStale: priceQuote.isStale(24), // Stale if older than 24 hours
          });

          // Track most recent date
          if (!mostRecentDate || priceQuote.priceDate > mostRecentDate) {
            mostRecentDate = priceQuote.priceDate;
          }
        } else {
          this.logger.warn(`No price data found for ${typeStr}`);
        }
      } catch (error) {
        this.logger.error(`Failed to fetch price for ${typeStr}`, error);
      }
    }

    this.logger.log(`Fetched ${prices.length} latest prices`);

    return {
      prices,
      lastUpdated: mostRecentDate,
    };
  }
}
