import { supabase } from './supabase';

// CSV Export utilities
export function arrayToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string) {
  if (typeof window !== 'undefined') {
    // Web download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Mobile - you could use expo-file-system to save
    console.log('CSV content:', csvContent);
    console.log('Use expo-file-system to save on mobile');
  }
}

// Assignment Reports
export async function exportAssignmentSubmissions(assignmentId: string) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        student:app_users!submissions_student_id_fkey(name, email, grade_level),
        assignment:assignments(title, due_date, max_score)
      `)
      .eq('assignment_id', assignmentId);

    if (error) throw error;

    const headers = [
      'student_name',
      'student_email',
      'grade_level',
      'submission_date',
      'status',
      'grade',
      'max_score',
      'percentage',
      'submitted_on_time',
      'days_late',
      'feedback'
    ];

    const csvData = data?.map(submission => {
      const dueDate = new Date(submission.assignment.due_date);
      const submissionDate = submission.submitted_at ? new Date(submission.submitted_at) : null;
      const daysLate = submissionDate && submissionDate > dueDate ? 
        Math.ceil((submissionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      return {
        student_name: submission.student?.name || 'N/A',
        student_email: submission.student?.email || 'N/A',
        grade_level: submission.student?.grade_level || 'N/A',
        submission_date: submissionDate ? submissionDate.toLocaleDateString() : 'Not submitted',
        status: submission.status || 'pending',
        grade: submission.grade || 'Not graded',
        max_score: submission.assignment.max_score,
        percentage: submission.grade ? `${((submission.grade / submission.assignment.max_score) * 100).toFixed(1)}%` : 'N/A',
        submitted_on_time: submissionDate ? 
          (submissionDate <= dueDate ? 'Yes' : 'No') : 'No',
        days_late: daysLate > 0 ? daysLate : 0,
        feedback: submission.feedback || ''
      };
    }) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const assignmentTitle = data?.[0]?.assignment?.title || 'assignment';
    const filename = `assignment_${assignmentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting assignment submissions:', error);
    return { success: false, error };
  }
}

// Monthly Assignment Report
export async function exportMonthlyAssignments(year: number, month: number, classId?: string) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let query = supabase
      .from('assignments')
      .select(`
        *,
        class:classes(name),
        submissions:assignment_submissions(
          student_id,
          submitted_at,
          grade,
          student:app_users!assignment_submissions_student_id_fkey(name, email)
        )
      `)
      .gte('due_date', startDate.toISOString())
      .lte('due_date', endDate.toISOString());

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const headers = [
      'assignment_title',
      'class_name',
      'due_date',
      'max_score',
      'total_students',
      'submitted_count',
      'on_time_count',
      'late_count',
      'not_submitted_count',
      'average_grade',
      'submission_rate'
    ];

    const csvData = data?.map(assignment => {
      const submissions = assignment.submissions || [];
      const totalStudents = submissions.length;
      const submittedCount = submissions.filter(s => s.submitted_at).length;
      const onTimeCount = submissions.filter(s => 
        s.submitted_at && new Date(s.submitted_at) <= new Date(assignment.due_date)
      ).length;
      const lateCount = submissions.filter(s => 
        s.submitted_at && new Date(s.submitted_at) > new Date(assignment.due_date)
      ).length;
      const notSubmittedCount = totalStudents - submittedCount;
      const gradedSubmissions = submissions.filter(s => s.grade !== null);
      const averageGrade = gradedSubmissions.length > 0 ? 
        gradedSubmissions.reduce((sum, s) => sum + s.grade, 0) / gradedSubmissions.length : 0;

      return {
        assignment_title: assignment.title,
        class_name: assignment.class?.name || 'N/A',
        due_date: new Date(assignment.due_date).toLocaleDateString(),
        max_score: assignment.max_score,
        total_students: totalStudents,
        submitted_count: submittedCount,
        on_time_count: onTimeCount,
        late_count: lateCount,
        not_submitted_count: notSubmittedCount,
        average_grade: averageGrade.toFixed(1),
        submission_rate: totalStudents > 0 ? `${((submittedCount / totalStudents) * 100).toFixed(1)}%` : '0%'
      };
    }) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
    const filename = `monthly_assignments_${monthName}_${year}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting monthly assignments:', error);
    return { success: false, error };
  }
}

// Student Performance Report (Individual Report Card)
export async function exportStudentPerformance(studentId: string) {
  try {
    // Get student info
    const { data: student, error: studentError } = await supabase
      .from('app_users')
      .select('name, email, grade_level, school:schools(name)')
      .eq('id', studentId)
      .single();

    if (studentError) throw studentError;

    // Get all submissions for the student
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(title, due_date, max_score, assignment_type, teacher:app_users!assignments_teacher_id_fkey(name))
      `)
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    const headers = [
      'student_name',
      'student_email',
      'grade_level',
      'school_name',
      'assignment_title',
      'assignment_type',
      'teacher_name',
      'due_date',
      'submission_date',
      'status',
      'grade',
      'max_score',
      'percentage',
      'days_late',
      'feedback'
    ];

    const csvData = data?.map(submission => {
      const dueDate = new Date(submission.assignment.due_date);
      const submissionDate = submission.submitted_at ? new Date(submission.submitted_at) : null;
      const daysLate = submissionDate && submissionDate > dueDate ? 
        Math.ceil((submissionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      return {
        student_name: student.name,
        student_email: student.email,
        grade_level: student.grade_level || 'N/A',
        school_name: student.school?.name || 'N/A',
        assignment_title: submission.assignment.title,
        assignment_type: submission.assignment.assignment_type || 'assignment',
        teacher_name: submission.assignment.teacher?.name || 'N/A',
        due_date: dueDate.toLocaleDateString(),
        submission_date: submissionDate ? submissionDate.toLocaleDateString() : 'Not submitted',
        status: submission.status || 'pending',
        grade: submission.grade || 'Not graded',
        max_score: submission.assignment.max_score,
        percentage: submission.grade ? `${((submission.grade / submission.assignment.max_score) * 100).toFixed(1)}%` : 'N/A',
        days_late: daysLate > 0 ? daysLate : 0,
        feedback: submission.feedback || ''
      };
    }) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `student_report_card_${student.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting student performance:', error);
    return { success: false, error };
  }
}

// All Users Report (Admin only)
export async function exportAllUsers() {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        *,
        school:schools(name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const headers = [
      'name',
      'email',
      'role',
      'school_name',
      'grade_level',
      'phone',
      'parent_phone',
      'is_active',
      'created_at',
      'last_login'
    ];

    const csvData = data?.map(user => ({
      name: user.name,
      email: user.email,
      role: user.role,
      school_name: user.school?.name || 'N/A',
      grade_level: user.grade_level || 'N/A',
      phone: user.phone || 'N/A',
      parent_phone: user.parent_phone || 'N/A',
      is_active: user.is_active ? 'Yes' : 'No',
      created_at: new Date(user.created_at).toLocaleDateString(),
      last_login: user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'
    })) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `all_users_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting all users:', error);
    return { success: false, error };
  }
}

// Monthly School Report - All students and assignments for a school in a month
export async function exportMonthlySchoolReport(schoolId: string, year: number, month: number) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get all students in the school
    const { data: students, error: studentsError } = await supabase
      .from('app_users')
      .select('id, name, email, grade_level')
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .eq('is_active', true);

    if (studentsError) throw studentsError;

    // Get all assignments for the school in the month
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        id, title, due_date, max_score,
        submissions:submissions(student_id, submitted_at, grade, status)
      `)
      .eq('school_id', schoolId)
      .gte('due_date', startDate.toISOString())
      .lte('due_date', endDate.toISOString());

    if (assignmentsError) throw assignmentsError;

    const headers = [
      'student_name',
      'student_email',
      'grade_level',
      'assignment_title',
      'due_date',
      'submission_status',
      'submitted_date',
      'grade',
      'max_score',
      'percentage',
      'days_late'
    ];

    const csvData: any[] = [];

    students?.forEach(student => {
      assignments?.forEach(assignment => {
        const submission = assignment.submissions?.find((s: any) => s.student_id === student.id);
        const dueDate = new Date(assignment.due_date);
        const submissionDate = submission?.submitted_at ? new Date(submission.submitted_at) : null;
        const daysLate = submissionDate && submissionDate > dueDate ? 
          Math.ceil((submissionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        csvData.push({
          student_name: student.name,
          student_email: student.email,
          grade_level: student.grade_level || 'N/A',
          assignment_title: assignment.title,
          due_date: dueDate.toLocaleDateString(),
          submission_status: submission ? 
            (submissionDate && submissionDate <= dueDate ? 'On Time' : 
             submissionDate ? 'Late' : 'Submitted') : 'Missing',
          submitted_date: submissionDate ? submissionDate.toLocaleDateString() : 'Not submitted',
          grade: submission?.grade || 'Not graded',
          max_score: assignment.max_score,
          percentage: submission?.grade ? `${((submission.grade / assignment.max_score) * 100).toFixed(1)}%` : 'N/A',
          days_late: daysLate > 0 ? daysLate : 0
        });
      });
    });

    const csvContent = arrayToCSV(csvData, headers);
    const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
    const filename = `monthly_school_report_${monthName}_${year}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting monthly school report:', error);
    return { success: false, error };
  }
}

// School Students Export
export async function exportSchoolStudents(schoolId: string) {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        *,
        school:schools(name),
        submissions(count),
        assignments_created:assignments!assignments_teacher_id_fkey(count)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    const headers = [
      'name',
      'email',
      'role',
      'grade_level',
      'phone',
      'parent_phone',
      'created_at',
      'last_login',
      'total_submissions',
      'assignments_created'
    ];

    const csvData = data?.map(user => ({
      name: user.name,
      email: user.email,
      role: user.role,
      grade_level: user.grade_level || 'N/A',
      phone: user.phone || 'N/A',
      parent_phone: user.parent_phone || 'N/A',
      created_at: new Date(user.created_at).toLocaleDateString(),
      last_login: user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never',
      total_submissions: user.submissions?.length || 0,
      assignments_created: user.assignments_created?.length || 0
    })) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `school_students_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting school students:', error);
    return { success: false, error };
  }
}

// Materials Usage Report
export async function exportMaterialsReport(schoolId: string) {
  try {
    const { data, error } = await supabase
      .from('study_materials')
      .select(`
        *,
        uploaded_by_user:app_users!study_materials_uploaded_by_fkey(name, email)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const headers = [
      'title',
      'description',
      'uploaded_by',
      'uploader_email',
      'file_name',
      'file_size_mb',
      'upload_date',
      'is_published',
      'download_count'
    ];

    const csvData = data?.map(material => ({
      title: material.title,
      description: material.description || '',
      uploaded_by: material.uploaded_by_user?.name || 'N/A',
      uploader_email: material.uploaded_by_user?.email || 'N/A',
      file_name: material.file_name || 'N/A',
      file_size_mb: material.file_size ? (material.file_size / (1024 * 1024)).toFixed(2) : 'N/A',
      upload_date: new Date(material.created_at).toLocaleDateString(),
      is_published: material.is_published ? 'Yes' : 'No',
      download_count: material.download_count || 0
    })) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `materials_report_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting materials report:', error);
    return { success: false, error };
  }
}

// Grade Summary Report
export async function exportGradeSummary(schoolId: string, gradeLevel?: string) {
  try {
    let query = supabase
      .from('app_users')
      .select(`
        id, name, email, grade_level,
        submissions(grade, assignment:assignments(max_score, title))
      `)
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .eq('is_active', true);

    if (gradeLevel) {
      query = query.eq('grade_level', gradeLevel);
    }

    const { data, error } = await query;
    if (error) throw error;

    const headers = [
      'student_name',
      'student_email',
      'grade_level',
      'total_assignments',
      'completed_assignments',
      'average_grade',
      'highest_grade',
      'lowest_grade',
      'completion_rate'
    ];

    const csvData = data?.map(student => {
      const submissions = student.submissions || [];
      const gradedSubmissions = submissions.filter((s: any) => s.grade !== null);
      const totalAssignments = submissions.length;
      const completedAssignments = gradedSubmissions.length;
      
      const grades = gradedSubmissions.map((s: any) => s.grade);
      const averageGrade = grades.length > 0 ? grades.reduce((sum: number, grade: number) => sum + grade, 0) / grades.length : 0;
      const highestGrade = grades.length > 0 ? Math.max(...grades) : 0;
      const lowestGrade = grades.length > 0 ? Math.min(...grades) : 0;
      const completionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

      return {
        student_name: student.name,
        student_email: student.email,
        grade_level: student.grade_level || 'N/A',
        total_assignments: totalAssignments,
        completed_assignments: completedAssignments,
        average_grade: averageGrade.toFixed(1),
        highest_grade: highestGrade,
        lowest_grade: lowestGrade,
        completion_rate: `${completionRate.toFixed(1)}%`
      };
    }) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `grade_summary_${gradeLevel || 'all_grades'}_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting grade summary:', error);
    return { success: false, error };
  }
}

// Teacher Performance Report
export async function exportTeacherPerformance(schoolId: string) {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        id, name, email,
        assignments_created:assignments!assignments_teacher_id_fkey(
          id, title, created_at,
          submissions(grade, status)
        ),
        materials_uploaded:study_materials!study_materials_uploaded_by_fkey(count)
      `)
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .eq('is_active', true);

    if (error) throw error;

    const headers = [
      'teacher_name',
      'teacher_email',
      'total_assignments_created',
      'total_submissions_received',
      'graded_submissions',
      'pending_submissions',
      'average_grade_given',
      'materials_uploaded',
      'last_assignment_created'
    ];

    const csvData = data?.map(teacher => {
      const assignments = teacher.assignments_created || [];
      const allSubmissions = assignments.flatMap((a: any) => a.submissions || []);
      const gradedSubmissions = allSubmissions.filter((s: any) => s.grade !== null);
      const pendingSubmissions = allSubmissions.filter((s: any) => s.status === 'submitted' && s.grade === null);
      
      const grades = gradedSubmissions.map((s: any) => s.grade);
      const averageGrade = grades.length > 0 ? grades.reduce((sum: number, grade: number) => sum + grade, 0) / grades.length : 0;
      
      const lastAssignment = assignments.length > 0 ? 
        new Date(Math.max(...assignments.map((a: any) => new Date(a.created_at).getTime()))).toLocaleDateString() : 'Never';

      return {
        teacher_name: teacher.name,
        teacher_email: teacher.email,
        total_assignments_created: assignments.length,
        total_submissions_received: allSubmissions.length,
        graded_submissions: gradedSubmissions.length,
        pending_submissions: pendingSubmissions.length,
        average_grade_given: averageGrade.toFixed(1),
        materials_uploaded: teacher.materials_uploaded?.length || 0,
        last_assignment_created: lastAssignment
      };
    }) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `teacher_performance_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting teacher performance:', error);
    return { success: false, error };
  }
}

// Chat Messages Export (for moderation)
export async function exportChatMessages(schoolId: string, startDate?: string, endDate?: string) {
  try {
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(name, email, role)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    const headers = [
      'sender_name',
      'sender_email',
      'sender_role',
      'message_content',
      'message_type',
      'sent_date',
      'has_attachment',
      'attachment_type'
    ];

    const csvData = data?.map(message => ({
      sender_name: message.sender?.name || 'N/A',
      sender_email: message.sender?.email || 'N/A',
      sender_role: message.sender?.role || 'N/A',
      message_content: message.content || '',
      message_type: message.message_type || 'text',
      sent_date: new Date(message.created_at).toLocaleDateString(),
      has_attachment: message.file_path ? 'Yes' : 'No',
      attachment_type: message.file_name ? message.file_name.split('.').pop() : 'N/A'
    })) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `chat_messages_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting chat messages:', error);
    return { success: false, error };
  }
}

// Attendance Report
export async function exportAttendanceReport(schoolId: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        student:app_users!attendance_student_id_fkey(name, email, grade_level)
      `)
      .eq('school_id', schoolId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    const headers = [
      'student_name',
      'student_email',
      'grade_level',
      'date',
      'status',
      'notes'
    ];

    const csvData = data?.map(record => ({
      student_name: record.student?.name || 'N/A',
      student_email: record.student?.email || 'N/A',
      grade_level: record.student?.grade_level || 'N/A',
      date: new Date(record.date).toLocaleDateString(),
      status: record.status,
      notes: record.notes || ''
    })) || [];

    const csvContent = arrayToCSV(csvData, headers);
    const filename = `attendance_report_${startDate}_to_${endDate}.csv`;
    
    downloadCSV(csvContent, filename);
    return { success: true };
  } catch (error) {
    console.error('Error exporting attendance report:', error);
    return { success: false, error };
  }
}