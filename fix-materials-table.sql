-- Fix study_materials table schema

-- Add missing columns to study_materials table
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- Update existing records to be published by default
UPDATE study_materials 
SET is_published = true 
WHERE is_published IS NULL;

-- Update school_id for existing materials based on uploader's school
UPDATE study_materials 
SET school_id = (
  SELECT school_id 
  FROM app_users 
  WHERE app_users.id = study_materials.uploaded_by
)
WHERE school_id IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_study_materials_published ON study_materials(is_published);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);