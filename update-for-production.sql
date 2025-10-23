-- Production-ready database updates

-- 1. Update lessons table to use video_path instead of video_url
ALTER TABLE lessons 
DROP COLUMN IF EXISTS video_url,
DROP COLUMN IF EXISTS video_id,
DROP COLUMN IF EXISTS video_platform,
ADD COLUMN IF NOT EXISTS video_path TEXT;

-- 2. Update messages table to support file sharing
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 3. Create videos storage bucket policy (run this in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);

-- 4. Create RLS policies for videos bucket
-- CREATE POLICY "Users can view videos from their school" ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'videos' AND
--     auth.uid() IN (
--       SELECT id FROM app_users 
--       WHERE school_id = (
--         SELECT school_id FROM app_users WHERE id = auth.uid()
--       )
--     )
--   );

-- CREATE POLICY "Teachers can upload videos" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'videos' AND
--     auth.uid() IN (
--       SELECT id FROM app_users 
--       WHERE role IN ('teacher', 'admin')
--     )
--   );

-- CREATE POLICY "Teachers can delete their videos" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'videos' AND
--     auth.uid() IN (
--       SELECT id FROM app_users 
--       WHERE role IN ('teacher', 'admin')
--     )
--   );

-- 5. Update assignments table to support video_path
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS video_path TEXT;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lessons_video_path ON lessons(video_path);
CREATE INDEX IF NOT EXISTS idx_assignments_video_path ON assignments(video_path);
CREATE INDEX IF NOT EXISTS idx_messages_file_type ON messages(file_type);
CREATE INDEX IF NOT EXISTS idx_messages_sender_school ON messages(sender_id, school_id);

-- 7. Update study_materials table for better file handling
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 8. Create function to get monthly assignment stats
CREATE OR REPLACE FUNCTION get_monthly_assignment_stats(
  school_id_param UUID,
  year_param INTEGER,
  month_param INTEGER
)
RETURNS TABLE (
  total_assignments INTEGER,
  total_submissions INTEGER,
  on_time_submissions INTEGER,
  late_submissions INTEGER,
  missing_submissions INTEGER,
  average_grade NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT a.id)::INTEGER as total_assignments,
    COUNT(s.id)::INTEGER as total_submissions,
    COUNT(CASE WHEN s.submitted_at <= a.due_date THEN 1 END)::INTEGER as on_time_submissions,
    COUNT(CASE WHEN s.submitted_at > a.due_date THEN 1 END)::INTEGER as late_submissions,
    (COUNT(DISTINCT a.id) * (SELECT COUNT(*) FROM app_users WHERE school_id = school_id_param AND role = 'student' AND is_active = true) - COUNT(s.id))::INTEGER as missing_submissions,
    COALESCE(AVG(s.grade), 0)::NUMERIC as average_grade
  FROM assignments a
  LEFT JOIN submissions s ON a.id = s.assignment_id
  WHERE a.school_id = school_id_param
    AND EXTRACT(YEAR FROM a.due_date) = year_param
    AND EXTRACT(MONTH FROM a.due_date) = month_param;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to clean up old signed URLs (for security)
CREATE OR REPLACE FUNCTION cleanup_old_files()
RETURNS void AS $$
BEGIN
  -- This function can be called periodically to clean up old files
  -- Implementation depends on your cleanup policy
  RAISE NOTICE 'File cleanup function created';
END;
$$ LANGUAGE plpgsql;

-- 10. Update RLS policies for better security
-- Ensure messages are only visible to users in the same school
DROP POLICY IF EXISTS "Users can view messages in their school" ON messages;
CREATE POLICY "Users can view messages in their school" ON messages
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM app_users WHERE id = auth.uid()
    ) OR
    class_id IN (
      SELECT c.id FROM classes c
      JOIN app_users u ON u.school_id = c.school_id
      WHERE u.id = auth.uid()
    )
  );

-- 11. Ensure proper constraints
ALTER TABLE lessons 
ADD CONSTRAINT check_video_path_length CHECK (char_length(video_path) <= 500);

ALTER TABLE messages 
ADD CONSTRAINT check_file_size CHECK (file_size IS NULL OR file_size > 0);

-- 12. Create audit table for file operations (optional)
CREATE TABLE IF NOT EXISTS file_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES app_users(id),
  action TEXT NOT NULL, -- 'upload', 'download', 'delete'
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  bucket_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_audit_user_id ON file_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_file_audit_created_at ON file_audit_log(created_at);

-- 13. Enable RLS on audit table
ALTER TABLE file_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own file audit logs" ON file_audit_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert audit logs" ON file_audit_log
  FOR INSERT WITH CHECK (true);