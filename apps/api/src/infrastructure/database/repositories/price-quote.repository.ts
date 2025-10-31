/**
 * Price Quote Repository Implementation
 *
 * Handles persistence of commodity price quotes in master database.
 * Uses Drizzle ORM for type-safe database operations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { desc, eq, and, gte, lte, lt } from 'drizzle-orm';
import { PriceQuote } from '../../../domain/commodity-pricing/price-quote.entity';
import { CommodityType } from '../../../domain/commodity-pricing/value-objects/commodity-type.vo';
import { IPriceQuoteRepository } from '../../../domain/repositories/price-quote.repository.interface';
import { MasterDatabaseService } from '../master-database.service';
import { priceQuotes } from '../schema/master/price-quotes.schema';

/**
 * Price Quote Repository
 */
@Injectable()
export class PriceQuoteRepository implements IPriceQuoteRepository {
  private readonly logger = new Logger(PriceQuoteRepository.name);

  constructor(private readonly masterDb: MasterDatabaseService) {}

  /**
   * Find latest price for a commodity type
   */
  async findLatest(commodityType: CommodityType): Promise<PriceQuote | null> {
    try {
      const db = this.masterDb.getDatabase();

      const rows = await db
        .select()
        .from(priceQuotes)
        .where(eq(priceQuotes.commodityType, commodityType.toValue()))
        .orderBy(desc(priceQuotes.priceDate))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      return this.toDomain(rows[0]);
    } catch (error) {
      this.logger.error(
        `Failed to find latest price for ${commodityType.type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find price for specific date
   */
  async findByDate(
    commodityType: CommodityType,
    date: Date,
  ): Promise<PriceQuote | null> {
    try {
      const db = this.masterDb.getDatabase();

      // Normalize date to start of day (remove time component)
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      const rows = await db
        .select()
        .from(priceQuotes)
        .where(
          and(
            eq(priceQuotes.commodityType, commodityType.toValue()),
            eq(priceQuotes.priceDate, dateOnly),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      return this.toDomain(rows[0]);
    } catch (error) {
      this.logger.error(
        `Failed to find price by date for ${commodityType.type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find historical prices within date range
   */
  async findByDateRange(
    commodityType: CommodityType,
    startDate: Date,
    endDate: Date,
  ): Promise<PriceQuote[]> {
    try {
      const db = this.masterDb.getDatabase();

      const rows = await db
        .select()
        .from(priceQuotes)
        .where(
          and(
            eq(priceQuotes.commodityType, commodityType.toValue()),
            gte(priceQuotes.priceDate, startDate),
            lte(priceQuotes.priceDate, endDate),
          ),
        )
        .orderBy(desc(priceQuotes.priceDate));

      return rows.map((row) => this.toDomain(row));
    } catch (error) {
      this.logger.error(
        `Failed to find prices by date range for ${commodityType.type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find all prices for a commodity type
   */
  async findAll(commodityType: CommodityType): Promise<PriceQuote[]> {
    try {
      const db = this.masterDb.getDatabase();

      const rows = await db
        .select()
        .from(priceQuotes)
        .where(eq(priceQuotes.commodityType, commodityType.toValue()))
        .orderBy(desc(priceQuotes.priceDate));

      return rows.map((row) => this.toDomain(row));
    } catch (error) {
      this.logger.error(
        `Failed to find all prices for ${commodityType.type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Save price quote (insert or update)
   */
  async save(priceQuote: PriceQuote): Promise<PriceQuote> {
    try {
      const db = this.masterDb.getDatabase();
      const primitives = priceQuote.toPrimitives();

      // Check if price exists for this commodity and date
      const existing = await this.findByDate(
        priceQuote.commodityType,
        priceQuote.priceDate,
      );

      if (existing) {
        // Update existing price
        await db
          .update(priceQuotes)
          .set({
            price: primitives.price.toString(),
            source: primitives.source,
            updatedAt: new Date(),
          })
          .where(eq(priceQuotes.id, existing.id));

        this.logger.log(
          `Updated price quote ${existing.id} for ${primitives.commodityType}`,
        );
      } else {
        // Insert new price
        await db.insert(priceQuotes).values({
          id: primitives.id,
          commodityType: primitives.commodityType,
          price: primitives.price.toString(),
          priceDate: primitives.priceDate,
          source: primitives.source,
          createdAt: primitives.createdAt,
          updatedAt: primitives.updatedAt,
        });

        this.logger.log(
          `Created price quote ${primitives.id} for ${primitives.commodityType}`,
        );
      }

      return priceQuote;
    } catch (error) {
      this.logger.error(`Failed to save price quote`, error);
      throw error;
    }
  }

  /**
   * Save multiple price quotes in bulk
   */
  async saveMany(priceQuotesList: PriceQuote[]): Promise<PriceQuote[]> {
    if (priceQuotesList.length === 0) {
      return [];
    }

    try {
      // Use upsert pattern for bulk insert
      for (const priceQuote of priceQuotesList) {
        await this.save(priceQuote);
      }

      this.logger.log(`Saved ${priceQuotesList.length} price quotes in bulk`);

      return priceQuotesList;
    } catch (error) {
      this.logger.error(`Failed to save many price quotes`, error);
      throw error;
    }
  }

  /**
   * Delete old price quotes (cleanup)
   */
  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const db = this.masterDb.getDatabase();

      const result = await db
        .delete(priceQuotes)
        .where(lt(priceQuotes.priceDate, date));

      const deletedCount = result.rowCount || 0;

      this.logger.log(
        `Deleted ${deletedCount} price quotes older than ${String(date)}`,
      );

      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to delete old price quotes`, error);
      throw error;
    }
  }

  /**
   * Check if price exists for date
   */
  async existsForDate(
    commodityType: CommodityType,
    date: Date,
  ): Promise<boolean> {
    const priceQuote = await this.findByDate(commodityType, date);
    return priceQuote !== null;
  }

  /**
   * Map database row to domain entity
   */
  private toDomain(row: typeof priceQuotes.$inferSelect): PriceQuote {
    return PriceQuote.fromPrimitives({
      id: row.id,
      commodityType: row.commodityType,
      price: parseFloat(row.price),
      priceDate: new Date(row.priceDate),
      source: row.source as 'EIA_API' | 'MANUAL',
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}
