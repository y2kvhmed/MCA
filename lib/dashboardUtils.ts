import { getCurrentUser } from './auth';
import { getTeacherSchoolStats, getStudentStats, getAdminStats, getAssignmentsByTeacherSchools, getAssignmentsForStudent } from './database';

export interface DashboardData {
  user: any;
  stats: any;
  assignments?: any[];
  error?: string;
}

export async function loadTeacherDashboard(): Promise<DashboardData> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { user: null, stats: {}, error: 'No user found' };
    }

    if (user.role !== 'teacher') {
      return { user, stats: {}, error: 'User is not a teacher' };
    }

    // Load all school-wide assignments for the teacher (same source as the
    // "School Assignments" screen so the dashboard count always matches it).
    let allAssignments: any[] = [];
    try {
      const { data: assignmentsData } = await getAssignmentsByTeacherSchools(user.id);
      allAssignments = assignmentsData || [];
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }

    // Stats are scoped to every school the teacher is assigned to, so the
    // Students / Materials cards reflect their schools instead of only their
    // primary school_id (which is often null for multi-school teachers).
    let stats = { totalStudents: 0, totalTeachers: 0, myAssignments: allAssignments.length, materialsSent: 0, totalTests: 0 };
    try {
      const schoolStats = await getTeacherSchoolStats(user.id);
      stats = { ...schoolStats, myAssignments: allAssignments.length };
    } catch (error) {
      console.error('Failed to load teacher school stats:', error);
    }

    const assignments = allAssignments.slice(0, 3);

    return { user, stats, assignments };
  } catch (error) {
    console.error('Teacher dashboard error:', error);
    return { 
      user: null, 
      stats: {}, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function loadStudentDashboard(): Promise<DashboardData> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { user: null, stats: {}, error: 'No user found' };
    }

    if (user.role !== 'student') {
      return { user, stats: {}, error: 'User is not a student' };
    }

    // Import supabase for direct queries
    const { supabase } = await import('./supabase');

    // Get materials count for student's school
    let totalMaterials = 0;
    if (user.school_id) {
      const { count } = await supabase
        .from('study_materials')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user.school_id);
      totalMaterials = count || 0;
    }

    // Get assignments count for student's school
    let totalAssignments = 0;
    if (user.school_id) {
      const { count } = await supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user.school_id);
      totalAssignments = count || 0;
    }

    // Count submissions
    let submittedCount = 0;
    const { count: subCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', user.id);
    submittedCount = subCount || 0;

    // Average test grade (%) across all of the student's recorded tests
    let avgTestGrade = 0;
    try {
      const { data: testRows } = await supabase
        .from('student_test_results')
        .select('score, max_score, percentage')
        .eq('student_id', user.id);

      if (testRows && testRows.length > 0) {
        const pcts = testRows
          .map((t: any) => {
            if (t.percentage !== null && t.percentage !== undefined) return Number(t.percentage);
            const max = Number(t.max_score) || 0;
            return max > 0 ? ((Number(t.score) || 0) / max) * 100 : 0;
          })
          .filter((n: number) => !isNaN(n));
        if (pcts.length > 0) {
          avgTestGrade = Math.round(pcts.reduce((a: number, b: number) => a + b, 0) / pcts.length);
        }
      }
    } catch (error) {
      console.warn('Failed to load average test grade:', error);
    }

    const stats = { totalMaterials, totalAssignments, submittedCount, avgTestGrade };

    // Load assignments with fallback
    let assignments: any[] = [];
    try {
      const { data: assignmentsData } = await getAssignmentsForStudent(user.id);
      if (assignmentsData) {
        assignments = assignmentsData
          .filter(a => !a.submissions || a.submissions.length === 0)
          .slice(0, 5);
      }
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }

    return { user, stats, assignments };
  } catch (error) {
    console.error('Student dashboard error:', error);
    return { 
      user: null, 
      stats: {}, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function loadAdminDashboard(): Promise<DashboardData> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { user: null, stats: {}, error: 'No user found' };
    }

    if (user.role !== 'admin') {
      return { user, stats: {}, error: 'User is not an admin' };
    }

    // Load stats with fallback
    let stats = { totalSchools: 0, totalUsers: 0, totalAssignments: 0, activeStudents: 0 };
    try {
      stats = await getAdminStats();
    } catch (error) {
      console.error('Failed to load admin stats:', error);
    }

    return { user, stats };
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return { 
      user: null, 
      stats: {}, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export function handleDashboardError(error: any, context: string) {
  console.error(`Dashboard error in ${context}:`, error);
  
  // Return safe fallback data
  return {
    user: null,
    stats: {},
    assignments: [],
    error: error instanceof Error ? error.message : 'Something went wrong loading the dashboard'
  };
}