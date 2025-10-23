-- Comprehensive school deletion function
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION delete_school_cascade(school_id_param UUID)
RETURNS JSON AS $$
DECLARE
  users_to_delete UUID[];
  files_to_delete TEXT[];
  result JSON;
  deleted_users_count INTEGER := 0;
  deleted_files_count INTEGER := 0;
BEGIN
  -- Get users that should be deleted when school is deleted
  -- Include: students, teachers who only belong to this school
  -- Exclude: admins, teachers who belong to multiple schools
  SELECT ARRAY_AGG(id) INTO users_to_delete
  FROM app_users 
  WHERE school_id = school_id_param 
    AND (
      role = 'student' 
      OR (
        role = 'teacher' 
        AND id NOT IN (
          -- Teachers who teach in multiple schools (through classes)
          SELECT DISTINCT u.id 
          FROM app_users u
          JOIN classes c ON c.teacher_id = u.id
          WHERE u.role = 'teacher' 
            AND c.school_id != school_id_param
        )
      )
    )
    AND role != 'admin'; -- Never delete admins

  -- Get all file paths for submissions from users being deleted
  SELECT ARRAY_AGG(DISTINCT s.file_path) INTO files_to_delete
  FROM submissions s
  JOIN assignments a ON a.id = s.assignment_id
  JOIN classes cl ON cl.id = a.class_id
  WHERE cl.school_id = school_id_param
     OR s.student_id = ANY(users_to_delete);

  -- Also get lesson video files from this school
  SELECT ARRAY_AGG(DISTINCT l.video_path) INTO files_to_delete
  FROM (
    SELECT UNNEST(files_to_delete) AS file_path
    UNION
    SELECT video_path 
    FROM lessons l
    JOIN classes cl ON cl.id = l.class_id
    WHERE cl.school_id = school_id_param
      AND video_path IS NOT NULL
    UNION
    SELECT video_path
    FROM lessons l
    WHERE l.school_id = school_id_param
      AND video_path IS NOT NULL
  ) combined;

  -- Start the deletion cascade
  
  -- 1. Delete submissions and related data
  DELETE FROM submissions 
  WHERE student_id = ANY(users_to_delete)
     OR assignment_id IN (
       SELECT a.id FROM assignments a
       JOIN classes c ON c.id = a.class_id
       WHERE c.school_id = school_id_param
     );

  -- 2. Delete assignments
  DELETE FROM assignments 
  WHERE class_id IN (
    SELECT id FROM classes WHERE school_id = school_id_param
  );

  -- 3. Delete enrollments
  DELETE FROM enrollments 
  WHERE student_id = ANY(users_to_delete)
     OR class_id IN (
       SELECT id FROM classes WHERE school_id = school_id_param
     );

  -- 4. Delete lessons
  DELETE FROM lessons 
  WHERE class_id IN (
    SELECT id FROM classes WHERE school_id = school_id_param
  ) OR school_id = school_id_param;

  -- 5. Delete messages/announcements
  DELETE FROM messages 
  WHERE class_id IN (
    SELECT id FROM classes WHERE school_id = school_id_param
  ) OR school_id = school_id_param
     OR sender_id = ANY(users_to_delete);

  -- 6. Delete classes
  DELETE FROM classes WHERE school_id = school_id_param;

  -- 7. Delete calendar events
  DELETE FROM calendar_events WHERE school_id = school_id_param;

  -- 8. Delete notifications for these users
  DELETE FROM notifications WHERE user_id = ANY(users_to_delete);

  -- 9. Delete activity logs
  DELETE FROM activity_logs WHERE user_id = ANY(users_to_delete);

  -- 10. Delete user permissions
  DELETE FROM user_permissions WHERE user_id = ANY(users_to_delete);

  -- 11. Delete attendance records
  DELETE FROM attendance WHERE student_id = ANY(users_to_delete);

  -- 12. Delete lesson progress
  DELETE FROM lesson_progress WHERE student_id = ANY(users_to_delete);

  -- 13. Delete file metadata
  DELETE FROM file_metadata 
  WHERE uploaded_by = ANY(users_to_delete)
     OR file_path = ANY(files_to_delete);

  -- 14. Delete users (this will cascade to auth.users if trigger exists)
  GET DIAGNOSTICS deleted_users_count = ROW_COUNT;
  DELETE FROM app_users WHERE id = ANY(users_to_delete);

  -- 15. Finally delete the school
  DELETE FROM schools WHERE id = school_id_param;

  -- Count files for return
  SELECT COALESCE(array_length(files_to_delete, 1), 0) INTO deleted_files_count;

  -- Return summary
  result := json_build_object(
    'success', true,
    'deleted_users_count', deleted_users_count,
    'deleted_files_count', deleted_files_count,
    'files_to_delete', files_to_delete,
    'users_deleted', users_to_delete
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Return error information
  result := json_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_school_cascade(UUID) TO authenticated;