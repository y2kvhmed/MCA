-- Recording Management System - Simplified Migration
-- This migration adds essential recording management features without complex dependencies

-- Add soft delete and audit columns to lessons table (recordings)
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES app_users(id);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- Create audit log table for recording management actions
CREATE TABLE IF NOT EXISTS recording_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lessons_deleted_at ON lessons(deleted_at);
CREATE INDEX IF NOT EXISTS idx_lessons_last_edited_by ON lessons(last_edited_by);
CREATE INDEX IF NOT EXISTS idx_recording_audit_log_recording_id ON recording_audit_log(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_audit_log_user_id ON recording_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_audit_log_created_at ON recording_audit_log(created_at);

-- Update existing lessons to have edit_count = 0 where NULL
UPDATE lessons SET edit_count = 0 WHERE edit_count IS NULL;

-- Add RLS policies for audit log table
ALTER TABLE recording_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for recordings they have access to
CREATE POLICY "Users can view recording audit logs" ON recording_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = recording_audit_log.recording_id
      AND (
        -- Admins can see all
        (SELECT role FROM app_users WHERE id = auth.uid()) = 'admin'
        OR
        -- Teachers can see logs for their school's recordings
        (
          (SELECT role FROM app_users WHERE id = auth.uid()) = 'teacher'
          AND l.school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
        )
        OR
        -- Students can see logs for recordings they have access to
        (
          (SELECT role FROM app_users WHERE id = auth.uid()) = 'student'
          AND l.school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
        )
      )
    )
  );

-- Policy: Only authenticated users can insert audit logs (handled by service)
CREATE POLICY "Service can insert recording audit logs" ON recording_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Update lessons table RLS policies to handle soft delete
DROP POLICY IF EXISTS "Users can view lessons based on role" ON lessons;

CREATE POLICY "Users can view lessons based on role" ON lessons
  FOR SELECT USING (
    deleted_at IS NULL AND (
      -- Admins can see all lessons
      (SELECT role FROM app_users WHERE id = auth.uid()) = 'admin'
      OR
      -- Teachers can see lessons from their school
      (
        (SELECT role FROM app_users WHERE id = auth.uid()) = 'teacher'
        AND school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
      )
      OR
      -- Students can see lessons from their school
      (
        (SELECT role FROM app_users WHERE id = auth.uid()) = 'student'
        AND school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
      )
    )
  );

-- Update lessons update policy to allow teachers and admins to edit
DROP POLICY IF EXISTS "Teachers and admins can update lessons" ON lessons;

CREATE POLICY "Teachers and admins can update lessons" ON lessons
  FOR UPDATE USING (
    (SELECT role FROM app_users WHERE id = auth.uid()) IN ('admin', 'teacher')
    AND (
      -- Admins can update any lesson
      (SELECT role FROM app_users WHERE id = auth.uid()) = 'admin'
      OR
      -- Teachers can update lessons from their school
      (
        (SELECT role FROM app_users WHERE id = auth.uid()) = 'teacher'
        AND school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE recording_audit_log IS 'Audit trail for recording management actions';
COMMENT ON COLUMN lessons.deleted_at IS 'Soft delete timestamp for recordings';
COMMENT ON COLUMN lessons.last_edited_by IS 'User who last edited this recording';
COMMENT ON COLUMN lessons.edit_count IS 'Number of times this recording has been edited';

-- Grant necessary permissions
GRANT SELECT, INSERT ON recording_audit_log TO authenticated;