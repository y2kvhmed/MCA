import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Environment variables with fallbacks and validation
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nykfwiljylzxkmlccpve.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55a2Z3aWxqeWx6eGttbGNjcHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NzczMzIsImV4cCI6MjEwNzE1MzMzMn0.0KlcJi4UIMgDDH59zf4R6WjFxOKtgRcMu75CDDodQZM';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Config] Missing Supabase environment variables');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
}

// Web-compatible storage adapter with SSR safety
const WebStorageAdapter = {
  getItem: (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return Promise.resolve(localStorage.getItem(key));
      } catch (error) {
        console.warn('localStorage getItem failed:', error);
        return Promise.resolve(null);
      }
    }
    return Promise.resolve(null);
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn('localStorage setItem failed:', error);
      }
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('localStorage removeItem failed:', error);
      }
    }
    return Promise.resolve();
  },
};

// Native storage adapters
let AsyncStorage: any = null;
let SecureStore: any = null;

try {
  if (Platform.OS !== 'web') {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
    SecureStore = require('expo-secure-store');
  }
} catch (error) {
  console.warn('Failed to load native storage modules:', error);
}

// Secure storage adapter for Expo
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore?.getItemAsync(key) || Promise.resolve(null);
  },
  setItem: (key: string, value: string) => {
    return SecureStore?.setItemAsync(key, value) || Promise.resolve();
  },
  removeItem: (key: string) => {
    return SecureStore?.deleteItemAsync(key) || Promise.resolve();
  },
};

// AsyncStorage adapter for web fallback
const AsyncStorageAdapter = {
  getItem: (key: string) => {
    return AsyncStorage?.getItem(key) || Promise.resolve(null);
  },
  setItem: (key: string, value: string) => {
    return AsyncStorage?.setItem(key, value) || Promise.resolve();
  },
  removeItem: (key: string) => {
    return AsyncStorage?.removeItem(key) || Promise.resolve();
  },
};

// Choose storage based on platform
const getStorageAdapter = () => {
  if (Platform.OS === 'web') {
    return WebStorageAdapter;
  }
  // Use SecureStore for native platforms when available
  return SecureStore ? ExpoSecureStoreAdapter : AsyncStorageAdapter;
};

if (__DEV__) {
  console.log('[Supabase] Initializing client...');
  console.log('Platform:', Platform.OS);
  console.log('URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('Key:', supabaseAnonKey ? 'Set' : 'Missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'physics-learning-app',
    },
  },
});

// Test connection on initialization
(async () => {
  try {
    const { error } = await supabase.from('schools').select('count').limit(1);
    if (error) {
      console.error('[Supabase] Connection test failed:', error.message);
    } else if (__DEV__) {
      console.log('[Supabase] Connection successful');
    }
  } catch (err) {
    console.error('[Supabase] Connection error:', err);
  }
})();