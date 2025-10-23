-- Fix Assignment System - Update database to work with groups instead of classes
-- Run this in your Supabase SQL Editor

-- First, let's create the assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  due_date TIMESTAMPTZ,
  max_score INTEGER DEFAULT 100,
  assignment_type TEXT DEFAULT 'assignment' CHECK (assignment_type IN ('assignment', 'material', 'quiz')),
  teacher_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  group_id UUID, -- For future group functionality
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  is_published BOOLEAN DEFAULT TRUE,
  allow_late_submission BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create submissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  content TEXT, -- For text submissions
  grade INTEGER,
  feedback TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id) -- One submission per student per assignment
);

-- Create assignment comments table
CREATE TABLE IF NOT EXISTS assignment_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES assignment_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create study materials table if it doesn't exist
CREATE TABLE IF NOT EXISTS study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  file_path TEXT,
  file_url TEXT,
  file_size BIGINT,
  material_type TEXT DEFAULT 'pdf',
  is_downloadable BOOLEAN DEFAULT TRUE,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment_id ON assignment_comments(assignment_id);

-- Enable Row Level Security
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignments
CREATE POLICY "Teachers can manage their assignments" ON assignments
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students can view published assignments from their school" ON assignments
  FOR SELECT USING (
    is_published = true AND 
    school_id IN (
      SELECT school_id FROM app_users WHERE id = auth.uid()
    )
  );

-- RLS Policies for submissions
CREATE POLICY "Students can manage their own submissions" ON submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view submissions for their assignments" ON submissions
  FOR SELECT USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update grades for their assignments" ON submissions
  FOR UPDATE USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id = auth.uid()
    )
  );

-- RLS Policies for assignment comments
CREATE POLICY "Users can manage their own comments" ON assignment_comments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view comments on assignments they have access to" ON assignment_comments
  FOR SELECT USING (
    assignment_id IN (
      SELECT id FROM assignments 
      WHERE teacher_id = auth.uid() 
      OR (is_published = true AND school_id IN (
        SELECT school_id FROM app_users WHERE id = auth.uid()
      ))
    )
  );

-- RLS Policies for study materials
CREATE POLICY "Teachers can manage their materials" ON study_materials
  FOR ALL USING (uploaded_by = auth.uid());

CREATE POLICY "Students can view materials from their school" ON study_materials
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM app_users WHERE id = auth.uid()
    )
  );

-- Update existing data if needed (remove class_id references)
-- This is safe to run multiple times
DO $$
BEGIN
  -- Add school_id to assignments if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'school_id') THEN
    ALTER TABLE assignments ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
  END IF;
  
  -- Update assignments to use school_id from teacher's school
  UPDATE assignments 
  SET school_id = (
    SELECT school_id FROM app_users WHERE id = assignments.teacher_id
  )
  WHERE school_id IS NULL;
END $$;