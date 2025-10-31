/**
 * Sync Prices From EIA Command Handler Tests
 *
 * Tests command handler for syncing commodity prices from EIA API.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  SyncPricesFromEiaCommand,
  SyncPricesFromEiaHandler,
} from './sync-prices-from-eia.command';
import { IPriceQuoteRepository } from '../../../domain/repositories/price-quote.repository.interface';
import { EiaApiService } from '../../../infrastructure/services/eia-api.service';
import { CommodityType } from '../../../domain/commodity-pricing/value-objects/commodity-type.vo';
import { PriceQuote } from '../../../domain/commodity-pricing/price-quote.entity';

describe('SyncPricesFromEiaHandler', () => {
  let handler: SyncPricesFromEiaHandler;
  let mockRepository: jest.Mocked<IPriceQuoteRepository>;
  let mockEiaService: jest.Mocked<EiaApiService>;

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

    mockEiaService = {
      isConfigured: jest.fn().mockReturnValue(true),
      fetchLatestPrice: jest.fn(),
      fetchPrices: jest.fn(),
      fetchPriceRange: jest.fn(),
      testConnection: jest.fn(),
    } as unknown as jest.Mocked<EiaApiService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncPricesFromEiaHandler,
        {
          provide: 'IPriceQuoteRepository',
          useValue: mockRepository,
        },
        {
          provide: EiaApiService,
          useValue: mockEiaService,
        },
      ],
    }).compile();

    handler = module.get<SyncPricesFromEiaHandler>(SyncPricesFromEiaHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should sync prices for all commodities by default', async () => {
      const mockQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      mockEiaService.fetchPrices.mockResolvedValue(mockQuotes);
      mockRepository.saveMany.mockResolvedValue(mockQuotes);

      const command = new SyncPricesFromEiaCommand();
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.pricesSynced).toBe(5); // All 5 commodities
      expect(result.commoditiesSynced).toHaveLength(5);
      expect(result.errors).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEiaService.fetchPrices).toHaveBeenCalledTimes(5);
    });

    it('should sync prices for specific commodities', async () => {
      const wtiQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      const gasQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('HENRY_HUB_GAS'),
          price: 3.25,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      // eslint-disable-next-line @typescript-eslint/require-await
      mockEiaService.fetchPrices.mockImplementation(async (commodityType) => {
        if (commodityType.type === 'WTI_CRUDE') return wtiQuotes;
        if (commodityType.type === 'HENRY_HUB_GAS') return gasQuotes;
        return [];
      });

      mockRepository.saveMany.mockResolvedValue([]);

      const command = new SyncPricesFromEiaCommand([
        'WTI_CRUDE',
        'HENRY_HUB_GAS',
      ]);
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.pricesSynced).toBe(2);
      expect(result.commoditiesSynced).toEqual(['WTI_CRUDE', 'HENRY_HUB_GAS']);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEiaService.fetchPrices).toHaveBeenCalledTimes(2);
    });

    it('should respect daysToFetch parameter', async () => {
      mockEiaService.fetchPrices.mockResolvedValue([]);
      mockRepository.saveMany.mockResolvedValue([]);

      const command = new SyncPricesFromEiaCommand(undefined, 30);
      await handler.execute(command);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEiaService.fetchPrices).toHaveBeenCalledWith(
        expect.anything(),
        30,
      );
    });

    it('should use default 7 days when daysToFetch not provided', async () => {
      mockEiaService.fetchPrices.mockResolvedValue([]);
      mockRepository.saveMany.mockResolvedValue([]);

      const command = new SyncPricesFromEiaCommand();
      await handler.execute(command);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEiaService.fetchPrices).toHaveBeenCalledWith(
        expect.anything(),
        7,
      );
    });

    it('should return error when EIA API key not configured', async () => {
      mockEiaService.isConfigured.mockReturnValue(false);

      const command = new SyncPricesFromEiaCommand();
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.pricesSynced).toBe(0);
      expect(result.errors).toContain('EIA_API_KEY not configured');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEiaService.fetchPrices).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockEiaService.fetchPrices.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      const command = new SyncPricesFromEiaCommand(['WTI_CRUDE']);
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.pricesSynced).toBe(0);
      expect(result.errors).toContain('WTI_CRUDE: API rate limit exceeded');
    });

    it('should continue syncing other commodities if one fails', async () => {
      const gasQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('HENRY_HUB_GAS'),
          price: 3.25,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      // eslint-disable-next-line @typescript-eslint/require-await
      mockEiaService.fetchPrices.mockImplementation(async (commodityType) => {
        if (commodityType.type === 'WTI_CRUDE') {
          throw new Error('API error');
        }
        return gasQuotes;
      });

      mockRepository.saveMany.mockResolvedValue(gasQuotes);

      const command = new SyncPricesFromEiaCommand([
        'WTI_CRUDE',
        'HENRY_HUB_GAS',
      ]);
      const result = await handler.execute(command);

      expect(result.success).toBe(true); // Partial success
      expect(result.pricesSynced).toBe(1); // Only gas was synced
      expect(result.commoditiesSynced).toEqual(['HENRY_HUB_GAS']);
      expect(result.errors).toContain('WTI_CRUDE: API error');
    });

    it('should handle multiple prices per commodity', async () => {
      const multipleQuotes = [
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

      mockEiaService.fetchPrices.mockResolvedValue(multipleQuotes);
      mockRepository.saveMany.mockResolvedValue(multipleQuotes);

      const command = new SyncPricesFromEiaCommand(['WTI_CRUDE'], 3);
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.pricesSynced).toBe(3);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.saveMany).toHaveBeenCalledWith(multipleQuotes);
    });

    it('should handle empty response from EIA API', async () => {
      mockEiaService.fetchPrices.mockResolvedValue([]);
      mockRepository.saveMany.mockResolvedValue([]);

      const command = new SyncPricesFromEiaCommand(['WTI_CRUDE']);
      const result = await handler.execute(command);

      expect(result.success).toBe(false); // No data synced = failure
      expect(result.pricesSynced).toBe(0);
      expect(result.commoditiesSynced).toEqual([]);
      expect(result.errors).toContain('No data returned for WTI_CRUDE');
    });

    it('should track which commodities were synced successfully', async () => {
      const wtiQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      const brentQuotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('BRENT_CRUDE'),
          price: 80.25,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      mockEiaService.fetchPrices.mockImplementation((commodityType) => {
        if (commodityType.type === 'WTI_CRUDE')
          return Promise.resolve(wtiQuotes);
        if (commodityType.type === 'BRENT_CRUDE')
          return Promise.resolve(brentQuotes);
        return Promise.resolve([]);
      });

      mockRepository.saveMany.mockResolvedValue([]);

      const command = new SyncPricesFromEiaCommand([
        'WTI_CRUDE',
        'BRENT_CRUDE',
      ]);
      const result = await handler.execute(command);

      expect(result.commoditiesSynced).toEqual(['WTI_CRUDE', 'BRENT_CRUDE']);
      expect(result.commoditiesSynced).toHaveLength(2);
    });

    it('should handle repository save errors', async () => {
      const quotes = [
        PriceQuote.create({
          commodityType: CommodityType.fromString('WTI_CRUDE'),
          price: 75.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ];

      mockEiaService.fetchPrices.mockResolvedValue(quotes);
      mockRepository.saveMany.mockRejectedValue(new Error('Database error'));

      const command = new SyncPricesFromEiaCommand(['WTI_CRUDE']);
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.pricesSynced).toBe(0);
      expect(result.errors).toContain('WTI_CRUDE: Database error');
    });
  });
});
