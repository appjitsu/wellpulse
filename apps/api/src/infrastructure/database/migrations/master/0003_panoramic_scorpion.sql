CREATE TABLE "price_quotes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"commodity_type" varchar(50) NOT NULL,
	"price" numeric(10, 4) NOT NULL,
	"price_date" timestamp NOT NULL,
	"source" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_price_quotes_commodity_date" ON "price_quotes" USING btree ("commodity_type","price_date");--> statement-breakpoint
CREATE INDEX "idx_price_quotes_date" ON "price_quotes" USING btree ("price_date");--> statement-breakpoint
CREATE INDEX "unq_price_quotes_commodity_date" ON "price_quotes" USING btree ("commodity_type","price_date");