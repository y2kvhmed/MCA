import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

// Logging for debugging in development only
const logAuth = (message: string, data?: any) => {
  if (__DEV__) {
    console.log(`[AUTH] ${message}`, data || '');
  }
};

// Explicit column list for reading a user profile. password_hash is deliberately
// excluded so it is never written into local storage or shipped to the client.
const PROFILE_COLUMNS =
  'id, email, name, full_name, role, school_id, grade_level, phone, parent_phone, avatar_url, push_token, is_active, linked_student_id, created_at, updated_at, school:schools(id, name)';

// The untyped Supabase client infers embedded to-one relations (e.g. `school:schools`)
// as arrays. At runtime PostgREST returns a single object for these, so normalize
// the shape here and hand back a well-typed User.
function toUser(row: any): User {
  const school = Array.isArray(row?.school) ? row.school[0] : row?.school;
  return { ...row, school } as User;
}

export async function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  logAuth('Sign in attempt', { email: normalizedEmail, passwordLength: password.length });

  try {
    // Authenticate against Supabase Auth. This establishes a real session so the
    // database can identify the caller (auth.uid()) and enforce RLS policies.
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !authData.user) {
      logAuth('Supabase Auth failed', authError?.message);
      return { user: null, error: 'Invalid email or password' };
    }

    logAuth('Supabase Auth successful', authData.user.id);

    // Load the application profile for the authenticated user.
    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select(PROFILE_COLUMNS)
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      logAuth('No app profile found for authenticated user', userError?.message);
      await supabase.auth.signOut();
      return { user: null, error: 'User profile not found' };
    }

    // Check if account is active
    if (!userData.is_active) {
      logAuth('Account is deactivated');
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

    logAuth('Login successful', { id: userData.id, role: userData.role });
    clearCachedUser();
    await AsyncStorage.setItem('current_user', JSON.stringify(userData));
    return { user: toUser(userData), error: null };
  } catch (error) {
    logAuth('Sign in error', error);
    return { user: null, error: 'Authentication failed. Please try again.' };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    logAuth('Getting current user');

    await AsyncStorage.removeItem('test_admin_session').catch(() => {});

    // A local profile cache is not proof of authentication. Verify the session
    // with Supabase Auth, then load the role from the trusted app_users row.
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const authUserId = authData.user?.id;
    if (authError || !authUserId) {
      logAuth('No verified Supabase Auth user', authError?.message);
      await AsyncStorage.removeItem('current_user').catch(() => {});
      return null;
    }

    const { data: userData, error: profileError } = await supabase
      .from('app_users')
      .select(PROFILE_COLUMNS)
      .eq('id', authUserId)
      .maybeSingle();

    if (profileError) {
      // Fail closed on profile lookup errors: a cached role must not grant access.
      logAuth('Could not verify app profile', profileError.message);
      await AsyncStorage.removeItem('current_user').catch(() => {});
      return null;
    }

    if (!userData || userData.is_active === false) {
      logAuth('User profile missing or inactive; clearing session');
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('current_user').catch(() => {});
      return null;
    }

    if (!['admin', 'teacher', 'student', 'parent'].includes(String(userData.role).toLowerCase())) {
      logAuth('Profile has an unsupported role');
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('current_user').catch(() => {});
      return null;
    }

    await AsyncStorage.setItem('current_user', JSON.stringify(userData));
    return toUser(userData);
  } catch (error) {
    logAuth('Get current user error', error);
    await AsyncStorage.removeItem('current_user').catch(() => {});
    return null;
  }
}

// Short-lived in-memory cache of the verified session.
// Navigation used to call getCurrentUser() on every route change, which costs a
// network round-trip to Supabase Auth plus a profile query. The cache keeps
// verification authoritative (it is only filled after a real Supabase session,
// expires quickly, and is cleared on sign-in/sign-out) while making route checks
// effectively free.
const VERIFY_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedUser: User | null = null;
let cachedAt = 0;

export function clearCachedUser() {
  cachedUser = null;
  cachedAt = 0;
}

export async function getCurrentUserCached(force = false): Promise<User | null> {
  if (!force && cachedUser && Date.now() - cachedAt < VERIFY_CACHE_TTL_MS) {
    return cachedUser;
  }
  const user = await getCurrentUser();
  cachedUser = user;
  cachedAt = Date.now();
  return user;
}

export async function signOut() {
  try {
    logAuth('Signing out');
    clearCachedUser();

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
      .select(PROFILE_COLUMNS)
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
