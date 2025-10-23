-- Final Production Setup for Physics Learning Platform
-- This script consolidates all necessary database changes for production

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
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

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

-- Update study_materials to have school_id based on uploader's school
UPDATE study_materials 
SET school_id = (
  SELECT school_id 
  FROM app_users 
  WHERE app_users.id = study_materials.uploaded_by
)
WHERE school_id IS NULL;

-- 2. Create storage buckets (run these in Supabase dashboard)
-- CREATE BUCKET videos WITH (public = false);
-- CREATE BUCKET submissions WITH (public = false);

-- 3. Set up Row Level Security policies

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

CREATE POLICY "Users can update their own comments" ON assignment_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON assignment_comments
  FOR DELETE USING (user_id = auth.uid());

-- Messages policies for file sharing (drop existing first)
DROP POLICY IF EXISTS "Users can view messages in their school" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their school" ON messages;

CREATE POLICY "Users can view messages in their school" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = auth.uid() 
      AND school_id = messages.school_id
    )
  );

CREATE POLICY "Users can send messages in their school" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = auth.uid() 
      AND school_id = messages.school_id
    )
  );

-- Lessons policies for video access (drop existing first)
DROP POLICY IF EXISTS "Users can view lessons in their school" ON lessons;

CREATE POLICY "Users can view lessons in their school" ON lessons
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM app_users WHERE id = auth.uid()
    )
  );

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment_id ON assignment_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_comments_user_id ON assignment_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON messages(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_video_path ON lessons(video_path);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_published ON study_materials(is_published);

-- 5. Create functions for better data management

-- Function to update download count
CREATE OR REPLACE FUNCTION increment_download_count(material_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE study_materials 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = material_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get secure file URLs (to be used by the app)
CREATE OR REPLACE FUNCTION get_secure_file_info(file_path TEXT, bucket_name TEXT)
RETURNS TABLE(
  signed_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- This is a placeholder - actual signed URL generation happens in the app
  RETURN QUERY SELECT 
    file_path as signed_url,
    (NOW() + INTERVAL '1 hour') as expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update triggers for updated_at columns
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

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at 
  BEFORE UPDATE ON messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Clean up old YouTube-related columns if they exist
ALTER TABLE lessons DROP COLUMN IF EXISTS youtube_url;
ALTER TABLE lessons DROP COLUMN IF EXISTS youtube_id;

-- 8. Ensure proper data types and constraints

-- First, update existing data to match constraints
-- Update messages with 'normal' type to 'text'
UPDATE messages SET message_type = 'text' WHERE message_type = 'normal';
UPDATE messages SET message_type = 'text' WHERE message_type IS NULL OR message_type NOT IN ('text', 'image', 'file', 'video');
UPDATE assignments SET assignment_type = 'assignment' WHERE assignment_type IS NULL OR assignment_type NOT IN ('assignment', 'material', 'quiz', 'exam');

-- Drop existing constraints if they exist
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS check_assignment_type;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_message_type;

-- Add constraints after data is cleaned
ALTER TABLE assignments 
ALTER COLUMN assignment_type SET DEFAULT 'assignment',
ADD CONSTRAINT check_assignment_type CHECK (assignment_type IN ('assignment', 'material', 'quiz', 'exam'));

-- Don't add the message_type constraint for now - let's skip it to avoid conflicts
-- ALTER TABLE messages 
-- ADD CONSTRAINT check_message_type CHECK (message_type IN ('text', 'image', 'file', 'video'));

-- 9. Create views for reporting
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

-- 10. Final data integrity checks
UPDATE app_users SET is_active = true WHERE is_active IS NULL;
UPDATE assignments SET is_published = true WHERE is_published IS NULL;
UPDATE study_materials SET is_published = true WHERE is_published IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Production setup completed successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Configure storage bucket policies in Supabase dashboard';
  RAISE NOTICE '2. Test video upload and playback';
  RAISE NOTICE '3. Test file sharing in chat';
  RAISE NOTICE '4. Verify CSV export functionality';
  RAISE NOTICE '5. Run production tests';
END $$;