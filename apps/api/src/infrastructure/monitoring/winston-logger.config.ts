/**
 * Winston Logger Configuration
 *
 * Provides structured logging with multiple transports:
 * - Console transport: Local development (colorized, human-readable)
 * - Application Insights transport: Production (structured JSON, sent to Azure)
 *
 * Log Levels:
 * - error: 0 - Error events that might still allow the app to continue
 * - warn: 1 - Warning events
 * - info: 2 - Informational messages (default for production)
 * - debug: 3 - Debug messages (verbose, for development)
 *
 * Features:
 * - Correlation IDs for request tracing
 * - Structured metadata (tenant, user, context)
 * - JSON format for production
 * - Colorized format for development
 * - Automatic Application Insights integration
 */

import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import Transport from 'winston-transport';
import * as appInsights from 'applicationinsights';

/**
 * Log Info type for Winston
 */
interface LogInfo {
  level: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Application Insights Transport for Winston
 * Sends log messages to Azure Application Insights
 */
class ApplicationInsightsTransport extends Transport {
  private client: appInsights.TelemetryClient | null;

  constructor(opts?: winston.transport.TransportStreamOptions) {
    super(opts);

    // Get the Application Insights client (must be initialized before this)
    this.client = appInsights.defaultClient;

    if (!this.client) {
      console.warn(
        'Application Insights client not initialized - logs will not be sent to Azure',
      );
    }
  }

  log(info: LogInfo, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (!this.client) {
      return callback();
    }

    // Extract message and metadata
    const message = info.message;
    const properties = {
      level: info.level,
      timestamp: info.timestamp,
      ...(info.metadata || {}),
    };

    // Track as trace in Application Insights
    this.client.trackTrace({
      message,
      properties,
    });

    // If it's an error, also track as exception
    if (info.level === 'error' && info.stack) {
      const error = new Error(message);
      error.stack = info.stack;

      this.client.trackException({
        exception: error,
        properties,
      });
    }

    callback();
  }
}

/**
 * Create a Winston logger instance
 * @param connectionString Optional Application Insights connection string
 * @param logLevel Log level (default: 'info')
 */
export function createWinstonLogger(
  connectionString?: string,
  logLevel = 'info',
): winston.Logger {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Define log format
  const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Include stack traces
    winston.format.splat(), // String interpolation
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'label'],
    }),
  );

  // Console format (human-readable for development)
  const consoleFormat = winston.format.combine(
    customFormat,
    winston.format.colorize({ all: true }),

    winston.format.printf((info: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { timestamp, level, message, metadata } = info;
      const metaString =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        metadata && Object.keys(metadata).length > 0
          ? `\n${JSON.stringify(metadata, null, 2)}`
          : '';
      return `${timestamp} [${level}]: ${message}${metaString}`;
    }),
  );

  // JSON format (structured for production)
  const jsonFormat = winston.format.combine(
    customFormat,
    winston.format.json(),
  );

  // Build transports array
  const transports: winston.transport[] = [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: isDevelopment ? consoleFormat : jsonFormat,
      level: logLevel,
    }),
  ];

  // Add Application Insights transport for production
  if (isProduction && connectionString) {
    try {
      const aiTransport = new ApplicationInsightsTransport({
        level: logLevel,
      });
      transports.push(aiTransport);
    } catch (error) {
      console.error(
        'Failed to initialize Application Insights transport:',
        error,
      );
    }
  }

  return winston.createLogger({
    level: logLevel,
    transports,
    exitOnError: false, // Don't exit on uncaught errors
  });
}

/**
 * NestJS-compatible Logger Service using Winston
 * Implements the LoggerService interface from @nestjs/common
 */
export class WinstonLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private context?: string;

  constructor(logger: winston.Logger, context?: string) {
    this.logger = logger;
    this.context = context;
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, {
      context: context || this.context,
      stack: trace,
    });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string): void {
    this.logger.debug(message, { context: context || this.context });
  }
}
