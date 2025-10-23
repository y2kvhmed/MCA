-- Recording Management System Database Migration
-- This migration adds support for recording management features

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

-- Create dependencies tracking table
CREATE TABLE IF NOT EXISTS recording_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  dependent_type VARCHAR(50) NOT NULL,
  dependent_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(recording_id, dependent_type, dependent_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lessons_deleted_at ON lessons(deleted_at);
CREATE INDEX IF NOT EXISTS idx_lessons_last_edited_by ON lessons(last_edited_by);
CREATE INDEX IF NOT EXISTS idx_recording_audit_log_recording_id ON recording_audit_log(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_audit_log_user_id ON recording_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_audit_log_created_at ON recording_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_recording_dependencies_recording_id ON recording_dependencies(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_dependencies_dependent ON recording_dependencies(dependent_type, dependent_id);

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

-- Add RLS policies for dependencies table
ALTER TABLE recording_dependencies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view dependencies for recordings they have access to
CREATE POLICY "Users can view recording dependencies" ON recording_dependencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = recording_dependencies.recording_id
      AND (
        -- Admins can see all
        (SELECT role FROM app_users WHERE id = auth.uid()) = 'admin'
        OR
        -- Teachers can see dependencies for their school's recordings
        (
          (SELECT role FROM app_users WHERE id = auth.uid()) = 'teacher'
          AND l.school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
        )
        OR
        -- Students can see dependencies for recordings they have access to
        (
          (SELECT role FROM app_users WHERE id = auth.uid()) = 'student'
          AND l.school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
        )
      )
    )
  );

-- Policy: Only teachers and admins can manage dependencies
CREATE POLICY "Teachers and admins can manage recording dependencies" ON recording_dependencies
  FOR ALL USING (
    (SELECT role FROM app_users WHERE id = auth.uid()) IN ('admin', 'teacher')
    AND EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = recording_dependencies.recording_id
      AND (
        (SELECT role FROM app_users WHERE id = auth.uid()) = 'admin'
        OR
        (
          (SELECT role FROM app_users WHERE id = auth.uid()) = 'teacher'
          AND l.school_id = (SELECT school_id FROM app_users WHERE id = auth.uid())
        )
      )
    )
  );

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

-- Function to automatically track dependencies when assignments/materials reference recordings
CREATE OR REPLACE FUNCTION track_recording_dependencies()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle assignments
  IF TG_TABLE_NAME = 'assignments' THEN
    -- Remove old dependencies for this assignment
    DELETE FROM recording_dependencies 
    WHERE dependent_type = 'assignment' AND dependent_id = NEW.id;
    
    -- Add new dependencies if video_url references a lesson
    IF NEW.video_url IS NOT NULL THEN
      INSERT INTO recording_dependencies (recording_id, dependent_type, dependent_id)
      SELECT l.id, 'assignment', NEW.id
      FROM lessons l
      WHERE NEW.video_url LIKE '%' || l.id || '%'
      ON CONFLICT (recording_id, dependent_type, dependent_id) DO NOTHING;
    END IF;
  END IF;
  
  -- Handle materials
  IF TG_TABLE_NAME = 'materials' THEN
    -- Remove old dependencies for this material
    DELETE FROM recording_dependencies 
    WHERE dependent_type = 'material' AND dependent_id = NEW.id;
    
    -- Add new dependencies if content references a lesson
    IF NEW.content IS NOT NULL OR NEW.video_url IS NOT NULL THEN
      INSERT INTO recording_dependencies (recording_id, dependent_type, dependent_id)
      SELECT l.id, 'material', NEW.id
      FROM lessons l
      WHERE (NEW.content LIKE '%' || l.id || '%' OR NEW.video_url LIKE '%' || l.id || '%')
      ON CONFLICT (recording_id, dependent_type, dependent_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically track dependencies
DROP TRIGGER IF EXISTS track_assignment_recording_dependencies ON assignments;
CREATE TRIGGER track_assignment_recording_dependencies
  AFTER INSERT OR UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION track_recording_dependencies();

DROP TRIGGER IF EXISTS track_material_recording_dependencies ON materials;
CREATE TRIGGER track_material_recording_dependencies
  AFTER INSERT OR UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION track_recording_dependencies();

-- Clean up function for deleted dependencies
CREATE OR REPLACE FUNCTION cleanup_recording_dependencies()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up dependencies when assignments are deleted
  IF TG_TABLE_NAME = 'assignments' THEN
    DELETE FROM recording_dependencies 
    WHERE dependent_type = 'assignment' AND dependent_id = OLD.id;
  END IF;
  
  -- Clean up dependencies when materials are deleted
  IF TG_TABLE_NAME = 'materials' THEN
    DELETE FROM recording_dependencies 
    WHERE dependent_type = 'material' AND dependent_id = OLD.id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup triggers
DROP TRIGGER IF EXISTS cleanup_assignment_recording_dependencies ON assignments;
CREATE TRIGGER cleanup_assignment_recording_dependencies
  AFTER DELETE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_recording_dependencies();

DROP TRIGGER IF EXISTS cleanup_material_recording_dependencies ON materials;
CREATE TRIGGER cleanup_material_recording_dependencies
  AFTER DELETE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_recording_dependencies();

-- Add comments for documentation
COMMENT ON TABLE recording_audit_log IS 'Audit trail for recording management actions';
COMMENT ON TABLE recording_dependencies IS 'Tracks which assignments/materials reference recordings';
COMMENT ON COLUMN lessons.deleted_at IS 'Soft delete timestamp for recordings';
COMMENT ON COLUMN lessons.last_edited_by IS 'User who last edited this recording';
COMMENT ON COLUMN lessons.edit_count IS 'Number of times this recording has been edited';

-- Grant necessary permissions
GRANT SELECT, INSERT ON recording_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recording_dependencies TO authenticated;

-- Refresh existing dependencies (run once after migration)
-- This will populate the dependencies table with existing references
INSERT INTO recording_dependencies (recording_id, dependent_type, dependent_id)
SELECT DISTINCT l.id, 'assignment', a.id
FROM lessons l, assignments a
WHERE a.video_url LIKE '%' || l.id || '%'
ON CONFLICT (recording_id, dependent_type, dependent_id) DO NOTHING;

INSERT INTO recording_dependencies (recording_id, dependent_type, dependent_id)
SELECT DISTINCT l.id, 'material', m.id
FROM lessons l, materials m
WHERE (m.content LIKE '%' || l.id || '%' OR m.video_url LIKE '%' || l.id || '%')
ON CONFLICT (recording_id, dependent_type, dependent_id) DO NOTHING;