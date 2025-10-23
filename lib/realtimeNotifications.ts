import { supabase } from './supabase';
import { Platform } from 'react-native';

interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
}

class RealtimeNotifications {
  private subscriptions: any[] = [];
  private userId: string | null = null;
  private schoolId: string | null = null;

  async initialize(userId: string, schoolId?: string) {
    this.userId = userId;
    this.schoolId = schoolId || null;
    
    // Request notification permissions
    await this.requestPermissions();
    
    // Set up real-time subscriptions
    this.setupChatNotifications();
    this.setupAssignmentNotifications();
    this.setupGeneralNotifications();
  }

  private async requestPermissions() {
    if (Platform.OS === 'web') {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
      }
    }
    // For mobile, you'd use expo-notifications here
  }

  private setupChatNotifications() {
    if (!this.schoolId) return;

    const chatSubscription = supabase
      .channel(`chat-${this.schoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `school_id=eq.${this.schoolId}`,
        },
        (payload) => {
          const message = payload.new;
          
          // Don't notify for own messages
          if (message.sender_id === this.userId) return;
          
          this.showNotification({
            title: 'New Message',
            body: `${message.sender_name || 'Someone'}: ${message.content}`,
            data: {
              type: 'chat',
              schoolId: this.schoolId,
              messageId: message.id,
            },
          });
        }
      )
      .subscribe();

    this.subscriptions.push(chatSubscription);
  }

  private setupAssignmentNotifications() {
    if (!this.schoolId) return;

    // New assignments
    const assignmentSubscription = supabase
      .channel(`assignments-${this.schoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assignments',
          filter: `school_id=eq.${this.schoolId}`,
        },
        (payload) => {
          const assignment = payload.new;
          
          this.showNotification({
            title: 'New Assignment',
            body: `${assignment.title} has been posted`,
            data: {
              type: 'assignment',
              assignmentId: assignment.id,
            },
          });
        }
      )
      .subscribe();

    // Assignment grades
    const submissionSubscription = supabase
      .channel(`submissions-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `student_id=eq.${this.userId}`,
        },
        (payload) => {
          const submission = payload.new;
          
          // Only notify when grade is added
          if (submission.grade !== null && payload.old.grade === null) {
            this.showNotification({
              title: 'Assignment Graded',
              body: `You received ${submission.grade}/${submission.max_score} points`,
              data: {
                type: 'grade',
                submissionId: submission.id,
              },
            });
          }
        }
      )
      .subscribe();

    this.subscriptions.push(assignmentSubscription, submissionSubscription);
  }

  private setupGeneralNotifications() {
    // System-wide notifications
    const systemSubscription = supabase
      .channel('system-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          const notification = payload.new;
          
          this.showNotification({
            title: notification.title,
            body: notification.message,
            data: {
              type: 'system',
              notificationId: notification.id,
            },
          });
        }
      )
      .subscribe();

    this.subscriptions.push(systemSubscription);
  }

  private showNotification(payload: NotificationPayload) {
    if (Platform.OS === 'web') {
      this.showWebNotification(payload);
    } else {
      this.showMobileNotification(payload);
    }
  }

  private showWebNotification(payload: NotificationPayload) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.data?.type || 'general',
        requireInteraction: false,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        this.handleNotificationClick(payload.data);
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }

  private showMobileNotification(payload: NotificationPayload) {
    // For mobile, you'd use expo-notifications
    console.log('Mobile notification:', payload);
  }

  private handleNotificationClick(data: any) {
    if (!data) return;

    switch (data.type) {
      case 'chat':
        // Navigate to chat
        console.log('Navigate to chat:', data.schoolId);
        break;
      case 'assignment':
        // Navigate to assignment
        console.log('Navigate to assignment:', data.assignmentId);
        break;
      case 'grade':
        // Navigate to submission
        console.log('Navigate to submission:', data.submissionId);
        break;
      default:
        console.log('Unknown notification type:', data.type);
    }
  }

  // Check for upcoming assignment due dates
  async checkUpcomingDeadlines() {
    if (!this.userId) return;

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const { data: assignments } = await supabase
        .from('assignments')
        .select(`
          id, title, due_date,
          submissions!left(id, student_id)
        `)
        .eq('school_id', this.schoolId)
        .lte('due_date', tomorrow.toISOString())
        .gte('due_date', new Date().toISOString());

      if (assignments) {
        assignments.forEach((assignment) => {
          // Check if student hasn't submitted
          const hasSubmitted = assignment.submissions.some(
            (sub: any) => sub.student_id === this.userId
          );

          if (!hasSubmitted) {
            const dueDate = new Date(assignment.due_date);
            const hoursLeft = Math.ceil(
              (dueDate.getTime() - Date.now()) / (1000 * 60 * 60)
            );

            this.showNotification({
              title: 'Assignment Due Soon',
              body: `"${assignment.title}" is due in ${hoursLeft} hours`,
              data: {
                type: 'deadline',
                assignmentId: assignment.id,
              },
            });
          }
        });
      }
    } catch (error) {
      console.error('Error checking deadlines:', error);
    }
  }

  // Clean up subscriptions
  cleanup() {
    this.subscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions = [];
  }

  // Update user context
  updateContext(userId: string, schoolId?: string) {
    this.cleanup();
    this.initialize(userId, schoolId);
  }
}

export const realtimeNotifications = new RealtimeNotifications();

// Utility function to schedule deadline checks
export function scheduleDeadlineChecks() {
  // Check every hour
  setInterval(() => {
    realtimeNotifications.checkUpcomingDeadlines();
  }, 60 * 60 * 1000);

  // Initial check
  realtimeNotifications.checkUpcomingDeadlines();
}