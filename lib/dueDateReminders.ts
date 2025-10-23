import { supabase } from './supabase';
import { Platform } from 'react-native';

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  school_id: string;
}

export class DueDateReminderService {
  private static instance: DueDateReminderService;
  private reminderInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private schoolId: string | null = null;

  static getInstance(): DueDateReminderService {
    if (!DueDateReminderService.instance) {
      DueDateReminderService.instance = new DueDateReminderService();
    }
    return DueDateReminderService.instance;
  }

  initialize(userId: string, schoolId: string) {
    this.userId = userId;
    this.schoolId = schoolId;
    this.startReminderService();
  }

  private startReminderService() {
    // Check for upcoming deadlines every 30 minutes
    this.reminderInterval = setInterval(() => {
      this.checkUpcomingDeadlines();
    }, 30 * 60 * 1000);

    // Initial check
    this.checkUpcomingDeadlines();
  }

  private async checkUpcomingDeadlines() {
    if (!this.userId || !this.schoolId) return;

    try {
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const next1Hour = new Date(now.getTime() + 60 * 60 * 1000);

      // Get assignments due in the next 24 hours
      const { data: assignments } = await supabase
        .from('assignments')
        .select(`
          id, title, due_date, school_id,
          submissions!left(id, student_id)
        `)
        .eq('school_id', this.schoolId)
        .gte('due_date', now.toISOString())
        .lte('due_date', next24Hours.toISOString())
        .neq('assignment_type', 'material'); // Materials don't have due dates

      if (!assignments) return;

      for (const assignment of assignments) {
        // Check if student has already submitted
        const hasSubmitted = assignment.submissions.some(
          (sub: any) => sub.student_id === this.userId
        );

        if (hasSubmitted) continue;

        const dueDate = new Date(assignment.due_date);
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Send different notifications based on time remaining
        if (hoursUntilDue <= 1 && hoursUntilDue > 0) {
          // Critical: Less than 1 hour
          this.sendNotification({
            title: '🚨 Assignment Due Soon!',
            body: `"${assignment.title}" is due in ${Math.round(hoursUntilDue * 60)} minutes`,
            urgency: 'critical',
            assignmentId: assignment.id,
          });
        } else if (hoursUntilDue <= 6 && hoursUntilDue > 1) {
          // High: Less than 6 hours
          this.sendNotification({
            title: '⏰ Assignment Due Today',
            body: `"${assignment.title}" is due in ${Math.round(hoursUntilDue)} hours`,
            urgency: 'high',
            assignmentId: assignment.id,
          });
        } else if (hoursUntilDue <= 24 && hoursUntilDue > 6) {
          // Medium: Less than 24 hours
          this.sendNotification({
            title: '📝 Assignment Due Tomorrow',
            body: `Don't forget: "${assignment.title}" is due tomorrow`,
            urgency: 'medium',
            assignmentId: assignment.id,
          });
        }
      }
    } catch (error) {
      console.error('Error checking due dates:', error);
    }
  }

  private async sendNotification(notification: {
    title: string;
    body: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    assignmentId: string;
  }) {
    // Check if we've already sent this notification recently
    const notificationKey = `reminder_${notification.assignmentId}_${notification.urgency}`;
    const lastSent = localStorage.getItem(notificationKey);
    const now = Date.now();
    
    // Don't spam - wait at least 2 hours between same-type notifications
    if (lastSent && now - parseInt(lastSent) < 2 * 60 * 60 * 1000) {
      return;
    }

    if (Platform.OS === 'web') {
      this.sendWebNotification(notification);
    } else {
      this.sendMobileNotification(notification);
    }

    // Record that we sent this notification
    localStorage.setItem(notificationKey, now.toString());
  }

  private sendWebNotification(notification: any) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const webNotification = new Notification(notification.title, {
        body: notification.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `assignment-${notification.assignmentId}`,
        requireInteraction: notification.urgency === 'critical',
        silent: notification.urgency === 'low',
      });

      webNotification.onclick = () => {
        window.focus();
        // Navigate to assignment
        window.location.href = `/assignment-details?assignmentId=${notification.assignmentId}`;
        webNotification.close();
      };

      // Auto close based on urgency
      const autoCloseTime = notification.urgency === 'critical' ? 10000 : 5000;
      setTimeout(() => webNotification.close(), autoCloseTime);
    }
  }

  private sendMobileNotification(notification: any) {
    // For mobile, you'd use expo-notifications
    console.log('Mobile notification:', notification);
  }

  // Manual check for immediate deadlines
  async checkImmediateDeadlines(): Promise<Assignment[]> {
    if (!this.schoolId) return [];

    try {
      const now = new Date();
      const next2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const { data: assignments } = await supabase
        .from('assignments')
        .select('id, title, due_date, school_id')
        .eq('school_id', this.schoolId)
        .gte('due_date', now.toISOString())
        .lte('due_date', next2Hours.toISOString())
        .neq('assignment_type', 'material');

      return assignments || [];
    } catch (error) {
      console.error('Error checking immediate deadlines:', error);
      return [];
    }
  }

  // Get overdue assignments
  async getOverdueAssignments(): Promise<Assignment[]> {
    if (!this.userId || !this.schoolId) return [];

    try {
      const now = new Date();

      const { data: assignments } = await supabase
        .from('assignments')
        .select(`
          id, title, due_date, school_id,
          submissions!left(id, student_id)
        `)
        .eq('school_id', this.schoolId)
        .lt('due_date', now.toISOString())
        .neq('assignment_type', 'material');

      if (!assignments) return [];

      // Filter out assignments that have been submitted
      return assignments.filter(assignment => 
        !assignment.submissions.some((sub: any) => sub.student_id === this.userId)
      );
    } catch (error) {
      console.error('Error getting overdue assignments:', error);
      return [];
    }
  }

  cleanup() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
  }

  // Request notification permissions
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
    }
    // For mobile, you'd use expo-notifications
    return false;
  }
}

// Singleton instance
export const dueDateReminders = DueDateReminderService.getInstance();