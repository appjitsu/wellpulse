CREATE TABLE "nominal_range_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"well_type" varchar(50),
	"min_value" numeric(10, 2),
	"max_value" numeric(10, 2),
	"unit" varchar(20) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "azure_tenant_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "sso_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "branding_config" jsonb;--> statement-breakpoint
CREATE INDEX "nominal_range_templates_field_name_idx" ON "nominal_range_templates" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "nominal_range_templates_well_type_idx" ON "nominal_range_templates" USING btree ("well_type");--> statement-breakpoint
CREATE INDEX "nominal_range_templates_is_active_idx" ON "nominal_range_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "nominal_range_templates_field_name_well_type_idx" ON "nominal_range_templates" USING btree ("field_name","well_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_azure_tenant_id_idx" ON "tenants" USING btree ("azure_tenant_id");--> statement-breakpoint

-- ===========================================================================
-- Seed Data: Nominal Range Templates for Permian Basin Wells
-- ===========================================================================
-- These are industry-standard default ranges. Tenants can override at org or well level.
-- ===========================================================================

-- -------------------------------------------------------------------------
-- Common Production Metrics (All Well Types)
-- -------------------------------------------------------------------------

-- Production Volume (Oil)
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('productionVolume', NULL, 1, 200, 'bbl/day', 'warning', 'Typical Permian Basin oil production range'),
('productionVolume', NULL, 0, 1, 'bbl/day', 'critical', 'Low production - well may be offline or experiencing issues'),
('productionVolume', NULL, 200, 500, 'bbl/day', 'info', 'Above average production - high performer');

-- Gas Volume
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('gasVolume', NULL, 10, 3000, 'mcf/day', 'warning', 'Typical associated gas production'),
('gasVolume', NULL, 3000, 10000, 'mcf/day', 'info', 'High gas production - monitor for gas lift optimization'),
('gasVolume', NULL, 0, 10, 'mcf/day', 'critical', 'Very low gas - check for restrictions or equipment issues');

-- Water Production & Water Cut
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('waterVolume', NULL, 0, 100, 'bbl/day', 'info', 'Low water production - good well health'),
('waterVolume', NULL, 100, 500, 'bbl/day', 'warning', 'Moderate water production - monitor trend'),
('waterVolume', NULL, 500, NULL, 'bbl/day', 'critical', 'High water production - consider workover'),
('waterCut', NULL, 0, 30, '%', 'info', 'Low water cut - healthy production'),
('waterCut', NULL, 30, 70, '%', 'warning', 'Increasing water cut - monitor decline curve'),
('waterCut', NULL, 70, 100, '%', 'critical', 'High water cut - well may need intervention');

-- Basic Sediment & Water (BS&W)
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('bsw', NULL, 0, 1, '%', 'info', 'Excellent oil quality'),
('bsw', NULL, 1, 5, '%', 'warning', 'Acceptable BS&W - monitor for separation issues'),
('bsw', NULL, 5, NULL, '%', 'critical', 'High BS&W - check separator operation');

-- Pressure & Temperature
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('pressure', NULL, 50, 2000, 'psi', 'warning', 'Normal operating pressure range for Permian wells'),
('pressure', NULL, 0, 50, 'psi', 'critical', 'Low pressure - well may be depleted or experiencing communication'),
('pressure', NULL, 2000, 5000, 'psi', 'critical', 'High pressure - safety concern'),
('temperature', NULL, 80, 180, '°F', 'warning', 'Normal reservoir temperature'),
('temperature', NULL, 180, 250, '°F', 'critical', 'High temperature - check for equipment overheating');

-- Casing & Tubing Pressure
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('casingPressure', NULL, 0, 200, 'psi', 'info', 'Normal casing pressure'),
('casingPressure', NULL, 200, 1000, 'psi', 'warning', 'Elevated casing pressure - check for casing leaks'),
('casingPressure', NULL, 1000, NULL, 'psi', 'critical', 'High casing pressure - potential safety hazard'),
('tubingPressure', NULL, 50, 1500, 'psi', 'warning', 'Normal tubing pressure'),
('tubingPressure', NULL, 0, 50, 'psi', 'critical', 'Very low tubing pressure');

-- Gas-Oil Ratio (GOR)
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('gor', NULL, 200, 2000, 'cf/bbl', 'info', 'Typical Permian GOR'),
('gor', NULL, 2000, 5000, 'cf/bbl', 'warning', 'Elevated GOR - monitor for gas breakthrough'),
('gor', NULL, 5000, NULL, 'cf/bbl', 'critical', 'Very high GOR - potential gas coning or casing leak');

-- Tank Level & Fluid Level
INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('tankLevel', NULL, 25, 85, '%', 'info', 'Optimal tank level for run scheduling'),
('tankLevel', NULL, 85, 95, '%', 'warning', 'Tank nearing capacity - schedule pickup'),
('tankLevel', NULL, 95, 100, '%', 'critical', 'Tank nearly full - immediate action required'),
('fluidLevel', NULL, 500, 4000, 'ft', 'warning', 'Normal fluid level for artificial lift wells');

-- -------------------------------------------------------------------------
-- Beam Pump Specific Fields
-- -------------------------------------------------------------------------

INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('pumpRuntime', 'beam-pump', 20, 24, 'hours', 'info', 'Pump running near continuously - efficient operation'),
('pumpRuntime', 'beam-pump', 12, 20, 'hours', 'warning', 'Moderate pump runtime - check for intermittent issues'),
('pumpRuntime', 'beam-pump', 0, 12, 'hours', 'critical', 'Low pump runtime - investigate downtime causes'),
('strokesPerMinute', 'beam-pump', 8, 15, 'spm', 'info', 'Optimal stroke rate for most beam pumps'),
('strokesPerMinute', 'beam-pump', 5, 8, 'spm', 'warning', 'Low stroke rate - may indicate high load'),
('strokesPerMinute', 'beam-pump', 15, 25, 'spm', 'warning', 'High stroke rate - monitor for pump wear'),
('strokeLength', 'beam-pump', 60, 120, 'inches', 'info', 'Common stroke length for Permian wells'),
('engineHours', 'beam-pump', NULL, NULL, 'hours', 'info', 'Track for preventive maintenance'),
('engineTemp', 'beam-pump', 150, 220, '°F', 'warning', 'Normal engine operating temperature'),
('engineTemp', 'beam-pump', 220, NULL, '°F', 'critical', 'Engine overheating - check cooling system');

-- -------------------------------------------------------------------------
-- Progressive Cavity Pump (PCP) Specific Fields
-- -------------------------------------------------------------------------

INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('motorAmps', 'pcp', 15, 80, 'amps', 'info', 'Normal motor current for PCP'),
('motorAmps', 'pcp', 80, 120, 'amps', 'warning', 'High current - check for pump wear or fluid issues'),
('motorAmps', 'pcp', 120, NULL, 'amps', 'critical', 'Very high current - motor overload risk'),
('motorVoltage', 'pcp', 400, 500, 'V', 'warning', 'Normal motor voltage'),
('motorTemp', 'pcp', 100, 200, '°F', 'warning', 'Acceptable motor temperature'),
('motorTemp', 'pcp', 200, 250, '°F', 'critical', 'Motor overheating - may fail soon'),
('motorRpm', 'pcp', 200, 600, 'rpm', 'info', 'Typical PCP operating speed'),
('motorRpm', 'pcp', 100, 200, 'rpm', 'warning', 'Low RPM - check for restrictions'),
('motorRunningHours', 'pcp', NULL, NULL, 'hours', 'info', 'Track for preventive maintenance'),
('dischargePressure', 'pcp', 200, 1500, 'psi', 'warning', 'Normal PCP discharge pressure');

-- -------------------------------------------------------------------------
-- Electric Submersible Pump (ESP) Specific Fields
-- -------------------------------------------------------------------------

INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('motorAmps', 'submersible', 20, 100, 'amps', 'info', 'Normal ESP current draw'),
('motorAmps', 'submersible', 100, 150, 'amps', 'warning', 'Elevated current - monitor for pump wear'),
('motorAmps', 'submersible', 150, NULL, 'amps', 'critical', 'Very high current - potential motor failure'),
('motorVoltage', 'submersible', 400, 600, 'V', 'warning', 'Normal ESP voltage'),
('motorTemp', 'submersible', 150, 250, '°F', 'warning', 'Normal motor temperature'),
('motorTemp', 'submersible', 250, NULL, '°F', 'critical', 'Motor overheating - immediate attention required'),
('motorRpm', 'submersible', 2900, 3600, 'rpm', 'info', 'Standard ESP operating speed'),
('motorRunningHours', 'submersible', NULL, NULL, 'hours', 'info', 'Track for run life analysis'),
('dischargePressure', 'submersible', 500, 2500, 'psi', 'warning', 'Normal ESP discharge pressure');

-- -------------------------------------------------------------------------
-- Gas Lift Specific Fields
-- -------------------------------------------------------------------------

INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('gasInjectionVolume', 'gas-lift', 50, 500, 'mcf', 'info', 'Typical gas injection rate'),
('gasInjectionVolume', 'gas-lift', 0, 50, 'mcf', 'warning', 'Low injection - may need optimization'),
('gasInjectionVolume', 'gas-lift', 500, NULL, 'mcf', 'warning', 'High injection - check for efficiency'),
('injectionPressure', 'gas-lift', 200, 1200, 'psi', 'warning', 'Normal injection pressure'),
('backpressure', 'gas-lift', 50, 500, 'psi', 'warning', 'Normal backpressure on annulus'),
('orificeSize', 'gas-lift', 8, 32, '1/64"', 'info', 'Common gas lift orifice sizes');

-- -------------------------------------------------------------------------
-- Plunger Lift Specific Fields
-- -------------------------------------------------------------------------

INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('cycleTime', 'plunger-lift', 30, 180, 'min', 'info', 'Typical plunger cycle time'),
('cycleTime', 'plunger-lift', 180, NULL, 'min', 'warning', 'Long cycle time - may indicate low well pressure'),
('surfacePressure', 'plunger-lift', 50, 800, 'psi', 'warning', 'Normal surface pressure'),
('plungerArrival', 'plunger-lift', NULL, NULL, 'timestamp', 'info', 'Track plunger arrival for optimization');

-- -------------------------------------------------------------------------
-- Operational Fields
-- -------------------------------------------------------------------------

INSERT INTO "nominal_range_templates" ("field_name", "well_type", "min_value", "max_value", "unit", "severity", "description") VALUES
('downtimeHours', NULL, 0, 1, 'hours', 'info', 'Minimal downtime - excellent uptime'),
('downtimeHours', NULL, 1, 8, 'hours', 'warning', 'Moderate downtime - investigate causes'),
('downtimeHours', NULL, 8, NULL, 'hours', 'critical', 'Significant downtime - immediate attention required');