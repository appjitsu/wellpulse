import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get ConfigService
  const configService = app.get(ConfigService);

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

  console.log(`🚀 WellPulse API is running on: http://localhost:${port}/api`);
  console.log(`📚 API docs available at: http://localhost:${port}/api/docs`);
  console.log(`🏥 Health check: http://localhost:${port}/api/health`);
}

void bootstrap();
