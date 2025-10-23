-- Comprehensive fix for all Physics Learning App issues
-- Run this in your Supabase SQL Editor

-- 1. Ensure all required tables exist with proper structure
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  parent_phone TEXT,
  grade_level TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'message' CHECK (message_type IN ('announcement', 'message', 'image', 'file')),
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_pinned BOOLEAN DEFAULT false
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_school_id ON app_users(school_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON messages(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 3. Insert default data if it doesn't exist
INSERT INTO schools (name, description)
SELECT 'Physics Academy', 'Default school for physics learning'
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE name = 'Physics Academy');

-- Get the school ID for the default school
DO $$
DECLARE
    default_school_id UUID;
BEGIN
    SELECT id INTO default_school_id FROM schools WHERE name = 'Physics Academy' LIMIT 1;
    
    -- Insert default admin user if none exists
    INSERT INTO app_users (email, name, role, is_active, password_hash, school_id)
    SELECT 'admin@physics.edu', 'System Admin', 'admin', true, 'admin123', default_school_id
    WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'admin@physics.edu');
    
    -- Insert a test teacher if none exists
    INSERT INTO app_users (email, name, role, is_active, password_hash, school_id)
    SELECT 'teacher@physics.edu', 'Mr. Saddam', 'teacher', true, 'teacher123', default_school_id
    WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'teacher@physics.edu');
    
    -- Insert a test student if none exists
    INSERT INTO app_users (email, name, role, is_active, password_hash, school_id, grade_level)
    SELECT 'student@physics.edu', 'Test Student', 'student', true, 'student123', default_school_id, '10'
    WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'student@physics.edu');
END $$;

-- 4. Enable Row Level Security (RLS) for better security
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for schools
DROP POLICY IF EXISTS "Schools are viewable by authenticated users" ON schools;
CREATE POLICY "Schools are viewable by authenticated users" ON schools
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Schools can be managed by admins" ON schools;
CREATE POLICY "Schools can be managed by admins" ON schools
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid()::uuid 
      AND app_users.role = 'admin'
      AND app_users.is_active = true
    )
  );

CREATE POLICY "Schools can be updated by admins" ON schools
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid()::uuid 
      AND app_users.role = 'admin'
      AND app_users.is_active = true
    )
  );

CREATE POLICY "Schools can be deleted by admins" ON schools
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid()::uuid 
      AND app_users.role = 'admin'
      AND app_users.is_active = true
    )
  );

-- 6. Create RLS policies for users
DROP POLICY IF EXISTS "Users can view users in their school" ON app_users;
CREATE POLICY "Users can view users in their school" ON app_users
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM app_users 
      WHERE id = auth.uid()::uuid
    )
    OR EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = auth.uid()::uuid 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON app_users;
CREATE POLICY "Users can update their own profile" ON app_users
  FOR UPDATE USING (id = auth.uid()::uuid);

DROP POLICY IF EXISTS "Admins can manage all users" ON app_users;
CREATE POLICY "Admins can insert users" ON app_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = auth.uid()::uuid 
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update all users" ON app_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = auth.uid()::uuid 
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can delete users" ON app_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = auth.uid()::uuid 
      AND role = 'admin'
      AND is_active = true
    )
  );

-- 7. Create RLS policies for messages
DROP POLICY IF EXISTS "Users can view messages in their school" ON messages;
CREATE POLICY "Users can view messages in their school" ON messages
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM app_users 
      WHERE id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their school" ON messages;
CREATE POLICY "Users can send messages to their school" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()::uuid
    AND school_id IN (
      SELECT school_id FROM app_users 
      WHERE id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE USING (sender_id = auth.uid()::uuid);

-- 8. Create a function to clean up duplicate users (for the 409 error)
CREATE OR REPLACE FUNCTION cleanup_duplicate_users()
RETURNS void AS $$
BEGIN
  -- Remove duplicate users keeping the most recent one
  DELETE FROM app_users a USING app_users b
  WHERE a.id < b.id 
  AND a.email = b.email;
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup
SELECT cleanup_duplicate_users();

-- 9. Create a function to get user statistics safely
CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS JSON AS $$
DECLARE
  user_record app_users%ROWTYPE;
  stats JSON;
BEGIN
  SELECT * INTO user_record FROM app_users WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN '{"error": "User not found"}'::JSON;
  END IF;
  
  CASE user_record.role
    WHEN 'admin' THEN
      SELECT json_build_object(
        'totalSchools', (SELECT COUNT(*) FROM schools),
        'totalUsers', (SELECT COUNT(*) FROM app_users WHERE is_active = true),
        'totalAssignments', 0,
        'activeStudents', (SELECT COUNT(*) FROM app_users WHERE role = 'student' AND is_active = true)
      ) INTO stats;
    
    WHEN 'teacher' THEN
      SELECT json_build_object(
        'totalStudents', (SELECT COUNT(*) FROM app_users WHERE school_id = user_record.school_id AND role = 'student' AND is_active = true),
        'myAssignments', 0,
        'materialsSent', 0
      ) INTO stats;
    
    WHEN 'student' THEN
      SELECT json_build_object(
        'totalMaterials', 0,
        'totalAssignments', 0,
        'averageGrade', 0
      ) INTO stats;
    
    ELSE
      SELECT '{}'::JSON INTO stats;
  END CASE;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

COMMIT;