import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Handles Supabase errors and converts them to appropriate NestJS exceptions
 */
export class SupabaseErrorHandler {
  static handle(error: PostgrestError | null, entityName: string, operation: string): never {
    if (!error) {
      throw new InternalServerErrorException(`Unknown error during ${operation} of ${entityName}`);
    }

    // Handle specific Supabase error codes
    switch (error.code) {
      case 'PGRST116': // Not found
        throw new NotFoundException(`${entityName} not found`);
      case '23505': // Unique violation
        throw new BadRequestException(`${entityName} already exists`);
      case '23503': // Foreign key violation
        throw new BadRequestException(`Invalid reference in ${entityName}`);
      case '23502': // Not null violation
        throw new BadRequestException(`Required field missing in ${entityName}`);
      default:
        throw new InternalServerErrorException(
          `Failed to ${operation} ${entityName}: ${error.message}`,
        );
    }
  }

  static handleNotFound<T>(data: T | null, entityName: string): asserts data is T {
    if (!data) {
      throw new NotFoundException(`${entityName} not found`);
    }
  }
}
