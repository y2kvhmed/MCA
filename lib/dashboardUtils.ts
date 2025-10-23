import { getCurrentUser } from './auth';
import { getSchoolStats, getStudentStats, getAdminStats, getAssignmentsByTeacher, getAssignmentsForStudent } from './database';

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

    if (!user.school_id) {
      return { 
        user, 
        stats: { totalStudents: 0, myAssignments: 0, materialsSent: 0 }, 
        assignments: [],
        error: 'Teacher has no school assigned' 
      };
    }

    // Load stats with fallback
    let stats = { totalStudents: 0, myAssignments: 0, materialsSent: 0 };
    try {
      stats = await getSchoolStats(user.school_id);
    } catch (error) {
      console.error('Failed to load school stats:', error);
    }

    // Load assignments with fallback
    let assignments: any[] = [];
    try {
      const { data: assignmentsData } = await getAssignmentsByTeacher(user.id);
      assignments = assignmentsData?.slice(0, 3) || [];
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }

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

    // Load stats with fallback
    let stats = { totalMaterials: 0, totalAssignments: 0, averageGrade: 0 };
    try {
      stats = await getStudentStats(user.id);
    } catch (error) {
      console.error('Failed to load student stats:', error);
    }

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