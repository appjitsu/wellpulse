/**
 * Price Quotes Database Schema
 *
 * Stores commodity price quotes from EIA API.
 * Master database table (shared across all tenants).
 */

import {
  pgTable,
  varchar,
  decimal,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Price Quotes Table
 *
 * Stores historical commodity prices fetched from EIA API.
 * Used for production revenue calculations and market analysis.
 */
export const priceQuotes = pgTable(
  'price_quotes',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    commodityType: varchar('commodity_type', { length: 50 }).notNull(),
    price: decimal('price', { precision: 10, scale: 4 }).notNull(),
    priceDate: timestamp('price_date', { mode: 'date' }).notNull(),
    source: varchar('source', { length: 20 }).notNull(), // 'EIA_API' or 'MANUAL'
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding latest price by commodity type
    commodityTypePriceDateIdx: index('idx_price_quotes_commodity_date').on(
      table.commodityType,
      table.priceDate,
    ),
    // Index for date range queries
    priceDateIdx: index('idx_price_quotes_date').on(table.priceDate),
    // Unique constraint: one price per commodity per date
    uniqueCommodityDate: index('unq_price_quotes_commodity_date').on(
      table.commodityType,
      table.priceDate,
    ),
  }),
);

/**
 * Price Quotes Type
 */
export type PriceQuoteRow = typeof priceQuotes.$inferSelect;
export type NewPriceQuoteRow = typeof priceQuotes.$inferInsert;
