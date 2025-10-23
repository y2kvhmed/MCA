-- Enhanced user deactivation security
-- Run this in your Supabase SQL Editor

-- Function to handle user deactivation
CREATE OR REPLACE FUNCTION handle_user_deactivation()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is being deactivated
  IF OLD.is_active = true AND NEW.is_active = false THEN
    -- Log the deactivation
    INSERT INTO activity_logs (
      user_id,
      action,
      action_type,
      entity_type,
      entity_id,
      details,
      created_at
    ) VALUES (
      NEW.id,
      'User account deactivated',
      'update',
      'user',
      NEW.id,
      jsonb_build_object(
        'deactivated_at', NOW(),
        'previous_status', 'active',
        'new_status', 'inactive'
      ),
      NOW()
    );
    
    -- Update the updated_at timestamp
    NEW.updated_at = NOW();
    
    -- You could also add logic here to:
    -- - Cancel pending assignments for students
    -- - Notify administrators
    -- - Archive user data
    
    RAISE NOTICE 'User % has been deactivated', NEW.email;
  END IF;
  
  -- If user is being reactivated
  IF OLD.is_active = false AND NEW.is_active = true THEN
    -- Log the reactivation
    INSERT INTO activity_logs (
      user_id,
      action,
      action_type,
      entity_type,
      entity_id,
      details,
      created_at
    ) VALUES (
      NEW.id,
      'User account reactivated',
      'update',
      'user',
      NEW.id,
      jsonb_build_object(
        'reactivated_at', NOW(),
        'previous_status', 'inactive',
        'new_status', 'active'
      ),
      NOW()
    );
    
    NEW.updated_at = NOW();
    
    RAISE NOTICE 'User % has been reactivated', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user deactivation
DROP TRIGGER IF EXISTS user_deactivation_trigger ON app_users;
CREATE TRIGGER user_deactivation_trigger
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION handle_user_deactivation();

-- Create index for faster active user queries
CREATE INDEX IF NOT EXISTS idx_app_users_active_email ON app_users(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_app_users_active_role ON app_users(role) WHERE is_active = true;

-- Function to get only active users (for security)
CREATE OR REPLACE FUNCTION get_active_user_by_email(user_email TEXT)
RETURNS TABLE(
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  is_active BOOLEAN,
  school_id UUID,
  phone TEXT,
  parent_phone TEXT,
  grade_level TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.is_active,
    u.school_id,
    u.phone,
    u.parent_phone,
    u.grade_level,
    u.password_hash,
    u.created_at,
    u.updated_at
  FROM app_users u
  WHERE u.email = user_email 
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_active_user_by_email(TEXT) TO authenticated;