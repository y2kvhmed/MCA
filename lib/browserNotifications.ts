import { Platform } from 'react-native';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: any;
  actions?: NotificationAction[];
}

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

class BrowserNotificationManager {
  private permission: NotificationPermission = 'default';
  private isSupported = false;

  constructor() {
    this.checkSupport();
  }

  private checkSupport() {
    if (Platform.OS === 'web' && 'Notification' in window) {
      this.isSupported = true;
      this.permission = Notification.permission;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Browser notifications not supported');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!this.isSupported || this.permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag || 'default',
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        data: options.data,
      });

      // Auto close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }
}

export const browserNotifications = new BrowserNotificationManager();//
 Notification templates for common use cases
export const NotificationTemplates = {
  newMessage: (senderName: string, message: string) => ({
    title: 'New Message',
    body: `${senderName}: ${message}`,
    icon: '/icons/message.png',
    tag: 'chat',
    data: { type: 'chat', senderName },
  }),

  assignmentDue: (assignmentTitle: string, hoursLeft: number) => ({
    title: 'Assignment Due Soon',
    body: `"${assignmentTitle}" is due in ${hoursLeft} hours`,
    icon: '/icons/assignment.png',
    tag: 'assignment-due',
    requireInteraction: true,
    data: { type: 'assignment-due', assignmentTitle },
  }),

  gradeReceived: (assignmentTitle: string, grade: string) => ({
    title: 'Assignment Graded',
    body: `You received ${grade} for "${assignmentTitle}"`,
    icon: '/icons/grade.png',
    tag: 'grade',
    data: { type: 'grade', assignmentTitle, grade },
  }),

  newAnnouncement: (title: string, preview: string) => ({
    title: 'New Announcement',
    body: `${title}: ${preview}`,
    icon: '/icons/announcement.png',
    tag: 'announcement',
    data: { type: 'announcement', title },
  }),

  systemAlert: (message: string, priority: 'low' | 'medium' | 'high' = 'medium') => ({
    title: priority === 'high' ? '⚠️ Important Alert' : 'System Notification',
    body: message,
    icon: '/icons/system.png',
    tag: 'system',
    requireInteraction: priority === 'high',
    data: { type: 'system', priority },
  }),
};

// Utility functions for scheduling notifications
export function scheduleNotification(
  options: NotificationOptions,
  delayMs: number
): NodeJS.Timeout {
  return setTimeout(() => {
    browserNotifications.show(options);
  }, delayMs);
}

export function scheduleRecurringNotification(
  options: NotificationOptions,
  intervalMs: number
): NodeJS.Timeout {
  return setInterval(() => {
    browserNotifications.show(options);
  }, intervalMs);
}

// Batch notification manager
export class BatchNotificationManager {
  private queue: NotificationOptions[] = [];
  private isProcessing = false;
  private batchDelay = 2000; // 2 seconds between notifications

  add(notification: NotificationOptions) {
    this.queue.push(notification);
    if (!this.isProcessing) {
      this.processBatch();
    }
  }

  private async processBatch() {
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const notification = this.queue.shift();
      if (notification) {
        await browserNotifications.show(notification);
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.batchDelay));
        }
      }
    }
    
    this.isProcessing = false;
  }

  clear() {
    this.queue = [];
  }

  setBatchDelay(delayMs: number) {
    this.batchDelay = delayMs;
  }
}

export const batchNotificationManager = new BatchNotificationManager();