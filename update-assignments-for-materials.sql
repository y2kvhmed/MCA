-- Update assignments table to support school-wide materials
-- Run this in your Supabase SQL Editor

-- Make class_id nullable for materials
ALTER TABLE assignments ALTER COLUMN class_id DROP NOT NULL;

-- Add school_id column if it doesn't exist
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Update the assignment_type constraint to include 'material'
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_assignment_type_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_assignment_type_check 
CHECK (assignment_type IN ('homework','assignment','material','quiz','exam','project','lab','presentation','essay','research'));

-- Add index for school-wide materials
CREATE INDEX IF NOT EXISTS idx_assignments_school_materials ON assignments(school_id) WHERE assignment_type = 'material';

-- Add index for class assignments
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id) WHERE class_id IS NOT NULL;

-- Function to get materials for a school
CREATE OR REPLACE FUNCTION get_school_materials(school_id_param UUID)
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  instructions TEXT,
  assignment_type TEXT,
  created_at TIMESTAMPTZ,
  teacher_name TEXT,
  attachments JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.description,
    a.instructions,
    a.assignment_type,
    a.created_at,
    u.name as teacher_name,
    a.attachments
  FROM assignments a
  JOIN app_users u ON u.id = a.teacher_id
  WHERE a.school_id = school_id_param 
    AND a.assignment_type = 'material'
    AND a.is_published = true
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_school_materials(UUID) TO authenticated;

-- Function to get assignments for a student (including school materials)
CREATE OR REPLACE FUNCTION get_student_assignments_and_materials(student_id_param UUID)
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  instructions TEXT,
  assignment_type TEXT,
  due_date TIMESTAMPTZ,
  max_score INTEGER,
  created_at TIMESTAMPTZ,
  teacher_name TEXT,
  class_name TEXT,
  is_material BOOLEAN
) AS $$
DECLARE
  student_school_id UUID;
BEGIN
  -- Get student's school_id
  SELECT school_id INTO student_school_id 
  FROM app_users 
  WHERE id = student_id_param;

  RETURN QUERY
  -- Get class assignments
  SELECT 
    a.id,
    a.title,
    a.description,
    a.instructions,
    a.assignment_type,
    a.due_date,
    a.max_score,
    a.created_at,
    u.name as teacher_name,
    c.name as class_name,
    false as is_material
  FROM assignments a
  JOIN app_users u ON u.id = a.teacher_id
  JOIN classes c ON c.id = a.class_id
  JOIN enrollments e ON e.class_id = c.id
  WHERE e.student_id = student_id_param
    AND a.is_published = true
    AND a.assignment_type != 'material'
  
  UNION ALL
  
  -- Get school materials
  SELECT 
    a.id,
    a.title,
    a.description,
    a.instructions,
    a.assignment_type,
    a.due_date,
    a.max_score,
    a.created_at,
    u.name as teacher_name,
    'School Material' as class_name,
    true as is_material
  FROM assignments a
  JOIN app_users u ON u.id = a.teacher_id
  WHERE a.school_id = student_school_id
    AND a.assignment_type = 'material'
    AND a.is_published = true
  
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_student_assignments_and_materials(UUID) TO authenticated;