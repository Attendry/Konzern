import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    try {
      // Use exact variable names Supabase_Public and Supabase_Secret
      const supabaseSecret = this.configService.get<string>('Supabase_Secret');
      
      // Fallback to alternative variable names for compatibility
      let supabaseUrl = 
        this.configService.get<string>('SUPABASE_URL') ||
        this.configService.get<string>('SUPABASE_PROJECT_URL');
      
      const supabaseKey = 
        supabaseSecret ||
        this.configService.get<string>('SUPABASE_SECRET_KEY') ||
        this.configService.get<string>('SUPABASE_SECRET');

      // Try to construct URL from project ref if not set
      if (!supabaseUrl) {
        const projectRef = this.configService.get<string>('SUPABASE_PROJECT_REF');
        if (projectRef) {
          supabaseUrl = `https://${projectRef}.supabase.co`;
        }
      }

      // Log configuration status (without revealing secrets)
      this.logger.log(`Supabase URL: ${supabaseUrl ? 'configured' : 'NOT SET'}`);
      this.logger.log(`Supabase Key: ${supabaseKey ? 'configured' : 'NOT SET'}`);

      if (!supabaseKey) {
        this.logger.warn('Missing Supabase secret key. Set Supabase_Secret or SUPABASE_SECRET_KEY in .env.local');
        this.logger.warn('The backend will start, but database operations will fail.');
        return;
      }

      if (!supabaseUrl) {
        this.logger.warn('Missing SUPABASE_URL. Set SUPABASE_URL in .env.local');
        this.logger.warn('The backend will start, but database operations will fail.');
        return;
      }

      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-client-info': 'konzern-backend',
          },
        },
      });
      
      // Test connection on startup (non-blocking)
      this.testConnection().catch((err) => {
        this.logger.warn(`Connection test failed: ${err.message}`);
      });
      
      this.logger.log('Supabase client initialized successfully');
    } catch (error: any) {
      this.logger.error(`Failed to initialize Supabase client: ${error.message}`);
      // Don't throw - let the backend start, errors will occur on use
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const startTime = Date.now();
      const { error } = await this.client
        .from('companies')
        .select('count')
        .limit(1);
      
      const duration = Date.now() - startTime;
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          this.logger.warn('The "companies" table does not exist. Please run migrations.');
        } else {
          this.logger.warn(`Connection test failed: ${error.message}`);
        }
      } else {
        this.logger.log(`Connection test successful (${duration}ms)`);
      }
    } catch (error: any) {
      this.logger.warn(`Connection test failed: ${error.message}`);
    }
  }

  getClient(): SupabaseClient {
    if (!this.client) {
      const error = new Error(
        'Supabase client not initialized. Configure in .env.local: SUPABASE_URL and Supabase_Secret',
      );
      this.logger.error('Supabase client not available');
      throw error;
    }
    return this.client;
  }
}
