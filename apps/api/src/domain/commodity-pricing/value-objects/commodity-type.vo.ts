/**
 * Commodity Type Value Object
 *
 * Represents the type of energy commodity with EIA-specific metadata.
 * Immutable value object following DDD principles.
 */

/**
 * Supported commodity types from EIA
 */
export type CommodityTypeEnum =
  | 'WTI_CRUDE' // West Texas Intermediate Crude Oil
  | 'BRENT_CRUDE' // Brent Crude Oil (international benchmark)
  | 'HENRY_HUB_GAS' // Henry Hub Natural Gas Spot Price
  | 'NY_HARBOR_HEATING_OIL' // New York Harbor Heating Oil
  | 'GULF_COAST_GASOLINE'; // US Gulf Coast Regular Gasoline

/**
 * EIA API configuration for each commodity type
 */
interface CommodityMetadata {
  name: string;
  description: string;
  unit: string;
  eiaEndpoint: string;
  eiaSeriesId: string;
  eiaFacetKey: string;
  eiaFacetValue: string;
}

/**
 * Commodity Type Value Object
 */
export class CommodityType {
  private readonly _type: CommodityTypeEnum;
  private readonly _metadata: CommodityMetadata;

  private constructor(type: CommodityTypeEnum) {
    this._type = type;
    this._metadata = this.getMetadata(type);
  }

  /**
   * Factory method to create CommodityType
   */
  static create(type: CommodityTypeEnum): CommodityType {
    return new CommodityType(type);
  }

  /**
   * Create from string value (for DB deserialization)
   */
  static fromString(value: string): CommodityType {
    if (!this.isValidType(value)) {
      throw new Error(`Invalid commodity type: ${value}`);
    }
    return new CommodityType(value as CommodityTypeEnum);
  }

  /**
   * Validate if string is valid commodity type
   */
  private static isValidType(value: string): boolean {
    const validTypes: string[] = [
      'WTI_CRUDE',
      'BRENT_CRUDE',
      'HENRY_HUB_GAS',
      'NY_HARBOR_HEATING_OIL',
      'GULF_COAST_GASOLINE',
    ];
    return validTypes.includes(value);
  }

  /**
   * Get metadata for commodity type
   */
  private getMetadata(type: CommodityTypeEnum): CommodityMetadata {
    const metadataMap: Record<CommodityTypeEnum, CommodityMetadata> = {
      WTI_CRUDE: {
        name: 'WTI Crude Oil',
        description: 'Cushing, OK WTI Spot Price FOB',
        unit: 'USD/Barrel',
        eiaEndpoint: '/v2/petroleum/pri/spt/data/',
        eiaSeriesId: 'EPCWTI',
        eiaFacetKey: 'product',
        eiaFacetValue: 'EPCWTI',
      },
      BRENT_CRUDE: {
        name: 'Brent Crude Oil',
        description: 'Europe Brent Spot Price FOB',
        unit: 'USD/Barrel',
        eiaEndpoint: '/v2/petroleum/pri/spt/data/',
        eiaSeriesId: 'EPCBRENT',
        eiaFacetKey: 'product',
        eiaFacetValue: 'EPCBRENT',
      },
      HENRY_HUB_GAS: {
        name: 'Henry Hub Natural Gas',
        description: 'Henry Hub Natural Gas Spot Price',
        unit: 'USD/MMBtu',
        eiaEndpoint: '/v2/natural-gas/pri/fut/data/',
        eiaSeriesId: 'RNGWHHD',
        eiaFacetKey: 'series',
        eiaFacetValue: 'RNGWHHD',
      },
      NY_HARBOR_HEATING_OIL: {
        name: 'NY Harbor Heating Oil',
        description: 'New York Harbor No. 2 Heating Oil Spot Price',
        unit: 'USD/Gallon',
        eiaEndpoint: '/v2/petroleum/pri/spt/data/',
        eiaSeriesId: 'EPD2F',
        eiaFacetKey: 'product',
        eiaFacetValue: 'EPD2F',
      },
      GULF_COAST_GASOLINE: {
        name: 'Gulf Coast Gasoline',
        description: 'US Gulf Coast Conventional Gasoline Regular Spot Price',
        unit: 'USD/Gallon',
        eiaEndpoint: '/v2/petroleum/pri/spt/data/',
        eiaSeriesId: 'EER_EPMRU_PF4_RGC_DPG',
        eiaFacetKey: 'product',
        eiaFacetValue: 'EER_EPMRU_PF4_RGC_DPG',
      },
    };

    return metadataMap[type];
  }

  // Getters
  get type(): CommodityTypeEnum {
    return this._type;
  }

  get name(): string {
    return this._metadata.name;
  }

  get description(): string {
    return this._metadata.description;
  }

  get unit(): string {
    return this._metadata.unit;
  }

  get eiaEndpoint(): string {
    return this._metadata.eiaEndpoint;
  }

  get eiaSeriesId(): string {
    return this._metadata.eiaSeriesId;
  }

  get eiaFacetKey(): string {
    return this._metadata.eiaFacetKey;
  }

  get eiaFacetValue(): string {
    return this._metadata.eiaFacetValue;
  }

  /**
   * Check if this is an oil commodity
   */
  isOilCommodity(): boolean {
    return ['WTI_CRUDE', 'BRENT_CRUDE'].includes(this._type);
  }

  /**
   * Check if this is a gas commodity
   */
  isGasCommodity(): boolean {
    return this._type === 'HENRY_HUB_GAS';
  }

  /**
   * Check if this is a refined product
   */
  isRefinedProduct(): boolean {
    return ['NY_HARBOR_HEATING_OIL', 'GULF_COAST_GASOLINE'].includes(
      this._type,
    );
  }

  /**
   * Extract primitive value for persistence
   */
  toValue(): string {
    return this._type;
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      type: this._type,
      name: this._metadata.name,
      description: this._metadata.description,
      unit: this._metadata.unit,
    };
  }

  /**
   * Equality check
   */
  equals(other: CommodityType): boolean {
    return this._type === other._type;
  }
}
