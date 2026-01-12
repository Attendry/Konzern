/**
 * Test-Script für Supabase-Verbindung
 * Führt aus: npx ts-node test-supabase-connection.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Lade .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ .env.local geladen');
} else {
  dotenv.config();
  console.log('⚠️  .env.local nicht gefunden, verwende .env');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecret = process.env.Supabase_Secret;

console.log('\n=== Supabase Connection Test ===\n');
console.log('SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET');
console.log('Supabase_Secret:', supabaseSecret ? `${supabaseSecret.substring(0, 20)}...` : 'NOT SET');
console.log('');

if (!supabaseUrl || !supabaseSecret) {
  console.error('❌ FEHLER: Supabase-Konfiguration fehlt!');
  console.error('Bitte setzen Sie in backend/.env.local:');
  console.error('  SUPABASE_URL=https://[your-project-ref].supabase.co');
  console.error('  Supabase_Secret=[your-service-role-key]');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecret, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testConnection() {
  try {
    console.log('1. Teste Verbindung zu Supabase...');
    
    // Test: Prüfe ob companies Tabelle existiert
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('companies')
      .select('count')
      .limit(1);
    
    const duration = Date.now() - startTime;
    console.log(`   Dauer: ${duration}ms`);
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.error('❌ FEHLER: Die "companies" Tabelle existiert nicht in Supabase!');
        console.error('\nBitte führen Sie die Migrationen aus:');
        console.error('1. Öffnen Sie Supabase Dashboard: https://app.supabase.com');
        console.error('2. Gehen Sie zu SQL Editor');
        console.error('3. Führen Sie die Datei supabase/migrations/001_initial_schema.sql aus');
        return;
      } else {
        console.error('❌ FEHLER:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Details:', JSON.stringify(error, null, 2));
        return;
      }
    }
    
    console.log('✅ Verbindung erfolgreich!');
    console.log('✅ "companies" Tabelle existiert');
    
    // Test: Versuche ein Unternehmen zu lesen
    console.log('\n2. Teste Lesen von Unternehmen...');
    const readStartTime = Date.now();
    const { data: companies, error: readError } = await supabase
      .from('companies')
      .select('*')
      .limit(5);
    
    const readDuration = Date.now() - readStartTime;
    console.log(`   Dauer: ${readDuration}ms`);
    
    if (readError) {
      console.error('❌ FEHLER beim Lesen:', readError.message);
      return;
    }
    
    console.log(`✅ ${companies?.length || 0} Unternehmen gefunden`);
    if (companies && companies.length > 0) {
      console.log('Beispiel-Unternehmen:', companies[0].name);
    }
    
    console.log('\n✅ Alle Tests erfolgreich! Supabase ist korrekt konfiguriert.');
    console.log(`✅ Verbindungszeiten: Initial ${duration}ms, Read ${readDuration}ms`);
    
  } catch (error: any) {
    console.error('❌ Unerwarteter Fehler:', error);
    console.error('Stack:', error.stack);
  }
}

testConnection();
