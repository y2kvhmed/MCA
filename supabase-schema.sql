-- ============================================================================
-- PHYSICS LEARNING PLATFORM - ULTIMATE COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This is the MOST COMPREHENSIVE production-ready database schema
-- Supports EVERY feature, function, and detail
-- Run this ENTIRE file in your Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search

-- ============================================================================
-- DROP ALL EXISTING TABLES (Clean slate)
-- ============================================================================
DROP TABLE IF EXISTS grade_history CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS message_reads CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS file_metadata CASCADE;
DROP TABLE IF EXISTS lesson_progress CASCADE;
DROP TABLE IF EXISTS assignment_attachments CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;
DROP TABLE IF EXISTS schools CASCADE;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Schools table - Educational institutions
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Egypt',
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  principal_name TEXT,
  established_year INTEGER,
  student_capacity INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table - All users (admin, teacher, student)
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  bio TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female','other')),
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  student_id TEXT UNIQUE, -- For students
  employee_id TEXT UNIQUE, -- For teachers/admin
  qualification TEXT, -- For teachers
  specialization TEXT, -- For teachers
  years_of_experience INTEGER, -- For teachers
  grade_level TEXT, -- For students
  section TEXT, -- For students
  roll_number TEXT, -- For students
  admission_date DATE, -- For students
  joining_date DATE, -- For teachers
  blood_group TEXT,
  medical_conditions TEXT,
  allergies TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  password_hash TEXT, -- For custom authentication
  push_token TEXT, -- For push notifications
  preferences JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table - Courses/Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT DEFAULT 'Physics',
  grade_level TEXT,
  section TEXT,
  room_number TEXT,
  building TEXT,
  schedule TEXT,
  schedule_details JSONB DEFAULT '[]'::jsonb, -- [{day, start_time, end_time}]
  teacher_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  max_students INTEGER DEFAULT 30,
  current_enrollment INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  academic_year TEXT,
  semester TEXT,
  start_date DATE,
  end_date DATE,
  syllabus_url TEXT,
  class_code TEXT UNIQUE, -- For easy joining
  meeting_link TEXT, -- For online classes
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Enrollments table - Student-Class relationships
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  enrollment_status TEXT DEFAULT 'active' CHECK (enrollment_status IN ('active','dropped','completed','suspended')),
  enrollment_type TEXT DEFAULT 'regular' CHECK (enrollment_type IN ('regular','audit','transfer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  dropped_at TIMESTAMPTZ,
  drop_reason TEXT,
  completion_date TIMESTAMPTZ,
  final_grade DECIMAL(5,2),
  grade_letter TEXT,
  attendance_percentage DECIMAL(5,2),
  performance_notes TEXT,
  parent_consent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(class_id, student_id)
);

-- Assignments table - Homework, quizzes, exams, projects
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  assignment_type TEXT DEFAULT 'homework' CHECK (assignment_type IN ('homework','quiz','exam','project','lab','presentation','essay','research')),
  difficulty_level TEXT CHECK (difficulty_level IN ('easy','medium','hard','advanced')),
  topic TEXT,
  chapter TEXT,
  learning_objectives TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  available_from TIMESTAMPTZ DEFAULT NOW(),
  available_until TIMESTAMPTZ,
  max_score INTEGER DEFAULT 100,
  passing_score INTEGER DEFAULT 60,
  weight DECIMAL(5,2) DEFAULT 1.0,
  is_published BOOLEAN DEFAULT TRUE,
  is_graded BOOLEAN DEFAULT TRUE,
  allow_late_submission BOOLEAN DEFAULT FALSE,
  late_penalty_percent DECIMAL(5,2) DEFAULT 0,
  max_attempts INTEGER DEFAULT 1,
  time_limit_minutes INTEGER,
  requires_file_upload BOOLEAN DEFAULT TRUE,
  allowed_file_types TEXT[] DEFAULT ARRAY['application/pdf'],
  max_file_size_mb INTEGER DEFAULT 10,
  rubric JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  submission_count INTEGER DEFAULT 0,
  graded_count INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table - Student assignment submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',
  file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  grade DECIMAL(5,2),
  grade_letter TEXT,
  percentage DECIMAL(5,2),
  feedback TEXT,
  private_notes TEXT, -- Only visible to teacher
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft','submitted','late','resubmitted','graded','returned','missing')),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  returned_at TIMESTAMPTZ,
  attempt_number INTEGER DEFAULT 1,
  is_late BOOLEAN DEFAULT FALSE,
  late_by_hours INTEGER,
  points_deducted DECIMAL(5,2) DEFAULT 0,
  bonus_points DECIMAL(5,2) DEFAULT 0,
  plagiarism_score DECIMAL(5,2),
  time_spent_minutes INTEGER,
  rubric_scores JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(assignment_id, student_id, attempt_number)
);


-- Lessons table - Video lessons, materials, recordings
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL, -- Can be school-wide or class-specific
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  lesson_type TEXT DEFAULT 'video' CHECK (lesson_type IN ('video','document','link','live','recording','presentation','interactive')),
  video_url TEXT, -- YouTube embed URL
  video_id TEXT, -- YouTube video ID
  video_platform TEXT DEFAULT 'youtube' CHECK (video_platform IN ('youtube','vimeo','custom')),
  video_path TEXT, -- For uploaded videos
  thumbnail_url TEXT,
  duration_minutes INTEGER,
  duration_seconds INTEGER,
  transcript TEXT,
  subtitles_url TEXT,
  quality TEXT DEFAULT 'hd' CHECK (quality IN ('sd','hd','fullhd','4k')),
  order_index INTEGER DEFAULT 0,
  chapter TEXT,
  topic TEXT,
  learning_objectives TEXT[],
  prerequisites TEXT[],
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner','intermediate','advanced')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_mandatory BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  attachments JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '[]'::jsonb,
  quiz_questions JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Messages/Announcements table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES app_users(id) ON DELETE CASCADE, -- For direct messages
  title TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'announcement' CHECK (message_type IN ('announcement','message','reminder','alert','notification','system')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','critical')),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]'::jsonb,
  recipients JSONB DEFAULT '[]'::jsonb, -- For bulk messages
  read_by JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- ADVANCED FEATURE TABLES
-- ============================================================================

-- User Permissions - Fine-grained access control
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  resource_type TEXT, -- 'school', 'class', 'assignment', etc.
  resource_id UUID,
  can_create BOOLEAN DEFAULT FALSE,
  can_read BOOLEAN DEFAULT TRUE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_manage BOOLEAN DEFAULT FALSE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES app_users(id),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Activity Logs - Track all user actions
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('create','read','update','delete','login','logout','upload','download','submit','grade')),
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  location TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications - Push notifications and alerts
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error','reminder','announcement')),
  category TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  action_text TEXT,
  icon TEXT,
  image_url TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  sent_via TEXT[] DEFAULT ARRAY['app'], -- 'app', 'email', 'sms', 'push'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);


-- File Metadata - Track all uploaded files
CREATE TABLE file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT,
  file_extension TEXT,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  bucket_name TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  checksum TEXT,
  virus_scan_status TEXT CHECK (virus_scan_status IN ('pending','clean','infected','error')),
  virus_scan_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  preview_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grade History - Track all grade changes
CREATE TABLE grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  old_grade DECIMAL(5,2),
  new_grade DECIMAL(5,2),
  old_status TEXT,
  new_status TEXT,
  changed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  change_reason TEXT,
  change_type TEXT CHECK (change_type IN ('initial','correction','appeal','bonus','penalty')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance - Track student attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present','absent','late','excused','sick','leave')),
  check_in_time TIME,
  check_out_time TIME,
  duration_minutes INTEGER,
  notes TEXT,
  marked_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ,
  location TEXT,
  ip_address TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  parent_notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id, date)
);

-- Calendar Events - Schedule management
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK (event_type IN ('class','exam','assignment','holiday','meeting','event','deadline','reminder')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  location TEXT,
  meeting_link TEXT,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  color TEXT DEFAULT '#001F3F',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT, -- RRULE format
  recurrence_end_date DATE,
  attendees JSONB DEFAULT '[]'::jsonb,
  reminders JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_cancelled BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lesson Progress - Track student progress
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','skipped')),
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  last_position_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  quiz_score DECIMAL(5,2),
  quiz_attempts INTEGER DEFAULT 0,
  notes TEXT,
  bookmarks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, student_id)
);

-- Assignment Attachments - Multiple file support
CREATE TABLE assignment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Reads - Track message read status
CREATE TABLE message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  device_type TEXT,
  UNIQUE(message_id, user_id)
);


-- ============================================================================
-- ENTERPRISE FEATURES
-- ============================================================================

-- Grade Reports - Comprehensive grade tracking
CREATE TABLE grade_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year TEXT,
  semester TEXT,
  term TEXT,
  overall_grade DECIMAL(5,2),
  grade_letter TEXT,
  gpa DECIMAL(3,2),
  rank INTEGER,
  total_students INTEGER,
  attendance_percentage DECIMAL(5,2),
  assignments_completed INTEGER,
  assignments_total INTEGER,
  average_score DECIMAL(5,2),
  highest_score DECIMAL(5,2),
  lowest_score DECIMAL(5,2),
  improvement_percentage DECIMAL(5,2),
  teacher_comments TEXT,
  strengths TEXT[],
  areas_for_improvement TEXT[],
  recommendations TEXT[],
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES app_users(id),
  report_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parent Communications - Track parent interactions
CREATE TABLE parent_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  communication_type TEXT CHECK (communication_type IN ('email','phone','meeting','message','report')),
  subject TEXT,
  message TEXT,
  response TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft','sent','delivered','read','replied','archived')),
  priority TEXT DEFAULT 'normal',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz Questions - For interactive lessons
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('multiple_choice','true_false','short_answer','essay','matching','fill_blank')),
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  correct_answers TEXT[], -- For multiple correct answers
  explanation TEXT,
  points DECIMAL(5,2) DEFAULT 1,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  order_index INTEGER DEFAULT 0,
  time_limit_seconds INTEGER,
  hints TEXT[],
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz Responses - Student quiz answers
CREATE TABLE quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  lesson_progress_id UUID REFERENCES lesson_progress(id) ON DELETE CASCADE,
  answer TEXT,
  answers TEXT[], -- For multiple answers
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2),
  time_taken_seconds INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion Forums - Class discussions
CREATE TABLE forum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_announcement BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum Replies
CREATE TABLE forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES forum_topics(id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES forum_replies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_solution BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study Materials - Additional resources
CREATE TABLE study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT CHECK (material_type IN ('pdf','doc','ppt','video','link','image','audio','other')),
  file_path TEXT,
  file_url TEXT,
  file_size BIGINT,
  thumbnail_url TEXT,
  category TEXT,
  tags TEXT[],
  is_downloadable BOOLEAN DEFAULT TRUE,
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- PERFORMANCE INDEXES (Critical for speed)
-- ============================================================================

-- Schools indexes
CREATE INDEX idx_schools_name ON schools(name);
CREATE INDEX idx_schools_active ON schools(is_active);
CREATE INDEX idx_schools_city ON schools(city);

-- Users indexes
CREATE INDEX idx_app_users_role ON app_users(role);
CREATE INDEX idx_app_users_school ON app_users(school_id);
CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_active ON app_users(is_active);
CREATE INDEX idx_app_users_student_id ON app_users(student_id);
CREATE INDEX idx_app_users_employee_id ON app_users(employee_id);
CREATE INDEX idx_app_users_name_trgm ON app_users USING gin(name gin_trgm_ops); -- Fuzzy search

-- Classes indexes
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_classes_active ON classes(is_active);
CREATE INDEX idx_classes_code ON classes(class_code);
CREATE INDEX idx_classes_academic_year ON classes(academic_year);

-- Enrollments indexes
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_status ON enrollments(enrollment_status);

-- Assignments indexes
CREATE INDEX idx_assignments_class ON assignments(class_id);
CREATE INDEX idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_assignments_published ON assignments(is_published);
CREATE INDEX idx_assignments_type ON assignments(assignment_type);

-- Submissions indexes
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_graded_by ON submissions(graded_by);
CREATE INDEX idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX idx_submissions_is_late ON submissions(is_late);

-- Lessons indexes
CREATE INDEX idx_lessons_class ON lessons(class_id);
CREATE INDEX idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX idx_lessons_school ON lessons(school_id);
CREATE INDEX idx_lessons_published ON lessons(is_published);
CREATE INDEX idx_lessons_order ON lessons(order_index);
CREATE INDEX idx_lessons_type ON lessons(lesson_type);

-- Messages indexes
CREATE INDEX idx_messages_class ON messages(class_id);
CREATE INDEX idx_messages_school ON messages(school_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_pinned ON messages(is_pinned);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Activity Logs indexes
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Attendance indexes
CREATE INDEX idx_attendance_class ON attendance(class_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);

-- Calendar Events indexes
CREATE INDEX idx_calendar_events_class ON calendar_events(class_id);
CREATE INDEX idx_calendar_events_school ON calendar_events(school_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_type ON calendar_events(event_type);

-- Lesson Progress indexes
CREATE INDEX idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX idx_lesson_progress_status ON lesson_progress(status);

-- File Metadata indexes
CREATE INDEX idx_file_metadata_entity ON file_metadata(entity_type, entity_id);
CREATE INDEX idx_file_metadata_uploaded_by ON file_metadata(uploaded_by);
CREATE INDEX idx_file_metadata_created_at ON file_metadata(created_at);


-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_users_updated_at BEFORE UPDATE ON app_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at BEFORE UPDATE ON lesson_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update class enrollment count
CREATE OR REPLACE FUNCTION update_class_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE classes 
        SET current_enrollment = current_enrollment + 1 
        WHERE id = NEW.class_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE classes 
        SET current_enrollment = current_enrollment - 1 
        WHERE id = OLD.class_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_enrollment_count_insert AFTER INSERT ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_class_enrollment_count();

CREATE TRIGGER update_enrollment_count_delete AFTER DELETE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_class_enrollment_count();

-- Function to update assignment submission count
CREATE OR REPLACE FUNCTION update_assignment_submission_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE assignments 
        SET submission_count = submission_count + 1 
        WHERE id = NEW.assignment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE assignments 
        SET submission_count = submission_count - 1 
        WHERE id = OLD.assignment_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_submission_count_insert AFTER INSERT ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_assignment_submission_count();

CREATE TRIGGER update_submission_count_delete AFTER DELETE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_assignment_submission_count();

-- Function to update assignment graded count
CREATE OR REPLACE FUNCTION update_assignment_graded_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'graded' AND (OLD.status IS NULL OR OLD.status != 'graded') THEN
        UPDATE assignments 
        SET graded_count = graded_count + 1 
        WHERE id = NEW.assignment_id;
    ELSIF OLD.status = 'graded' AND NEW.status != 'graded' THEN
        UPDATE assignments 
        SET graded_count = graded_count - 1 
        WHERE id = OLD.assignment_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_graded_count AFTER UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_assignment_graded_count();

-- Function to log grade changes
CREATE OR REPLACE FUNCTION log_grade_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.grade IS DISTINCT FROM NEW.grade THEN
        INSERT INTO grade_history (
            submission_id, 
            old_grade, 
            new_grade, 
            old_status, 
            new_status, 
            changed_by,
            change_type
        ) VALUES (
            NEW.id, 
            OLD.grade, 
            NEW.grade, 
            OLD.status, 
            NEW.status, 
            NEW.graded_by,
            CASE 
                WHEN OLD.grade IS NULL THEN 'initial'
                ELSE 'correction'
            END
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_grade_changes_trigger AFTER UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION log_grade_changes();

-- Function to update lesson views count
CREATE OR REPLACE FUNCTION update_lesson_views()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE lessons 
    SET views_count = views_count + 1 
    WHERE id = NEW.lesson_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lesson_views_trigger AFTER INSERT ON lesson_progress
    FOR EACH ROW EXECUTE FUNCTION update_lesson_views();

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_read()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE messages 
    SET is_read = TRUE, read_at = NOW() 
    WHERE id = NEW.message_id AND recipient_id = NEW.user_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER mark_message_read_trigger AFTER INSERT ON message_reads
    FOR EACH ROW EXECUTE FUNCTION mark_message_read();


-- ============================================================================
-- VIEWS FOR COMPLEX QUERIES (Performance optimization)
-- ============================================================================

-- View: Student Assignment Status (Excel-like view)
CREATE OR REPLACE VIEW v_student_assignment_status AS
SELECT 
    a.id as assignment_id,
    a.title as assignment_title,
    a.due_date,
    a.max_score,
    c.id as class_id,
    c.name as class_name,
    s.id as school_id,
    s.name as school_name,
    u.id as student_id,
    u.name as student_name,
    u.email as student_email,
    u.phone as student_phone,
    u.parent_phone,
    u.parent_email,
    u.parent_name,
    COALESCE(sub.status, 
        CASE 
            WHEN a.due_date < NOW() THEN 'missing'
            ELSE 'not_submitted'
        END
    ) as submission_status,
    sub.submitted_at,
    sub.grade,
    sub.feedback,
    CASE 
        WHEN sub.submitted_at IS NULL AND a.due_date < NOW() THEN TRUE
        WHEN sub.is_late = TRUE THEN TRUE
        ELSE FALSE
    END as is_late,
    CASE 
        WHEN a.due_date < NOW() AND sub.submitted_at IS NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - a.due_date))/3600
        WHEN sub.is_late = TRUE THEN sub.late_by_hours
        ELSE 0
    END as hours_late
FROM assignments a
CROSS JOIN app_users u
INNER JOIN classes c ON a.class_id = c.id
LEFT JOIN schools s ON c.school_id = s.id
LEFT JOIN enrollments e ON e.class_id = c.id AND e.student_id = u.id
LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = u.id
WHERE u.role = 'student' 
AND e.enrollment_status = 'active'
ORDER BY a.due_date DESC, u.name;

-- View: Class Performance Summary
CREATE OR REPLACE VIEW v_class_performance AS
SELECT 
    c.id as class_id,
    c.name as class_name,
    c.teacher_id,
    t.name as teacher_name,
    COUNT(DISTINCT e.student_id) as total_students,
    COUNT(DISTINCT a.id) as total_assignments,
    COUNT(DISTINCT CASE WHEN sub.status = 'graded' THEN sub.id END) as graded_submissions,
    AVG(CASE WHEN sub.status = 'graded' THEN sub.grade END) as average_grade,
    AVG(CASE WHEN att.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 as attendance_percentage
FROM classes c
LEFT JOIN app_users t ON c.teacher_id = t.id
LEFT JOIN enrollments e ON e.class_id = c.id AND e.enrollment_status = 'active'
LEFT JOIN assignments a ON a.class_id = c.id
LEFT JOIN submissions sub ON sub.assignment_id = a.id
LEFT JOIN attendance att ON att.class_id = c.id
GROUP BY c.id, c.name, c.teacher_id, t.name;

-- View: Student Performance Dashboard
CREATE OR REPLACE VIEW v_student_performance AS
SELECT 
    u.id as student_id,
    u.name as student_name,
    u.email,
    c.id as class_id,
    c.name as class_name,
    COUNT(DISTINCT a.id) as total_assignments,
    COUNT(DISTINCT sub.id) as submitted_assignments,
    COUNT(DISTINCT CASE WHEN sub.status = 'graded' THEN sub.id END) as graded_assignments,
    AVG(CASE WHEN sub.status = 'graded' THEN sub.grade END) as average_grade,
    MAX(sub.grade) as highest_grade,
    MIN(sub.grade) as lowest_grade,
    COUNT(DISTINCT CASE WHEN sub.is_late = TRUE THEN sub.id END) as late_submissions,
    AVG(CASE WHEN att.status = 'present' THEN 1 ELSE 0 END)::decimal * 100 as attendance_percentage
FROM app_users u
INNER JOIN enrollments e ON e.student_id = u.id AND e.enrollment_status = 'active'
INNER JOIN classes c ON c.id = e.class_id
LEFT JOIN assignments a ON a.class_id = c.id
LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = u.id
LEFT JOIN attendance att ON att.class_id = c.id AND att.student_id = u.id
WHERE u.role = 'student'
GROUP BY u.id, u.name, u.email, c.id, c.name;

-- View: Teacher Workload
CREATE OR REPLACE VIEW v_teacher_workload AS
SELECT 
    t.id as teacher_id,
    t.name as teacher_name,
    COUNT(DISTINCT c.id) as total_classes,
    COUNT(DISTINCT e.student_id) as total_students,
    COUNT(DISTINCT a.id) as total_assignments,
    COUNT(DISTINCT CASE WHEN sub.status IN ('submitted', 'late', 'resubmitted') THEN sub.id END) as pending_grading,
    COUNT(DISTINCT CASE WHEN sub.status = 'graded' THEN sub.id END) as graded_submissions,
    AVG(CASE WHEN sub.status = 'graded' THEN 
        EXTRACT(EPOCH FROM (sub.graded_at - sub.submitted_at))/3600 
    END) as avg_grading_time_hours
FROM app_users t
LEFT JOIN classes c ON c.teacher_id = t.id AND c.is_active = TRUE
LEFT JOIN enrollments e ON e.class_id = c.id AND e.enrollment_status = 'active'
LEFT JOIN assignments a ON a.class_id = c.id
LEFT JOIN submissions sub ON sub.assignment_id = a.id
WHERE t.role = 'teacher'
GROUP BY t.id, t.name;
