/**
 * Price Quote Entity Tests
 *
 * Tests price quote creation, business rules, and calculations.
 */

import { PriceQuote } from './price-quote.entity';
import { CommodityType } from './value-objects/commodity-type.vo';

describe('PriceQuote', () => {
  const wtiCrude = CommodityType.fromString('WTI_CRUDE');
  const henryHubGas = CommodityType.fromString('HENRY_HUB_GAS');

  describe('create', () => {
    it('should create a valid price quote with EIA_API source', () => {
      const priceDate = new Date('2024-01-15');
      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate,
        source: 'EIA_API',
      });

      expect(priceQuote.id).toBeDefined();
      expect(priceQuote.commodityType.equals(wtiCrude)).toBe(true);
      expect(priceQuote.price).toBe(75.5);
      expect(priceQuote.priceDate).toEqual(priceDate);
      expect(priceQuote.source).toBe('EIA_API');
      expect(priceQuote.createdAt).toBeInstanceOf(Date);
      expect(priceQuote.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a valid price quote with MANUAL source', () => {
      const priceQuote = PriceQuote.create({
        commodityType: henryHubGas,
        price: 3.25,
        priceDate: new Date('2024-01-15'),
        source: 'MANUAL',
      });

      expect(priceQuote.source).toBe('MANUAL');
    });

    it('should throw error for negative price', () => {
      expect(() =>
        PriceQuote.create({
          commodityType: wtiCrude,
          price: -10,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ).toThrow('Price must be greater than zero');
    });

    it('should throw error for zero price', () => {
      expect(() =>
        PriceQuote.create({
          commodityType: wtiCrude,
          price: 0,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ).toThrow('Price must be greater than zero');
    });

    it('should throw error for future price date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

      expect(() =>
        PriceQuote.create({
          commodityType: wtiCrude,
          price: 75.5,
          priceDate: futureDate,
          source: 'EIA_API',
        }),
      ).toThrow('Price date cannot be in the future');
    });

    it('should throw error for oil price below $1', () => {
      expect(() =>
        PriceQuote.create({
          commodityType: wtiCrude,
          price: 0.5,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ).toThrow('Oil price must be between $1 and $500 per barrel');
    });

    it('should throw error for oil price above $500', () => {
      expect(() =>
        PriceQuote.create({
          commodityType: wtiCrude,
          price: 600,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ).toThrow('Oil price must be between $1 and $500 per barrel');
    });

    it('should throw error for gas price below $0.10', () => {
      expect(() =>
        PriceQuote.create({
          commodityType: henryHubGas,
          price: 0.05,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ).toThrow('Gas price must be between $0.10 and $50 per MMBtu');
    });

    it('should throw error for gas price above $50', () => {
      expect(() =>
        PriceQuote.create({
          commodityType: henryHubGas,
          price: 75,
          priceDate: new Date('2024-01-15'),
          source: 'EIA_API',
        }),
      ).toThrow('Gas price must be between $0.10 and $50 per MMBtu');
    });

    it('should accept oil price at lower boundary ($1)', () => {
      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 1,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      expect(priceQuote.price).toBe(1);
    });

    it('should accept oil price at upper boundary ($500)', () => {
      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 500,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      expect(priceQuote.price).toBe(500);
    });
  });

  // Note: PriceQuote uses create() for both new and reconstituted entities

  describe('isStale', () => {
    it('should return false for fresh price (within 24 hours)', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago

      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: recentDate,
        source: 'EIA_API',
      });

      expect(priceQuote.isStale(24)).toBe(false);
    });

    it('should return true for stale price (older than 24 hours)', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: oldDate,
        source: 'EIA_API',
      });

      expect(priceQuote.isStale(24)).toBe(true);
    });

    it('should use default 24-hour threshold', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30 hours ago

      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: oldDate,
        source: 'EIA_API',
      });

      expect(priceQuote.isStale()).toBe(true);
    });

    it('should respect custom staleness threshold', () => {
      const now = new Date();
      const date = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago

      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: date,
        source: 'EIA_API',
      });

      expect(priceQuote.isStale(4)).toBe(true); // Stale with 4-hour threshold
      expect(priceQuote.isStale(8)).toBe(false); // Fresh with 8-hour threshold
    });
  });

  describe('calculateChangePercent', () => {
    it('should calculate positive price change', () => {
      const previousQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 70.0,
        priceDate: new Date('2024-01-14'),
        source: 'EIA_API',
      });

      const currentQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      const changePercent = currentQuote.calculateChangePercent(previousQuote);

      expect(changePercent).toBeCloseTo(7.857, 2); // (75.5 - 70) / 70 * 100 = 7.857%
    });

    it('should calculate negative price change', () => {
      const previousQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 80.0,
        priceDate: new Date('2024-01-14'),
        source: 'EIA_API',
      });

      const currentQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      const changePercent = currentQuote.calculateChangePercent(previousQuote);

      expect(changePercent).toBeCloseTo(-5.625, 2); // (75.5 - 80) / 80 * 100 = -5.625%
    });

    it('should return zero for no price change', () => {
      const previousQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: new Date('2024-01-14'),
        source: 'EIA_API',
      });

      const currentQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      const changePercent = currentQuote.calculateChangePercent(previousQuote);

      expect(changePercent).toBe(0);
    });

    it('should throw error when comparing different commodity types', () => {
      const oilQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      const gasQuote = PriceQuote.create({
        commodityType: henryHubGas,
        price: 3.25,
        priceDate: new Date('2024-01-15'),
        source: 'EIA_API',
      });

      expect(() => oilQuote.calculateChangePercent(gasQuote)).toThrow(
        'Cannot compare different commodity types',
      );
    });
  });

  describe('toPrimitives', () => {
    it('should convert to primitives', () => {
      const priceDate = new Date('2024-01-15');
      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate,
        source: 'EIA_API',
      });

      const primitives = priceQuote.toPrimitives();

      expect(primitives.id).toBeDefined();
      expect(primitives.commodityType).toBe('WTI_CRUDE');
      expect(primitives.price).toBe(75.5);
      expect(primitives.priceDate).toEqual(priceDate);
      expect(primitives.source).toBe('EIA_API');
      expect(primitives.createdAt).toBeInstanceOf(Date);
      expect(primitives.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('immutability', () => {
    it('should not expose internal mutable state', () => {
      const priceDate = new Date('2024-01-15');
      const priceQuote = PriceQuote.create({
        commodityType: wtiCrude,
        price: 75.5,
        priceDate,
        source: 'EIA_API',
      });

      // Try to mutate the returned date
      const returnedDate = priceQuote.priceDate;
      returnedDate.setDate(returnedDate.getDate() + 1);

      // Original price quote should be unchanged
      expect(priceQuote.priceDate).toEqual(priceDate);
    });
  });
});
