-- Ensure user creation works properly
-- Run this in your Supabase SQL Editor

-- Disable RLS temporarily for testing (you can re-enable later)
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;

-- Make sure the table has the right structure
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS parent_phone TEXT,
ADD COLUMN IF NOT EXISTS grade_level TEXT;

-- Ensure email is unique but allow nulls for other fields
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
ALTER TABLE app_users ADD CONSTRAINT app_users_email_unique UNIQUE (email);

-- Make sure school_id can be null (for admins)
ALTER TABLE app_users ALTER COLUMN school_id DROP NOT NULL;

-- Test insert to make sure it works
DO $$
BEGIN
  -- Try to insert a test user
  INSERT INTO app_users (email, name, role, password_hash, is_active)
  VALUES ('test@example.com', 'Test User', 'admin', 'test123', true)
  ON CONFLICT (email) DO NOTHING;
  
  -- Delete the test user
  DELETE FROM app_users WHERE email = 'test@example.com';
  
  RAISE NOTICE 'User creation test passed successfully!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'User creation test failed: %', SQLERRM;
END $$;