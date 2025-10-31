/**
 * Commodity Prices Repository
 *
 * Data access layer for commodity pricing data from EIA API.
 * Fetches WTI Crude Oil and Henry Hub Natural Gas spot prices.
 *
 * Pattern References:
 * - Repository Pattern (data access abstraction)
 * - Error Handling Pattern (user-friendly error messages)
 */

import { apiClient } from '../api/client';

/**
 * Price data point
 */
interface PricePoint {
  date: string;
  price: number;
}

/**
 * Commodity price with historical data
 */
export interface CommodityPrice {
  commodity: 'WTI_CRUDE_OIL' | 'HENRY_HUB_NATURAL_GAS';
  currentPrice: number;
  previousPrice: number;
  unit: string;
  change: number;
  changePercent: number;
  historical: PricePoint[];
  lastUpdated: string;
}

/**
 * Commodity Prices Repository
 */
class CommodityPricesRepository {
  private readonly basePath = '/commodity-pricing';

  /**
   * Fetch current commodity prices with 30-day historical data
   */
  async getCurrentPrices(): Promise<CommodityPrice[]> {
    try {
      const response = await apiClient.get<CommodityPrice[]>(`${this.basePath}/current`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch commodity prices:', error);
      throw new Error('Failed to load commodity prices. Please try again.');
    }
  }
}

export const commodityPricesRepository = new CommodityPricesRepository();
