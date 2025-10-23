-- Migration script to add password_hash column to existing app_users table
-- Run this in your Supabase SQL Editor

-- Add password_hash column to app_users table
ALTER TABLE app_users 
ADD COLUMN password_hash TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN app_users.password_hash IS 'Password hash for custom authentication';

-- Verify the column was added (optional - you can run this to check)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'app_users' AND column_name = 'password_hash';