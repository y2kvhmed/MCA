import { createUser } from './database';
import { supabase } from './supabase';

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  phone?: string;
  parent_phone?: string;
  grade_level?: string;
  role: 'admin' | 'teacher' | 'student';
  school_id?: string;
}

export interface CreateUserResult {
  success: boolean;
  data?: any;
  error?: string;
  isDuplicate?: boolean;
}

export async function createUserSafely(userData: CreateUserData): Promise<CreateUserResult> {
  try {
    // First check if user already exists
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id, email, is_active, role')
      .eq('email', userData.email.toLowerCase())
      .single();

    if (existingUser) {
      return {
        success: false,
        error: `User with email ${userData.email} already exists`,
        isDuplicate: true,
        data: existingUser
      };
    }

    // Create the user
    const result = await createUser({
      ...userData,
      email: userData.email.toLowerCase(),
      is_active: true
    });

    if (result.error) {
      // Handle specific error cases
      if (result.error.code === 'USER_EXISTS' || result.error.code === '23505') {
        return {
          success: false,
          error: `User with email ${userData.email} already exists`,
          isDuplicate: true
        };
      }

      return {
        success: false,
        error: result.error.message || 'Failed to create user'
      };
    }

    return {
      success: true,
      data: result.data
    };

  } catch (error) {
    console.error('User creation helper error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function updateExistingUser(userId: string, updates: Partial<CreateUserData>): Promise<CreateUserResult> {
  try {
    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.phone) updateData.phone = updates.phone;
    if (updates.parent_phone) updateData.parent_phone = updates.parent_phone;
    if (updates.grade_level) updateData.grade_level = updates.grade_level;
    if (updates.role) updateData.role = updates.role;
    if (updates.school_id) updateData.school_id = updates.school_id;
    if (updates.password) updateData.password_hash = updates.password;

    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('User update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export function generateRandomPassword(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}