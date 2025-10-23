import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Conditionally import Device only for native platforms
let Device: any = null;
if (Platform.OS !== 'web') {
  Device = require('expo-device');
}
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enhanced notification configuration
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: data?.priority === 'high' ? 
        Notifications.AndroidNotificationPriority.HIGH : 
        Notifications.AndroidNotificationPriority.DEFAULT,
    };
  },
});

// Notification categories for better organization
export const NotificationCategories = {
  ASSIGNMENT: 'assignment',
  GRADE: 'grade', 
  VIDEO: 'video',
  ANNOUNCEMENT: 'announcement',
  REMINDER: 'reminder',
  CHAT: 'chat',
  ATTENDANCE: 'attendance',
} as const;

// Enhanced notification types
export const NotificationTypes = {
  // Assignment related
  NEW_ASSIGNMENT: 'new_assignment',
  ASSIGNMENT_DUE_SOON: 'assignment_due_soon',
  ASSIGNMENT_DUE_TODAY: 'assignment_due_today',
  ASSIGNMENT_OVERDUE: 'assignment_overdue',
  
  // Grade related
  GRADE_RELEASED: 'grade_released',
  GRADE_UPDATED: 'grade_updated',
  
  // Video/Content related
  NEW_VIDEO: 'new_video',
  NEW_LESSON: 'new_lesson',
  
  // Communication
  NEW_ANNOUNCEMENT: 'new_announcement',
  NEW_MESSAGE: 'new_message',
  TEACHER_FEEDBACK: 'teacher_feedback',
  
  // Attendance
  ATTENDANCE_REMINDER: 'attendance_reminder',
  ABSENT_NOTIFICATION: 'absent_notification',
  
  // System
  MAINTENANCE: 'maintenance',
  UPDATE_AVAILABLE: 'update_available',
} as const;

// Register for push notifications with enhanced permissions
export async function registerForPushNotifications() {
  let token;

  if (Platform.OS === 'android') {
    // Create notification channels for Android
    await createNotificationChannels();
  }

  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  if (Device && Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: true,
          allowCriticalAlerts: false,
          provideAppNotificationSettings: true,
          allowProvisional: false,
          allowAnnouncements: true,
        },
      });
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Push notification token:', token);
    
    // Save token to local storage
    await AsyncStorage.setItem('pushToken', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Create notification channels for Android
async function createNotificationChannels() {
  await Notifications.setNotificationChannelAsync('assignments', {
    name: 'Assignments',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#ffe164',
    sound: 'default',
    description: 'Notifications about assignments and due dates',
  });

  await Notifications.setNotificationChannelAsync('grades', {
    name: 'Grades',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#34C759',
    sound: 'default',
    description: 'Grade releases and updates',
  });

  await Notifications.setNotificationChannelAsync('content', {
    name: 'New Content',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#007AFF',
    sound: 'default',
    description: 'New videos and lessons',
  });

  await Notifications.setNotificationChannelAsync('communication', {
    name: 'Messages & Announcements',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF9500',
    sound: 'default',
    description: 'Messages and class announcements',
  });
}

// Enhanced notification scheduling with smart timing
export async function scheduleSmartNotification(
  type: string,
  title: string,
  body: string,
  triggerDate: Date,
  data?: any,
  options?: {
    priority?: 'low' | 'normal' | 'high';
    category?: string;
    sound?: string;
    badge?: number;
  }
) {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type,
        timestamp: new Date().toISOString(),
        ...data,
      },
      sound: options?.sound || 'default',
      badge: options?.badge,
      categoryIdentifier: options?.category,
      priority: options?.priority === 'high' ? 
        Notifications.AndroidNotificationPriority.HIGH : 
        Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: {
      date: triggerDate,
      channelId: getChannelForType(type),
    },
  });

  // Store notification ID for potential cancellation
  await AsyncStorage.setItem(`notification_${type}_${data?.id || 'general'}`, notificationId);
  
  return notificationId;
}

// Get appropriate channel for notification type
function getChannelForType(type: string): string {
  if (type.includes('assignment') || type.includes('due')) return 'assignments';
  if (type.includes('grade')) return 'grades';
  if (type.includes('video') || type.includes('lesson')) return 'content';
  if (type.includes('message') || type.includes('announcement')) return 'communication';
  return 'default';
}

// Smart assignment reminders with multiple alerts
export async function scheduleAssignmentReminders(
  assignmentId: string,
  assignmentTitle: string,
  dueDate: string,
  studentIds: string[]
) {
  const due = new Date(dueDate);
  const now = new Date();

  // Schedule multiple reminders
  const reminders = [
    { days: 3, title: '3 Days Left', priority: 'normal' as const },
    { days: 1, title: 'Due Tomorrow', priority: 'high' as const },
    { days: 0, hours: 2, title: 'Due in 2 Hours', priority: 'high' as const },
  ];

  for (const reminder of reminders) {
    const reminderDate = new Date(due);
    if (reminder.days) reminderDate.setDate(reminderDate.getDate() - reminder.days);
    if (reminder.hours) reminderDate.setHours(reminderDate.getHours() - reminder.hours);

    if (reminderDate > now) {
      await scheduleSmartNotification(
        NotificationTypes.ASSIGNMENT_DUE_SOON,
        `${reminder.title}: ${assignmentTitle}`,
        `Don't forget to submit your assignment "${assignmentTitle}"`,
        reminderDate,
        { 
          assignmentId, 
          assignmentTitle,
          dueDate,
          reminderType: reminder.days ? `${reminder.days}days` : `${reminder.hours}hours`
        },
        {
          priority: reminder.priority,
          category: NotificationCategories.ASSIGNMENT,
        }
      );
    }
  }
}

// Instant notifications for real-time events
export async function sendInstantNotification(
  type: string,
  title: string,
  body: string,
  data?: any,
  options?: {
    priority?: 'low' | 'normal' | 'high';
    category?: string;
    sound?: string;
  }
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type,
        timestamp: new Date().toISOString(),
        ...data,
      },
      sound: options?.sound || 'default',
      categoryIdentifier: options?.category,
      priority: options?.priority === 'high' ? 
        Notifications.AndroidNotificationPriority.HIGH : 
        Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: null, // Send immediately
  });
}

// Batch notifications for efficiency
export async function sendBatchNotifications(notifications: Array<{
  type: string;
  title: string;
  body: string;
  data?: any;
  triggerDate?: Date;
  options?: any;
}>) {
  const promises = notifications.map(notification => {
    if (notification.triggerDate) {
      return scheduleSmartNotification(
        notification.type,
        notification.title,
        notification.body,
        notification.triggerDate,
        notification.data,
        notification.options
      );
    } else {
      return sendInstantNotification(
        notification.type,
        notification.title,
        notification.body,
        notification.data,
        notification.options
      );
    }
  });

  return await Promise.all(promises);
}

// Cancel specific notifications
export async function cancelNotification(type: string, id?: string) {
  const notificationId = await AsyncStorage.getItem(`notification_${type}_${id || 'general'}`);
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    await AsyncStorage.removeItem(`notification_${type}_${id || 'general'}`);
  }
}

// Get notification history
export async function getNotificationHistory() {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  return notifications;
}

// Handle notification responses (when user taps notification)
export function addNotificationResponseListener(handler: (response: any) => void) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

// Handle notifications received while app is in foreground
export function addNotificationReceivedListener(handler: (notification: any) => void) {
  return Notifications.addNotificationReceivedListener(handler);
}

// Smart notification preferences
export async function updateNotificationPreferences(preferences: {
  assignments?: boolean;
  grades?: boolean;
  videos?: boolean;
  announcements?: boolean;
  reminders?: boolean;
  quietHours?: { start: string; end: string };
}) {
  await AsyncStorage.setItem('notificationPreferences', JSON.stringify(preferences));
}

export async function getNotificationPreferences() {
  const prefs = await AsyncStorage.getItem('notificationPreferences');
  return prefs ? JSON.parse(prefs) : {
    assignments: true,
    grades: true,
    videos: true,
    announcements: true,
    reminders: true,
    quietHours: { start: '22:00', end: '07:00' }
  };
}

// Check if current time is in quiet hours
export async function isQuietHours(): Promise<boolean> {
  const prefs = await getNotificationPreferences();
  if (!prefs.quietHours) return false;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = prefs.quietHours.start.split(':').map(Number);
  const [endHour, endMin] = prefs.quietHours.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours span midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
}

// Physics-specific notification templates
export const PhysicsNotificationTemplates = {
  newExperiment: (title: string) => ({
    title: '🧪 New Physics Experiment',
    body: `Try the new experiment: ${title}`,
    category: NotificationCategories.VIDEO,
  }),
  
  formulaOfTheDay: (formula: string) => ({
    title: '📐 Physics Formula of the Day',
    body: `Today's formula: ${formula}`,
    category: NotificationCategories.ANNOUNCEMENT,
  }),
  
  labReport: (dueDate: string) => ({
    title: '📋 Lab Report Due',
    body: `Your lab report is due ${dueDate}`,
    category: NotificationCategories.ASSIGNMENT,
  }),
  
  quizReminder: (topic: string) => ({
    title: '📝 Physics Quiz Tomorrow',
    body: `Don't forget to study ${topic} for tomorrow's quiz`,
    category: NotificationCategories.REMINDER,
  }),
};