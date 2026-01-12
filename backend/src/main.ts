import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingMiddleware } from './common/logging.middleware';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Catch unhandled errors (log but don't exit immediately - let NestJS handle it)
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    logger.error('Stack:', error.stack);
    // Don't exit immediately - let the app try to handle it
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately - let the app try to handle it
  });
  
  try {
    logger.log('Starting NestJS application...');
    logger.log('Environment check:');
    logger.log(`  - PORT: ${process.env.PORT || 'not set (using 3000)'}`);
    logger.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    logger.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? 'set' : 'not set'}`);
    logger.log(`  - Supabase_Secret: ${process.env.Supabase_Secret ? 'set' : 'not set'}`);
    
    logger.log('Creating NestJS app...');
    let app;
    try {
      app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      });
      logger.log('✅ NestJS app created successfully');
    } catch (createError: any) {
      logger.error('❌ Failed to create NestJS app:', createError);
      logger.error('Error message:', createError.message);
      logger.error('Error stack:', createError.stack);
      throw createError;
    }
    
    // CORS MUST be enabled FIRST - before any other middleware
    // This ensures preflight OPTIONS requests are handled correctly
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')) // Remove trailing slashes
      : [process.env.FRONTEND_URL || 'http://localhost:5173'];
    
    logger.log(`CORS Configuration:`);
    logger.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    logger.log(`  - ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS || 'not set'}`);
    logger.log(`  - Parsed allowed origins: ${allowedOrigins.join(', ')}`);
    
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
        // Automatically allow all *.vercel.app subdomains (for preview deployments)
        const isVercelPreview = origin.endsWith('.vercel.app');
        const isExplicitlyAllowed = allowedOrigins.includes(origin);
        const hasVercelInAllowed = allowedOrigins.some(o => o.includes('vercel.app'));
        
        logger.log(`CORS Check: origin=${origin}, isVercelPreview=${isVercelPreview}, isExplicitlyAllowed=${isExplicitlyAllowed}, hasVercelInAllowed=${hasVercelInAllowed}`);
        
        // Allow if:
        // 1. Explicitly in allowed list, OR
        // 2. It's a Vercel preview domain AND we have any vercel.app domain in allowed list
        const isAllowed = isExplicitlyAllowed || (isVercelPreview && hasVercelInAllowed);
        
        if (isAllowed) {
          logger.log(`CORS: ✅ Allowing origin: ${origin}${isVercelPreview && !isExplicitlyAllowed ? ' (Vercel preview)' : ''}`);
          callback(null, true);
        } else {
          logger.warn(`CORS: ❌ Blocking origin: ${origin}`);
          logger.warn(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
          // Temporarily allow to debug - change back to callback(new Error(...)) after fixing
          logger.warn(`CORS: Temporarily allowing for debugging`);
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
      maxAge: 86400, // 24 hours
    });
    logger.log(`✅ CORS enabled for origins: ${allowedOrigins.join(', ')}`);
    
    // Request logging middleware (after CORS)
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

    // API Prefix
    const apiPrefix = process.env.API_PREFIX || 'api';
    app.setGlobalPrefix(apiPrefix);

    // Railway requires listening on 0.0.0.0 and PORT env var
    // See: https://docs.railway.com/reference/errors/application-failed-to-respond
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0'; // Always use 0.0.0.0 for Railway (don't allow override)
    
    logger.log(`Starting server on host: ${host}, port: ${port}`);
    await app.listen(port, host);
    
    logger.log('═══════════════════════════════════════════════════════════');
    logger.log(`✅ API listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/${apiPrefix}`);
    logger.log(`✅ Health check: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/${apiPrefix}/health`);
    logger.log(`✅ Companies endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/${apiPrefix}/companies`);
    logger.log('═══════════════════════════════════════════════════════════');
    logger.log('✅ Backend started successfully!');
  } catch (error: any) {
    logger.error('❌ Failed to start application:', error);
    logger.error('Error details:', error.message);
    logger.error('Error name:', error.name);
    logger.error('Stack:', error.stack);
    logger.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    // Give it a moment before exiting to ensure logs are written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

// Wrap bootstrap in try-catch at top level
bootstrap().catch((error) => {
  console.error('Fatal error in bootstrap:', error);
  process.exit(1);
});
