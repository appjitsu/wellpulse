/**
 * Commodity Type Value Object Tests
 *
 * Tests commodity type creation, validation, and EIA metadata retrieval.
 */

import { CommodityType } from './commodity-type.vo';

describe('CommodityType', () => {
  describe('fromString', () => {
    it('should create WTI_CRUDE commodity type', () => {
      const commodityType = CommodityType.fromString('WTI_CRUDE');

      expect(commodityType.type).toBe('WTI_CRUDE');
      expect(commodityType.name).toBe('WTI Crude Oil');
      expect(commodityType.unit).toBe('USD/Barrel');
      expect(commodityType.eiaEndpoint).toBe('/v2/petroleum/pri/spt/data/');
      expect(commodityType.eiaSeriesId).toBe('EPCWTI');
    });

    it('should create BRENT_CRUDE commodity type', () => {
      const commodityType = CommodityType.fromString('BRENT_CRUDE');

      expect(commodityType.type).toBe('BRENT_CRUDE');
      expect(commodityType.name).toBe('Brent Crude Oil');
      expect(commodityType.unit).toBe('USD/Barrel');
      expect(commodityType.eiaEndpoint).toBe('/v2/petroleum/pri/spt/data/');
      expect(commodityType.eiaSeriesId).toBe('EPCBRENT');
    });

    it('should create HENRY_HUB_GAS commodity type', () => {
      const commodityType = CommodityType.fromString('HENRY_HUB_GAS');

      expect(commodityType.type).toBe('HENRY_HUB_GAS');
      expect(commodityType.name).toBe('Henry Hub Natural Gas');
      expect(commodityType.unit).toBe('USD/MMBtu');
      expect(commodityType.eiaEndpoint).toBe('/v2/natural-gas/pri/fut/data/');
      expect(commodityType.eiaSeriesId).toBe('RNGWHHD');
    });

    it('should create NY_HARBOR_HEATING_OIL commodity type', () => {
      const commodityType = CommodityType.fromString('NY_HARBOR_HEATING_OIL');

      expect(commodityType.type).toBe('NY_HARBOR_HEATING_OIL');
      expect(commodityType.name).toBe('NY Harbor Heating Oil');
      expect(commodityType.unit).toBe('USD/Gallon');
    });

    it('should create GULF_COAST_GASOLINE commodity type', () => {
      const commodityType = CommodityType.fromString('GULF_COAST_GASOLINE');

      expect(commodityType.type).toBe('GULF_COAST_GASOLINE');
      expect(commodityType.name).toBe('Gulf Coast Gasoline');
      expect(commodityType.unit).toBe('USD/Gallon');
    });

    it('should throw error for invalid commodity type', () => {
      expect(() => CommodityType.fromString('INVALID_TYPE')).toThrow(
        'Invalid commodity type: INVALID_TYPE',
      );
    });

    it('should throw error for empty string', () => {
      expect(() => CommodityType.fromString('')).toThrow(
        'Invalid commodity type: ',
      );
    });
  });

  describe('isOilCommodity', () => {
    it('should return true for WTI crude oil', () => {
      const commodityType = CommodityType.fromString('WTI_CRUDE');
      expect(commodityType.isOilCommodity()).toBe(true);
    });

    it('should return true for Brent crude oil', () => {
      const commodityType = CommodityType.fromString('BRENT_CRUDE');
      expect(commodityType.isOilCommodity()).toBe(true);
    });

    it('should return false for natural gas', () => {
      const commodityType = CommodityType.fromString('HENRY_HUB_GAS');
      expect(commodityType.isOilCommodity()).toBe(false);
    });

    it('should return false for heating oil (refined product)', () => {
      const commodityType = CommodityType.fromString('NY_HARBOR_HEATING_OIL');
      expect(commodityType.isOilCommodity()).toBe(false);
    });

    it('should return false for gasoline (refined product)', () => {
      const commodityType = CommodityType.fromString('GULF_COAST_GASOLINE');
      expect(commodityType.isOilCommodity()).toBe(false);
    });
  });

  describe('isGasCommodity', () => {
    it('should return false for WTI crude oil', () => {
      const commodityType = CommodityType.fromString('WTI_CRUDE');
      expect(commodityType.isGasCommodity()).toBe(false);
    });

    it('should return true for natural gas', () => {
      const commodityType = CommodityType.fromString('HENRY_HUB_GAS');
      expect(commodityType.isGasCommodity()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for same commodity type', () => {
      const type1 = CommodityType.fromString('WTI_CRUDE');
      const type2 = CommodityType.fromString('WTI_CRUDE');

      expect(type1.equals(type2)).toBe(true);
    });

    it('should return false for different commodity types', () => {
      const type1 = CommodityType.fromString('WTI_CRUDE');
      const type2 = CommodityType.fromString('BRENT_CRUDE');

      expect(type1.equals(type2)).toBe(false);
    });
  });

  describe('toValue', () => {
    it('should return commodity type string', () => {
      const commodityType = CommodityType.fromString('WTI_CRUDE');
      expect(commodityType.toValue()).toBe('WTI_CRUDE');
    });
  });

  // Note: CommodityType uses toValue() instead of toPrimitives()
});
