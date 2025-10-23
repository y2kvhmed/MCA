import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

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

if (Platform.OS !== 'web') {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
  SecureStore = require('expo-secure-store');
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

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Choose storage based on platform
const getStorageAdapter = () => {
  if (Platform.OS === 'web') {
    return WebStorageAdapter;
  }
  // Use SecureStore for native platforms when available
  return SecureStore ? ExpoSecureStoreAdapter : AsyncStorageAdapter;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorageAdapter(),
    autoRefreshToken: typeof window !== 'undefined',
    persistSession: typeof window !== 'undefined' && Platform.OS !== 'web',
    detectSessionInUrl: false,
  },
  realtime: Platform.OS === 'web' ? {
    params: {
      eventsPerSecond: 2,
    },
  } : undefined,
});
