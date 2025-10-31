/**
 * EIA API Client Service
 *
 * Integrates with U.S. Energy Information Administration API v2
 * to fetch real-time commodity prices (oil, natural gas, refined products).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PriceQuote, CommodityType } from '../../domain/commodity-pricing';

/**
 * EIA API Response Structure
 */
interface EiaApiResponse {
  response: {
    total: number;
    dateFormat: string;
    frequency: string;
    data: Array<{
      period: string; // Date in YYYY-MM-DD format
      value: string; // Price as string
      [key: string]: string; // Additional facets
    }>;
  };
}

/**
 * EIA API Client
 */
@Injectable()
export class EiaApiService {
  private readonly logger = new Logger(EiaApiService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.eia.gov/v2';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('EIA_API_KEY', '');

    if (!this.apiKey) {
      this.logger.warn(
        'EIA_API_KEY not configured - commodity pricing will be unavailable',
      );
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WellPulse/1.0',
      },
    });
  }

  /**
   * Fetch latest price for a commodity
   */
  async fetchLatestPrice(
    commodityType: CommodityType,
  ): Promise<PriceQuote | null> {
    try {
      const response = await this.fetchPrices(commodityType, 1);
      return response[0] || null;
    } catch (error) {
      this.logger.error(
        `Failed to fetch latest price for ${commodityType.type}`,
        error,
      );
      return null;
    }
  }

  /**
   * Fetch historical prices for date range
   */
  async fetchPriceRange(
    commodityType: CommodityType,
    startDate: Date,
    endDate: Date,
  ): Promise<PriceQuote[]> {
    try {
      const url = this.buildApiUrl(commodityType, startDate, endDate);
      const response = await this.axiosInstance.get<EiaApiResponse>(url);

      return this.parseEiaResponse(response.data, commodityType);
    } catch (error) {
      this.logger.error(
        `Failed to fetch price range for ${commodityType.type}`,
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`EIA API request failed: ${errorMessage}`);
    }
  }

  /**
   * Fetch recent prices (last N days)
   */
  async fetchPrices(
    commodityType: CommodityType,
    limitDays = 30,
  ): Promise<PriceQuote[]> {
    try {
      const url = this.buildApiUrl(commodityType, null, null, limitDays);
      const response = await this.axiosInstance.get<EiaApiResponse>(url);

      return this.parseEiaResponse(response.data, commodityType);
    } catch (error) {
      this.logger.error(
        `Failed to fetch prices for ${commodityType.type}`,
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`EIA API request failed: ${errorMessage}`);
    }
  }

  /**
   * Build EIA API URL with parameters
   */
  private buildApiUrl(
    commodityType: CommodityType,
    startDate: Date | null,
    endDate: Date | null,
    limit?: number,
  ): string {
    const endpoint = commodityType.eiaEndpoint;
    const params = new URLSearchParams({
      api_key: this.apiKey,
      frequency: 'daily',
      'data[0]': 'value',
      [`facets[${commodityType.eiaFacetKey}][]`]: commodityType.eiaFacetValue,
      'sort[0][column]': 'period',
      'sort[0][direction]': 'desc',
    });

    // Add date range if provided
    if (startDate) {
      params.append('start', this.formatDate(startDate));
    }
    if (endDate) {
      params.append('end', this.formatDate(endDate));
    }

    // Add limit if provided
    if (limit) {
      params.append('length', limit.toString());
    }

    return `${endpoint}?${params.toString()}`;
  }

  /**
   * Parse EIA API response into domain entities
   */
  private parseEiaResponse(
    response: EiaApiResponse,
    commodityType: CommodityType,
  ): PriceQuote[] {
    if (!response.response?.data) {
      this.logger.warn('EIA API returned no data');
      return [];
    }

    const priceQuotes: PriceQuote[] = [];

    for (const dataPoint of response.response.data) {
      try {
        const price = parseFloat(dataPoint.value);
        const priceDate = this.parseDate(dataPoint.period);

        // Skip invalid data points
        if (isNaN(price) || price <= 0) {
          this.logger.warn(`Invalid price value: ${dataPoint.value}`);
          continue;
        }

        const priceQuote = PriceQuote.create({
          commodityType,
          price,
          priceDate,
          source: 'EIA_API',
        });

        priceQuotes.push(priceQuote);
      } catch (error) {
        this.logger.warn(
          `Failed to parse EIA data point: ${JSON.stringify(dataPoint)}`,
          error,
        );
      }
    }

    this.logger.log(
      `Fetched ${priceQuotes.length} price quotes for ${commodityType.type}`,
    );

    return priceQuotes;
  }

  /**
   * Format date for EIA API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse date from EIA API format
   */
  private parseDate(dateString: string): Date {
    // EIA returns dates in YYYY-MM-DD format
    return new Date(dateString);
  }

  /**
   * Check if EIA API is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Test EIA API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const wtiType = CommodityType.create('WTI_CRUDE');
      const url = this.buildApiUrl(wtiType, null, null, 1);
      await this.axiosInstance.get(url);
      return true;
    } catch (error) {
      this.logger.error('EIA API connection test failed', error);
      return false;
    }
  }
}
