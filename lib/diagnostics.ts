import { supabase } from './supabase';

export async function runDiagnostics() {
  const results = {
    supabaseConnection: false,
    environmentVariables: false,
    databaseTables: false,
    errors: [] as string[],
  };

  try {
    // Check environment variables
    if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      results.environmentVariables = true;
    } else {
      results.errors.push('Missing Supabase environment variables');
    }

    // Test Supabase connection
    const { data, error } = await supabase.from('schools').select('count', { count: 'exact', head: true });
    if (!error) {
      results.supabaseConnection = true;
      results.databaseTables = true;
    } else {
      results.errors.push(`Supabase connection error: ${error.message}`);
    }

  } catch (error) {
    results.errors.push(`Diagnostic error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return results;
}

export function logDiagnostics() {
  runDiagnostics().then(results => {
    console.group('🔍 App Diagnostics');
    console.log('Environment Variables:', results.environmentVariables ? '✅' : '❌');
    console.log('Supabase Connection:', results.supabaseConnection ? '✅' : '❌');
    console.log('Database Tables:', results.databaseTables ? '✅' : '❌');
    
    if (results.errors.length > 0) {
      console.error('Errors:', results.errors);
    }
    console.groupEnd();
  }).catch(error => {
    console.error('Failed to run diagnostics:', error);
  });
}