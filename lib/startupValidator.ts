import { supabase } from './supabase';

export interface StartupValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  details: {
    environment: boolean;
    supabase: boolean;
    database: boolean;
    components: boolean;
  };
}

export async function validateStartup(): Promise<StartupValidationResult> {
  const result: StartupValidationResult = {
    success: false,
    errors: [],
    warnings: [],
    details: {
      environment: false,
      supabase: false,
      database: false,
      components: false,
    },
  };

  try {
    // 1. Check environment variables
    console.log('🔍 Checking environment variables...');
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
      result.errors.push('Missing EXPO_PUBLIC_SUPABASE_URL');
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      result.errors.push('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
    }
    
    if (result.errors.length === 0) {
      result.details.environment = true;
      console.log('✅ Environment variables OK');
    } else {
      console.log('❌ Environment variables missing');
      return result;
    }

    // 2. Check Supabase client
    console.log('🔍 Checking Supabase client...');
    if (!supabase) {
      result.errors.push('Supabase client not initialized');
      return result;
    }
    result.details.supabase = true;
    console.log('✅ Supabase client OK');

    // 3. Test database connection
    console.log('🔍 Testing database connection...');
    try {
      const { error: dbError } = await supabase
        .from('schools')
        .select('count', { count: 'exact', head: true });
      
      if (dbError) {
        result.errors.push(`Database connection failed: ${dbError.message}`);
        return result;
      }
      
      result.details.database = true;
      console.log('✅ Database connection OK');
    } catch (dbError) {
      result.errors.push(`Database test failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      return result;
    }

    // 4. Check required tables exist
    console.log('🔍 Checking required tables...');
    const requiredTables = ['schools', 'app_users', 'assignments', 'lessons'];
    
    for (const table of requiredTables) {
      try {
        const { error: tableError } = await supabase
          .from(table)
          .select('count', { count: 'exact', head: true });
        
        if (tableError) {
          result.warnings.push(`Table '${table}' might not exist: ${tableError.message}`);
        }
      } catch (error) {
        result.warnings.push(`Could not check table '${table}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 5. Check components can be imported
    console.log('🔍 Checking components...');
    try {
      // These imports will throw if components are missing
      const { Colors } = await import('../constants/Colors');
      const { Spacing } = await import('../constants/Styles');
      
      if (!Colors || !Spacing) {
        result.errors.push('Constants not properly exported');
        return result;
      }
      
      result.details.components = true;
      console.log('✅ Components OK');
    } catch (componentError) {
      result.errors.push(`Component check failed: ${componentError instanceof Error ? componentError.message : 'Unknown error'}`);
      return result;
    }

    // If we get here, everything is OK
    result.success = true;
    console.log('🎉 Startup validation completed successfully');

  } catch (error) {
    result.errors.push(`Startup validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('❌ Startup validation error:', error);
  }

  return result;
}

export function logStartupValidation() {
  validateStartup().then(result => {
    console.group('🚀 Startup Validation Results');
    console.log('Success:', result.success ? '✅' : '❌');
    console.log('Environment:', result.details.environment ? '✅' : '❌');
    console.log('Supabase:', result.details.supabase ? '✅' : '❌');
    console.log('Database:', result.details.database ? '✅' : '❌');
    console.log('Components:', result.details.components ? '✅' : '❌');
    
    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }
    
    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }
    
    console.groupEnd();
  }).catch(error => {
    console.error('Failed to run startup validation:', error);
  });
}