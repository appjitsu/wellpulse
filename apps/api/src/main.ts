import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as appInsights from 'applicationinsights';
import { AppModule } from './app.module';
import {
  createWinstonLogger,
  WinstonLoggerService,
} from './infrastructure/monitoring/winston-logger.config';

/**
 * Extended Express Request with correlation ID
 */
interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

async function bootstrap() {
  // Initialize Application Insights early (before app creation)
  // This ensures all telemetry is captured from the start
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (connectionString) {
    appInsights
      .setup(connectionString)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(true)
      .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
      .start();

    console.log('✅ Application Insights initialized');
  } else {
    console.log(
      '⚠️  Application Insights not configured - running without Azure monitoring',
    );
  }

  // Create Winston logger
  const logLevel = process.env.LOG_LEVEL || 'info';
  const winstonLogger = createWinstonLogger(connectionString, logLevel);
  const logger = new WinstonLoggerService(winstonLogger);

  // Create NestJS app with Winston logger
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Get ConfigService
  const configService = app.get(ConfigService);

  // Correlation ID middleware (for request tracing)
  // Adds X-Correlation-ID header to all requests
  app.use((req: RequestWithCorrelation, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    // Add to Application Insights context
    if (appInsights.defaultClient) {
      appInsights.defaultClient.context.tags[
        appInsights.defaultClient.context.keys.operationId
      ] = correlationId;
    }

    next();
  });

  // Cookie parser middleware (for reading cookies from requests)
  app.use(cookieParser());

  // Compression middleware
  app.use(compression());

  // Security headers with Helmet
  const isDevelopment = process.env.NODE_ENV === 'development';
  app.use(
    helmet({
      contentSecurityPolicy: isDevelopment ? false : undefined, // Disable CSP in development for easier debugging
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
      },
    }),
  );

  // CORS configuration - support multiple origins
  const corsOriginEnv =
    configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
  const corsOrigins = corsOriginEnv.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigins,
    credentials: true, // Allow cookies (for JWT refresh tokens)
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if unknown properties
      transform: true, // Automatically transform to DTO class
      transformOptions: {
        enableImplicitConversion: true, // Auto-convert types
      },
    }),
  );

  // API versioning (optional for now)
  app.setGlobalPrefix('api');

  // Swagger/OpenAPI documentation
  if (isDevelopment || configService.get<string>('ENABLE_SWAGGER') === 'true') {
    const config = new DocumentBuilder()
      .setTitle('WellPulse API')
      .setDescription('Oil & Gas Field Data Management Platform API')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )
      .addTag('health', 'Health check endpoints')
      .addTag('tenants', 'Tenant management (admin only)')
      .addTag('auth', 'Authentication endpoints')
      .addTag('wells', 'Well management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  const port = configService.get<number>('PORT') || 4000;
  await app.listen(port);

  logger.log(
    `🚀 WellPulse API is running on: http://localhost:${port}/api`,
    'Bootstrap',
  );
  logger.log(
    `📚 API docs available at: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
  logger.log(
    `🏥 Health check: http://localhost:${port}/api/health`,
    'Bootstrap',
  );
  logger.log(
    `📊 Metrics endpoint: http://localhost:${port}/metrics`,
    'Bootstrap',
  );

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    void (async () => {
      logger.log('SIGTERM signal received: closing HTTP server', 'Bootstrap');

      // Flush Application Insights telemetry before shutdown
      if (appInsights.defaultClient) {
        logger.log('Flushing Application Insights telemetry...', 'Bootstrap');
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        appInsights.defaultClient.flush();
        // Give it a moment to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
        logger.log('Application Insights telemetry flushed', 'Bootstrap');
      }

      await app.close();
      logger.log('HTTP server closed', 'Bootstrap');
    })();
  });
}

void bootstrap();
