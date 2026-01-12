import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}

// Root controller to handle requests to /
@Controller()
export class RootController {
  @Get()
  root() {
    return {
      message: 'Konzern API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 'not set',
      endpoints: {
        health: '/api/health',
        companies: '/api/companies',
        financialStatements: '/api/financial-statements',
        import: '/api/import',
        consolidation: '/api/consolidation',
      },
      documentation: 'All API endpoints are prefixed with /api',
    };
  }
  
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}