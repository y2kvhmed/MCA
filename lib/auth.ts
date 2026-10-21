import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

// Logging for debugging in development only
const logAuth = (message: string, data?: any) => {
  if (__DEV__) {
    console.log(`[AUTH] ${message}`, data || '');
  }
};

export async function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  logAuth('Sign in attempt', { email: normalizedEmail, passwordLength: password.length });
  
  try {
    // Direct database lookup with case-insensitive email match
    logAuth('Attempting direct database lookup');
    const { data: userCheck, error: checkError } = await supabase
      .from('app_users')
      .select('*')
      .ilike('email', normalizedEmail)
      .single();

    if (checkError) {
      logAuth('Database lookup failed', checkError);
      
      // If direct lookup fails, try Supabase Auth
      logAuth('Trying Supabase Auth');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authData.user && !authError) {
        logAuth('Supabase Auth successful', authData.user.id);
        
        // Get user from app_users table
        const { data: userData, error: userError } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (userData) {
          logAuth('User profile found', userData.role);
          
          // Check if account is active
          if (!userData.is_active) {
            await supabase.auth.signOut();
            return { user: null, error: 'Your account has been deactivated. Please contact an administrator.' };
          }

          // Check maintenance mode and login controls for non-admins
          try {
            const { data: appSettings } = await supabase
              .from('app_settings')
              .select('*')
              .eq('id', 1)
              .single();

            if (appSettings) {
              if (appSettings.maintenance_mode && userData.role !== 'admin') {
                logAuth('Maintenance mode blocked non-admin user:', userData.role);
                await supabase.auth.signOut();
                return {
                  user: null,
                  error: appSettings.maintenance_message || 'The app is currently under maintenance. Please try again later.'
                };
              }

              if (userData.role === 'student' && appSettings.allow_student_login === false) {
                await supabase.auth.signOut();
                return { user: null, error: 'Student login is currently disabled. Please contact your administrator.' };
              }

              if (userData.role === 'teacher' && appSettings.allow_teacher_login === false) {
                await supabase.auth.signOut();
                return { user: null, error: 'Teacher login is currently disabled. Please contact your administrator.' };
              }
            }
          } catch (settingsError) {
            logAuth('Could not check app settings', settingsError);
          }

          await AsyncStorage.setItem('current_user', JSON.stringify(userData));
          return { user: userData as User, error: null };
        } else {
          logAuth('No user profile found for authenticated user');
          await supabase.auth.signOut();
          return { user: null, error: 'User profile not found' };
        }
      } else {
        logAuth('Both database and auth lookup failed');
        return { user: null, error: 'Invalid email or password' };
      }
    }

    // Direct database lookup succeeded
    logAuth('Database user found', { id: userCheck.id, role: userCheck.role, active: userCheck.is_active });

    // Check if account is deactivated
    if (!userCheck.is_active) {
      logAuth('Account is deactivated');
      return { user: null, error: 'Your account has been deactivated. Please contact an administrator.' };
    }

    // Check maintenance mode & login controls based on role (admins always bypass)
    try {
      const { data: appSettings } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (appSettings) {
        if (appSettings.maintenance_mode && userCheck.role !== 'admin') {
          logAuth('Maintenance mode blocked non-admin user:', userCheck.role);
          return {
            user: null,
            error: appSettings.maintenance_message || 'The app is currently under maintenance. Please try again later.'
          };
        }

        if (userCheck.role === 'student' && appSettings.allow_student_login === false) {
          logAuth('Student login is disabled');
          return { user: null, error: 'Student login is currently disabled. Please contact your administrator.' };
        }
        if (userCheck.role === 'teacher' && appSettings.allow_teacher_login === false) {
          logAuth('Teacher login is disabled');
          return { user: null, error: 'Teacher login is currently disabled. Please contact your administrator.' };
        }
      }
    } catch (settingsError) {
      logAuth('Could not check login controls', settingsError);
    }

    // Check password (simple comparison for now)
    if (userCheck.password_hash !== password) {
      logAuth('Password mismatch');
      return { user: null, error: 'Invalid email or password' };
    }

    // User is valid and active
    logAuth('Login successful', { id: userCheck.id, role: userCheck.role });
    const userData = userCheck;

    // Store user session
    await AsyncStorage.setItem('current_user', JSON.stringify(userData));

    return { user: userData as User, error: null };
    
  } catch (error) {
    logAuth('Sign in error', error);
    return { user: null, error: 'Authentication failed. Please try again.' };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    logAuth('Getting current user');
    
    // Clear any legacy test admin session key
    try {
      await AsyncStorage.removeItem('test_admin_session');
    } catch (_) {}

    // Check for regular user session
    const currentUser = await AsyncStorage.getItem('current_user');
    if (currentUser) {
      const user = JSON.parse(currentUser) as User;
      
      // If legacy test-admin was stored, wipe it out immediately
      if (user.id === 'test-admin-id') {
        logAuth('Wiping legacy test admin session');
        await AsyncStorage.removeItem('current_user');
        return null;
      }

      logAuth('Local user session found', { id: user.id, role: user.role });

      // Verify the user is still active in the database (but don't fail if we can't check)
      try {
        const { data: userData, error } = await supabase
          .from('app_users')
          .select('*, school:schools(id, name)')
          .eq('id', user.id)
          .eq('is_active', true)
          .single();

        if (error || !userData) {
          logAuth('User no longer active, clearing session');
          await AsyncStorage.removeItem('current_user');
          return null;
        }

        // Update local session with fresh data
        await AsyncStorage.setItem('current_user', JSON.stringify(userData));
        return userData as User;
      } catch (dbError) {
        logAuth('Database check failed, using cached user', dbError);
        // Return cached user if database check fails (offline scenario)
        return user;
      }
    }

    // Check if user is logged in via Supabase Auth
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        logAuth('Supabase auth user found', authUser.id);
        
        // Try to get user from app_users table
        const { data: userData, error } = await supabase
          .from('app_users')
          .select('*, school:schools(id, name)')
          .eq('id', authUser.id)
          .eq('is_active', true)
          .single();

        if (userData) {
          logAuth('Auth user profile found', userData.role);
          // Store in local session for faster access
          await AsyncStorage.setItem('current_user', JSON.stringify(userData));
          return userData as User;
        } else {
          logAuth('Auth user has no profile');
        }
      }
    } catch (authError) {
      logAuth('Supabase auth check failed', authError);
    }

    logAuth('No current user found');
    return null;
    
  } catch (error) {
    logAuth('Get current user error', error);
    return null;
  }
}

export async function signOut() {
  try {
    logAuth('Signing out');
    
    // Clear all local storage
    try {
      await AsyncStorage.removeItem('test_admin_session');
    } catch (_) {}
    await AsyncStorage.removeItem('current_user');

    // Clear all AsyncStorage keys (for web compatibility)
    try {
      await AsyncStorage.clear();
    } catch (clearError) {
      logAuth('AsyncStorage clear error (non-critical)', clearError);
    }

    // Sign out from Supabase (if there's a session)
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logAuth('Supabase sign out error (non-critical)', error);
    }

    logAuth('Sign out completed');
    return { error: null };
  } catch (error) {
    logAuth('Sign out error', error);
    return { error: error as any };
  }
}

export async function updateUserProfile(userId: string, updates: Partial<User>) {
  try {
    logAuth('Updating user profile', { userId, updates });
    
    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Update local session
    await AsyncStorage.setItem('current_user', JSON.stringify(data));

    logAuth('Profile updated successfully');
    return { data, error: null };
  } catch (error) {
    logAuth('Update profile error', error);
    return { data: null, error: 'Failed to update profile' };
  }
}

// Function to check if current user is still active (call this periodically)
export async function checkUserActiveStatus(): Promise<boolean> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    // Check if user is still active in database
    const { data: userData, error } = await supabase
      .from('app_users')
      .select('is_active')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      logAuth('Could not check user status, assuming active', error.message);
      return true;
    }

    if (!userData || userData.is_active === false) {
      logAuth('User is deactivated, signing out');
      await signOut();
      return false;
    }

    return true;
  } catch (error) {
    logAuth('Check user active status error', error);
    return true;
  }
}

// Debug function to test authentication
export async function debugAuth() {
  logAuth('=== AUTH DEBUG START ===');
  
  try {
    // Test Supabase connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('schools')
      .select('count')
      .limit(1);
    
    logAuth('Supabase connection', connectionError ? 'FAILED' : 'SUCCESS');
    
    // Test current session
    const currentUser = await getCurrentUser();
    logAuth('Current user', currentUser ? `${currentUser.name} (${currentUser.role})` : 'None');
    
    // Test database access
    const { data: users, error: usersError } = await supabase
      .from('app_users')
      .select('id, email, role, is_active')
      .limit(3);
    
    logAuth('Users table access', usersError ? 'FAILED' : 'SUCCESS');
    if (users) {
      logAuth('Sample users', users);
    }
    
  } catch (error) {
    logAuth('Debug error', error);
  }
  
  logAuth('=== AUTH DEBUG END ===');
}

export async function checkMaintenanceStatus(userRole?: string): Promise<{ isMaintenance: boolean; message: string }> {
  try {
    if (userRole === 'admin') {
      return { isMaintenance: false, message: '' };
    }
    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('maintenance_mode, maintenance_message')
      .eq('id', 1)
      .single();

    if (appSettings?.maintenance_mode) {
      return {
        isMaintenance: true,
        message: appSettings.maintenance_message || 'The app is currently undergoing scheduled maintenance. Please check back soon.',
      };
    }
    return { isMaintenance: false, message: '' };
  } catch (err) {
    return { isMaintenance: false, message: '' };
  }
}