/**
 * Get Latest Prices Query Handler Tests
 *
 * Tests query handler for fetching latest commodity prices.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  GetLatestPricesQuery,
  GetLatestPricesHandler,
} from './get-latest-prices.query';
import { IPriceQuoteRepository } from '../../../domain/repositories/price-quote.repository.interface';
import { CommodityType } from '../../../domain/commodity-pricing/value-objects/commodity-type.vo';
import { PriceQuote } from '../../../domain/commodity-pricing/price-quote.entity';

describe('GetLatestPricesHandler', () => {
  let handler: GetLatestPricesHandler;
  let mockRepository: jest.Mocked<IPriceQuoteRepository>;

  beforeEach(async () => {
    mockRepository = {
      findLatest: jest.fn(),
      findByDate: jest.fn(),
      findByDateRange: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      deleteOlderThan: jest.fn(),
      existsForDate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetLatestPricesHandler,
        {
          provide: 'IPriceQuoteRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<GetLatestPricesHandler>(GetLatestPricesHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return latest prices for all commodities by default', async () => {
      const mockQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('BRENT_CRUDE'),
          price: 80.25,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('HENRY_HUB_GAS'),
          price: 3.25,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('NY_HARBOR_HEATING_OIL'),
          price: 2.45,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('GULF_COAST_GASOLINE'),
          price: 2.15,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      mockRepository.findLatest.mockImplementation(
        (commodityType: CommodityType) => {
          return Promise.resolve(
            mockQuotes.find((q) => q.commodityType.equals(commodityType)) ||
              null,
          );
        },
      );

      const query = new GetLatestPricesQuery();
      const result = await handler.execute(query);

      expect(result.prices).toHaveLength(5); // All 5 commodities
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.findLatest).toHaveBeenCalledTimes(5);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should return latest prices for specific commodities', async () => {
      const wtiQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('WTI_CRUDE'),
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      const gasQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('HENRY_HUB_GAS'),
        price: 3.25,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      mockRepository.findLatest.mockImplementation(
        (commodityType: CommodityType) => {
          if (commodityType.type === 'WTI_CRUDE')
            return Promise.resolve(wtiQuote);
          if (commodityType.type === 'HENRY_HUB_GAS')
            return Promise.resolve(gasQuote);
          return Promise.resolve(null);
        },
      );

      const query = new GetLatestPricesQuery(['WTI_CRUDE', 'HENRY_HUB_GAS']);
      const result = await handler.execute(query);

      expect(result.prices).toHaveLength(2);
      expect(result.prices[0].commodityType).toBe('WTI_CRUDE');
      expect(result.prices[0].price).toBe(75.5);
      expect(result.prices[1].commodityType).toBe('HENRY_HUB_GAS');
      expect(result.prices[1].price).toBe(3.25);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.findLatest).toHaveBeenCalledTimes(2);
    });

    it('should include staleness indicator for each price', async () => {
      const now = new Date();
      const freshDate = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
      const staleDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

      const freshQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('WTI_CRUDE'),
        price: 75.5,
        priceDate: freshDate,
        source: 'EIA_API',
      });

      const staleQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('BRENT_CRUDE'),
        price: 80.25,
        priceDate: staleDate,
        source: 'EIA_API',
      });

      mockRepository.findLatest.mockImplementation(
        (commodityType: CommodityType) => {
          if (commodityType.type === 'WTI_CRUDE')
            return Promise.resolve(freshQuote);
          if (commodityType.type === 'BRENT_CRUDE')
            return Promise.resolve(staleQuote);
          return Promise.resolve(null);
        },
      );

      const query = new GetLatestPricesQuery(['WTI_CRUDE', 'BRENT_CRUDE']);
      const result = await handler.execute(query);

      expect(result.prices[0].isStale).toBe(false); // Fresh (6 hours old)
      expect(result.prices[1].isStale).toBe(true); // Stale (48 hours old)
    });

    it('should skip commodities with no data', async () => {
      const wtiQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('WTI_CRUDE'),
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      mockRepository.findLatest.mockImplementation(
        (commodityType: CommodityType) => {
          if (commodityType.type === 'WTI_CRUDE')
            return Promise.resolve(wtiQuote);
          return Promise.resolve(null); // No data for other commodities
        },
      );

      const query = new GetLatestPricesQuery(['WTI_CRUDE', 'BRENT_CRUDE']);
      const result = await handler.execute(query);

      expect(result.prices).toHaveLength(1); // Only WTI has data
      expect(result.prices[0].commodityType).toBe('WTI_CRUDE');
    });

    it('should return empty array when no prices available', async () => {
      mockRepository.findLatest.mockResolvedValue(null);

      const query = new GetLatestPricesQuery(['WTI_CRUDE']);
      const result = await handler.execute(query);

      expect(result.prices).toEqual([]);
      expect(result.lastUpdated).toBeNull();
    });

    it('should include commodity metadata in response', async () => {
      const wtiQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('WTI_CRUDE'),
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      mockRepository.findLatest.mockResolvedValue(wtiQuote);

      const query = new GetLatestPricesQuery(['WTI_CRUDE']);
      const result = await handler.execute(query);

      expect(result.prices[0].commodityName).toBe('WTI Crude Oil');
      expect(result.prices[0].unit).toBe('USD/Barrel');
      expect(result.prices[0].source).toBe('EIA_API');
    });

    it('should calculate most recent update time', async () => {
      const olderDate = new Date('2024-01-14T10:00:00Z');
      const newerDate = new Date('2024-01-15T15:30:00Z');

      const oldQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('WTI_CRUDE'),
        price: 75.5,
        priceDate: olderDate,
        source: 'EIA_API',
      });

      const newQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('BRENT_CRUDE'),
        price: 80.25,
        priceDate: newerDate,
        source: 'EIA_API',
      });

      mockRepository.findLatest.mockImplementation(
        (commodityType: CommodityType) => {
          if (commodityType.type === 'WTI_CRUDE')
            return Promise.resolve(oldQuote);
          if (commodityType.type === 'BRENT_CRUDE')
            return Promise.resolve(newQuote);
          return Promise.resolve(null);
        },
      );

      const query = new GetLatestPricesQuery(['WTI_CRUDE', 'BRENT_CRUDE']);
      const result = await handler.execute(query);

      expect(result.lastUpdated).toEqual(newerDate); // Most recent date
    });

    it('should handle manual source prices', async () => {
      const manualQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('WTI_CRUDE'),
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'MANUAL',
      });

      mockRepository.findLatest.mockResolvedValue(manualQuote);

      const query = new GetLatestPricesQuery(['WTI_CRUDE']);
      const result = await handler.execute(query);

      expect(result.prices[0].source).toBe('MANUAL');
    });
  });
});
