-- 🚨 UNIVERSAL DATABASE FIX
-- This will work regardless of current database state
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Create tables if they don't exist
-- ============================================

-- Create schools table with all possible columns
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Egypt',
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  logo_url TEXT,
  principal_name TEXT,
  established_year INTEGER,
  student_capacity INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to schools if they don't exist
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create app_users table with all possible columns
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  bio TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female','other')),
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  student_id TEXT,
  employee_id TEXT,
  qualification TEXT,
  specialization TEXT,
  subject_specialization TEXT,
  years_of_experience INTEGER,
  grade_level TEXT,
  section TEXT,
  roll_number TEXT,
  admission_date DATE,
  joining_date DATE,
  blood_group TEXT,
  medical_conditions TEXT,
  allergies TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 0,
  password TEXT,
  password_hash TEXT,
  push_token TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to app_users if they don't exist
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subject_specialization TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS school_id UUID;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update full_name from name if needed
UPDATE app_users SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;
UPDATE app_users SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- Create study_materials table
CREATE TABLE IF NOT EXISTS study_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT DEFAULT 'pdf' CHECK (content_type IN ('pdf', 'video', 'audio', 'text', 'link')),
  file_url TEXT,
  file_path TEXT,
  file_size BIGINT,
  subject TEXT,
  grade_level TEXT,
  created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID,
  lesson_id UUID,
  is_published BOOLEAN DEFAULT false,
  is_downloadable BOOLEAN DEFAULT TRUE,
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  material_type TEXT,
  category TEXT,
  tags TEXT[],
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to study_materials
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'pdf';
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update created_by from uploaded_by if needed
UPDATE study_materials SET created_by = uploaded_by WHERE created_by IS NULL AND uploaded_by IS NOT NULL;

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  assignment_type TEXT DEFAULT 'homework',
  difficulty_level TEXT,
  topic TEXT,
  chapter TEXT,
  subject TEXT,
  grade_level TEXT,
  created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID,
  material_id UUID REFERENCES study_materials(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  available_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  available_until TIMESTAMP WITH TIME ZONE,
  max_score INTEGER DEFAULT 100,
  max_points INTEGER DEFAULT 100,
  passing_score INTEGER DEFAULT 60,
  weight DECIMAL(5,2) DEFAULT 1.0,
  is_published BOOLEAN DEFAULT TRUE,
  is_graded BOOLEAN DEFAULT TRUE,
  allow_late_submission BOOLEAN DEFAULT FALSE,
  late_penalty_percent DECIMAL(5,2) DEFAULT 0,
  max_attempts INTEGER DEFAULT 1,
  time_limit_minutes INTEGER,
  requires_file_upload BOOLEAN DEFAULT TRUE,
  allowed_file_types TEXT[] DEFAULT ARRAY['application/pdf'],
  max_file_size_mb INTEGER DEFAULT 10,
  rubric JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  submission_count INTEGER DEFAULT 0,
  graded_count INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES study_materials(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_points INTEGER DEFAULT 100;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update created_by from teacher_id if needed
UPDATE assignments SET created_by = teacher_id WHERE created_by IS NULL AND teacher_id IS NOT NULL;

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  content TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT DEFAULT 'application/pdf',
  file_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  grade DECIMAL(5,2),
  points_earned INTEGER,
  grade_letter TEXT,
  percentage DECIMAL(5,2),
  feedback TEXT,
  private_notes TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft','submitted','late','resubmitted','graded','returned','missing')),
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  returned_at TIMESTAMP WITH TIME ZONE,
  attempt_number INTEGER DEFAULT 1,
  is_late BOOLEAN DEFAULT FALSE,
  late_by_hours INTEGER,
  points_deducted DECIMAL(5,2) DEFAULT 0,
  bonus_points DECIMAL(5,2) DEFAULT 0,
  plagiarism_score DECIMAL(5,2),
  time_spent_minutes INTEGER,
  rubric_scores JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS points_earned INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update points_earned from grade if needed
UPDATE submissions SET points_earned = grade WHERE points_earned IS NULL AND grade IS NOT NULL;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  subject TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'message',
  priority TEXT DEFAULT 'normal',
  category TEXT,
  class_id UUID,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  is_pinned BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  attachments JSONB DEFAULT '[]'::jsonb,
  recipients JSONB DEFAULT '[]'::jsonb,
  read_by JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  lesson_type TEXT DEFAULT 'video',
  video_url TEXT,
  video_id TEXT,
  video_platform TEXT DEFAULT 'youtube',
  video_path TEXT,
  thumbnail_url TEXT,
  duration_minutes INTEGER,
  duration_seconds INTEGER,
  transcript TEXT,
  subtitles_url TEXT,
  quality TEXT DEFAULT 'hd',
  order_index INTEGER DEFAULT 0,
  chapter TEXT,
  topic TEXT,
  subject TEXT,
  grade_level TEXT,
  created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_mandatory BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  attachments JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '[]'::jsonb,
  quiz_questions JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update created_by from teacher_id if needed
UPDATE lessons SET created_by = teacher_id WHERE created_by IS NULL AND teacher_id IS NOT NULL;

-- ============================================
-- STEP 2: Enable RLS on all tables
-- ============================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create RLS Policies (Drop existing first)
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view schools" ON schools;
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;
DROP POLICY IF EXISTS "Users can view other users" ON app_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON app_users;
DROP POLICY IF EXISTS "Admins can manage users" ON app_users;
DROP POLICY IF EXISTS "Anyone can view published materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can create materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can update their materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can delete their materials" ON study_materials;
DROP POLICY IF EXISTS "Students can view assignments from their school" ON assignments;
DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can update their assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can delete their assignments" ON assignments;
DROP POLICY IF EXISTS "Students can view their own submissions" ON submissions;
DROP POLICY IF EXISTS "Students can create their own submissions" ON submissions;
DROP POLICY IF EXISTS "Students can update their own submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers can view submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers can update submissions" ON submissions;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Anyone can view published lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can create lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can update their lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can delete their lessons" ON lessons;

-- Schools policies
CREATE POLICY "Anyone can view schools" ON schools FOR SELECT USING (true);
CREATE POLICY "Admins can manage schools" ON schools FOR ALL USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND role = 'admin'
  )
);

-- App users policies
CREATE POLICY "Users can view other users" ON app_users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON app_users FOR UPDATE USING (
  auth_user_id = auth.uid() OR id = auth.uid()
);
CREATE POLICY "Admins can manage users" ON app_users FOR ALL USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND role = 'admin'
  )
);

-- Study materials policies
CREATE POLICY "Anyone can view published materials" ON study_materials FOR SELECT USING (
  is_published = true OR 
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Teachers can create materials" ON study_materials FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND role IN ('teacher', 'admin')
  )
);
CREATE POLICY "Teachers can update their materials" ON study_materials FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Teachers can delete their materials" ON study_materials FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);

-- Assignments policies
CREATE POLICY "Students can view assignments from their school" ON assignments FOR SELECT USING (
  is_published = true AND school_id IN (
    SELECT school_id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  ) OR
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Teachers can create assignments" ON assignments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND role IN ('teacher', 'admin')
  )
);
CREATE POLICY "Teachers can update their assignments" ON assignments FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Teachers can delete their assignments" ON assignments FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);

-- Submissions policies
CREATE POLICY "Students can view their own submissions" ON submissions FOR SELECT USING (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM assignments a
    JOIN app_users u ON (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    WHERE a.id = assignment_id AND a.created_by = u.id
  )
);
CREATE POLICY "Students can create their own submissions" ON submissions FOR INSERT WITH CHECK (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Students can update their own submissions" ON submissions FOR UPDATE USING (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);

-- Messages policies
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (
  sender_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  ) OR
  recipient_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (
  sender_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);

-- Lessons policies
CREATE POLICY "Anyone can view published lessons" ON lessons FOR SELECT USING (
  is_published = true OR 
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Teachers can create lessons" ON lessons FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND role IN ('teacher', 'admin')
  )
);
CREATE POLICY "Teachers can update their lessons" ON lessons FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);
CREATE POLICY "Teachers can delete their lessons" ON lessons FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
);

-- ============================================
-- STEP 4: Create essential indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_school_id ON app_users(school_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_study_materials_created_by ON study_materials(created_by);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_created_by ON assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_by ON lessons(created_by);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);

-- ============================================
-- STEP 5: Insert default data
-- ============================================

-- Insert default school using correct column names
INSERT INTO schools (id, name, address, email)
SELECT 
  gen_random_uuid(),
  'Default School',
  '123 Education Street',
  'admin@defaultschool.edu'
WHERE NOT EXISTS (SELECT 1 FROM schools);

-- If contact_email column exists, also try that
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'contact_email') THEN
    INSERT INTO schools (id, name, address, contact_email)
    SELECT 
      gen_random_uuid(),
      'Default School 2',
      '456 Learning Avenue',
      'contact@defaultschool.edu'
    WHERE NOT EXISTS (SELECT 1 FROM schools WHERE name = 'Default School 2');
  END IF;
END $;

-- ============================================
-- FINAL STATUS
-- ============================================
SELECT '✅ UNIVERSAL DATABASE FIX COMPLETE!' as status;

-- Show final table counts
SELECT 'schools' as table_name, COUNT(*) as record_count FROM schools
UNION ALL
SELECT 'app_users' as table_name, COUNT(*) as record_count FROM app_users
UNION ALL
SELECT 'assignments' as table_name, COUNT(*) as record_count FROM assignments
UNION ALL
SELECT 'study_materials' as table_name, COUNT(*) as record_count FROM study_materials
UNION ALL
SELECT 'submissions' as table_name, COUNT(*) as record_count FROM submissions
UNION ALL
SELECT 'messages' as table_name, COUNT(*) as record_count FROM messages
UNION ALL
SELECT 'lessons' as table_name, COUNT(*) as record_count FROM lessons;

SELECT 'Database should now be working!' as message;
SELECT 'Restart your app and try logging in.' as next_step;