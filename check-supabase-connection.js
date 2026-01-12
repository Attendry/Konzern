/**
 * Script zum Testen der Supabase-Verbindung
 * Führt aus: node check-supabase-connection.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// WICHTIG: Verwende exakte Variablennamen Supabase_Public und Supabase_Secret
const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.Supabase_Secret || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET;

console.log('=== Supabase Connection Test ===\n');
console.log('Supabase URL:', supabaseUrl || 'NOT SET');
console.log('Supabase Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'NOT SET');
console.log('');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ FEHLER: Supabase-Konfiguration fehlt!');
  console.error('\nBitte erstellen Sie eine .env.local Datei im Backend-Verzeichnis mit:');
  console.error('SUPABASE_URL=https://[your-project-ref].supabase.co');
  console.error('Supabase_Secret=[your-service-role-key]');
  console.error('Supabase_Public=[your-anon-key] (optional)');
  console.error('\nWICHTIG: Verwenden Sie die exakten Variablennamen Supabase_Secret und Supabase_Public!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('1. Teste Verbindung zu Supabase...');
    
    // Test: Prüfe ob companies Tabelle existiert
    const { data, error } = await supabase
      .from('companies')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.error('❌ FEHLER: Die "companies" Tabelle existiert nicht in Supabase!');
        console.error('\nBitte führen Sie die Migrationen aus:');
        console.error('1. Öffnen Sie Supabase Dashboard');
        console.error('2. Gehen Sie zu SQL Editor');
        console.error('3. Führen Sie die Datei supabase/migrations/001_initial_schema.sql aus');
        console.error('\nOder verwenden Sie Supabase CLI:');
        console.error('  supabase db push');
        return;
      } else {
        console.error('❌ FEHLER:', error.message);
        console.error('Error Code:', error.code);
        return;
      }
    }
    
    console.log('✅ Verbindung erfolgreich!');
    console.log('✅ "companies" Tabelle existiert');
    
    // Test: Versuche ein Unternehmen zu lesen
    console.log('\n2. Teste Lesen von Unternehmen...');
    const { data: companies, error: readError } = await supabase
      .from('companies')
      .select('*')
      .limit(5);
    
    if (readError) {
      console.error('❌ FEHLER beim Lesen:', readError.message);
      return;
    }
    
    console.log(`✅ ${companies?.length || 0} Unternehmen gefunden`);
    
    // Test: Versuche ein Test-Unternehmen zu erstellen
    console.log('\n3. Teste Erstellen eines Unternehmens...');
    const testCompany = {
      name: `Test Company ${Date.now()}`,
      is_consolidated: true,
    };
    
    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert(testCompany)
      .select()
      .single();
    
    if (createError) {
      console.error('❌ FEHLER beim Erstellen:', createError.message);
      console.error('Error Code:', createError.code);
      console.error('Error Details:', createError);
      return;
    }
    
    console.log('✅ Test-Unternehmen erfolgreich erstellt:', newCompany.id);
    
    // Lösche Test-Unternehmen
    await supabase
      .from('companies')
      .delete()
      .eq('id', newCompany.id);
    
    console.log('✅ Test-Unternehmen wieder gelöscht');
    
    console.log('\n✅ Alle Tests erfolgreich! Supabase ist korrekt konfiguriert.');
    
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error);
  }
}

testConnection();
