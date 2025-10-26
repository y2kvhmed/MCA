-- Simple storage setup that works with standard Supabase permissions
-- Run this in your Supabase SQL editor

-- Create storage buckets (this should work with standard permissions)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('materials', 'materials', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('study-materials', 'study-materials', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('videos', 'videos', true, 104857600, ARRAY['video/mp4', 'video/avi', 'video/mov', 'video/wmv']),
  ('lessons', 'lessons', true, 104857600, ARRAY['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'application/pdf', 'image/jpeg', 'image/png']),
  ('chat-files', 'chat-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf']),
  ('assignment-submissions', 'assignment-submissions', true, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
  entity_type TEXT, -- 'submission', 'material', 'lesson', etc.
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

-- Enable RLS on file_metadata
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

-- RLS policies for file_metadata
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

-- Add file_path column to study_materials if it doesn't exist
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add video_path column to lessons if it doesn't exist  
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS video_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add file columns to messages table for chat files
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;