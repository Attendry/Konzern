import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const startTime = Date.now();
    const userAgent = req.get('user-agent') || '';

    // Log request start
    this.logger.log(`${method} ${originalUrl} - ${ip} - ${userAgent}`);

    // Log response when finished
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms`;
      
      if (statusCode >= 400) {
        this.logger.error(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
