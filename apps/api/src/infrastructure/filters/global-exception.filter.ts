/**
 * Global Exception Filter
 *
 * Catches all unhandled exceptions and formats them into consistent error responses.
 * Provides correlation IDs, structured logging, and security by preventing stack trace leakage.
 *
 * Features:
 * - Standardized error response format
 * - Correlation ID generation for request tracing
 * - Different error detail levels for development vs production
 * - Structured logging with Winston
 * - Security: No stack traces in production
 * - HTTP status code mapping for common exceptions
 *
 * Error Response Format:
 * {
 *   statusCode: number,
 *   message: string | string[],
 *   error: string,
 *   correlationId: string,
 *   timestamp: string,
 *   path: string,
 *   method: string,
 *   details?: any (only in development)
 * }
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

/**
 * Standardized error response structure
 */
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  correlationId: string;
  timestamp: string;
  path: string;
  method: string;
  details?: unknown;
}

/**
 * Global exception filter that catches all exceptions
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * Check if we're in development mode (dynamically checks NODE_ENV)
   * This is a getter so tests can change NODE_ENV and it will reflect immediately
   */
  private get isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate correlation ID for request tracing
    const correlationId = this.getOrGenerateCorrelationId(request);

    // Determine HTTP status code
    const status = this.getHttpStatus(exception);

    // Build error response
    const errorResponse = this.buildErrorResponse(
      exception,
      status,
      request,
      correlationId,
    );

    // Log the error with context
    this.logError(exception, errorResponse, request);

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Get correlation ID from request or generate a new one
   */
  private getOrGenerateCorrelationId(request: Request): string {
    // Check if correlation ID was provided by client (for distributed tracing)
    const existingId = request.headers['x-correlation-id'] as string;
    if (existingId) {
      return existingId;
    }

    // Generate new correlation ID (8 random bytes = 16 hex chars)
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Determine HTTP status code from exception
   */
  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Map common error types to status codes
    if (exception instanceof Error) {
      // Database errors
      if (exception.message.includes('unique constraint')) {
        return HttpStatus.CONFLICT;
      }
      if (exception.message.includes('foreign key constraint')) {
        return HttpStatus.BAD_REQUEST;
      }
      if (exception.message.includes('not found')) {
        return HttpStatus.NOT_FOUND;
      }

      // Validation errors
      if (exception.message.includes('validation')) {
        return HttpStatus.BAD_REQUEST;
      }

      // Authentication errors
      if (exception.message.includes('unauthorized')) {
        return HttpStatus.UNAUTHORIZED;
      }
      if (exception.message.includes('forbidden')) {
        return HttpStatus.FORBIDDEN;
      }
    }

    // Default to internal server error
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Build standardized error response
   */
  private buildErrorResponse(
    exception: unknown,
    status: number,
    request: Request,
    correlationId: string,
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    // Extract error message and details
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let details: unknown;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name; // Use exception name for error type
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (responseObj.message as string | string[]) || exception.message;
        error = (responseObj.error as string) || exception.name;

        // Include validation errors in development
        if (this.isDevelopment && responseObj.details) {
          details = responseObj.details;
        }
      }
    } else if (exception instanceof Error) {
      message = this.sanitizeErrorMessage(exception.message);
      error = exception.name || 'Error';

      // Include stack trace in development only
      if (this.isDevelopment) {
        details = {
          stack: exception.stack,
          cause: exception.cause,
        };
      }
    } else {
      message = 'An unexpected error occurred';
      if (this.isDevelopment) {
        details = exception;
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      correlationId,
      timestamp,
      path,
      method,
    };

    // Only include details in development
    if (this.isDevelopment && details) {
      errorResponse.details = details;
    }

    return errorResponse;
  }

  /**
   * Sanitize error messages to prevent information leakage
   */
  private sanitizeErrorMessage(message: string): string {
    // In production, sanitize potentially sensitive information
    if (!this.isDevelopment) {
      // Remove database connection strings
      message = message.replace(/postgresql:\/\/[^\s]+/g, '[DATABASE_URL]');
      message = message.replace(/mysql:\/\/[^\s]+/g, '[DATABASE_URL]');

      // Remove file paths
      message = message.replace(/\/[\w\/.-]+\.(ts|js|json)/g, '[FILE_PATH]');

      // Remove IP addresses
      message = message.replace(
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
        '[IP_ADDRESS]',
      );
    }

    return message;
  }

  /**
   * Log error with structured context
   */
  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request: Request,
  ): void {
    const logContext = {
      correlationId: errorResponse.correlationId,
      statusCode: errorResponse.statusCode,
      method: errorResponse.method,
      path: errorResponse.path,
      userId: (request as any).user?.id,
      tenantId: (request as any).tenant?.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    // Log level based on status code
    if (errorResponse.statusCode >= 500) {
      // Server errors - log as error
      this.logger.error(
        `${errorResponse.error}: ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : undefined,
        logContext,
      );
    } else if (errorResponse.statusCode >= 400) {
      // Client errors - log as warning
      this.logger.warn(
        `${errorResponse.error}: ${errorResponse.message}`,
        logContext,
      );
    } else {
      // Other status codes - log as log
      this.logger.log(
        `${errorResponse.error}: ${errorResponse.message}`,
        logContext,
      );
    }
  }
}
