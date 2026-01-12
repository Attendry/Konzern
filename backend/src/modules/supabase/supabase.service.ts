import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    try {
      // WICHTIG: Verwende exakte Variablennamen Supabase_Public und Supabase_Secret
      // Diese werden aus .env.local gelesen
      const supabasePublic = this.configService.get<string>('Supabase_Public');
      const supabaseSecret = this.configService.get<string>('Supabase_Secret');
      
      // Fallback auf alternative Variablennamen für Kompatibilität
      let supabaseUrl = 
        this.configService.get<string>('SUPABASE_URL') ||
        this.configService.get<string>('SUPABASE_PROJECT_URL');
      
      let supabaseKey = 
        supabaseSecret ||  // Primär: Supabase_Secret
        this.configService.get<string>('SUPABASE_SECRET_KEY') ||
        this.configService.get<string>('SUPABASE_SECRET');

      // Versuche URL aus Supabase_Public zu extrahieren oder verwende explizite URL
      // Supabase_Public enthält normalerweise nicht die URL, aber wir prüfen es
      if (!supabaseUrl) {
        const projectRef = this.configService.get<string>('SUPABASE_PROJECT_REF');
        if (projectRef) {
          supabaseUrl = `https://${projectRef}.supabase.co`;
        }
      }

      console.log('=== Supabase Configuration ===');
      console.log('Supabase_Public:', supabasePublic ? `${supabasePublic.substring(0, 20)}...` : 'NOT SET');
      console.log('Supabase_Secret:', supabaseSecret ? `${supabaseSecret.substring(0, 20)}...` : 'NOT SET');
      console.log('Supabase URL:', supabaseUrl || 'NOT SET');
      console.log('Supabase Key (used):', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'NOT SET');
      console.log('=============================');

      if (!supabaseKey) {
        const errorMsg = 
          '⚠️  WARNING: Missing Supabase configuration. Please set in .env.local:\n' +
          '  - Supabase_Secret=[your-service-role-key] (required)\n' +
          '  - Supabase_Public=[your-anon-key] (optional, for client-side)\n' +
          '  - SUPABASE_URL=https://[your-project-ref].supabase.co (required)\n\n' +
          'Die Datei sollte im backend/ Verzeichnis liegen.\n' +
          'WICHTIG: Verwenden Sie die exakten Variablennamen Supabase_Public und Supabase_Secret!\n' +
          'Das Backend startet, aber Datenbank-Operationen werden fehlschlagen.';
        console.warn(errorMsg);
        // Wir werfen keinen Fehler, damit das Backend trotzdem startet
        // Die Fehler werden bei der Verwendung auftreten
        return;
      }

      // Wenn keine URL gesetzt ist, versuche sie aus dem Public Key zu extrahieren
      // (normalerweise ist die URL separat erforderlich)
      if (!supabaseUrl) {
        const errorMsg = 
          '⚠️  WARNING: Missing SUPABASE_URL. Please set in .env.local:\n' +
          '  - SUPABASE_URL=https://[your-project-ref].supabase.co (required)\n' +
          '  - Supabase_Secret=[your-service-role-key] (required)\n' +
          'Das Backend startet, aber Datenbank-Operationen werden fehlschlagen.';
        console.warn(errorMsg);
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
      
      // Test-Verbindung beim Start (nicht blockierend)
      this.testConnection().catch((err) => {
        console.warn('⚠️  Supabase-Verbindungstest fehlgeschlagen:', err.message);
        console.warn('   Das Backend startet trotzdem. Bitte prüfen Sie die Konfiguration.');
      });
      
      console.log('✅ Supabase Client erfolgreich erstellt');
    } catch (error: any) {
      console.error('❌ Fehler beim Erstellen des Supabase Clients:', error);
      console.error('⚠️  Das Backend startet trotzdem, aber Datenbank-Operationen werden fehlschlagen.');
      // Wir werfen keinen Fehler, damit das Backend trotzdem startet
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
          console.warn('⚠️  WARNING: Die "companies" Tabelle existiert nicht in Supabase!');
          console.warn('   Bitte führen Sie die Migrationen aus (siehe README_SUPABASE_SETUP.md)');
        } else {
          console.warn('⚠️  WARNING: Supabase-Verbindungstest fehlgeschlagen:', error.message);
        }
      } else {
        console.log(`✅ Supabase-Verbindungstest erfolgreich (${duration}ms)`);
      }
    } catch (error: any) {
      console.warn('⚠️  Supabase-Verbindungstest fehlgeschlagen:', error.message);
    }
  }

  getClient(): SupabaseClient {
    if (!this.client) {
      const error = new Error(
        'Supabase Client nicht initialisiert. Bitte konfigurieren Sie Supabase in .env.local:\n' +
        '  - SUPABASE_URL=https://[your-project-ref].supabase.co\n' +
        '  - Supabase_Secret=[your-service-role-key]',
      );
      console.error('❌ Supabase Client nicht verfügbar:', error.message);
      throw error;
    }
    return this.client;
  }
}
