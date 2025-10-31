/**
 * Price Quote Repository Interface
 *
 * Defines the contract for price quote persistence operations.
 * Part of the domain layer, implemented in infrastructure.
 */

import { PriceQuote } from '../commodity-pricing/price-quote.entity';
import { CommodityType } from '../commodity-pricing/value-objects/commodity-type.vo';

/**
 * Price Quote Repository Interface
 */
export interface IPriceQuoteRepository {
  /**
   * Find latest price for a commodity type
   */
  findLatest(commodityType: CommodityType): Promise<PriceQuote | null>;

  /**
   * Find price for specific date
   */
  findByDate(
    commodityType: CommodityType,
    date: Date,
  ): Promise<PriceQuote | null>;

  /**
   * Find historical prices within date range
   */
  findByDateRange(
    commodityType: CommodityType,
    startDate: Date,
    endDate: Date,
  ): Promise<PriceQuote[]>;

  /**
   * Find all prices for a commodity type
   */
  findAll(commodityType: CommodityType): Promise<PriceQuote[]>;

  /**
   * Save price quote (insert or update)
   */
  save(priceQuote: PriceQuote): Promise<PriceQuote>;

  /**
   * Save multiple price quotes in bulk
   */
  saveMany(priceQuotes: PriceQuote[]): Promise<PriceQuote[]>;

  /**
   * Delete old price quotes (cleanup)
   */
  deleteOlderThan(date: Date): Promise<number>;

  /**
   * Check if price exists for date
   */
  existsForDate(commodityType: CommodityType, date: Date): Promise<boolean>;
}
