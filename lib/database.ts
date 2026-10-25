import { supabase } from './supabase';

const logDB = (operation: string, data?: any) => {
  if (__DEV__) {
    console.log(`[DB] ${operation}:`, data || '');
  }
};

const handleDBError = (operation: string, error: any) => {
  console.error(`[DB ERROR] ${operation} failed:`, error);
  return { data: null, error: error.message || 'Database operation failed' };
};
import { User, School, Class, Assignment, Submission, Lesson, Message } from '../types';

// ============= SCHOOLS =============
export async function getSchoolById(id: string) {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
}

export async function getTeacherSchools(teacherId: string) {
  try {
    const { data: teacherSchools, error: tsError } = await supabase
      .from('teacher_schools')
      .select('school_id, schools(id, name, description)')
      .eq('teacher_id', teacherId);

    if (tsError) {
      console.warn('Teacher schools lookup error:', tsError);
    }

    if (teacherSchools && teacherSchools.length > 0) {
      const schools = teacherSchools.map((ts: any) => ts.schools).filter(Boolean);
      return { data: schools, error: null };
    }

    // Fallback to teacher direct school
    const { data: user } = await supabase
      .from('app_users')
      .select('school_id, schools(id, name, description)')
      .eq('id', teacherId)
      .single();

    if (user?.schools) {
      return { data: [user.schools], error: null };
    }

    // Fallback to all schools
    return await getSchools();
  } catch (error: any) {
    console.error('getTeacherSchools exception:', error);
    return await getSchools();
  }
}

export async function setTeacherSchools(teacherId: string, schoolIds: string[]) {
  try {
    // 1. Delete existing associations
    const { error: delError } = await supabase
      .from('teacher_schools')
      .delete()
      .eq('teacher_id', teacherId);

    if (delError) {
      console.warn('Error clearing existing teacher schools:', delError.message);
    }

    // 2. Insert new associations
    if (schoolIds.length > 0) {
      const records = schoolIds.map(schoolId => ({
        teacher_id: teacherId,
        school_id: schoolId,
      }));
      const { error: insError } = await supabase
        .from('teacher_schools')
        .insert(records);
      if (insError) throw insError;
    }

    // 3. Keep primary school_id on app_users in sync with the first selected school
    await supabase
      .from('app_users')
      .update({
        school_id: schoolIds.length > 0 ? schoolIds[0] : null,
      })
      .eq('id', teacherId);

    return { success: true, error: null };
  } catch (error: any) {
    console.error('setTeacherSchools error:', error);
    return { success: false, error: error.message };
  }
}

export async function getTeacherSchoolIds(teacherId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('teacher_schools')
      .select('school_id')
      .eq('teacher_id', teacherId);

    const ids = (data || []).map(r => r.school_id).filter(Boolean);

    // Also check direct school_id
    const { data: user } = await supabase
      .from('app_users')
      .select('school_id')
      .eq('id', teacherId)
      .single();

    if (user?.school_id && !ids.includes(user.school_id)) {
      ids.push(user.school_id);
    }

    return ids;
  } catch (e) {
    console.warn('getTeacherSchoolIds error:', e);
    return [];
  }
}

export async function deleteSchoolCompletely(schoolId: string) {
  try {
    console.log('Starting resilient school deletion for:', schoolId);

    // 1. Delete teacher-school associations
    try {
      await supabase.from('teacher_schools').delete().eq('school_id', schoolId);
    } catch (e) {
      console.warn('Cleanup teacher_schools warning:', e);
    }

    // 2. Unlink any users assigned to this school (teachers and students)
    // Setting school_id to null preserves users and prevents foreign key restriction errors
    try {
      await supabase.from('app_users').update({ school_id: null }).eq('school_id', schoolId);
    } catch (e) {
      console.warn('Cleanup app_users warning:', e);
    }

    // 3. Clean up attendance records for this school
    try {
      await supabase.from('attendance').delete().eq('school_id', schoolId);
    } catch (e) {
      console.warn('Cleanup attendance warning:', e);
    }

    // 4. Clean up recordings assigned to this school
    try {
      await supabase.from('recordings').delete().eq('school_id', schoolId);
    } catch (e) {
      console.warn('Cleanup recordings warning:', e);
    }

    // 5. Clean up materials assigned to this school
    try {
      await supabase.from('materials').delete().eq('school_id', schoolId);
    } catch (e) {
      console.warn('Cleanup materials warning:', e);
    }

    // 6. Clean up assignments and submissions for this school
    try {
      const { data: schoolAssignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('school_id', schoolId);

      if (schoolAssignments && schoolAssignments.length > 0) {
        const assignmentIds = schoolAssignments.map((a: any) => a.id);
        await supabase.from('submissions').delete().in('assignment_id', assignmentIds);
        await supabase.from('assignments').delete().eq('school_id', schoolId);
      }
    } catch (e) {
      console.warn('Cleanup assignments warning:', e);
    }

    // 7. Clean up classes belonging to this school
    try {
      await supabase.from('classes').delete().eq('school_id', schoolId);
    } catch (e) {
      console.warn('Cleanup classes warning:', e);
    }

    // 8. Delete the school itself
    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', schoolId);

    if (error) {
      console.error('School deletion error:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete school'
      };
    }

    console.log('School deleted successfully');
    return {
      success: true,
      message: 'School deleted successfully'
    };

  } catch (error) {
    console.error('School deletion exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// ============= USERS =============


export async function createUser(userData: {
  email: string;
  name: string;
  password: string;
  phone?: string;
  parent_phone?: string;
  grade_level?: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  school_id?: string;
  linked_student_id?: string;
  parent_email?: string;
  is_active: boolean;
}) {
  try {
    console.log('Creating user with data:', { ...userData, password: '[HIDDEN]' });

    // First check if user already exists
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id, email, is_active')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return {
        data: null,
        error: {
          message: `User with email ${userData.email} already exists`,
          code: 'USER_EXISTS'
        }
      };
    }

    // Create a clean insert object with only defined values
    const insertData: any = {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      is_active: userData.is_active,
      password_hash: userData.password,
    };

    // Only add optional fields if they have values
    if (userData.phone) insertData.phone = userData.phone;
    if (userData.parent_phone) insertData.parent_phone = userData.parent_phone;
    if (userData.grade_level) insertData.grade_level = userData.grade_level;
    if (userData.school_id) insertData.school_id = userData.school_id;
    if (userData.linked_student_id) insertData.linked_student_id = userData.linked_student_id;
    if (userData.parent_email) insertData.parent_email = userData.parent_email;

    console.log('Insert data prepared:', { ...insertData, password_hash: '[HIDDEN]' });

    // Create the user
    const { data, error } = await supabase
      .from('app_users')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('User creation error:', error);

      // Handle specific error cases
      if (error.code === '23505') { // Unique constraint violation
        return {
          data: null,
          error: {
            message: `User with email ${userData.email} already exists`,
            code: 'USER_EXISTS'
          }
        };
      }

      return { data: null, error };
    }

    console.log('User created successfully:', data?.id);
    return { data, error: null };

  } catch (error) {
    console.error('Create user exception:', error);
    return { data: null, error: { message: 'Failed to create user' } };
  }
}

export async function getUsers(role?: string) {
  let query = supabase.from('app_users').select(`
    *,
    school:schools(id, name)
  `);

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  return { data, error };
}

export async function getUserById(userId: string) {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('id', userId)
    .single();

  return { data, error };
}

export async function deleteUser(userId: string) {
  try {
    const { getCurrentUser } = await import('./auth');
    const currentUser = await getCurrentUser();

    // Prevent self-deletion
    if (currentUser?.id === userId) {
      return { error: { message: 'Security restriction: You cannot delete your own account.' } };
    }

    // Check if target user is an admin
    const { data: targetUser } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', userId)
      .single();

    if (targetUser?.role === 'admin') {
      const { count } = await supabase
        .from('app_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);

      if (count && count <= 1) {
        return { error: { message: 'Security restriction: Cannot delete the only remaining administrator account.' } };
      }
    }

    // Delete from app_users table
    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Database deletion error:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Delete user error:', error);
    return { error: error as any };
  }
}

export async function deactivateUser(userId: string) {
  try {
    const { getCurrentUser } = await import('./auth');
    const currentUser = await getCurrentUser();

    // Prevent self-deactivation
    if (currentUser?.id === userId) {
      return { data: null, error: { message: 'Security restriction: You cannot deactivate your own account.' } };
    }

    // Update user status to inactive
    const { data, error } = await supabase
      .from('app_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Deactivate user error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Deactivate user exception:', error);
    return { data: null, error: { message: 'Failed to deactivate user' } };
  }
}

export async function activateUser(userId: string) {
  const { data, error } = await supabase
    .from('app_users')
    .update({ is_active: true })
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}





// ============= ASSIGNMENTS =============
export async function createAssignment(assignment: {
  teacher_id: string;
  title: string;
  description?: string;
  instructions?: string;
  due_date?: string;
  max_score?: number;
  assignment_type?: string;
  school_id?: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
}) {
  // Get teacher's school if not provided
  let schoolId = assignment.school_id;
  if (!schoolId) {
    const { data: teacher } = await supabase
      .from('app_users')
      .select('school_id')
      .eq('id', assignment.teacher_id)
      .single();
    schoolId = teacher?.school_id;
  }

  // Only include core fields
  const assignmentData: any = {
    title: assignment.title,
    teacher_id: assignment.teacher_id,
  };

  if (assignment.description) assignmentData.description = assignment.description;
  if (assignment.instructions) assignmentData.instructions = assignment.instructions;
  if (schoolId) assignmentData.school_id = schoolId;
  if (assignment.due_date) assignmentData.due_date = assignment.due_date;
  if (assignment.max_score) assignmentData.max_score = assignment.max_score;

  const { data, error } = await supabase
    .from('assignments')
    .insert(assignmentData)
    .select(`
      *,
      teacher:app_users!assignments_teacher_id_fkey(id, name),
      school:schools(id, name)
    `)
    .single();

  return { data, error };
}

export async function getAssignmentsByClass(classId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      class:classes(id, name),
      teacher:app_users!assignments_teacher_id_fkey(id, name),
      submissions(count)
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function getAssignmentsByTeacher(teacherId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      teacher:app_users!assignments_teacher_id_fkey(id, name),
      school:schools(id, name),
      submissions(id)
    `)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Every assignment belonging to the schools the teacher teaches in, so co-teachers at the same
 * school share one list instead of only seeing what they created themselves. The teacher's own
 * assignments are always included too, so anything created before a school was attached (or with
 * a null school_id) can never disappear from the list.
 */
export async function getAssignmentsByTeacherSchools(teacherId: string) {
  const schoolIds = await getTeacherSchoolIds(teacherId);

  const filters = [`teacher_id.eq.${teacherId}`];
  if (schoolIds.length > 0) {
    filters.push(`school_id.in.(${schoolIds.join(',')})`);
  }

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      teacher:app_users!assignments_teacher_id_fkey(id, name),
      school:schools(id, name),
      submissions(id)
    `)
    .or(filters.join(','))
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function getAssignmentById(assignmentId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      teacher:app_users!assignments_teacher_id_fkey(id, name),
      school:schools(id, name)
    `)
    .eq('id', assignmentId)
    .single();

  return { data, error };
}

export async function updateAssignment(assignmentId: string, updates: {
  title?: string;
  description?: string;
  instructions?: string;
  due_date?: string;
  max_score?: number;
}) {
  const { data, error } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select()
    .single();

  return { data, error };
}

export async function deleteAssignment(assignmentId: string) {
  try {
    // Clean up dependent child records first
    await supabase.from('assignment_comments').delete().eq('assignment_id', assignmentId);
    await supabase.from('submissions').delete().eq('assignment_id', assignmentId);
    
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId);

    return { error };
  } catch (err: any) {
    return { error: err };
  }
}




// ============= SUBMISSIONS =============
export async function createSubmission(submission: {
  assignment_id: string;
  student_id: string;
  content?: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_url?: string;
  status?: string;
  points_earned?: number;
}) {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      assignment_id: submission.assignment_id,
      student_id: submission.student_id,
      content: submission.content || 'File submission',
      file_path: submission.file_path,
      file_name: submission.file_name,
      file_size: submission.file_size,
      file_url: submission.file_url,
      status: submission.status || 'submitted',
      points_earned: submission.points_earned,
      submitted_at: new Date().toISOString()
    })
    .select()
    .single();

  return { data, error };
}

export async function getSubmissionsByAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      student:app_users!submissions_student_id_fkey(id, name, email),
      assignment:assignments(id, title, max_score)
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });

  return { data, error };
}

export async function getSubmissionsByStudent(studentId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignment:assignments(
        id,
        title,
        max_score,
        class:classes(id, name)
      )
    `)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });

  return { data, error };
}

export async function gradeSubmission(
  submissionId: string,
  grade: number,
  feedback: string,
  gradedBy: string
) {
  const { data, error } = await supabase
    .from('submissions')
    .update({
      grade,
      feedback,
      status: 'graded',
      graded_at: new Date().toISOString(),
      graded_by: gradedBy,
    })
    .eq('id', submissionId)
    .select()
    .single();

  return { data, error };
}

export async function getPendingSubmissions(teacherId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      student:app_users!submissions_student_id_fkey(id, name, email),
      assignment:assignments!inner(
        id,
        title,
        max_score,
        class:classes(id, name)
      )
    `)
    .eq('assignment.teacher_id', teacherId)
    .eq('status', 'submitted')
    .is('grade', null)
    .order('submitted_at', { ascending: true });

  return { data, error };
}


// ============= LESSONS =============
export async function createLesson(lesson: {
  class_id?: string | null;
  teacher_id: string;
  title: string;
  description?: string;
  video_path?: string;
  lesson_type?: string;
  duration_minutes?: number;
  scheduled_at?: string;
  school_id?: string | null;
  is_published?: boolean;
}) {
  console.log('[DB] createLesson called with:', lesson);

  // Only include fields that are provided
  const lessonData: any = {
    teacher_id: lesson.teacher_id,
    title: lesson.title,
    is_published: true, // Publish by default so recordings are visible immediately
  };

  if (lesson.description) lessonData.description = lesson.description;
  if (lesson.video_path) lessonData.video_path = lesson.video_path;
  if (lesson.duration_minutes) lessonData.duration_minutes = lesson.duration_minutes;
  if (lesson.school_id !== undefined) lessonData.school_id = lesson.school_id;
  if (lesson.class_id !== undefined) lessonData.class_id = lesson.class_id;
  if (lesson.is_published !== undefined) lessonData.is_published = lesson.is_published;

  console.log('[DB] Inserting lesson data:', lessonData);

  const { data, error } = await supabase
    .from('lessons')
    .insert(lessonData)
    .select()
    .single();

  console.log('[DB] Supabase response:', { data, error });

  return { data, error };
}

export async function getLessonsByClass(classId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      class:classes(id, name),
      teacher:app_users!lessons_teacher_id_fkey(id, name)
    `)
    .eq('class_id', classId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function getLessonsBySchool(schoolId: string) {
  // Get lessons for this school OR global lessons (where school_id is null)
  // Don't filter by is_published to ensure existing recordings remain visible
  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      class:classes(id, name),
      school:schools(id, name),
      teacher:app_users!lessons_teacher_id_fkey(id, name)
    `)
    .or(`school_id.eq.${schoolId},school_id.is.null`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function getLessonsForStudent(studentId: string) {
  // First try to get lessons by student's school
  const { data: userData, error: userError } = await supabase
    .from('app_users')
    .select('school_id')
    .eq('id', studentId)
    .single();

  if (userError || !userData?.school_id) {
    // Fallback to class-based lessons if no school
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', studentId);

    if (enrollError || !enrollments) return { data: null, error: enrollError };

    const classIds = enrollments.map((e: any) => e.class_id);

    const { data, error } = await supabase
      .from('lessons')
      .select(`
        *,
        class:classes(id, name),
        school:schools(id, name)
      `)
      .in('class_id', classIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    return { data, error };
  }

  // Get lessons by school
  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      class:classes(id, name),
      school:schools(id, name),
      teacher:app_users!lessons_teacher_id_fkey(id, name)
    `)
    .or(`school_id.eq.${userData.school_id},school_id.is.null`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function publishLesson(lessonId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .update({ is_published: true })
    .eq('id', lessonId)
    .select()
    .single();

  return { data, error };
}

export async function getAllLessons() {
  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      class:classes(id, name),
      teacher:app_users!lessons_teacher_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function deleteLesson(lessonId: string) {
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId);

  return { error };
}

// ============= RECORDING MANAGEMENT =============
export async function updateLesson(lessonId: string, updates: {
  title?: string;
  description?: string;
  video_url?: string;
  duration_minutes?: number;
  last_edited_by?: string;
}) {
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('lessons')
    .update(updateData)
    .eq('id', lessonId)
    .select()
    .single();

  return { data, error };
}

export async function softDeleteLesson(lessonId: string, userId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .update({
      deleted_at: new Date().toISOString(),
      last_edited_by: userId,
    })
    .eq('id', lessonId)
    .select()
    .single();

  return { data, error };
}

export async function getLessonById(lessonId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      school:schools(id, name),
      teacher:app_users!lessons_teacher_id_fkey(id, name, email)
    `)
    .eq('id', lessonId)
    .is('deleted_at', null)
    .single();

  return { data, error };
}

// Get real school statistics
export async function getSchoolStats(schoolId: string) {
  try {
    // Get student count
    const { data: students } = await supabase
      .from('app_users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .eq('is_active', true);

    // Get teacher count  
    const { data: teachers } = await supabase
      .from('app_users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .eq('is_active', true);

    // Get assignments count for this school
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .in('teacher_id', teachers?.map(t => t.id) || []);

    // Get materials count
    const { data: materials } = await supabase
      .from('study_materials')
      .select('id')
      .in('uploaded_by', teachers?.map(t => t.id) || []);

    return {
      totalStudents: students?.length || 0,
      totalTeachers: teachers?.length || 0,
      myAssignments: assignments?.length || 0,
      materialsSent: materials?.length || 0,
    };
  } catch (error) {
    console.error('Error getting school stats:', error);
    return {
      totalStudents: 0,
      totalTeachers: 0,
      myAssignments: 0,
      materialsSent: 0,
    };
  }
}

// Get stats scoped to every school the teacher is assigned to.
// Used by the teacher dashboard so the cards reflect the teacher's schools
// rather than only their primary school_id (which may be null).
export async function getTeacherSchoolStats(teacherId: string) {
  const empty = { totalStudents: 0, totalTeachers: 0, myAssignments: 0, materialsSent: 0 };
  try {
    const schoolIds = await getTeacherSchoolIds(teacherId);

    let totalStudents = 0;
    let totalTeachers = 0;
    let materialsSent = 0;

    if (schoolIds.length > 0) {
      const [studentsRes, teachersRes, materialsRes] = await Promise.all([
        supabase
          .from('app_users')
          .select('id')
          .in('school_id', schoolIds)
          .eq('role', 'student')
          .eq('is_active', true),
        supabase
          .from('app_users')
          .select('id')
          .in('school_id', schoolIds)
          .eq('role', 'teacher')
          .eq('is_active', true),
        supabase.from('study_materials').select('id').in('school_id', schoolIds),
      ]);

      totalStudents = studentsRes.data?.length || 0;
      totalTeachers = teachersRes.data?.length || 0;
      materialsSent = materialsRes.data?.length || 0;
    }

    // Assignments use the same school-wide source as the School Assignments screen
    let myAssignments = 0;
    try {
      const { data: assignments } = await getAssignmentsByTeacherSchools(teacherId);
      myAssignments = assignments?.length || 0;
    } catch (e) {
      console.warn('getTeacherSchoolStats assignments error:', e);
    }

    return { totalStudents, totalTeachers, myAssignments, materialsSent };
  } catch (error) {
    console.error('Error getting teacher school stats:', error);
    return empty;
  }
}



// Create material in study_materials table
export async function createMaterial(material: {
  title: string;
  description?: string;
  class_id?: string;
  teacher_id: string;
  school_id?: string;
  file_path?: string;
  file_url?: string;
  file_size?: number;
  material_type?: string;
}) {
  const materialData: any = {
    title: material.title,
    uploaded_by: material.teacher_id,
  };

  if (material.description) materialData.description = material.description;
  if (material.school_id) materialData.school_id = material.school_id;
  if (material.class_id) materialData.class_id = material.class_id;
  if (material.file_path) materialData.file_path = material.file_path;
  if (material.file_url) materialData.file_url = material.file_url;
  if (material.file_size) materialData.file_size = material.file_size;
  if (material.material_type) materialData.material_type = material.material_type;

  const { data, error } = await supabase
    .from('study_materials')
    .insert(materialData)
    .select()
    .single();

  return { data, error };
}

// Get materials by teacher
export async function getMaterialsByTeacher(teacherId: string) {
  const { data, error } = await supabase
    .from('study_materials')
    .select(`
      *,
      class:classes(id, name),
      uploaded_by_user:app_users!study_materials_uploaded_by_fkey(id, name)
    `)
    .eq('uploaded_by', teacherId)
    .order('created_at', { ascending: false });

  return { data, error };
}

// Get materials for student
export async function getMaterialsForStudent(studentId: string) {
  try {
    const { data: student } = await supabase
      .from('app_users')
      .select('school_id')
      .eq('id', studentId)
      .single();

    let query = supabase
      .from('study_materials')
      .select(`
        *,
        uploaded_by_user:app_users(id, name)
      `)
      .order('created_at', { ascending: false });

    if (student?.school_id) {
      query = query.or(`school_id.eq.${student.school_id},school_id.is.null`);
    }

    let { data, error } = await query;
    if (error) {
      let fbQuery = supabase
        .from('study_materials')
        .select('*')
        .order('created_at', { ascending: false });
      if (student?.school_id) {
        fbQuery = fbQuery.or(`school_id.eq.${student.school_id},school_id.is.null`);
      }
      const fb = await fbQuery;
      data = fb.data;
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('getMaterialsForStudent error:', err);
    return { data: [], error: null };
  }
}

// Get users by school (excluding admins if specified)
export async function getUsersBySchool(schoolId: string | null, excludeAdmins: boolean = false) {
  let query = supabase
    .from('app_users')
    .select(`
      *,
      school:schools(id, name)
    `)
    .eq('is_active', true);

  if (schoolId) {
    query = query.eq('school_id', schoolId);
  }

  if (excludeAdmins) {
    query = query.neq('role', 'admin');
  }

  const { data, error } = await query.order('name');
  return { data, error };
}

// Update user details (admin only) - password editing removed
export async function updateUserPassword(userId: string, updates: { email?: string; name?: string; password?: string }) {
  const updatePayload: any = { updated_at: new Date().toISOString() };
  if (updates.email) updatePayload.email = updates.email;
  if (updates.name) updatePayload.name = updates.name;

  const { data, error } = await supabase
    .from('app_users')
    .update(updatePayload)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

export async function getStudentSubmissions(studentId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignment:assignments(id, title, assignment_type, max_score, due_date, class_id)
    `)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });

  return { data, error };
}



export async function getAssignmentsBySchool(schoolId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      teacher:app_users!assignments_teacher_id_fkey(id, name),
      school:schools(id, name)
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  return { data, error };
}



// Removed duplicate getMaterialsForStudentFixed - using getMaterialsForStudent instead

// ============= ASSIGNMENT COMMENTS =============
export async function addAssignmentComment(comment: {
  assignment_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string;
}) {
  const { data, error } = await supabase
    .from('assignment_comments')
    .insert(comment)
    .select(`
      *,
      user:app_users!assignment_comments_user_id_fkey(id, name, role)
    `)
    .single();

  return { data, error };
}

export async function getAssignmentComments(assignmentId: string) {
  const { data, error } = await supabase
    .from('assignment_comments')
    .select(`
      *,
      user:app_users!assignment_comments_user_id_fkey(id, name, role)
    `)
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true });

  return { data, error };
}

// ============= MESSAGES =============
export async function createMessage(messageData: {
  school_id?: string;
  class_id?: string;
  sender_id: string;
  content: string;
  message_type?: string;
  file_url?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...messageData,
        created_at: new Date().toISOString(),
      })
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(id, name, role, avatar_url)
      `)
      .single();

    if (error) {
      console.error('createMessage error:', error);
      // Fallback simple insert
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('messages')
        .insert({
          ...messageData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      return { data: fallbackData, error: fallbackError };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('createMessage exception:', error);
    return { data: null, error };
  }
}

export async function createImageMessage(message: {
  class_id?: string;
  sender_id: string;
  content: string;
  school_id?: string;
  image_path: string;
  image_name: string;
  image_size: number;
}) {
  const messageData: any = {
    sender_id: message.sender_id,
    content: message.content,
  };

  if (message.class_id) messageData.class_id = message.class_id;
  if (message.school_id) messageData.school_id = message.school_id;

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  return { data, error };
}

export async function createFileMessage(message: {
  class_id?: string;
  sender_id: string;
  content: string;
  school_id?: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
}) {
  const messageData: any = {
    sender_id: message.sender_id,
    content: message.content,
  };

  if (message.class_id) messageData.class_id = message.class_id;
  if (message.school_id) messageData.school_id = message.school_id;

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  return { data, error };
}

export async function getMessagesByClass(schoolOrClassId: string) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(id, name, role, avatar_url)
      `)
      .or(`school_id.eq.${schoolOrClassId},class_id.eq.${schoolOrClassId}`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('getMessagesByClass error:', error);
      // Fallback without FK relation if constraint differs
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('messages')
        .select('*')
        .or(`school_id.eq.${schoolOrClassId},class_id.eq.${schoolOrClassId}`)
        .order('created_at', { ascending: true });

      return { data: fallbackData || [], error: fallbackError };
    }

    return { data: data || [], error: null };
  } catch (error: any) {
    console.error('getMessagesByClass exception:', error);
    return { data: [], error };
  }
}


// ============= STATISTICS =============
export async function getAdminStats() {
  const [schools, users, assignments, students] = await Promise.all([
    supabase.from('schools').select('id', { count: 'exact', head: true }),
    supabase.from('app_users').select('id', { count: 'exact', head: true }),
    supabase.from('assignments').select('id', { count: 'exact', head: true }),
    supabase.from('app_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
  ]);

  return {
    totalSchools: schools.count || 0,
    totalUsers: users.count || 0,
    totalAssignments: assignments.count || 0,
    activeStudents: students.count || 0,
  };
}

export async function getTeacherStats(teacherId: string) {
  try {
    // Get teacher's classes
    const { data: teacherClasses } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', teacherId);

    const classIds = teacherClasses?.map((c: any) => c.id) || [];

    // Get teacher's assignment IDs first
    const { data: teacherAssignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('teacher_id', teacherId);

    const assignmentIds = teacherAssignments?.map((a: any) => a.id) || [];

    const [classes, enrollments, submissions] = await Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
      classIds.length > 0
        ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).in('class_id', classIds)
        : Promise.resolve({ count: 0 }),
      assignmentIds.length > 0
        ? supabase.from('submissions')
          .select('id', { count: 'exact', head: true })
          .is('grade', null)
          .eq('status', 'submitted')
          .in('assignment_id', assignmentIds)
        : Promise.resolve({ count: 0 }),
    ]);

    return {
      myClasses: classes.count || 0,
      totalStudents: enrollments.count || 0,
      pendingSubmissions: submissions.count || 0,
    };
  } catch (error) {
    console.error('Error getting teacher stats:', error);
    return {
      myClasses: 0,
      totalStudents: 0,
      pendingSubmissions: 0,
    };
  }
}

export async function getStudentStats(studentId: string) {
  // Get student's school
  const { data: student } = await supabase
    .from('app_users')
    .select('school_id')
    .eq('id', studentId)
    .single();

  const schoolId = student?.school_id;

  const [assignments, submissions, materials] = await Promise.all([
    // Get assignments for student's school
    schoolId ? supabase.from('assignments').select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .in('teacher_id',
        (await supabase.from('app_users').select('id').eq('school_id', schoolId).eq('role', 'teacher')).data?.map(t => t.id) || []
      )
      : Promise.resolve({ count: 0 }),
    // Get student's submissions
    supabase.from('submissions').select('grade')
      .eq('student_id', studentId)
      .not('grade', 'is', null),
    // Get materials for student's school
    schoolId ? supabase.from('study_materials').select('id', { count: 'exact', head: true })
      .in('uploaded_by',
        (await supabase.from('app_users').select('id').eq('school_id', schoolId).eq('role', 'teacher')).data?.map(t => t.id) || []
      )
      : Promise.resolve({ count: 0 }),
  ]);

  const grades = submissions.data?.map((s: any) => s.grade).filter((g: any) => g !== null) || [];
  const averageGrade = grades.length > 0
    ? Math.round(grades.reduce((a: any, b: any) => a + b, 0) / grades.length)
    : null;

  return {
    totalMaterials: materials.count || 0,
    totalAssignments: assignments.count || 0,
    averageGrade,
  };
}

// ============= CALENDAR =============
export async function createCalendarEvent(eventData: {
  title: string;
  description?: string | null;
  date: string;
  time?: string | null;
  type: string;
  created_by: string;
  user_id: string;
}) {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(eventData)
    .select()
    .single();

  return { data, error };
}

export async function getCalendarEvents(userId: string) {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .or(`user_id.eq.${userId},created_by.eq.${userId}`)
    .order('start_time', { ascending: true });

  return { data, error };
}

export async function getAssignmentsByStudent(studentId: string) {
  // Get all classes the student is enrolled in
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', studentId);

  if (enrollError || !enrollments) return { data: null, error: enrollError };

  const classIds = enrollments.map((e: any) => e.class_id);

  // Get assignments for those classes
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      class:classes(id, name),
      submissions!left(id, grade, status, submitted_at)
    `)
    .in('class_id', classIds)
    .eq('is_published', true)
    .order('due_date', { ascending: true, nullsFirst: false });

  return { data, error };
}

// ============= ANNOUNCEMENTS =============
export async function createAnnouncement(announcementData: {
  title: string;
  content: string;
  sender_id: string;
  target_type: string;
  target_id?: string | null;
  priority: string;
  message_type: string;
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      title: announcementData.title,
      content: announcementData.content,
      sender_id: announcementData.sender_id,
      message_type: announcementData.message_type,
      priority: announcementData.priority,
      // Store target info in metadata
      metadata: {
        target_type: announcementData.target_type,
        target_id: announcementData.target_id,
      }
    })
    .select()
    .single();

  return { data, error };
}

export async function getAnnouncements(userId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:app_users!messages_sender_id_fkey(id, name, role)
    `)
    .eq('message_type', 'announcement')
    .order('created_at', { ascending: false });

  return { data, error };
}

// ============= STUDENT ASSIGNMENTS & MATERIALS =============
export async function getAssignmentsForStudent(studentId: string) {
  try {
    // Get student's school
    const { data: student } = await supabase
      .from('app_users')
      .select('school_id')
      .eq('id', studentId)
      .single();

    let query = supabase
      .from('assignments')
      .select(`
        *,
        teacher:app_users(id, name)
      `)
      .order('created_at', { ascending: false });

    if (student?.school_id) {
      query = query.or(`school_id.eq.${student.school_id},school_id.is.null`);
    } else {
      query = query.is('school_id', null);
    }

    let { data: assignments, error } = await query;
    if (error) {
      let fbQuery = supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });
      if (student?.school_id) {
        fbQuery = fbQuery.or(`school_id.eq.${student.school_id},school_id.is.null`);
      } else {
        fbQuery = fbQuery.is('school_id', null);
      }
      const fb = await fbQuery;
      assignments = fb.data;
    }

    if (!assignments || assignments.length === 0) {
      return { data: [], error: null };
    }

    // Get submissions for these assignments by this student
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissions } = await supabase
      .from('submissions')
      .select('*')
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentId);

    // Combine assignments with their submissions
    const assignmentsWithSubmissions = assignments.map(assignment => ({
      ...assignment,
      submissions: submissions?.filter(s => s.assignment_id === assignment.id) || []
    }));

    return { data: assignmentsWithSubmissions, error: null };
  } catch (error) {
    console.error('Exception in getAssignmentsForStudent:', error);
    return { data: [], error };
  }
}


// SCHOOL OPERATIONS
export async function createSchool(schoolData: {
  name: string;
  description?: string;
}) {
  try {
    logDB('Creating school', schoolData.name);

    const { data, error } = await supabase
      .from('schools')
      .insert({
        name: schoolData.name,
        description: schoolData.description || null
      })
      .select()
      .single();

    if (error) return handleDBError('createSchool', error);

    logDB('School created successfully', data.id);
    return { data, error: null };
  } catch (error) {
    return handleDBError('createSchool', error);
  }
}

export async function updateSchool(schoolId: string, updates: {
  name?: string;
  description?: string;
}) {
  try {
    logDB('Updating school', schoolId);

    const { data, error } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
      .select()
      .single();

    if (error) return handleDBError('updateSchool', error);

    logDB('School updated successfully');
    return { data, error: null };
  } catch (error) {
    return handleDBError('updateSchool', error);
  }
}

export async function deleteSchool(schoolId: string) {
  try {
    logDB('Deleting school completely', schoolId);
    const result = await deleteSchoolCompletely(schoolId);
    if (!result.success) {
      return { data: null, error: result.error || 'Failed to delete school' };
    }
    return { data: true, error: null };
  } catch (error) {
    return handleDBError('deleteSchool', error);
  }
}

export async function getSchools() {
  try {
    logDB('Fetching schools');

    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name');

    if (error) return handleDBError('getSchools', error);

    logDB('Schools fetched', data?.length);
    return { data, error: null };
  } catch (error) {
    return handleDBError('getSchools', error);
  }
}

// USER OPERATIONS


export async function updateUser(userId: string, updates: {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  school_id?: string;
  phone?: string;
  is_active?: boolean;
}) {
  try {
    logDB('Updating user', userId);

    const updateData: any = { ...updates };
    if (updates.password) {
      updateData.password_hash = updates.password;
      delete updateData.password;
    }

    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) return handleDBError('updateUser', error);

    logDB('User updated successfully');
    return { data, error: null };
  } catch (error) {
    return handleDBError('updateUser', error);
  }
}

// All duplicate functions (deactivateUser, deleteUser, getUsers, createAssignment, updateAssignment, 
// deleteAssignment, getAssignments, createMaterial, deleteMaterial, createLesson, updateLesson, 
// deleteLesson, gradeSubmission, getClasses, createClass) are already defined above in their 
// respective sections. Removed duplicates to fix compilation errors.



// ============= ADDITIONAL MATERIAL FUNCTIONS =============

export async function getAllMaterials() {
  try {
    const { data, error } = await supabase
      .from('study_materials')
      .select(`
        *,
        uploaded_by_user:app_users!study_materials_uploaded_by_fkey(id, name),
        school:schools(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) return handleDBError('getAllMaterials', error);
    return { data, error: null };
  } catch (error) {
    return handleDBError('getAllMaterials', error);
  }
}

export async function deleteMaterial(materialId: string) {
  try {
    // Delete file from storage if present
    const { data: mat } = await supabase
      .from('study_materials')
      .select('file_path')
      .eq('id', materialId)
      .single();

    if (mat?.file_path) {
      await supabase.storage.from('study-materials').remove([mat.file_path]);
      await supabase.storage.from('materials').remove([mat.file_path]);
    }

    const { error } = await supabase
      .from('study_materials')
      .delete()
      .eq('id', materialId);

    if (error) return handleDBError('deleteMaterial', error);
    return { error: null };
  } catch (error) {
    return handleDBError('deleteMaterial', error);
  }
}

// ============= ADDITIONAL MESSAGE FUNCTIONS =============

export async function deleteMessage(messageId: string) {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) return handleDBError('deleteMessage', error);
    return { error: null };
  } catch (error) {
    return handleDBError('deleteMessage', error);
  }
}

// ============= PARENT PORTAL FUNCTIONS =============

export async function getLinkedStudent(parentId: string) {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', parentId)
      .eq('role', 'parent')
      .single();

    if (error || !data?.linked_student_id) {
      return { data: null, error: error || { message: 'No linked student found' } };
    }

    const { data: student, error: studentError } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', data.linked_student_id)
      .single();

    return { data: student, error: studentError };
  } catch (error) {
    return handleDBError('getLinkedStudent', error);
  }
}

export async function getStudentSubmissionsForParent(parentId: string) {
  try {
    // Get linked student
    const { data: parent } = await supabase
      .from('app_users')
      .select('linked_student_id')
      .eq('id', parentId)
      .eq('role', 'parent')
      .single();

    if (!parent?.linked_student_id) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(id, title, due_date, max_score, teacher_id, teacher:app_users!assignments_teacher_id_fkey(id, name))
      `)
      .eq('student_id', parent.linked_student_id)
      .order('submitted_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return handleDBError('getStudentSubmissionsForParent', error);
  }
}

export async function getStudentGradesForParent(parentId: string) {
  try {
    const { data: parent } = await supabase
      .from('app_users')
      .select('linked_student_id')
      .eq('id', parentId)
      .eq('role', 'parent')
      .single();

    if (!parent?.linked_student_id) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(id, title, max_score)
      `)
      .eq('student_id', parent.linked_student_id)
      .not('grade', 'is', null)
      .order('submitted_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return handleDBError('getStudentGradesForParent', error);
  }
}

export async function getPrivateMessages(userId: string) {
  try {
    const { data, error } = await supabase
      .from('private_messages')
      .select(`
        *,
        sender:app_users!private_messages_sender_id_fkey(id, name, role, email),
        recipient:app_users!private_messages_recipient_id_fkey(id, name, role, email)
      `)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return handleDBError('getPrivateMessages', error);
  }
}

export async function getPrivateMessagesWithUser(userId: string, otherUserId: string) {
  try {
    const { data, error } = await supabase
      .from('private_messages')
      .select(`
        *,
        sender:app_users!private_messages_sender_id_fkey(id, name, role, email),
        recipient:app_users!private_messages_recipient_id_fkey(id, name, role, email)
      `)
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    return { data, error };
  } catch (error) {
    return handleDBError('getPrivateMessagesWithUser', error);
  }
}

export async function sendPrivateMessage(messageData: {
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('private_messages')
      .insert({
        sender_id: messageData.sender_id,
        recipient_id: messageData.recipient_id,
        content: messageData.content,
        message_type: messageData.message_type || 'text',
        file_path: messageData.file_path,
        file_name: messageData.file_name,
        file_size: messageData.file_size,
        file_type: messageData.file_type,
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return handleDBError('sendPrivateMessage', error);
  }
}

export async function getParentConversations(teacherId: string) {
  try {
    // Get all parents who have messaged this teacher or vice versa
    const { data: messages, error } = await supabase
      .from('private_messages')
      .select(`
        sender_id,
        recipient_id,
        sender:app_users!private_messages_sender_id_fkey(id, name, role, email, linked_student_id),
        recipient:app_users!private_messages_recipient_id_fkey(id, name, role, email, linked_student_id),
        created_at
      `)
      .or(`sender_id.eq.${teacherId},recipient_id.eq.${teacherId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching messages:', error);
      return { data: [], error: null }; // Return empty array instead of error
    }

    // Get unique parent IDs
    const parentIds = new Set<string>();
    messages?.forEach((msg: any) => {
      if (msg.sender?.role === 'parent' && msg.sender_id !== teacherId) {
        parentIds.add(msg.sender_id);
      }
      if (msg.recipient?.role === 'parent' && msg.recipient_id !== teacherId) {
        parentIds.add(msg.recipient_id);
      }
    });

    // Get parent details with their linked students
    const parents = [];
    for (const parentId of Array.from(parentIds)) {
      const { data: parent, error: parentError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', parentId)
        .single();

      if (parent && !parentError) {
        // Get linked student if exists
        if (parent.linked_student_id) {
          const { data: student } = await supabase
            .from('app_users')
            .select('id, name, email')
            .eq('id', parent.linked_student_id)
            .single();
          
          parent.linked_student = student;
        }
        parents.push(parent);
      }
    }

    return { data: parents, error: null };
  } catch (error) {
    console.error('getParentConversations error:', error);
    return { data: [], error: null }; // Return empty array on error
  }
}

// ============================================================================
// STUDENT TEST RESULTS & DETAILED ACADEMIC ANALYTICS
// ============================================================================

export async function getStudentTestResults(studentId: string) {
  try {
    const { data, error } = await supabase
      .from('student_test_results')
      .select(`
        *,
        teacher:app_users!student_test_results_teacher_id_fkey(id, name, email),
        school:schools(id, name)
      `)
      .eq('student_id', studentId)
      .order('test_date', { ascending: true });

    if (error) {
      // Graceful fallback if table does not exist or relation fails
      const { data: rawData, error: rawError } = await supabase
        .from('student_test_results')
        .select('*')
        .eq('student_id', studentId)
        .order('test_date', { ascending: true });

      if (rawError) {
        console.warn('student_test_results query note:', rawError.message);
        return { data: [], error: null };
      }
      return { data: rawData || [], error: null };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('getStudentTestResults error:', error);
    return { data: [], error: null };
  }
}

export async function addStudentTestResult(resultData: {
  student_id: string;
  teacher_id?: string;
  school_id?: string;
  title: string;
  test_date: string;
  score: number;
  max_score: number;
  percentage?: number;
  notes?: string;
  pdf_url?: string;
  pdf_path?: string;
}) {
  try {
    const calculatedPercentage = resultData.max_score > 0
      ? Math.round(((resultData.score / resultData.max_score) * 100) * 100) / 100
      : 0;

    const payload = {
      ...resultData,
      percentage: calculatedPercentage,
    };

    const { data, error } = await supabase
      .from('student_test_results')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return handleDBError('addStudentTestResult', error);
  }
}

export async function updateStudentTestResult(
  id: string,
  updates: Partial<{
    title: string;
    test_date: string;
    score: number;
    max_score: number;
    notes?: string;
    pdf_url?: string;
    pdf_path?: string;
  }>
) {
  try {
    const payload: any = { ...updates, updated_at: new Date().toISOString() };
    if (updates.score !== undefined && updates.max_score !== undefined && updates.max_score > 0) {
      payload.percentage = Math.round(((updates.score / updates.max_score) * 100) * 100) / 100;
    }

    const { data, error } = await supabase
      .from('student_test_results')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return handleDBError('updateStudentTestResult', error);
  }
}

export async function deleteStudentTestResult(id: string) {
  try {
    const { error } = await supabase
      .from('student_test_results')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return handleDBError('deleteStudentTestResult', error);
  }
}

export async function getStudentAttendanceSummary(studentId: string) {
  try {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    const history: Array<{ date: string; status: string; note?: string }> = [];

    // 1. Query attendance_records joined with attendance_sheets
    const { data: records, error: recError } = await supabase
      .from('attendance_records')
      .select(`
        id,
        status,
        note,
        created_at,
        sheet:attendance_sheets(date)
      `)
      .eq('student_id', studentId);

    if (!recError && records && records.length > 0) {
      records.forEach((r: any) => {
        const s = (r.status || '').toLowerCase().trim();
        if (s === 'present') present++;
        else if (s === 'absent') absent++;
        else if (s === 'late' || s === 'punished') late++;
        else if (s === 'excused' || s === 'kicked') excused++;
        else present++;

        history.push({
          date: r.sheet?.date || (r.created_at ? r.created_at.split('T')[0] : 'Unknown'),
          status: s || 'present',
          note: r.note || '',
        });
      });
    }

    // 2. Also check standalone attendance table if present
    const { data: standaloneData } = await supabase
      .from('attendance')
      .select('date, status, notes')
      .eq('student_id', studentId);

    if (standaloneData && standaloneData.length > 0) {
      standaloneData.forEach((r: any) => {
        const s = (r.status || '').toLowerCase().trim();
        if (s === 'present') present++;
        else if (s === 'absent') absent++;
        else if (s === 'late' || s === 'punished') late++;
        else if (s === 'excused' || s === 'kicked') excused++;
        else present++;

        history.push({
          date: r.date || 'Unknown',
          status: s || 'present',
          note: r.notes || '',
        });
      });
    }

    const total = present + absent + late + excused;
    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

    return {
      present,
      absent,
      late,
      excused,
      total,
      attendanceRate,
      history: history.sort((a, b) => b.date.localeCompare(a.date)),
    };
  } catch (error) {
    console.error('getStudentAttendanceSummary error:', error);
    return {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
      attendanceRate: 100,
      history: [],
    };
  }
}

