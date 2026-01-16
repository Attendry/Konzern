import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingMiddleware } from './common/logging.middleware';
import { AllExceptionsFilter } from './common/http-exception.filter';
import helmet from 'helmet';

// Environment variable validation
function validateEnvironment(): void {
  const requiredVars = ['SUPABASE_URL'];
  const requiredSecrets = ['Supabase_Secret', 'SUPABASE_SECRET_KEY', 'SUPABASE_SECRET'];
  
  const missingVars = requiredVars.filter(v => !process.env[v]);
  const hasSecret = requiredSecrets.some(v => !!process.env[v]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing required environment variables: ${missingVars.join(', ')}`);
    console.warn('   The application will start, but database operations may fail.');
  }
  
  if (!hasSecret) {
    console.warn('⚠️  Missing Supabase secret key. Set one of: Supabase_Secret, SUPABASE_SECRET_KEY, or SUPABASE_SECRET');
    console.warn('   The application will start, but database operations may fail.');
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Validate environment variables
  validateEnvironment();
  
  // Catch unhandled errors (log but don't exit immediately - let NestJS handle it)
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Don't exit immediately - let the app try to handle it
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately - let the app try to handle it
  });
  
  // Graceful shutdown handlers
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, starting graceful shutdown...`);
      try {
        // App will be set in the try block below
        if (typeof (global as any).__app?.close === 'function') {
          await (global as any).__app.close();
          logger.log('Application closed successfully');
        }
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
      }
      process.exit(0);
    });
  });
  
  try {
    logger.log('Starting NestJS application...');
    const isProduction = process.env.NODE_ENV === 'production';
    logger.log(`Environment: ${isProduction ? 'production' : 'development'}`);
    logger.log(`Port: ${process.env.PORT || '8080'}`);
    logger.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'configured' : 'not configured'}`);
    logger.log(`Supabase Secret: ${process.env.Supabase_Secret || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET ? 'configured' : 'not configured'}`);
    
    logger.log('Creating NestJS app...');
    let app;
    try {
      app = await NestFactory.create(AppModule, {
        logger: isProduction 
          ? ['error', 'warn', 'log'] 
          : ['error', 'warn', 'log', 'debug', 'verbose'],
      });
      (global as any).__app = app; // Store for graceful shutdown
      logger.log('NestJS app created successfully');
    } catch (createError: any) {
      logger.error('Failed to create NestJS app:', createError.message);
      throw createError;
    }
    
    // Security: Add Helmet for security headers
    app.use(helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in development for easier debugging
      crossOriginEmbedderPolicy: false, // Allow embedding (for API documentation, etc.)
    }));
    logger.log('Security headers (Helmet) enabled');
    
    // CORS Configuration - Restrict to allowed origins in production
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ''))
      : [process.env.FRONTEND_URL || 'http://localhost:5173'];
    
    // In development, allow all origins for easier testing
    // In production, strictly use ALLOWED_ORIGINS or FRONTEND_URL
    const corsOrigin = isProduction
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Allow requests with no origin (like mobile apps, curl, Postman)
          if (!origin) {
            return callback(null, true);
          }
          // Check if origin is in allowed list
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      : true; // Allow all origins in development
    
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Cache-Control',
        'Pragma',
        'Expires',
        'Accept',
        'Origin',
      ],
      exposedHeaders: ['Content-Length', 'Content-Type', 'Content-Disposition'],
      maxAge: 86400,
    });
    logger.log(`CORS enabled (${isProduction ? 'production mode - restricted origins' : 'development mode - all origins'})`);
    if (isProduction) {
      logger.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
    }
    
    // Request logging middleware (after CORS)
    const loggingMiddleware = new LoggingMiddleware();
    app.use((req: any, res: any, next: any) => loggingMiddleware.use(req, res, next));
    
    // Global exception filter for error handling
    app.useGlobalFilters(new AllExceptionsFilter());
    
    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false, // Allow additional fields for multipart/form-data
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // API Prefix
    const apiPrefix = process.env.API_PREFIX || 'api';
    app.setGlobalPrefix(apiPrefix);

    // Railway requires listening on 0.0.0.0 and PORT env var
    const port = process.env.PORT || 8080;
    const host = '0.0.0.0';
    
    await app.listen(port, host);
    
    logger.log('═══════════════════════════════════════════════════════════');
    logger.log(`API listening on http://localhost:${port}/${apiPrefix}`);
    logger.log(`Health check: http://localhost:${port}/${apiPrefix}/health`);
    logger.log('═══════════════════════════════════════════════════════════');
  } catch (error: any) {
    logger.error('Failed to start application:', error.message);
    // Give it a moment before exiting to ensure logs are written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal error in bootstrap:', error.message);
  process.exit(1);
});
