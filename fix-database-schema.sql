-- Fix database schema issues

-- 1. Add school_id column to study_materials table if it doesn't exist
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- 2. Create assignment_comments table if it doesn't exist
CREATE TABLE IF NOT EXISTS assignment_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment_id ON assignment_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_comments_user_id ON assignment_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);

-- 4. Update existing study_materials to have school_id based on the uploader's school
UPDATE study_materials 
SET school_id = (
  SELECT school_id 
  FROM app_users 
  WHERE app_users.id = study_materials.uploaded_by
)
WHERE school_id IS NULL;

-- 5. Enable RLS on assignment_comments table
ALTER TABLE assignment_comments ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for assignment_comments
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

-- 7. Create lessons bucket in storage if it doesn't exist (this needs to be done via Supabase dashboard)
-- Note: Storage buckets need to be created via the Supabase dashboard or API

-- 8. Ensure all tables have proper updated_at triggers
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

-- 9. Fix any missing columns in assignments table for file handling
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 10. Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_published ON assignments(is_published);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_app_users_school_id ON app_users(school_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_active ON app_users(is_active);