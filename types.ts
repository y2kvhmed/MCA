export type UserRole = 'admin' | 'teacher' | 'student';

export interface School {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  school_id?: string;
  school_ids?: string[];
  phone?: string;
  parent_phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at?: string;
  school?: School;
  schools?: School[];
}

export interface Class {
  id: string;
  name: string;
  school_id: string;
  teacher_id?: string;
  created_at?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  school_id?: string;
  teacher_id?: string;
  file_url?: string;
  file_name?: string;
  created_at?: string;
  school?: School;
  teacher?: User;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  content?: string;
  file_url?: string;
  file_name?: string;
  grade?: number;
  feedback?: string;
  created_at?: string;
  student?: User;
  assignment?: Assignment;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  school_id?: string;
  teacher_id?: string;
  created_at?: string;
}

export interface Message {
  id: string;
  sender_id: string;
  content: string;
  school_id?: string;
  class_id?: string;
  message_type?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
  sender?: User;
}
