-- Core fixes for Physics Learning App issues
-- Run this in your Supabase SQL Editor

-- 1. Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create or update core tables
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

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  max_score INTEGER DEFAULT 100,
  assignment_type TEXT DEFAULT 'homework',
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  grade INTEGER,
  feedback TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'resubmitted', 'graded')),
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES app_users(id),
  is_late BOOLEAN DEFAULT false
);

-- Study materials table
CREATE TABLE IF NOT EXISTS study_materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  video_path TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_published BOOLEAN DEFAULT true
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

-- 3. Create essential indexes
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_school_id ON app_users(school_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON messages(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 4. Clean up duplicate users (fix for 409 error)
DELETE FROM app_users a USING app_users b
WHERE a.id > b.id 
AND a.email = b.email;

-- 5. Insert default data if it doesn't exist
INSERT INTO schools (name, description)
SELECT 'Physics Academy', 'Default school for physics learning'
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE name = 'Physics Academy');

-- Insert default users with the school ID
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
    
    -- Insert sample assignments
    INSERT INTO assignments (teacher_id, school_id, title, description, instructions, due_date, max_score, assignment_type)
    SELECT 
        (SELECT id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1),
        default_school_id,
        'Newton''s Laws of Motion',
        'Complete the worksheet on Newton''s three laws of motion',
        'Read chapter 4 in your textbook and complete all exercises. Show your work for all calculations.',
        NOW() + INTERVAL '7 days',
        100,
        'homework'
    WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Newton''s Laws of Motion');
    
    INSERT INTO assignments (teacher_id, school_id, title, description, instructions, due_date, max_score, assignment_type)
    SELECT 
        (SELECT id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1),
        default_school_id,
        'Energy and Work Problems',
        'Solve problems related to kinetic and potential energy',
        'Complete problems 1-15 from the energy worksheet. Include diagrams where appropriate.',
        NOW() + INTERVAL '5 days',
        80,
        'homework'
    WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Energy and Work Problems');
    
    INSERT INTO assignments (teacher_id, school_id, title, description, instructions, due_date, max_score, assignment_type)
    SELECT 
        (SELECT id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1),
        default_school_id,
        'Wave Properties Lab Report',
        'Write a lab report on wave properties experiment',
        'Include hypothesis, methodology, results, and conclusion. Minimum 500 words.',
        NOW() + INTERVAL '10 days',
        120,
        'lab_report'
    WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Wave Properties Lab Report');
END $$;

-- 6. Disable RLS temporarily to avoid auth issues during development
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- 7. Grant permissions for development
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 8. Create a simple function to check if email exists
CREATE OR REPLACE FUNCTION email_exists(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM app_users WHERE email = check_email);
END;
$$ LANGUAGE plpgsql;

-- 9. Create a function to get safe user stats
CREATE OR REPLACE FUNCTION get_safe_user_stats(user_id UUID)
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
        'totalSchools', COALESCE((SELECT COUNT(*) FROM schools), 0),
        'totalUsers', COALESCE((SELECT COUNT(*) FROM app_users WHERE is_active = true), 0),
        'totalAssignments', 0,
        'activeStudents', COALESCE((SELECT COUNT(*) FROM app_users WHERE role = 'student' AND is_active = true), 0)
      ) INTO stats;
    
    WHEN 'teacher' THEN
      SELECT json_build_object(
        'totalStudents', COALESCE((SELECT COUNT(*) FROM app_users WHERE school_id = user_record.school_id AND role = 'student' AND is_active = true), 0),
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

COMMIT;