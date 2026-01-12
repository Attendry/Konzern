import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingMiddleware } from './common/logging.middleware';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    logger.log('Starting NestJS application...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    
    // Request logging middleware (must be before other middleware)
    const loggingMiddleware = new LoggingMiddleware();
    app.use((req: any, res: any, next: any) => loggingMiddleware.use(req, res, next));
    
    // Global exception filter for error handling
    app.useGlobalFilters(new AllExceptionsFilter());
    
    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false, // Erlaube zusätzliche Felder für multipart/form-data
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // CORS für Frontend
    // Allow multiple origins for development and production
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [process.env.FRONTEND_URL || 'http://localhost:5173'];
    
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          logger.log('CORS: Allowing request with no origin');
          return callback(null, true);
        }
        
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
          logger.log(`CORS: Allowing origin in development: ${origin}`);
          callback(null, true);
          return;
        }
        
        // In production, check allowed origins
        // Also allow any *.vercel.app subdomain if a vercel.app domain is in the list
        const isAllowed = allowedOrigins.includes(origin) || 
          (origin.includes('.vercel.app') && allowedOrigins.some(o => o.includes('vercel.app')));
        
        if (isAllowed) {
          logger.log(`CORS: Allowing origin: ${origin}`);
          callback(null, true);
        } else {
          logger.warn(`CORS: Blocking origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
          callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);

    // API Prefix
    const apiPrefix = process.env.API_PREFIX || 'api';
    app.setGlobalPrefix(apiPrefix);

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen(port, host);
    
    logger.log('═══════════════════════════════════════════════════════════');
    logger.log(`✅ API listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/${apiPrefix}`);
    logger.log(`✅ Health check: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/${apiPrefix}/health`);
    logger.log(`✅ Companies endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/${apiPrefix}/companies`);
    logger.log('═══════════════════════════════════════════════════════════');
  } catch (error: any) {
    logger.error('❌ Failed to start application:', error);
    logger.error('Error details:', error.message);
    logger.error('Stack:', error.stack);
    process.exit(1);
  }
}
bootstrap();
