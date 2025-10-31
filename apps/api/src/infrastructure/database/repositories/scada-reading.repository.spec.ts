import { Test, TestingModule } from '@nestjs/testing';
import { ScadaReadingRepository } from './scada-reading.repository';
import { TenantDatabaseService } from '../tenant-database.service';
import { ScadaReading } from '../../../domain/scada/scada-reading.entity';

describe('ScadaReadingRepository', () => {
  let repository: ScadaReadingRepository;
  let mockTenantDb: jest.Mocked<TenantDatabaseService>;
  let mockDb: any;

  const mockTenantId = 'tenant-123';
  const mockWellId = 'well-456';
  const mockConnectionId = 'connection-789';

  beforeEach(async () => {
    // Mock database operations
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockResolvedValue([]), // Return promise
      orderBy: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    mockTenantDb = {
      getTenantDatabase: jest.fn().mockResolvedValue(mockDb),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScadaReadingRepository,
        {
          provide: TenantDatabaseService,
          useValue: mockTenantDb,
        },
      ],
    }).compile();

    repository = module.get<ScadaReadingRepository>(ScadaReadingRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new SCADA reading', async () => {
      const reading = ScadaReading.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        value: 150.5,
        unit: 'psi',
      });

      await repository.create(reading);

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(mockTenantId);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          value: 150.5,
        }),
      );
    });
  });

  describe('createBatch', () => {
    it('should create multiple SCADA readings in batch', async () => {
      const readings = [
        ScadaReading.create({
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          value: 150.5,
        }),
        ScadaReading.create({
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'temperature',
          value: 75.2,
        }),
      ];

      await repository.createBatch(readings);

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(mockTenantId);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ tagName: 'pressure' }),
          expect.objectContaining({ tagName: 'temperature' }),
        ]),
      );
    });

    it('should handle empty batch gracefully', async () => {
      await repository.createBatch([]);

      expect(mockTenantDb.getTenantDatabase).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a reading by ID', async () => {
      const mockRow = {
        id: 'reading-123',
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        value: 150.5,
        dataType: 'number',
        quality: 'GOOD',
        timestamp: new Date(),
        unit: 'psi',
        minValue: 100,
        maxValue: 200,
        metadata: {},
      };

      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById(mockTenantId, 'reading-123');

      expect(result).toBeInstanceOf(ScadaReading);
      expect(result?.id).toBe('reading-123');
      expect(result?.tagName).toBe('pressure');
    });

    it('should return null when reading not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById(mockTenantId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findWithFilters', () => {
    it('should find readings with filters', async () => {
      const mockRows = [
        {
          id: 'reading-1',
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          value: 150.5,
          dataType: 'number',
          quality: 'GOOD',
          timestamp: new Date(),
          unit: 'psi',
          minValue: null,
          maxValue: null,
          metadata: null,
        },
      ];

      mockDb.offset.mockResolvedValue(mockRows);

      const result = await repository.findWithFilters(mockTenantId, {
        wellId: mockWellId,
        tagName: 'pressure',
        limit: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ScadaReading);
    });

    it('should apply time range filters', async () => {
      const startTime = new Date('2025-01-01');
      const endTime = new Date('2025-01-31');

      mockDb.offset.mockResolvedValue([]);

      await repository.findWithFilters(mockTenantId, {
        startTime,
        endTime,
      });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findLatestByTag', () => {
    it('should find the latest reading for a tag', async () => {
      const mockRow = {
        id: 'reading-latest',
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        value: 155.0,
        dataType: 'number',
        quality: 'GOOD',
        timestamp: new Date(),
        unit: 'psi',
        minValue: null,
        maxValue: null,
        metadata: null,
      };

      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findLatestByTag(
        mockTenantId,
        mockConnectionId,
        'pressure',
      );

      expect(result).toBeInstanceOf(ScadaReading);
      expect(result?.tagName).toBe('pressure');
    });

    it('should return null when no readings found for tag', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findLatestByTag(
        mockTenantId,
        mockConnectionId,
        'nonexistent-tag',
      );

      expect(result).toBeNull();
    });
  });

  describe('findByWellIdAndTimeRange', () => {
    it('should find readings within time range for a well', async () => {
      const startTime = new Date('2025-01-01');
      const endTime = new Date('2025-01-31');

      const mockRows = [
        {
          id: 'reading-1',
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          value: 150.5,
          dataType: 'number',
          quality: 'GOOD',
          timestamp: new Date('2025-01-15'),
          unit: 'psi',
          minValue: null,
          maxValue: null,
          metadata: null,
        },
      ];

      mockDb.limit.mockResolvedValue(mockRows);

      const result = await repository.findByWellIdAndTimeRange(
        mockTenantId,
        mockWellId,
        startTime,
        endTime,
        100,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ScadaReading);
    });
  });

  describe('countByConnectionId', () => {
    it('should count readings for a connection', async () => {
      mockDb.where.mockResolvedValue([{ count: 42 }]);

      const result = await repository.countByConnectionId(
        mockTenantId,
        mockConnectionId,
      );

      expect(result).toBe(42);
    });

    it('should return 0 when no readings found', async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repository.countByConnectionId(
        mockTenantId,
        mockConnectionId,
      );

      expect(result).toBe(0);
    });
  });

  describe('deleteOlderThan', () => {
    it('should throw error (not yet implemented)', async () => {
      const cutoffDate = new Date();

      await expect(repository.deleteOlderThan(cutoffDate)).rejects.toThrow(
        'deleteOlderThan not yet implemented',
      );
    });
  });

  describe('domain mapping', () => {
    it('should correctly map domain entity to database row', async () => {
      const reading = ScadaReading.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        value: 150.5,
        unit: 'psi',
        minValue: 100,
        maxValue: 200,
      });

      await repository.create(reading);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          value: 150.5,
          dataType: 'number',
          quality: 'GOOD',
          unit: 'psi',
          minValue: 100,
          maxValue: 200,
        }),
      );
    });

    it('should handle string values', async () => {
      const reading = ScadaReading.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'status',
        value: 'running',
      });

      await repository.create(reading);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'running',
          dataType: 'string',
        }),
      );
    });

    it('should handle boolean values', async () => {
      const reading = ScadaReading.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pump_active',
        value: true,
      });

      await repository.create(reading);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          value: true,
          dataType: 'boolean',
        }),
      );
    });
  });
});
