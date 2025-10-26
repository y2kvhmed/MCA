-- 🚨 EMERGENCY COMPLETE DATABASE FIX
-- This will restore your database to working condition
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Check what exists
-- ============================================
SELECT 'Checking existing tables...' as status;

-- ============================================
-- STEP 2: Add missing auth_user_id column
-- ============================================
SELECT 'Adding missing auth_user_id column...' as status;

-- Add auth_user_id column to app_users if it doesn't exist
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);

-- ============================================
-- STEP 3: Fix table structure issues
-- ============================================
SELECT 'Fixing table structures...' as status;

-- Ensure all required columns exist in app_users
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS grade_level TEXT,
ADD COLUMN IF NOT EXISTS subject_specialization TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS password TEXT;

-- Update full_name from name if it's null
UPDATE app_users SET full_name = name WHERE full_name IS NULL;

-- Ensure all required columns exist in assignments
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES study_materials(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS max_points INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Update created_by from teacher_id if it exists
UPDATE assignments SET created_by = teacher_id WHERE created_by IS NULL AND teacher_id IS NOT NULL;

-- Ensure all required columns exist in study_materials
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'pdf',
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS grade_level TEXT;

-- Update created_by from uploaded_by if it exists
UPDATE study_materials SET created_by = uploaded_by WHERE created_by IS NULL AND uploaded_by IS NOT NULL;

-- Ensure all required columns exist in submissions
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS points_earned INTEGER,
ADD COLUMN IF NOT EXISTS feedback TEXT,
ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP WITH TIME ZONE;

-- Update points_earned from grade if it exists
UPDATE submissions SET points_earned = grade WHERE points_earned IS NULL AND grade IS NOT NULL;

-- Ensure all required columns exist in messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Ensure all required columns exist in lessons
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Update created_by from teacher_id if it exists
UPDATE lessons SET created_by = teacher_id WHERE created_by IS NULL AND teacher_id IS NOT NULL;

-- ============================================
-- STEP 4: Enable RLS on all tables
-- ============================================
SELECT 'Enabling Row Level Security...' as status;

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Create RLS Policies
-- ============================================
SELECT 'Creating RLS policies...' as status;

-- Drop all existing policies to avoid conflicts
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
    WHERE auth_user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- App users policies
CREATE POLICY "Users can view other users" ON app_users FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON app_users FOR UPDATE USING (
  auth_user_id = auth.uid()
);

CREATE POLICY "Admins can manage users" ON app_users FOR ALL USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Study materials policies
CREATE POLICY "Anyone can view published materials" ON study_materials FOR SELECT USING (
  is_published = true OR 
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can create materials" ON study_materials FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

CREATE POLICY "Teachers can update their materials" ON study_materials FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can delete their materials" ON study_materials FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Assignments policies
CREATE POLICY "Students can view assignments from their school" ON assignments FOR SELECT USING (
  is_published = true AND school_id IN (
    SELECT school_id FROM app_users WHERE auth_user_id = auth.uid()
  ) OR
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can create assignments" ON assignments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

CREATE POLICY "Teachers can update their assignments" ON assignments FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can delete their assignments" ON assignments FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Submissions policies
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

CREATE POLICY "Students can create their own submissions" ON submissions FOR INSERT WITH CHECK (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Students can update their own submissions" ON submissions FOR UPDATE USING (
  student_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can view submissions" ON submissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

CREATE POLICY "Teachers can update submissions" ON submissions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

-- Messages policies
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (
  sender_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  ) OR
  recipient_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (
  sender_id IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- Lessons policies
CREATE POLICY "Anyone can view published lessons" ON lessons FOR SELECT USING (
  is_published = true OR 
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can create lessons" ON lessons FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('teacher', 'admin')
  )
);

CREATE POLICY "Teachers can update their lessons" ON lessons FOR UPDATE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can delete their lessons" ON lessons FOR DELETE USING (
  created_by IN (
    SELECT id FROM app_users WHERE auth_user_id = auth.uid()
  )
);

-- ============================================
-- STEP 6: Create essential indexes
-- ============================================
SELECT 'Creating performance indexes...' as status;

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
-- STEP 7: Insert default data if missing
-- ============================================
SELECT 'Inserting default data...' as status;

-- Insert default school if no schools exist
INSERT INTO schools (id, name, address, contact_email)
SELECT 
  gen_random_uuid(),
  'Default School',
  '123 Education Street',
  'admin@defaultschool.edu'
WHERE NOT EXISTS (SELECT 1 FROM schools);

-- ============================================
-- STEP 8: Final verification
-- ============================================
SELECT 'EMERGENCY FIX COMPLETE!' as status;

-- Check table counts
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

-- Test basic queries
SELECT 'Testing basic queries...' as status;

-- Test if we can query each table without errors
SELECT 'schools query test' as test, (SELECT COUNT(*) FROM schools) as result
UNION ALL
SELECT 'app_users query test' as test, (SELECT COUNT(*) FROM app_users) as result
UNION ALL
SELECT 'assignments query test' as test, (SELECT COUNT(*) FROM assignments) as result;

SELECT '✅ DATABASE RECOVERY COMPLETE!' as final_status;
SELECT 'Your database should now be working properly.' as message;
SELECT 'Try refreshing your app and logging in again.' as next_step;