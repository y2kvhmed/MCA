-- ============================================
-- COMPLETE DATABASE FIX FOR PHYSICS LEARNING APP
-- Run this entire script in your Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: STORAGE BUCKETS SETUP
-- ============================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('materials', 'materials', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]),
  ('study-materials', 'study-materials', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]),
  ('videos', 'videos', true, 104857600, ARRAY['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/quicktime']::text[]),
  ('lessons', 'lessons', true, 104857600, ARRAY['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'application/pdf', 'image/jpeg', 'image/png']::text[]),
  ('chat-files', 'chat-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf']::text[]),
  ('assignment-submissions', 'assignment-submissions', true, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- PART 2: TABLES STRUCTURE
-- ============================================

-- Add missing columns to app_users table
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS assigned_schools TEXT[] DEFAULT '{}';

-- Add missing columns to study_materials table
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add missing columns to lessons table  
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS video_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add missing columns to messages table for chat files
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'message';

-- Add missing columns to submissions table
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Create file_metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS file_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  mime_type TEXT,
  file_extension TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id UUID,
  bucket_name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for file_metadata
CREATE INDEX IF NOT EXISTS idx_file_metadata_file_path ON file_metadata(file_path);
CREATE INDEX IF NOT EXISTS idx_file_metadata_uploaded_by ON file_metadata(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_metadata_entity ON file_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_bucket ON file_metadata(bucket_name);

-- ============================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Users can insert their own file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Users can update their own file metadata" ON file_metadata;
DROP POLICY IF EXISTS "Users can delete their own file metadata" ON file_metadata;

-- File metadata policies
CREATE POLICY "Users can view file metadata" ON file_metadata
FOR SELECT USING (
  uploaded_by = auth.uid() OR 
  is_public = true OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "Users can insert their own file metadata" ON file_metadata
FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own file metadata" ON file_metadata
FOR UPDATE USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own file metadata" ON file_metadata
FOR DELETE USING (uploaded_by = auth.uid());

-- Study materials policies
DROP POLICY IF EXISTS "Anyone can view published materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can create materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can update their materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can delete their materials" ON study_materials;

CREATE POLICY "Anyone can view published materials" ON study_materials
FOR SELECT USING (is_published = true);

CREATE POLICY "Teachers can create materials" ON study_materials
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "Teachers can update their materials" ON study_materials
FOR UPDATE USING (
  uploaded_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Teachers can delete their materials" ON study_materials
FOR DELETE USING (
  uploaded_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Lessons policies
DROP POLICY IF EXISTS "Anyone can view published lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can create lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can update their lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can delete their lessons" ON lessons;

CREATE POLICY "Anyone can view published lessons" ON lessons
FOR SELECT USING (is_published = true);

CREATE POLICY "Teachers can create lessons" ON lessons
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "Teachers can update their lessons" ON lessons
FOR UPDATE USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Teachers can delete their lessons" ON lessons
FOR DELETE USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages from their school" ON messages;
DROP POLICY IF EXISTS "Users can create messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Users can view messages from their school" ON messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND (school_id = messages.school_id OR role = 'admin')
  )
);

CREATE POLICY "Users can create messages" ON messages
FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON messages
FOR DELETE USING (
  sender_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

-- Submissions policies
DROP POLICY IF EXISTS "Students can view their own submissions" ON submissions;
DROP POLICY IF EXISTS "Students can create submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers can view submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers can update submissions" ON submissions;

CREATE POLICY "Students can view their own submissions" ON submissions
FOR SELECT USING (
  student_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "Students can create submissions" ON submissions
FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view submissions" ON submissions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "Teachers can update submissions" ON submissions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

-- Assignments policies
DROP POLICY IF EXISTS "Students can view assignments from their school" ON assignments;
DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can update their assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can delete their assignments" ON assignments;

CREATE POLICY "Students can view assignments from their school" ON assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND (school_id = assignments.school_id OR role IN ('admin', 'teacher'))
  )
);

CREATE POLICY "Teachers can create assignments" ON assignments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "Teachers can update their assignments" ON assignments
FOR UPDATE USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Teachers can delete their assignments" ON assignments
FOR DELETE USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Schools policies
DROP POLICY IF EXISTS "Anyone can view schools" ON schools;
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;

CREATE POLICY "Anyone can view schools" ON schools
FOR SELECT USING (true);

CREATE POLICY "Admins can manage schools" ON schools
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- App users policies
DROP POLICY IF EXISTS "Users can view other users" ON app_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON app_users;
DROP POLICY IF EXISTS "Admins can manage users" ON app_users;

CREATE POLICY "Users can view other users" ON app_users
FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON app_users
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can manage users" ON app_users
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- ============================================
-- PART 4: TRIGGERS AND FUNCTIONS
-- ============================================

-- Update function for file_metadata
CREATE OR REPLACE FUNCTION update_file_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for file_metadata
DROP TRIGGER IF EXISTS trigger_update_file_metadata_updated_at ON file_metadata;
CREATE TRIGGER trigger_update_file_metadata_updated_at
  BEFORE UPDATE ON file_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_file_metadata_updated_at();

-- Function to delete school and all related data
DROP FUNCTION IF EXISTS delete_school_cascade(UUID);
CREATE OR REPLACE FUNCTION delete_school_cascade(school_id_param UUID)
RETURNS void AS $$
BEGIN
  -- Delete in correct order to respect foreign keys
  DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id = school_id_param);
  DELETE FROM assignments WHERE school_id = school_id_param;
  DELETE FROM study_materials WHERE school_id = school_id_param;
  DELETE FROM lessons WHERE school_id = school_id_param;
  DELETE FROM messages WHERE school_id = school_id_param;
  DELETE FROM app_users WHERE school_id = school_id_param AND role != 'admin';
  DELETE FROM schools WHERE id = school_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION delete_school_cascade(UUID) TO authenticated;

-- ============================================
-- PART 5: INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_uploaded_by ON study_materials(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_id ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON messages(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_app_users_school_id ON app_users(school_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- ============================================
-- COMPLETE! 
-- ============================================
-- All database structures, policies, and functions are now set up correctly.
-- Next steps:
-- 1. Set up storage bucket policies manually in Supabase dashboard (Storage > Policies)
-- 2. For each bucket, create policies for: SELECT (public), INSERT (authenticated), UPDATE (owner), DELETE (owner)
-- ============================================