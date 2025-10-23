-- Fix assignments table for file uploads and school-based system
-- This script is safe to run multiple times

-- Add file upload columns (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'file_path') THEN
        ALTER TABLE assignments ADD COLUMN file_path TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'file_name') THEN
        ALTER TABLE assignments ADD COLUMN file_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'file_size') THEN
        ALTER TABLE assignments ADD COLUMN file_size BIGINT;
    END IF;
END $$;

-- Update assignment_type constraint to only allow 'assignment' and 'material'
ALTER TABLE assignments 
DROP CONSTRAINT IF EXISTS assignments_assignment_type_check;

ALTER TABLE assignments 
ADD CONSTRAINT assignments_assignment_type_check 
CHECK (assignment_type IN ('assignment','material'));

-- Make class_id nullable since materials don't need classes
ALTER TABLE assignments 
ALTER COLUMN class_id DROP NOT NULL;

-- Update existing assignments to have school_id based on their class (if school_id exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'school_id') THEN
        UPDATE assignments 
        SET school_id = (
          SELECT c.school_id 
          FROM classes c 
          WHERE c.id = assignments.class_id
        )
        WHERE class_id IS NOT NULL AND school_id IS NULL;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assignment_type ON assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);

-- Create materials storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for materials bucket
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Teachers can upload materials" ON storage.objects;
    DROP POLICY IF EXISTS "Everyone can view materials" ON storage.objects;
    DROP POLICY IF EXISTS "Teachers can delete their materials" ON storage.objects;
    
    -- Create new policies
    CREATE POLICY "Teachers can upload materials" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'materials' AND
      auth.uid()::text IN (
        SELECT id::text FROM app_users WHERE role IN ('teacher', 'admin')
      )
    );

    CREATE POLICY "Everyone can view materials" ON storage.objects
    FOR SELECT USING (bucket_id = 'materials');

    CREATE POLICY "Teachers can delete their materials" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'materials' AND
      auth.uid()::text IN (
        SELECT id::text FROM app_users WHERE role IN ('teacher', 'admin')
      )
    );
END $$;