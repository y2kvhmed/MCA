-- 🔍 QUICK TEST - Run this to see what's happening
-- Copy the results and tell me what you see

-- Test 1: Check if we can query basic tables
SELECT 'TEST 1: Basic table queries' as test_name;

SELECT 'schools' as table_name, COUNT(*) as count FROM schools;
SELECT 'app_users' as table_name, COUNT(*) as count FROM app_users;

-- Test 2: Check if auth_user_id column was added
SELECT 'TEST 2: Check auth_user_id column' as test_name;

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'app_users' 
AND column_name = 'auth_user_id';

-- Test 3: Check RLS policies
SELECT 'TEST 3: Check RLS policies' as test_name;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('schools', 'app_users', 'assignments', 'study_materials')
ORDER BY tablename, policyname;

-- Test 4: Try a simple query that was failing
SELECT 'TEST 4: Try problematic query' as test_name;

SELECT id FROM schools LIMIT 1;
SELECT id FROM app_users LIMIT 1;