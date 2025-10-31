/**
 * Commodity Pricing Controller
 *
 * REST API endpoints for commodity price data from EIA.
 * Provides latest prices and historical data for revenue calculations.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetHistoricalPricesDto } from './dto/get-historical-prices.dto';
import {
  GetLatestPricesQuery,
  GetLatestPricesResult,
} from '../../application/commodity-pricing/queries/get-latest-prices.query';
import {
  GetHistoricalPricesQuery,
  GetHistoricalPricesResult,
} from '../../application/commodity-pricing/queries/get-historical-prices.query';
import {
  SyncPricesFromEiaCommand,
  SyncPricesResult,
} from '../../application/commodity-pricing/commands/sync-prices-from-eia.command';

@ApiTags('commodity-pricing')
@ApiBearerAuth('access-token')
@Controller('commodity-pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommodityPricingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Get Latest Prices
   * GET /commodity-pricing/latest
   *
   * Retrieves the most recent commodity prices.
   * All authenticated users can view prices.
   */
  @Get('latest')
  @ApiOperation({
    summary: 'Get latest commodity prices',
    description:
      'Retrieve the most recent commodity prices from EIA for revenue calculations and dashboards',
  })
  @ApiQuery({
    name: 'commodityTypes',
    required: false,
    description:
      'Comma-separated list of commodity types (WTI_CRUDE, BRENT_CRUDE, HENRY_HUB_GAS, etc.)',
    example: 'WTI_CRUDE,HENRY_HUB_GAS',
  })
  @ApiResponse({
    status: 200,
    description: 'Latest prices retrieved successfully',
  })
  async getLatestPrices(
    @Query('commodityTypes') commodityTypesParam?: string,
  ): Promise<GetLatestPricesResult> {
    const commodityTypes = commodityTypesParam
      ? commodityTypesParam.split(',').map((t) => t.trim())
      : undefined;

    const query = new GetLatestPricesQuery(commodityTypes);

    return this.queryBus.execute<GetLatestPricesQuery, GetLatestPricesResult>(
      query,
    );
  }

  /**
   * Get Historical Prices
   * GET /commodity-pricing/historical
   *
   * Retrieves commodity price history for charts and analysis.
   * All authenticated users can view historical data.
   */
  @Get('historical')
  @ApiOperation({
    summary: 'Get historical commodity prices',
    description:
      'Retrieve historical commodity prices for trend analysis and charting',
  })
  @ApiResponse({
    status: 200,
    description: 'Historical prices retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range or commodity type',
  })
  async getHistoricalPrices(
    @Query() dto: GetHistoricalPricesDto,
  ): Promise<GetHistoricalPricesResult> {
    const query = new GetHistoricalPricesQuery(
      dto.commodityType,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );

    return this.queryBus.execute<
      GetHistoricalPricesQuery,
      GetHistoricalPricesResult
    >(query);
  }

  /**
   * Sync Prices from EIA
   * POST /commodity-pricing/sync
   *
   * Manually trigger sync of commodity prices from EIA API.
   * Only Admin and Manager roles can trigger sync.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Sync prices from EIA API',
    description:
      'Manually trigger synchronization of commodity prices from EIA API (typically runs via cron)',
  })
  @ApiQuery({
    name: 'commodityTypes',
    required: false,
    description:
      'Comma-separated list of commodity types to sync (defaults to all)',
    example: 'WTI_CRUDE,HENRY_HUB_GAS',
  })
  @ApiQuery({
    name: 'daysToFetch',
    required: false,
    description: 'Number of days of historical data to fetch (default: 7)',
    example: 7,
  })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
  })
  @ApiResponse({ status: 500, description: 'EIA API sync failed' })
  async syncPrices(
    @Query('commodityTypes') commodityTypesParam?: string,
    @Query('daysToFetch') daysToFetch?: string,
  ): Promise<SyncPricesResult> {
    const commodityTypes = commodityTypesParam
      ? commodityTypesParam.split(',').map((t) => t.trim())
      : undefined;

    const days = daysToFetch ? parseInt(daysToFetch, 10) : 7;

    const command = new SyncPricesFromEiaCommand(commodityTypes, days);

    return this.commandBus.execute<SyncPricesFromEiaCommand, SyncPricesResult>(
      command,
    );
  }
}
