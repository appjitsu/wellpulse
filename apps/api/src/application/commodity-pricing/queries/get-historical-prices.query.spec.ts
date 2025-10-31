/**
 * Get Historical Prices Query Handler Tests
 *
 * Tests query handler for fetching historical commodity prices with statistics.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  GetHistoricalPricesQuery,
  GetHistoricalPricesHandler,
} from './get-historical-prices.query';
import { IPriceQuoteRepository } from '../../../domain/repositories/price-quote.repository.interface';
import { CommodityType } from '../../../domain/commodity-pricing/value-objects/commodity-type.vo';
import { PriceQuote } from '../../../domain/commodity-pricing/price-quote.entity';

describe('GetHistoricalPricesHandler', () => {
  let handler: GetHistoricalPricesHandler;
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
        GetHistoricalPricesHandler,
        {
          provide: 'IPriceQuoteRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<GetHistoricalPricesHandler>(
      GetHistoricalPricesHandler,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return historical prices with statistics', async () => {
      const mockQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 74.25,
          priceDate: new Date('2024-01-14'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 76.0,
          priceDate: new Date('2024-01-13'),
          source: 'EIA_API',
        }),
      ];

      mockRepository.findByDateRange.mockResolvedValue(mockQuotes);

      const query = new GetHistoricalPricesQuery(
        'WTI_CRUDE',
        new Date('2024-01-13'),
        new Date('2024-01-15'),
      );

      const result = await handler.execute(query);

      expect(result.commodityType).toBe('WTI_CRUDE');
      expect(result.commodityName).toBe('WTI Crude Oil');
      expect(result.unit).toBe('USD/Barrel');
      expect(result.prices).toHaveLength(3);
      expect(result.startDate).toEqual(new Date('2024-01-13'));
      expect(result.endDate).toEqual(new Date('2024-01-15'));
    });

    it('should calculate correct average price', async () => {
      const mockQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 70.0,
          priceDate: new Date('2024-01-13'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 80.0,
          priceDate: new Date('2024-01-14'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.0,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      mockRepository.findByDateRange.mockResolvedValue(mockQuotes);

      const query = new GetHistoricalPricesQuery(
        'WTI_CRUDE',
        new Date('2024-01-13'),
        new Date('2024-01-15'),
      );

      const result = await handler.execute(query);

      expect(result.averagePrice).toBe(75.0); // (70 + 80 + 75) / 3 = 75
    });

    it('should calculate correct min and max prices', async () => {
      const mockQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 72.5,
          priceDate: new Date('2024-01-13'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 68.0, // Minimum
          priceDate: new Date('2024-01-14'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 79.25, // Maximum
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      mockRepository.findByDateRange.mockResolvedValue(mockQuotes);

      const query = new GetHistoricalPricesQuery(
        'WTI_CRUDE',
        new Date('2024-01-13'),
        new Date('2024-01-15'),
      );

      const result = await handler.execute(query);

      expect(result.minPrice).toBe(68.0);
      expect(result.maxPrice).toBe(79.25);
    });

    it('should return empty result for date range with no data', async () => {
      mockRepository.findByDateRange.mockResolvedValue([]);

      const query = new GetHistoricalPricesQuery(
        'WTI_CRUDE',
        new Date('2020-01-01'),
        new Date('2020-01-07'),
      );

      const result = await handler.execute(query);

      expect(result.prices).toEqual([]);
      expect(result.averagePrice).toBe(0);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
    });

    it('should handle single price in range', async () => {
      const singleQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('HENRY_HUB_GAS'),
        price: 3.25,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      mockRepository.findByDateRange.mockResolvedValue([singleQuote]);

      const query = new GetHistoricalPricesQuery(
        'HENRY_HUB_GAS',
        new Date('2024-01-15'),
        new Date('2024-01-15'),
      );

      const result = await handler.execute(query);

      expect(result.prices).toHaveLength(1);
      expect(result.averagePrice).toBe(3.25);
      expect(result.minPrice).toBe(3.25);
      expect(result.maxPrice).toBe(3.25);
    });

    it('should include price dates and source in response', async () => {
      const quote = PriceQuote.create({
        commodityType: CommodityType.fromString('WTI_CRUDE'),
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      mockRepository.findByDateRange.mockResolvedValue([quote]);

      const query = new GetHistoricalPricesQuery(
        'WTI_CRUDE',
        new Date('2024-01-15'),
        new Date('2024-01-15'),
      );

      const result = await handler.execute(query);

      expect(result.prices[0].date).toEqual(new Date('2024-01-15'));
      expect(result.prices[0].price).toBe(75.5);
      expect(result.prices[0].source).toBe('EIA_API');
    });

    it('should handle natural gas commodity', async () => {
      const gasQuote = PriceQuote.create({
        commodityType: CommodityType.fromString('HENRY_HUB_GAS'),
        price: 3.25,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      mockRepository.findByDateRange.mockResolvedValue([gasQuote]);

      const query = new GetHistoricalPricesQuery(
        'HENRY_HUB_GAS',
        new Date('2024-01-15'),
        new Date('2024-01-15'),
      );

      const result = await handler.execute(query);

      expect(result.commodityType).toBe('HENRY_HUB_GAS');
      expect(result.commodityName).toBe('Henry Hub Natural Gas');
      expect(result.unit).toBe('USD/MMBtu');
    });

    it('should order prices by date', async () => {
      const quotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 74.25,
          priceDate: new Date('2024-01-14'),
          source: 'EIA_API',
        }),
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 73.0,
          priceDate: new Date('2024-01-13'),
          source: 'EIA_API',
        }),
      ];

      mockRepository.findByDateRange.mockResolvedValue(quotes);

      const query = new GetHistoricalPricesQuery(
        'WTI_CRUDE',
        new Date('2024-01-13'),
        new Date('2024-01-15'),
      );

      const result = await handler.execute(query);

      expect(result.prices).toHaveLength(3);
      // Repository should return in chronological order
      expect(result.prices[0].date).toEqual(new Date('2024-01-15'));
      expect(result.prices[1].date).toEqual(new Date('2024-01-14'));
      expect(result.prices[2].date).toEqual(new Date('2024-01-13'));
    });
  });
});
