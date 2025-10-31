/**
 * Price Quote Entity
 *
 * Represents a commodity price quote at a specific point in time.
 * Domain entity following DDD principles with business rules.
 */

import { CommodityType } from './value-objects/commodity-type.vo';

/**
 * Price Quote Entity Props
 */
export interface PriceQuoteProps {
  id?: string;
  commodityType: CommodityType;
  price: number;
  priceDate: Date;
  source: 'EIA_API' | 'MANUAL';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Price Quote Entity
 */
export class PriceQuote {
  private _id: string;
  private _commodityType: CommodityType;
  private _price: number;
  private _priceDate: Date;
  private _source: 'EIA_API' | 'MANUAL';
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: PriceQuoteProps) {
    this._id = props.id || this.generateId();
    this._commodityType = props.commodityType;
    this._price = props.price;
    this._priceDate = props.priceDate;
    this._source = props.source;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  /**
   * Factory method to create new Price Quote
   */
  static create(props: PriceQuoteProps): PriceQuote {
    // Validate business rules
    this.validate(props);

    return new PriceQuote(props);
  }

  /**
   * Validate price quote business rules
   */
  private static validate(props: PriceQuoteProps): void {
    // Price must be positive
    if (props.price <= 0) {
      throw new Error('Price must be greater than zero');
    }

    // Price date cannot be in the future
    if (props.priceDate > new Date()) {
      throw new Error('Price date cannot be in the future');
    }

    // Validate reasonable price ranges (prevent data errors)
    if (props.commodityType.isOilCommodity()) {
      if (props.price < 1 || props.price > 500) {
        throw new Error('Oil price must be between $1 and $500 per barrel');
      }
    }

    if (props.commodityType.isGasCommodity()) {
      if (props.price < 0.1 || props.price > 50) {
        throw new Error('Gas price must be between $0.10 and $50 per MMBtu');
      }
    }

    if (props.commodityType.isRefinedProduct()) {
      if (props.price < 0.5 || props.price > 20) {
        throw new Error(
          'Refined product price must be between $0.50 and $20 per gallon',
        );
      }
    }
  }

  /**
   * Generate unique ID (UUID v4)
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  /**
   * Update price (for manual corrections)
   */
  updatePrice(newPrice: number): void {
    if (newPrice <= 0) {
      throw new Error('Price must be greater than zero');
    }

    // Validate reasonable ranges
    if (this._commodityType.isOilCommodity()) {
      if (newPrice < 1 || newPrice > 500) {
        throw new Error('Oil price must be between $1 and $500 per barrel');
      }
    }

    if (this._commodityType.isGasCommodity()) {
      if (newPrice < 0.1 || newPrice > 50) {
        throw new Error('Gas price must be between $0.10 and $50 per MMBtu');
      }
    }

    if (this._commodityType.isRefinedProduct()) {
      if (newPrice < 0.5 || newPrice > 20) {
        throw new Error(
          'Refined product price must be between $0.50 and $20 per gallon',
        );
      }
    }

    this._price = newPrice;
    this._updatedAt = new Date();
  }

  /**
   * Check if quote is stale (older than 24 hours)
   */
  isStale(maxAgeHours = 24): boolean {
    const now = new Date();
    const ageInHours =
      (now.getTime() - this._priceDate.getTime()) / (1000 * 60 * 60);
    return ageInHours > maxAgeHours;
  }

  /**
   * Check if quote is from external API
   */
  isFromAPI(): boolean {
    return this._source === 'EIA_API';
  }

  /**
   * Check if quote is manually entered
   */
  isManual(): boolean {
    return this._source === 'MANUAL';
  }

  /**
   * Calculate price change percentage from another quote
   */
  calculateChangePercent(previousQuote: PriceQuote): number {
    if (!this._commodityType.equals(previousQuote._commodityType)) {
      throw new Error('Cannot compare different commodity types');
    }

    if (previousQuote._price === 0) {
      return 0;
    }

    return ((this._price - previousQuote._price) / previousQuote._price) * 100;
  }

  /**
   * Format price with currency and unit
   */
  formatPrice(): string {
    return `$${this._price.toFixed(2)} ${this._commodityType.unit}`;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get commodityType(): CommodityType {
    return this._commodityType;
  }

  get price(): number {
    return this._price;
  }

  get priceDate(): Date {
    return this._priceDate;
  }

  get source(): 'EIA_API' | 'MANUAL' {
    return this._source;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Extract primitive values for persistence
   */
  toPrimitives() {
    return {
      id: this._id,
      commodityType: this._commodityType.toValue(),
      price: this._price,
      priceDate: this._priceDate,
      source: this._source,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Reconstruct entity from primitives
   */
  static fromPrimitives(data: {
    id: string;
    commodityType: string;
    price: number;
    priceDate: Date;
    source: 'EIA_API' | 'MANUAL';
    createdAt: Date;
    updatedAt: Date;
  }): PriceQuote {
    return new PriceQuote({
      id: data.id,
      commodityType: CommodityType.fromString(data.commodityType),
      price: data.price,
      priceDate: data.priceDate,
      source: data.source,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
