-- Basic table setup for Physics Learning App
-- Run this if you're getting database errors

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App users table
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  parent_phone TEXT,
  grade_level TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  teacher_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  max_score INTEGER DEFAULT 100,
  is_published BOOLEAN DEFAULT false,
  assignment_type TEXT DEFAULT 'homework'
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  grade INTEGER,
  feedback TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'resubmitted', 'graded')),
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES app_users(id)
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  video_path TEXT,
  video_id TEXT,
  video_platform TEXT,
  duration_minutes INTEGER,
  lesson_type TEXT DEFAULT 'video',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_published BOOLEAN DEFAULT true
);

-- Study materials table
CREATE TABLE IF NOT EXISTS study_materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'message' CHECK (message_type IN ('announcement', 'message')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_pinned BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_users_school_id ON app_users(school_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);

-- Insert a default admin user if none exists
INSERT INTO app_users (email, name, role, is_active, password_hash)
SELECT 'admin@physics.edu', 'System Admin', 'admin', true, 'admin123'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE role = 'admin');

-- Insert a default school if none exists
INSERT INTO schools (name, description)
SELECT 'Default School', 'Default school for testing'
WHERE NOT EXISTS (SELECT 1 FROM schools);

COMMIT;