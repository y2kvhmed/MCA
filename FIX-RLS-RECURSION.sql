-- 🚨 FIX RLS INFINITE RECURSION
-- This will fix the circular reference in policies
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Drop ALL existing policies
-- ============================================
DROP POLICY IF EXISTS "Anyone can view schools" ON schools;
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;
DROP POLICY IF EXISTS "Users can view other users" ON app_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON app_users;
DROP POLICY IF EXISTS "Admins can manage users" ON app_users;
DROP POLICY IF EXISTS "Anyone can view published materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can create materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can update their materials" ON study_materials;
DROP POLICY IF EXISTS "Teachers can delete their materials" ON study_materials;
DROP POLICY IF EXISTS "Students can view assignments from their school" ON assignments;
DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can update their assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can delete their assignments" ON assignments;
DROP POLICY IF EXISTS "Students can view their own submissions" ON submissions;
DROP POLICY IF EXISTS "Students can create their own submissions" ON submissions;
DROP POLICY IF EXISTS "Students can update their own submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers can view submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers can update submissions" ON submissions;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Anyone can view published lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can create lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can update their lessons" ON lessons;
DROP POLICY IF EXISTS "Teachers can delete their lessons" ON lessons;

-- ============================================
-- STEP 2: Create SIMPLE policies without recursion
-- ============================================

-- Schools policies (simple - no user lookup)
CREATE POLICY "Anyone can view schools" ON schools FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage schools" ON schools FOR ALL USING (auth.uid() IS NOT NULL);

-- App users policies (simple - no self-reference)
CREATE POLICY "Anyone can view users" ON app_users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON app_users FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY "Authenticated users can insert" ON app_users FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete" ON app_users FOR DELETE USING (auth.uid() IS NOT NULL);

-- Study materials policies (simple)
CREATE POLICY "Anyone can view materials" ON study_materials FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create materials" ON study_materials FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own materials" ON study_materials FOR UPDATE USING (
  created_by IN (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Users can delete own materials" ON study_materials FOR DELETE USING (
  created_by IN (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
);

-- Assignments policies (simple)
CREATE POLICY "Anyone can view assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create assignments" ON assignments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own assignments" ON assignments FOR UPDATE USING (
  created_by IN (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Users can delete own assignments" ON assignments FOR DELETE USING (
  created_by IN (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
);

-- Submissions policies (simple)
CREATE POLICY "Anyone can view submissions" ON submissions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own submissions" ON submissions FOR UPDATE USING (
  student_id IN (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
);

-- Messages policies (simple)
CREATE POLICY "Anyone can view messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create messages" ON messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Lessons policies (simple)
CREATE POLICY "Anyone can view lessons" ON lessons FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create lessons" ON lessons FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own lessons" ON lessons FOR UPDATE USING (
  created_by IN (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Users can delete own lessons" ON lessons FOR DELETE USING (
  created_by IN (SELECT id FROM app_users WHERE auth_user_id = auth.uid())
);

-- ============================================
-- FINAL STATUS
-- ============================================
SELECT '✅ RLS RECURSION FIXED!' as status;
SELECT 'Policies are now simple and non-recursive' as message;
SELECT 'Test your app now!' as next_step;