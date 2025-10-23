import { supabase } from './supabase';
import { validateStartup } from './startupValidator';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: {
    database: boolean;
    auth: boolean;
    environment: boolean;
  };
  errors: string[];
  version: string;
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      auth: false,
      environment: false,
    },
    errors: [],
    version: '1.0.0',
  };

  try {
    // Check environment
    if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      result.checks.environment = true;
    } else {
      result.errors.push('Environment variables missing');
    }

    // Check database
    try {
      const { error: dbError } = await supabase
        .from('schools')
        .select('count', { count: 'exact', head: true });
      
      if (!dbError) {
        result.checks.database = true;
      } else {
        result.errors.push(`Database error: ${dbError.message}`);
      }
    } catch (error) {
      result.errors.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check auth system
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (!authError) {
        result.checks.auth = true;
      } else {
        result.errors.push(`Auth error: ${authError.message}`);
      }
    } catch (error) {
      result.errors.push(`Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Determine overall status
    const allChecksPass = Object.values(result.checks).every(check => check);
    if (allChecksPass) {
      result.status = 'healthy';
    } else if (result.checks.database && result.checks.environment) {
      result.status = 'degraded';
    } else {
      result.status = 'unhealthy';
    }

  } catch (error) {
    result.status = 'unhealthy';
    result.errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

export function logHealthCheck() {
  performHealthCheck().then(result => {
    console.group('🏥 Health Check Results');
    console.log('Status:', result.status);
    console.log('Database:', result.checks.database ? '✅' : '❌');
    console.log('Auth:', result.checks.auth ? '✅' : '❌');
    console.log('Environment:', result.checks.environment ? '✅' : '❌');
    
    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }
    
    console.groupEnd();
  }).catch(error => {
    console.error('Health check failed:', error);
  });
}