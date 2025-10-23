export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  parent_phone?: string;
  grade_level?: string;
  role: 'admin' | 'teacher' | 'student';
  school_id?: string;
  password_hash?: string; // For authentication
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface School {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  teacher_id: string;
  school_id?: string;
  created_at: string;
  teacher?: User;
  enrollments?: { count: number }[];
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
  class?: Class;
  student?: User;
}

export interface Assignment {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  instructions?: string;
  created_at: string;
  due_date?: string;
  max_score: number;
  is_published: boolean;
  class?: Class;
  teacher?: User;
  submissions?: Submission[] | { count: number }[];
}


export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  submitted_at: string;
  grade?: number;
  feedback?: string;
  status: 'submitted' | 'late' | 'resubmitted' | 'graded';
  graded_at?: string;
  graded_by?: string;
  assignment?: Assignment;
  student?: User;
}

export interface Lesson {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  video_url?: string;
  video_path?: string;
  duration_minutes?: number;
  scheduled_at?: string;
  created_at: string;
  is_published: boolean;
  class?: Class;
  teacher?: User;
}

export interface Message {
  id: string;
  class_id: string;
  sender_id: string;
  title?: string;
  content: string;
  message_type: 'announcement' | 'message';
  created_at: string;
  is_pinned: boolean;
  sender?: User;
}

export interface DashboardStats {
  admin?: {
    totalSchools: number;
    totalUsers: number;
    totalClasses: number;
    activeStudents: number;
  };
  teacher?: {
    myClasses: number;
    totalStudents: number;
    pendingSubmissions: number;
  };
  student?: {
    enrolledClasses: number;
    totalAssignments: number;
    averageGrade: number | null;
  };
}
