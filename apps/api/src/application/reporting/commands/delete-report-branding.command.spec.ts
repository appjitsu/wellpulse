/**
 * DeleteReportBranding Command Handler Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  DeleteReportBrandingCommand,
  DeleteReportBrandingHandler,
} from './delete-report-branding.command';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';

describe('DeleteReportBrandingHandler', () => {
  let handler: DeleteReportBrandingHandler;
  let mockRepository: jest.Mocked<IReportBrandingRepository>;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    // Create mock repository
    mockRepository = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
      deleteByTenantId: jest.fn(),
      exists: jest.fn(),
    };

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteReportBrandingHandler,
        {
          provide: 'IReportBrandingRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<DeleteReportBrandingHandler>(
      DeleteReportBrandingHandler,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should delete branding configuration', async () => {
      // Arrange
      mockRepository.exists.mockResolvedValue(true);
      mockRepository.deleteByTenantId.mockResolvedValue(undefined);

      const command = new DeleteReportBrandingCommand(TENANT_ID);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.exists).toHaveBeenCalledWith(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.deleteByTenantId).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should throw NotFoundException when branding does not exist', async () => {
      // Arrange: No existing branding
      mockRepository.exists.mockResolvedValue(false);

      const command = new DeleteReportBrandingCommand(TENANT_ID);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow(
        'No branding configuration found for tenant',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.deleteByTenantId).not.toHaveBeenCalled();
    });

    it('should propagate repository errors from exists check', async () => {
      // Arrange: Repository exists error
      mockRepository.exists.mockRejectedValue(
        new Error('Database query failed'),
      );

      const command = new DeleteReportBrandingCommand(TENANT_ID);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Database query failed',
      );
    });

    it('should propagate repository errors from delete', async () => {
      // Arrange
      mockRepository.exists.mockResolvedValue(true);
      mockRepository.deleteByTenantId.mockRejectedValue(
        new Error('Database delete failed'),
      );

      const command = new DeleteReportBrandingCommand(TENANT_ID);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Database delete failed',
      );
    });

    it('should hard delete from database (not soft delete)', async () => {
      // Arrange: This is a hard delete operation (no deletedAt field)
      mockRepository.exists.mockResolvedValue(true);
      mockRepository.deleteByTenantId.mockResolvedValue(undefined);

      const command = new DeleteReportBrandingCommand(TENANT_ID);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      // Verify we called deleteByTenantId (hard delete) not save (soft delete)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.deleteByTenantId).toHaveBeenCalledWith(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });
});
