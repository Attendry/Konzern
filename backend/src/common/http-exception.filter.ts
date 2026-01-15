import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
        ? exception.message
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any).message || message,
    };

    // Log full error details
    const errorMessage = typeof message === 'string' ? message : (message as any).message || JSON.stringify(message);
    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
    );
    this.logger.error(`Error message: ${errorMessage}`);
    this.logger.error(`Error message length: ${errorMessage?.length || 0}`);
    if (exception instanceof Error) {
      this.logger.error(`Error stack: ${exception.stack}`);
    } else {
      this.logger.error(`Error details: ${JSON.stringify(exception)}`);
    }

    response.status(status).json(errorResponse);
  }
}
