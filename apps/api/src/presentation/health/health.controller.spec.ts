import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    const mockHealthService = {
      check: jest.fn().mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'wellpulse-api',
        version: '1.0.0',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);

    // Mock Express Response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health status with 200 status code', async function () {
      const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'wellpulse-api',
        version: '1.0.0',
      };

      (healthService.check as jest.Mock).mockResolvedValue(healthCheck);

      await controller.check(mockResponse as Response);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(healthService.check).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(healthCheck);
    });

    it('should return 503 status code when unhealthy', async () => {
      const healthCheck = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'wellpulse-api',
        version: '1.0.0',
      };

      (healthService.check as jest.Mock).mockResolvedValue(healthCheck);

      await controller.check(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(healthCheck);
    });
  });
});
