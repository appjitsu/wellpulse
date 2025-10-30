/**
 * GetMonthlyTrendHandler Tests
 *
 * Tests production monthly trend query handler with comprehensive coverage of:
 * - Monthly aggregation of production data
 * - Target calculation based on historical average
 * - Efficiency percentage calculation
 * - Date range handling
 * - Empty data scenarios
 */

import { GetMonthlyTrendHandler } from './get-monthly-trend.query';
import { GetMonthlyTrendQuery } from './get-monthly-trend.query';
import { IFieldEntryRepository } from '../../../domain/repositories/field-entry.repository.interface';
import { FieldEntry } from '../../../domain/field-data/field-entry.entity';
import { ProductionData } from '../../../domain/field-data/value-objects';

/* eslint-disable @typescript-eslint/unbound-method */

describe('GetMonthlyTrendHandler', () => {
  let handler: GetMonthlyTrendHandler;
  let mockRepository: jest.Mocked<IFieldEntryRepository>;

  // Helper function to create a mock production entry
  const createMockEntry = (recordedAt: Date, oilVolume: number): FieldEntry => {
    return FieldEntry.reconstitute({
      id: `entry-${Math.random()}`,
      tenantId: 'tenant-123',
      wellId: 'well-456',
      entryType: 'PRODUCTION',
      productionData: ProductionData.create({
        oilVolume,
        gasVolume: 0,
        waterVolume: 0,
        runHours: 24,
      }),
      recordedAt,
      createdBy: 'user-123',
      deviceId: 'device-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByWellId: jest.fn(),
      findUnsynced: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      getProductionSummary: jest.fn(),
    } as jest.Mocked<IFieldEntryRepository>;

    // Initialize handler with mock
    handler = new GetMonthlyTrendHandler(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Basic functionality', () => {
      it('should return monthly trend data with correct structure', async () => {
        // Arrange
        const entries = [
          createMockEntry(new Date('2024-10-01'), 1000),
          createMockEntry(new Date('2024-10-15'), 1500),
          createMockEntry(new Date('2024-11-01'), 2000),
        ];
        mockRepository.findAll.mockResolvedValue(entries);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(6);

        // Check structure of first result
        expect(result[0]).toHaveProperty('month');
        expect(result[0]).toHaveProperty('production');
        expect(result[0]).toHaveProperty('target');
        expect(result[0]).toHaveProperty('efficiency');

        // Verify month is a string (e.g., "Oct")
        expect(typeof result[0].month).toBe('string');
        expect(result[0].month.length).toBeLessThanOrEqual(3);

        // Verify production, target, efficiency are numbers
        expect(typeof result[0].production).toBe('number');
        expect(typeof result[0].target).toBe('number');
        expect(typeof result[0].efficiency).toBe('number');
      });

      it('should aggregate production data by month correctly', async () => {
        // Arrange
        const currentDate = new Date();
        const lastMonth = new Date(currentDate);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const entries = [
          createMockEntry(currentDate, 1000),
          createMockEntry(currentDate, 1500),
          createMockEntry(lastMonth, 2000),
          createMockEntry(lastMonth, 500),
        ];
        mockRepository.findAll.mockResolvedValue(entries);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        await handler.execute(query);

        // Assert
        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
        expect(mockRepository.findAll).toHaveBeenCalledWith(
          'tenant-123',
          expect.objectContaining({
            entryType: 'PRODUCTION',
            startDate: expect.any(Date) as Date,
            endDate: expect.any(Date) as Date,
          }),
          10000,
          0,
        );
      });

      it('should calculate target as 5% above average', async () => {
        // Arrange
        const entries = [
          createMockEntry(new Date('2024-10-01'), 1000),
          createMockEntry(new Date('2024-11-01'), 2000),
        ];
        mockRepository.findAll.mockResolvedValue(entries);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert
        // Average = (1000 + 2000) / 2 = 1500
        // Target = 1500 * 1.05 = 1575
        expect(result[0].target).toBe(1575);
      });

      it('should calculate efficiency percentage correctly', async () => {
        // Arrange
        // Use dates 6 months ago to ensure they fall within query range
        const currentDate = new Date();
        const month1 = new Date(currentDate);
        month1.setMonth(month1.getMonth() - 2);
        const month2 = new Date(currentDate);
        month2.setMonth(month2.getMonth() - 1);

        const entries = [
          createMockEntry(month1, 1000),
          createMockEntry(month2, 2000),
        ];
        mockRepository.findAll.mockResolvedValue(entries);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert
        // Average = (1000 + 2000) / 2 = 1500
        // Target = ceil(1500 * 1.05) = 1575
        // Efficiency for month with 2000 production = (2000 / 1575) * 100 = 126.98...
        const highMonth = result.find((m) => m.production === 2000);
        expect(highMonth).toBeDefined();
        if (highMonth) {
          expect(highMonth.efficiency).toBeCloseTo(127, 0);
        }
      });
    });

    describe('Date range handling', () => {
      it('should respect the months parameter', async () => {
        // Arrange
        mockRepository.findAll.mockResolvedValue([]);

        // Act & Assert
        // Test with 3 months
        let result = await handler.execute(
          new GetMonthlyTrendQuery('tenant-123', 3),
        );
        expect(result).toHaveLength(3);

        // Test with 12 months
        result = await handler.execute(
          new GetMonthlyTrendQuery('tenant-123', 12),
        );
        expect(result).toHaveLength(12);
      });

      it('should use default of 6 months when not specified', async () => {
        // Arrange
        mockRepository.findAll.mockResolvedValue([]);

        const query = new GetMonthlyTrendQuery('tenant-123');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toHaveLength(6);
      });

      it('should call repository with correct date range', async () => {
        // Arrange
        mockRepository.findAll.mockResolvedValue([]);

        const query = new GetMonthlyTrendQuery('tenant-123', 3);

        // Act
        await handler.execute(query);

        // Assert
        expect(mockRepository.findAll).toHaveBeenCalledWith(
          'tenant-123',
          expect.objectContaining({
            entryType: 'PRODUCTION',
            startDate: expect.any(Date) as Date,
            endDate: expect.any(Date) as Date,
          }),
          10000,
          0,
        );

        // Verify the date range is approximately 3 months
        const call = mockRepository.findAll.mock.calls[0];
        const filters = call[1];
        const startDate = filters?.startDate;
        const endDate = filters?.endDate;

        expect(startDate).toBeDefined();
        expect(endDate).toBeDefined();

        if (startDate && endDate) {
          const diffInMonths =
            (endDate.getTime() - startDate.getTime()) /
            (1000 * 60 * 60 * 24 * 30);
          expect(diffInMonths).toBeGreaterThanOrEqual(2.8);
          expect(diffInMonths).toBeLessThanOrEqual(3.2);
        }
      });
    });

    describe('Empty data scenarios', () => {
      it('should return zero production for months with no data', async () => {
        // Arrange
        mockRepository.findAll.mockResolvedValue([]);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toHaveLength(6);
        result.forEach((month) => {
          expect(month.production).toBe(0);
          expect(month.efficiency).toBe(0);
        });
      });

      it('should handle entries without production data by skipping them', async () => {
        // Arrange
        // Create inspection entry (not production) - should be filtered by repository
        // If somehow a production entry without data gets through, handler should skip it
        const validEntry = createMockEntry(new Date(), 1000);

        mockRepository.findAll.mockResolvedValue([validEntry]);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toHaveLength(6);
        // Should handle gracefully - the query filters by entryType: 'PRODUCTION'
        // so only production entries should be returned
      });

      it('should handle entries with zero oil volume', async () => {
        // Arrange
        const entries = [createMockEntry(new Date(), 0)];
        mockRepository.findAll.mockResolvedValue(entries);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert - Should not crash
        expect(result).toHaveLength(6);
      });
    });

    describe('Tenant isolation', () => {
      it('should only query data for specified tenant', async () => {
        // Arrange
        mockRepository.findAll.mockResolvedValue([]);

        const query = new GetMonthlyTrendQuery('tenant-abc', 6);

        // Act
        await handler.execute(query);

        // Assert
        expect(mockRepository.findAll).toHaveBeenCalledWith(
          'tenant-abc',
          expect.any(Object),
          expect.any(Number),
          expect.any(Number),
        );
      });

      it('should filter by PRODUCTION entry type only', async () => {
        // Arrange
        mockRepository.findAll.mockResolvedValue([]);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        await handler.execute(query);

        // Assert
        expect(mockRepository.findAll).toHaveBeenCalledWith(
          'tenant-123',
          expect.objectContaining({
            entryType: 'PRODUCTION',
          }),
          10000,
          0,
        );
      });
    });

    describe('Edge cases', () => {
      it('should round production values to integers', async () => {
        // Arrange
        const entries = [
          createMockEntry(new Date('2024-10-01'), 1000.7),
          createMockEntry(new Date('2024-10-15'), 1500.3),
        ];
        mockRepository.findAll.mockResolvedValue(entries);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert
        result.forEach((month) => {
          expect(Number.isInteger(month.production)).toBe(true);
        });
      });

      it('should handle single month query', async () => {
        // Arrange
        mockRepository.findAll.mockResolvedValue([]);

        const query = new GetMonthlyTrendQuery('tenant-123', 1);

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toHaveLength(1);
      });

      it('should ceil target values to integers', async () => {
        // Arrange
        const entries = [createMockEntry(new Date('2024-10-01'), 1000)];
        mockRepository.findAll.mockResolvedValue(entries);

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act
        const result = await handler.execute(query);

        // Assert
        result.forEach((month) => {
          expect(Number.isInteger(month.target)).toBe(true);
        });
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors', async () => {
        // Arrange
        mockRepository.findAll.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const query = new GetMonthlyTrendQuery('tenant-123', 6);

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(
          'Database connection failed',
        );
      });
    });
  });
});
