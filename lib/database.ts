import { supabase } from './supabase';
import { User, School, Class, Assignment, Submission, Lesson, Message } from '../types';

// ============= SCHOOLS =============
export async function createSchool(name: string, description?: string) {
  const { data, error } = await supabase
    .from('schools')
    .insert({ name, description })
    .select()
    .single();
  
  return { data, error };
}

export async function getSchools() {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('created_at', { ascending: false });
  
  return { data, error };
}

export async function deleteSchoolCompletely(schoolId: string) {
  try {
    console.log('Starting complete school deletion for:', schoolId);
    
    // Call the database function to get files that need to be deleted
    const { data: deleteResult, error: dbError } = await supabase
      .rpc('delete_school_cascade', { school_id_param: schoolId });
    
    if (dbError) {
      console.error('Database deletion error:', dbError);
      return { success: false, error: dbError.message };
    }
    
    console.log('Database deletion result:', deleteResult);
    
    // If database deletion was successful, delete files from storage
    if (deleteResult?.success && deleteResult?.files_to_delete?.length > 0) {
      console.log('Deleting files from storage:', deleteResult.files_to_delete);
      
      // Delete files from Supabase Storage
      const filesToDelete = deleteResult.files_to_delete.filter((path: string) => path && path.trim());
      
      if (filesToDelete.length > 0) {
        // Delete from submissions bucket
        const { error: storageError } = await supabase.storage
          .from('submissions')
          .remove(filesToDelete);
        
        if (storageError) {
          console.warn('Some files could not be deleted from storage:', storageError);
          // Don't fail the entire operation for storage errors
        }
        
        // Also try to delete from lessons bucket if any video files
        const videoFiles = filesToDelete.filter((path: string) => 
          path.includes('lessons/') || path.includes('videos/')
        );
        
        if (videoFiles.length > 0) {
          const { error: videoStorageError } = await supabase.storage
            .from('lessons')
            .remove(videoFiles);
          
          if (videoStorageError) {
            console.warn('Some video files could not be deleted:', videoStorageError);
          }
        }
      }
    }
    
    if (deleteResult?.success) {
      return {
        success: true,
        deletedUsers: deleteResult?.deleted_users_count || 0,
        deletedFiles: deleteResult?.deleted_files_count || 0,
        message: deleteResult?.message || `School deleted successfully. Removed ${deleteResult?.deleted_users_count || 0} users.`
      };
    } else {
      console.error('Database function returned failure:', deleteResult);
      // Try manual deletion as fallback
      return await deleteSchoolManually(schoolId);
    }
    
  } catch (error) {
    console.error('Complete school deletion error:', error);
    // Try manual deletion as fallback
    try {
      return await deleteSchoolManually(schoolId);
    } catch (fallbackError) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

// Manual school deletion fallback
async function deleteSchoolManually(schoolId: string) {
  try {
    console.log('Starting manual school deletion for:', schoolId);
    
    let deletedUsers = 0;
    
    // Delete in dependency order
    
    // 1. Delete submissions
    const { error: submissionsError } = await supabase
      .from('submissions')
      .delete()
      .in('assignment_id', 
        supabase.from('assignments').select('id').in('class_id',
          supabase.from('classes').select('id').eq('school_id', schoolId)
        )
      );
    
    if (submissionsError) console.warn('Error deleting submissions:', submissionsError);
    
    // 2. Delete assignments
    const { error: assignmentsError } = await supabase
      .from('assignments')
      .delete()
      .in('class_id', 
        supabase.from('classes').select('id').eq('school_id', schoolId)
      );
    
    if (assignmentsError) console.warn('Error deleting assignments:', assignmentsError);
    
    // 3. Delete study materials
    const { error: materialsError } = await supabase
      .from('study_materials')
      .delete()
      .in('uploaded_by',
        supabase.from('app_users').select('id').eq('school_id', schoolId)
      );
    
    if (materialsError) console.warn('Error deleting materials:', materialsError);
    
    // 4. Delete messages
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .in('sender_id',
        supabase.from('app_users').select('id').eq('school_id', schoolId)
      );
    
    if (messagesError) console.warn('Error deleting messages:', messagesError);
    
    // 5. Delete classes
    const { error: classesError } = await supabase
      .from('classes')
      .delete()
      .eq('school_id', schoolId);
    
    if (classesError) console.warn('Error deleting classes:', classesError);
    
    // 6. Count and delete users (except admins)
    const { data: usersToDelete } = await supabase
      .from('app_users')
      .select('id')
      .eq('school_id', schoolId)
      .neq('role', 'admin');
    
    deletedUsers = usersToDelete?.length || 0;
    
    const { error: usersError } = await supabase
      .from('app_users')
      .delete()
      .eq('school_id', schoolId)
      .neq('role', 'admin');
    
    if (usersError) console.warn('Error deleting users:', usersError);
    
    // 7. Delete the school
    const { error: schoolError } = await supabase
      .from('schools')
      .delete()
      .eq('id', schoolId);
    
    if (schoolError) {
      throw new Error(`Failed to delete school: ${schoolError.message}`);
    }
    
    return {
      success: true,
      deletedUsers,
      deletedFiles: 0,
      message: `School deleted successfully using manual method. Removed ${deletedUsers} users.`
    };
    
  } catch (error) {
    console.error('Manual school deletion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Manual deletion failed'
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
  role: 'admin' | 'teacher' | 'student';
  school_id?: string;
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

    console.log('User deactivated successfully:', userId);
    
    // Note: The user will be automatically signed out when they try to access the app
    // due to the checks in getCurrentUser() and signIn()
    
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

  const assignmentData = {
    title: assignment.title,
    description: assignment.description,
    instructions: assignment.instructions,
    teacher_id: assignment.teacher_id,
    school_id: schoolId,
    assignment_type: assignment.assignment_type || 'assignment',
    file_path: assignment.file_path,
    file_name: assignment.file_name,
    file_size: assignment.file_size,
    is_published: true,
    // Set due_date and max_score based on type
    due_date: assignment.assignment_type === 'material' ? null : assignment.due_date,
    max_score: assignment.assignment_type === 'material' ? null : (assignment.max_score || 100),
  };

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
      submissions(id)
    `)
    .eq('teacher_id', teacherId)
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
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId);
  
  return { error };
}




// ============= SUBMISSIONS =============
export async function createSubmission(submission: {
  assignment_id: string;
  student_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
}) {
  const { data, error } = await supabase
    .from('submissions')
    .insert(submission)
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
  const { data, error } = await supabase
    .from('lessons')
    .insert(lesson)
    .select()
    .single();
  
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
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  
  return { data, error };
}

export async function getLessonsBySchool(schoolId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      class:classes(id, name),
      school:schools(id, name),
      teacher:app_users!lessons_teacher_id_fkey(id, name)
    `)
    .eq('school_id', schoolId)
    .eq('is_published', true)
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
      .eq('is_published', true)
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
    .eq('school_id', userData.school_id)
    .eq('is_published', true)
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



// Create material in study_materials table
export async function createMaterial(material: {
  title: string;
  description?: string;
  class_id?: string;
  uploaded_by: string;
  school_id?: string;
  file_path?: string;
  file_url?: string;
  file_size?: number;
  material_type?: string;
}) {
  const { data, error } = await supabase
    .from('study_materials')
    .insert({
      title: material.title,
      description: material.description,
      class_id: material.class_id,
      uploaded_by: material.uploaded_by,
      file_path: material.file_path,
      file_url: material.file_url,
      file_size: material.file_size,
      material_type: material.material_type || 'pdf',
      is_downloadable: true,
    })
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
  // Get student's school
  const { data: student } = await supabase
    .from('app_users')
    .select('school_id')
    .eq('id', studentId)
    .single();

  if (!student?.school_id) {
    return { data: [], error: null };
  }

  // Get materials from teachers in the same school
  const { data, error } = await supabase
    .from('study_materials')
    .select(`
      *,
      class:classes(id, name),
      uploaded_by_user:app_users!study_materials_uploaded_by_fkey(id, name)
    `)
    .in('uploaded_by', 
      (await supabase.from('app_users').select('id').eq('school_id', student.school_id).eq('role', 'teacher')).data?.map(t => t.id) || []
    )
    .order('created_at', { ascending: false });
  
  return { data, error };
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

// Update user password and email (admin only)
export async function updateUserPassword(userId: string, updates: { email?: string; password?: string }) {
  const { data, error } = await supabase
    .from('app_users')
    .update({
      ...(updates.email && { email: updates.email }),
      ...(updates.password && { password_hash: updates.password }), // In real app, hash this
      updated_at: new Date().toISOString(),
    })
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
      assignment:assignments(id, title, assignment_type, max_score, due_date),
      class:classes(id, name)
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



export async function getMaterialsForStudentFixed(studentId: string) {
  try {
    // Get student's school
    const { data: student, error: studentError } = await supabase
      .from('app_users')
      .select('school_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student?.school_id) {
      console.error('Student not found or no school:', studentError);
      return { data: [], error: studentError };
    }

    // Get materials from teachers in the same school
    const { data, error } = await supabase
      .from('study_materials')
      .select(`
        *,
        uploaded_by_user:app_users!study_materials_uploaded_by_fkey(id, name)
      `)
      .eq('school_id', student.school_id)
      .order('created_at', { ascending: false });
    
    return { data: data || [], error };
  } catch (error) {
    console.error('Error getting materials for student:', error);
    return { data: [], error: { message: 'Failed to get materials' } };
  }
}

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
export async function createMessage(message: {
  class_id?: string;
  sender_id: string;
  title?: string;
  content: string;
  message_type?: string;
  school_id?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ ...message, message_type: message.message_type || 'announcement' })
    .select()
    .single();
  
  return { data, error };
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
  const messageData = {
    class_id: message.class_id,
    sender_id: message.sender_id,
    content: message.content,
    school_id: message.school_id,
    message_type: 'image',
    file_path: message.image_path,
    file_name: message.image_name,
    file_size: message.image_size,
    file_type: 'image'
  };

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
  const messageData = {
    class_id: message.class_id,
    sender_id: message.sender_id,
    content: message.content,
    school_id: message.school_id,
    message_type: 'file',
    file_path: message.file_path,
    file_name: message.file_name,
    file_size: message.file_size,
    file_type: message.file_type
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();
  
  return { data, error };
}

export async function getMessagesByClass(classId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:app_users!messages_sender_id_fkey(id, name, role)
    `)
    .or(`class_id.eq.${classId},school_id.eq.${classId}`)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  
  return { data, error };
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
  // Get teacher's classes
  const { data: teacherClasses } = await supabase
    .from('classes')
    .select('id')
    .eq('teacher_id', teacherId);
  
  const classIds = teacherClasses?.map((c: any) => c.id) || [];
  
  const [classes, enrollments, submissions] = await Promise.all([
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    classIds.length > 0 
      ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).in('class_id', classIds)
      : Promise.resolve({ count: 0 }),
    supabase.from('submissions')
      .select('id', { count: 'exact', head: true })
      .is('grade', null)
      .eq('status', 'submitted')
      .in('assignment_id',
        supabase.from('assignments').select('id').eq('teacher_id', teacherId)
      ),
  ]);
  
  return {
    myClasses: classes.count || 0,
    totalStudents: enrollments.count || 0,
    pendingSubmissions: submissions.count || 0,
  };
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
    const { data: student, error: studentError } = await supabase
      .from('app_users')
      .select('school_id')
      .eq('id', studentId)
      .single();
    
    if (studentError || !student?.school_id) {
      console.error('Student not found or no school:', studentError);
      return { data: [], error: studentError };
    }
    
    // Get all assignments for student's school
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        *,
        teacher:app_users!assignments_teacher_id_fkey(id, name)
      `)
      .eq('school_id', student.school_id)
      .eq('is_published', true)
      .order('due_date', { ascending: true, nullsFirst: false });
    
    if (error) {
      console.error('Error fetching assignments:', error);
      return { data: [], error };
    }
    
    if (!assignments || assignments.length === 0) {
      console.log('No assignments found for school:', student.school_id);
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
    
    console.log(`Found ${assignmentsWithSubmissions.length} assignments for student`);
    return { data: assignmentsWithSubmissions, error: null };
  } catch (error) {
    console.error('Exception in getAssignmentsForStudent:', error);
    return { data: [], error };
  }
}

