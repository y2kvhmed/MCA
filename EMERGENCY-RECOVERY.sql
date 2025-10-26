-- 🚨 EMERGENCY RECOVERY SCRIPT
-- Run this in Supabase SQL Editor if data is actually missing

-- First, check if tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check if data exists in key tables
SELECT 'schools' as table_name, COUNT(*) as record_count FROM schools
UNION ALL
SELECT 'app_users' as table_name, COUNT(*) as record_count FROM app_users
UNION ALL
SELECT 'assignments' as table_name, COUNT(*) as record_count FROM assignments
UNION ALL
SELECT 'study_materials' as table_name, COUNT(*) as record_count FROM study_materials
UNION ALL
SELECT 'submissions' as table_name, COUNT(*) as record_count FROM submissions;

-- If tables are missing, recreate them
-- (Only run this section if tables don't exist)

-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  grade_level TEXT,
  subject_specialization TEXT,
  is_active BOOLEAN DEFAULT true,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create study_materials table
CREATE TABLE IF NOT EXISTS study_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('pdf', 'video', 'audio', 'text', 'link')),
  file_url TEXT,
  file_size BIGINT,
  subject TEXT,
  grade_level TEXT,
  created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  material_id UUID REFERENCES study_materials(id) ON DELETE SET NULL,
  max_points INTEGER DEFAULT 100,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'graded')),
  points_earned INTEGER,
  feedback TEXT,
  graded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  subject TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  subject TEXT,
  grade_level TEXT,
  created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for schools
DROP POLICY IF EXISTS "Anyone can view schools" ON schools;
CREATE POLICY "Anyone can view schools" ON schools FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage schools" ON schools;
CREATE POLICY "Admins can manage schools" ON schools FOR ALL USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create RLS policies for app_users
DROP POLICY IF EXISTS "Users can view other users" ON app_users;
CREATE POLICY "Users can view other users" ON app_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON app_users;
CREATE POLICY "Users can update their own profile" ON app_users FOR UPDATE USING (
  auth_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins can manage users" ON app_users;
CREATE POLICY "Admins can manage users" ON app_users FOR ALL USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create RLS policies for study_materials
DROP POLICY IF EXISTS "Anyone can view published materials" ON study_materials;
CREATE POLICY "Anyone can view published materials" ON study_materials FOR SELECT USING (
  is_published = true OR 
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can create materials" ON study_materials;
CREATE POLICY "Teachers can create materials" ON study_materials FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "Teachers can update their materials" ON study_materials;
CREATE POLICY "Teachers can update their materials" ON study_materials FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can delete their materials" ON study_materials;
CREATE POLICY "Teachers can delete their materials" ON study_materials FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Create RLS policies for assignments
DROP POLICY IF EXISTS "Students can view assignments from their school" ON assignments;
CREATE POLICY "Students can view assignments from their school" ON assignments FOR SELECT USING (
  is_published = true AND school_id IN (
    SELECT school_id FROM app_users WHERE auth_user_id = auth.uid()
  ) OR
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
CREATE POLICY "Teachers can create assignments" ON assignments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "Teachers can update their assignments" ON assignments;
CREATE POLICY "Teachers can update their assignments" ON assignments FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can delete their assignments" ON assignments;
CREATE POLICY "Teachers can delete their assignments" ON assignments FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Create RLS policies for submissions
DROP POLICY IF EXISTS "Students can view their own submissions" ON submissions;
CREATE POLICY "Students can view their own submissions" ON submissions FOR SELECT USING (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM assignments a
    JOIN app_users u ON u.auth_user_id = auth.uid()
    WHERE a.id = assignment_id AND a.created_by = u.id
  )
);

DROP POLICY IF EXISTS "Students can create their own submissions" ON submissions;
CREATE POLICY "Students can create their own submissions" ON submissions FOR INSERT WITH CHECK (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Students can update their own submissions" ON submissions;
CREATE POLICY "Students can update their own submissions" ON submissions FOR UPDATE USING (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Create RLS policies for messages
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (
  sender_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  ) OR
  recipient_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (
  sender_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Create RLS policies for lessons
DROP POLICY IF EXISTS "Anyone can view published lessons" ON lessons;
CREATE POLICY "Anyone can view published lessons" ON lessons FOR SELECT USING (
  is_published = true OR 
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can create lessons" ON lessons;
CREATE POLICY "Teachers can create lessons" ON lessons FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "Teachers can update their lessons" ON lessons;
CREATE POLICY "Teachers can update their lessons" ON lessons FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can delete their lessons" ON lessons;
CREATE POLICY "Teachers can delete their lessons" ON lessons FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_school_id ON app_users(school_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_study_materials_created_by ON study_materials(created_by);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_created_by ON assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);

-- Insert default admin user if no users exist
INSERT INTO schools (id, name, address, contact_email)
SELECT 
  gen_random_uuid(),
  'Default School',
  '123 Education St',
  'admin@school.edu'
WHERE NOT EXISTS (SELECT 1 FROM schools);

-- Final verification
SELECT 'RECOVERY COMPLETE' as status;
SELECT 'Tables created:' as info, COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Data check:' as info;
SELECT 'schools' as table_name, COUNT(*) as records FROM schools
UNION ALL
SELECT 'app_users' as table_name, COUNT(*) as records FROM app_users
UNION ALL
SELECT 'assignments' as table_name, COUNT(*) as records FROM assignments
UNION ALL
SELECT 'study_materials' as table_name, COUNT(*) as records FROM study_materials;