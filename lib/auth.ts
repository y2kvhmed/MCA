import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const TEST_ADMIN_KEY = 'test_admin_session';
const TEST_ADMIN_EMAIL = 'Admin';
const TEST_ADMIN_PASSWORD = 'Adm1n1strat0r';

// Test admin user object
const TEST_ADMIN_USER: User = {
  id: 'test-admin-id',
  email: 'admin@test.com',
  name: 'Test Administrator',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
};

export async function signIn(email: string, password: string) {
  try {
    // Check for test admin credentials
    if (email === TEST_ADMIN_EMAIL && password === TEST_ADMIN_PASSWORD) {
      await AsyncStorage.setItem(TEST_ADMIN_KEY, JSON.stringify(TEST_ADMIN_USER));
      return { user: TEST_ADMIN_USER, error: null };
    }

    // Try Supabase Auth first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authData.user && !authError) {
      // Get user from app_users table (check if exists first)
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userData) {
        // Check if account is active
        if (!userData.is_active) {
          // Sign out from Supabase since account is deactivated
          await supabase.auth.signOut();
          return { user: null, error: 'Your account has been deactivated. Please contact an administrator.' };
        }
        
        await AsyncStorage.setItem('current_user', JSON.stringify(userData));
        return { user: userData as User, error: null };
      }
    }

    // Fallback to custom authentication - check app_users table directly
    // First check if user exists at all
    const { data: userCheck, error: checkError } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .single();

    if (checkError || !userCheck) {
      return { user: null, error: 'Invalid email or password' };
    }

    // Check if account is deactivated
    if (!userCheck.is_active) {
      return { user: null, error: 'Your account has been deactivated. Please contact an administrator.' };
    }

    // Check password
    if (userCheck.password_hash !== password) {
      return { user: null, error: 'Invalid email or password' };
    }

    // User is valid and active
    const userData = userCheck;

    // Store user session
    await AsyncStorage.setItem('current_user', JSON.stringify(userData));
    
    return { user: userData as User, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { user: null, error: 'Authentication failed' };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    // Check for test admin session
    const testAdmin = await AsyncStorage.getItem(TEST_ADMIN_KEY);
    if (testAdmin) {
      return JSON.parse(testAdmin) as User;
    }

    // Check for regular user session
    const currentUser = await AsyncStorage.getItem('current_user');
    if (currentUser) {
      const user = JSON.parse(currentUser) as User;
      
      // Verify the user is still active in the database
      const { data: userData, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', user.id)
        .eq('is_active', true)
        .single();
      
      if (error || !userData) {
        // User no longer exists or is inactive, clear session
        await AsyncStorage.removeItem('current_user');
        return null;
      }
      
      return userData as User;
    }

    // Check if user is logged in via Supabase Auth
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      // Try to get user from app_users table
      const { data: userData, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', authUser.id)
        .eq('is_active', true)
        .single();
      
      if (userData) {
        // Store in local session for faster access
        await AsyncStorage.setItem('current_user', JSON.stringify(userData));
        return userData as User;
      }
    }

    return null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function signOut() {
  try {
    console.log('Clearing local storage...');
    // Clear all local storage
    await AsyncStorage.removeItem(TEST_ADMIN_KEY);
    await AsyncStorage.removeItem('current_user');
    
    // Clear all AsyncStorage keys (for web compatibility)
    try {
      await AsyncStorage.clear();
    } catch (clearError) {
      console.log('AsyncStorage clear error (non-critical):', clearError);
    }
    
    console.log('Signing out from Supabase...');
    // Sign out from Supabase (if there's a session)
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Supabase sign out error (non-critical):', error);
    }
    
    console.log('Sign out completed');
    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error: error as any };
  }
}

export async function updateUserProfile(userId: string, updates: Partial<User>) {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Update local session
    await AsyncStorage.setItem('current_user', JSON.stringify(data));
    
    return { data, error: null };
  } catch (error) {
    console.error('Update profile error:', error);
    return { data: null, error: 'Failed to update profile' };
  }
}

// Function to check if current user is still active (call this periodically)
export async function checkUserActiveStatus(): Promise<boolean> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    // Skip check for test admin
    if (currentUser.id === 'test-admin-id') return true;

    // Check if user is still active in database
    const { data: userData, error } = await supabase
      .from('app_users')
      .select('is_active')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      // On database errors, assume user is still active (don't log them out)
      console.warn('Could not check user status, assuming active:', error.message);
      return true;
    }

    if (!userData || userData.is_active === false) {
      // User is explicitly deactivated, sign them out
      console.log('User is deactivated, signing out');
      await signOut();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Check user active status error:', error);
    // On network/other errors, assume user is still active (don't log them out)
    return true;
  }
}
