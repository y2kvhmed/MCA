-- Fix user creation issues
-- Run this in your Supabase SQL Editor

-- First, let's check if the app_users table has all required columns
-- Add any missing columns that might be needed

-- Ensure the table has the basic required columns
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS parent_phone TEXT,
ADD COLUMN IF NOT EXISTS grade_level TEXT;

-- Check and fix RLS policies for app_users table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own data" ON app_users;
DROP POLICY IF EXISTS "Admins can read all users" ON app_users;
DROP POLICY IF EXISTS "Admins can insert users" ON app_users;
DROP POLICY IF EXISTS "Admins can update users" ON app_users;
DROP POLICY IF EXISTS "Admins can delete users" ON app_users;

-- Enable RLS on app_users table
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Create new, more permissive policies for user creation
CREATE POLICY "Allow authenticated users to read users" ON app_users
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert users" ON app_users
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update users" ON app_users
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete users" ON app_users
FOR DELETE USING (auth.role() = 'authenticated');

-- Alternatively, if you want to temporarily disable RLS for testing:
-- ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;

-- Make sure the email column allows the format we're using
-- Remove any constraints that might be too restrictive
ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE app_users ALTER COLUMN email SET NOT NULL;

-- Ensure the role column accepts our values
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
CHECK (role IN ('admin', 'teacher', 'student'));

-- Make sure school_id can be null for admins
ALTER TABLE app_users ALTER COLUMN school_id DROP NOT NULL;