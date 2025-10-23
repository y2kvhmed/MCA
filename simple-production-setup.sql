-- Simple Production Setup - Skip problematic constraints
-- This script sets up the essential production features without constraint conflicts

-- 1. Ensure all required tables exist with proper structure

-- Update lessons table for video storage
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS video_path TEXT,
ADD COLUMN IF NOT EXISTS video_size BIGINT,
ADD COLUMN IF NOT EXISTS video_duration INTEGER;

-- Update messages table for file sharing
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Ensure assignment_comments table exists
CREATE TABLE IF NOT EXISTS assignment_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure study_materials has all required columns
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id),
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

-- Ensure app_users has push_token column for notifications
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Update study_materials to have school_id based on uploader's school
UPDATE study_materials 
SET school_id = (
  SELECT school_id 
  FROM app_users 
  WHERE app_users.id = study_materials.uploaded_by
)
WHERE school_id IS NULL;

-- 2. Set up Row Level Security policies

-- Enable RLS on all tables
ALTER TABLE assignment_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Assignment comments policies (drop existing first)
DROP POLICY IF EXISTS "Users can view comments on assignments in their school" ON assignment_comments;
DROP POLICY IF EXISTS "Users can create comments on assignments in their school" ON assignment_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON assignment_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON assignment_comments;

CREATE POLICY "Users can view comments on assignments in their school" ON assignment_comments
  FOR SELECT USING (
    assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN app_users u ON u.school_id = a.school_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can create comments on assignments in their school" ON assignment_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN app_users u ON u.school_id = a.school_id
      WHERE u.id = auth.uid()
    )
  );

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment_id ON assignment_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_comments_user_id ON assignment_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON messages(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_video_path ON lessons(video_path);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_published ON study_materials(is_published);

-- 4. Create functions for better data management

-- Function to update download count
CREATE OR REPLACE FUNCTION increment_download_count(material_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE study_materials 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = material_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_assignment_comments_updated_at ON assignment_comments;
CREATE TRIGGER update_assignment_comments_updated_at 
  BEFORE UPDATE ON assignment_comments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Clean up old YouTube-related columns if they exist
ALTER TABLE lessons DROP COLUMN IF EXISTS youtube_url;
ALTER TABLE lessons DROP COLUMN IF EXISTS youtube_id;

-- 7. Create views for reporting
CREATE OR REPLACE VIEW student_performance_summary AS
SELECT 
  u.id as student_id,
  u.name as student_name,
  u.email as student_email,
  u.grade_level,
  u.school_id,
  s.name as school_name,
  COUNT(sub.id) as total_submissions,
  COUNT(CASE WHEN sub.grade IS NOT NULL THEN 1 END) as graded_submissions,
  AVG(sub.grade) as average_grade,
  COUNT(CASE WHEN sub.submitted_at <= a.due_date THEN 1 END) as on_time_submissions,
  COUNT(CASE WHEN sub.submitted_at > a.due_date THEN 1 END) as late_submissions
FROM app_users u
LEFT JOIN schools s ON u.school_id = s.id
LEFT JOIN submissions sub ON u.id = sub.student_id
LEFT JOIN assignments a ON sub.assignment_id = a.id
WHERE u.role = 'student' AND u.is_active = true
GROUP BY u.id, u.name, u.email, u.grade_level, u.school_id, s.name;

CREATE OR REPLACE VIEW assignment_statistics AS
SELECT 
  a.id as assignment_id,
  a.title,
  a.due_date,
  a.max_score,
  a.school_id,
  s.name as school_name,
  t.name as teacher_name,
  COUNT(sub.id) as total_submissions,
  COUNT(CASE WHEN sub.grade IS NOT NULL THEN 1 END) as graded_count,
  AVG(sub.grade) as average_grade,
  COUNT(CASE WHEN sub.submitted_at <= a.due_date THEN 1 END) as on_time_count,
  COUNT(CASE WHEN sub.submitted_at > a.due_date THEN 1 END) as late_count
FROM assignments a
LEFT JOIN schools s ON a.school_id = s.id
LEFT JOIN app_users t ON a.teacher_id = t.id
LEFT JOIN submissions sub ON a.id = sub.assignment_id
GROUP BY a.id, a.title, a.due_date, a.max_score, a.school_id, s.name, t.name;

-- 8. Final data integrity checks
UPDATE app_users SET is_active = true WHERE is_active IS NULL;
UPDATE assignments SET is_published = true WHERE is_published IS NULL;
UPDATE study_materials SET is_published = true WHERE is_published IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Simple production setup completed successfully!';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '- Secure video storage (no YouTube)';
  RAISE NOTICE '- File sharing in chat';
  RAISE NOTICE '- Assignment comments system';
  RAISE NOTICE '- CSV export ready';
  RAISE NOTICE '- Performance views created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Configure storage bucket policies in Supabase dashboard';
  RAISE NOTICE '2. Test video upload and playback';
  RAISE NOTICE '3. Test file sharing in chat';
  RAISE NOTICE '4. Run production tests: node production-test.js';
END $$;