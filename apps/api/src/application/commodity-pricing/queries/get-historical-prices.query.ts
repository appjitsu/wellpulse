/**
 * Get Historical Prices Query
 *
 * Retrieves commodity price history for a date range.
 * Used for price charts and trend analysis.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { IPriceQuoteRepository } from '../../../domain/repositories/price-quote.repository.interface';
import { CommodityType } from '../../../domain/commodity-pricing/value-objects/commodity-type.vo';

/**
 * Get Historical Prices Query
 */
export class GetHistoricalPricesQuery {
  constructor(
    public readonly commodityType: string, // e.g., 'WTI_CRUDE'
    public readonly startDate: Date,
    public readonly endDate: Date,
  ) {}
}

/**
 * Historical Price Point DTO
 */
export interface HistoricalPriceDto {
  date: Date;
  price: number;
  source: 'EIA_API' | 'MANUAL';
}

/**
 * Get Historical Prices Response
 */
export interface GetHistoricalPricesResult {
  commodityType: string;
  commodityName: string;
  unit: string;
  prices: HistoricalPriceDto[];
  startDate: Date;
  endDate: Date;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
}

/**
 * Get Historical Prices Query Handler
 */
@QueryHandler(GetHistoricalPricesQuery)
export class GetHistoricalPricesHandler
  implements IQueryHandler<GetHistoricalPricesQuery>
{
  private readonly logger = new Logger(GetHistoricalPricesHandler.name);

  constructor(
    @Inject('IPriceQuoteRepository')
    private readonly priceQuoteRepo: IPriceQuoteRepository,
  ) {}

  async execute(
    query: GetHistoricalPricesQuery,
  ): Promise<GetHistoricalPricesResult> {
    this.logger.log(
      `Fetching historical prices for ${query.commodityType} from ${String(query.startDate)} to ${String(query.endDate)}`,
    );

    // Validate commodity type
    const commodityType = CommodityType.fromString(query.commodityType);

    // Fetch prices from repository
    const priceQuotes = await this.priceQuoteRepo.findByDateRange(
      commodityType,
      query.startDate,
      query.endDate,
    );

    if (priceQuotes.length === 0) {
      this.logger.warn(
        `No price data found for ${query.commodityType} in specified date range`,
      );
    }

    // Map to DTOs
    const prices: HistoricalPriceDto[] = priceQuotes.map((quote) => ({
      date: quote.priceDate,
      price: quote.price,
      source: quote.source,
    }));

    // Calculate statistics
    const priceValues = prices.map((p) => p.price);
    const averagePrice =
      priceValues.length > 0
        ? priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length
        : 0;
    const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
    const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0;

    this.logger.log(
      `Fetched ${prices.length} historical prices for ${commodityType.name}`,
    );

    return {
      commodityType: commodityType.type,
      commodityName: commodityType.name,
      unit: commodityType.unit,
      prices,
      startDate: query.startDate,
      endDate: query.endDate,
      averagePrice,
      minPrice,
      maxPrice,
    };
  }
}
