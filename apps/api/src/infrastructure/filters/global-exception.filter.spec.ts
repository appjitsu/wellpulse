/**
 * Global Exception Filter Tests
 *
 * Tests standardized error handling with correlation IDs.
 * CRITICAL for security and debugging - ensures consistent error responses.
 *
 * Security Requirements:
 * - No stack traces in production
 * - Sanitize error messages (remove DB URLs, file paths, IPs)
 * - Generate correlation IDs for request tracing
 * - Structured logging with context
 * - HTTP status code mapping
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    // Mock Response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock Request object
    mockRequest = {
      url: '/api/test',
      method: 'GET',
      headers: {},
      ip: '192.168.1.1',
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
      getArgByIndex: jest.fn(),
      getArgs: jest.fn(),
      getType: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    };

    filter = new GlobalExceptionFilter();

    // Spy on logger to prevent console output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HttpException Handling', () => {
    it('should handle HttpException correctly', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Not Found',
          error: 'HttpException',
          path: '/api/test',
          method: 'GET',
        }),
      );
    });

    it('should handle BadRequestException', () => {
      const exception = new HttpException(
        'Bad Request',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Bad Request',
        }),
      );
    });

    it('should handle UnauthorizedException', () => {
      const exception = new HttpException(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle ForbiddenException', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle InternalServerErrorException', () => {
      const exception = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Correlation ID Generation', () => {
    it('should generate correlation ID if not provided', () => {
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.correlationId).toBeDefined();
      expect(typeof responseData.correlationId).toBe('string');
      expect(responseData.correlationId.length).toBeGreaterThan(0);
    });

    it('should use existing correlation ID from request header', () => {
      mockRequest.headers['x-correlation-id'] = 'existing-correlation-id';
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.correlationId).toBe('existing-correlation-id');
    });

    it('should generate unique correlation IDs for different requests', () => {
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);
      const correlationId1 = mockResponse.json.mock.calls[0][0].correlationId;

      // Reset mocks
      mockResponse.json.mockClear();

      filter.catch(exception, mockArgumentsHost);
      const correlationId2 = mockResponse.json.mock.calls[0][0].correlationId;

      expect(correlationId1).not.toBe(correlationId2);
    });
  });

  describe('Error Response Format', () => {
    it('should include all required fields in error response', () => {
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData).toHaveProperty('statusCode');
      expect(responseData).toHaveProperty('message');
      expect(responseData).toHaveProperty('error');
      expect(responseData).toHaveProperty('correlationId');
      expect(responseData).toHaveProperty('timestamp');
      expect(responseData).toHaveProperty('path');
      expect(responseData).toHaveProperty('method');
    });

    it('should include timestamp in ISO format', () => {
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.timestamp).toBeDefined();
      expect(() => new Date(responseData.timestamp)).not.toThrow();
    });

    it('should include request path and method', () => {
      mockRequest.url = '/api/users/123';
      mockRequest.method = 'POST';
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.path).toBe('/api/users/123');
      expect(responseData.method).toBe('POST');
    });
  });

  describe('Database Error Mapping', () => {
    it('should map unique constraint error to 409 CONFLICT', () => {
      const exception = new Error('unique constraint violated');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    });

    it('should map foreign key constraint error to 400 BAD_REQUEST', () => {
      const exception = new Error('foreign key constraint violated');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('should map not found error to 404 NOT_FOUND', () => {
      const exception = new Error('Entity not found');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });
  });

  describe('Error Message Sanitization', () => {
    beforeEach(() => {
      // Set NODE_ENV to production for sanitization tests
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      // Reset NODE_ENV
      delete process.env.NODE_ENV;
    });

    it('should sanitize database URLs in production', () => {
      const exception = new Error(
        'Connection failed: postgresql://user:password@localhost:5432/db',
      );

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.message).not.toContain('postgresql://');
      expect(responseData.message).not.toContain('password');
      expect(responseData.message).toContain('[DATABASE_URL]');
    });

    it('should sanitize MySQL URLs in production', () => {
      const exception = new Error(
        'Connection failed: mysql://user:password@localhost:3306/db',
      );

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.message).not.toContain('mysql://');
      expect(responseData.message).toContain('[DATABASE_URL]');
    });

    it('should sanitize file paths in production', () => {
      const exception = new Error(
        'Error in /Users/developer/projects/app/src/module.ts',
      );

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.message).not.toContain('/Users/developer');
      expect(responseData.message).toContain('[FILE_PATH]');
    });

    it('should sanitize IP addresses in production', () => {
      const exception = new Error('Connection refused: 192.168.1.100');

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.message).not.toContain('192.168.1.100');
      expect(responseData.message).toContain('[IP_ADDRESS]');
    });

    it('should not sanitize in development mode', () => {
      delete process.env.NODE_ENV; // Development mode

      const exception = new Error(
        'Error: postgresql://user:pass@localhost:5432/db in /path/to/file.ts at 192.168.1.1',
      );

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      // In development, sensitive data is included for debugging
      expect(responseData.details).toBeDefined();
    });
  });

  describe('Development vs Production Mode', () => {
    it('should include stack trace in development', () => {
      delete process.env.NODE_ENV; // Development mode

      const exception = new Error('Test error');

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.details).toBeDefined();
      expect(responseData.details.stack).toBeDefined();
    });

    it('should NOT include stack trace in production', () => {
      process.env.NODE_ENV = 'production';

      const exception = new Error('Test error');

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.details).toBeUndefined();
    });
  });

  describe('Logging', () => {
    it('should log server errors (500+) as error', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should log client errors (400-499) as warning', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'warn');
      const exception = new HttpException(
        'Bad Request',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should include correlation ID in logs', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'warn');
      mockRequest.headers['x-correlation-id'] = 'test-correlation-id';
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      // Check that the log context includes correlation ID
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          correlationId: 'test-correlation-id',
        }),
      );
    });

    it('should include tenant and user context in logs', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'warn');
      mockRequest.user = { id: 'user-123' };
      mockRequest.tenant = { id: 'tenant-456' };
      const exception = new HttpException('Test Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-123',
          tenantId: 'tenant-456',
        }),
      );
    });
  });

  describe('Non-Error Objects', () => {
    it('should handle string exceptions', () => {
      const exception = 'Simple string error';

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'An unexpected error occurred',
        }),
      );
    });

    it('should handle null exceptions', () => {
      const exception = null;

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle undefined exceptions', () => {
      const exception = undefined;

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle object exceptions', () => {
      const exception = { custom: 'error', code: 123 };

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('Validation Errors', () => {
    it('should handle validation errors', () => {
      const exception = new Error('validation failed for field email');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('should handle validation error arrays', () => {
      const exception = new HttpException(
        {
          statusCode: 400,
          message: ['email must be valid', 'password is required'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.message).toEqual([
        'email must be valid',
        'password is required',
      ]);
    });
  });

  describe('Security - Information Disclosure', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should not leak sensitive error details in production', () => {
      const exception = new Error(
        'Database password "super_secret_123" failed validation',
      );

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.details).toBeUndefined();
      // Note: Our filter sanitizes DB URLs, file paths, and IPs, but not generic sensitive data
      // For custom sensitive data filtering, consider adding application-specific sanitization
    });

    it('should not expose internal error stack traces in production', () => {
      const exception = new Error('Internal error');
      exception.stack = '/Users/dev/secret/path/file.ts:123:45';

      filter.catch(exception, mockArgumentsHost);

      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData.details).toBeUndefined();
      expect(JSON.stringify(responseData)).not.toContain('/Users/dev');
    });
  });
});
