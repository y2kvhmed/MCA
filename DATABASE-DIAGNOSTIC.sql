-- 🔍 DATABASE DIAGNOSTIC SCRIPT
-- Run this first to see what exists in your database

-- Check what tables exist
SELECT 'EXISTING TABLES:' as info;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check schools table structure
SELECT 'SCHOOLS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'schools' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check app_users table structure
SELECT 'APP_USERS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'app_users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check assignments table structure
SELECT 'ASSIGNMENTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'assignments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check study_materials table structure
SELECT 'STUDY_MATERIALS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'study_materials' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check data counts
SELECT 'DATA COUNTS:' as info;
SELECT 'schools' as table_name, COUNT(*) as record_count FROM schools
UNION ALL
SELECT 'app_users' as table_name, COUNT(*) as record_count FROM app_users
UNION ALL
SELECT 'assignments' as table_name, COUNT(*) as record_count FROM assignments
UNION ALL
SELECT 'study_materials' as table_name, COUNT(*) as record_count FROM study_materials
UNION ALL
SELECT 'submissions' as table_name, COUNT(*) as record_count FROM submissions
UNION ALL
SELECT 'messages' as table_name, COUNT(*) as record_count FROM messages
UNION ALL
SELECT 'lessons' as table_name, COUNT(*) as record_count FROM lessons;