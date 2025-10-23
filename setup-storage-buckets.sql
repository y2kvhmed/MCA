-- Setup storage buckets for file management
-- Run this in your Supabase SQL Editor

-- Create submissions bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Create lessons bucket if it doesn't exist  
INSERT INTO storage.buckets (id, name, public)
VALUES ('lessons', 'lessons', false)
ON CONFLICT (id) DO NOTHING;

-- Create study-materials bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-materials', 'study-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for submissions bucket
CREATE POLICY "Users can upload their own submissions" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own submissions" ON storage.objects
FOR SELECT USING (
  bucket_id = 'submissions' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'teacher')
    )
  )
);

CREATE POLICY "Teachers and admins can delete submissions" ON storage.objects
FOR DELETE USING (
  bucket_id = 'submissions' 
  AND EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

-- Set up RLS policies for lessons bucket
CREATE POLICY "Teachers can upload lessons" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lessons' 
  AND EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "All users can view lessons" ON storage.objects
FOR SELECT USING (bucket_id = 'lessons');

CREATE POLICY "Teachers and admins can delete lessons" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lessons' 
  AND EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

-- Set up RLS policies for study-materials bucket
CREATE POLICY "Teachers can upload study materials" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'study-materials' 
  AND EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);

CREATE POLICY "All users can view study materials" ON storage.objects
FOR SELECT USING (bucket_id = 'study-materials');

CREATE POLICY "Teachers and admins can delete study materials" ON storage.objects
FOR DELETE USING (
  bucket_id = 'study-materials' 
  AND EXISTS (
    SELECT 1 FROM app_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'teacher')
  )
);