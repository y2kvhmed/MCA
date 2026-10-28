import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getWebPushSubscriptions } from './webPush';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

/**
 * Register for push notifications and save token to database
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    // Check if device supports push notifications
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission not granted for push notifications');
      return null;
    }

    // Get push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // Replace with your Expo project ID
    });
    const token = tokenData.data;

    // Save token to database
    await savePushToken(userId, token);

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Save push token to database
 */
async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    const platform = Platform.OS as 'ios' | 'android' | 'web';

    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'token',
      });

    if (error) {
      console.error('Error saving push token:', error);
    }
  } catch (error) {
    console.error('Error in savePushToken:', error);
  }
}

/**
 * Remove push token from database (when user logs out or disables notifications)
 */
export async function removePushToken(token: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('token', token);

    if (error) {
      console.error('Error removing push token:', error);
    }
  } catch (error) {
    console.error('Error in removePushToken:', error);
  }
}

/**
 * Send notification to specific users
 */
export async function sendNotificationToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    // Get push tokens for users
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    if (error || !tokens || tokens.length === 0) {
      console.log('No push tokens found for users');
      return;
    }

    // --- Native push (Expo Push API) ---
    const expoTokens = tokens.filter((t: any) => !t.token.startsWith('http'));
    if (expoTokens.length > 0) {
      const messages = expoTokens.map((tokenRecord: any) => ({
        to: tokenRecord.token,
        sound: 'default',
        title,
        body,
        data,
      }));
      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        });
      }
    }

    // --- Web push (Web Push API via /api/send-push) ---
    const webSubscriptions = await getWebPushSubscriptions(userIds);
    if (webSubscriptions.length > 0) {
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: webSubscriptions,
          title,
          body,
          data,
          url: data?.url || '/',
        }),
      });
    }

    // Save notification records to database
    const notificationRecords = userIds.map((userId) => ({
      user_id: userId,
      title,
      body,
      type: data?.type || 'general',
      entity_id: data?.entityId || null,
    }));

    await supabase.from('notifications').insert(notificationRecords);
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
}

/**
 * Send notification to all students in a school
 */
export async function notifySchoolStudents(
  schoolId: string,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    // Get all student IDs in the school
    const { data: students, error } = await supabase
      .from('app_users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .eq('is_active', true);

    if (error || !students || students.length === 0) {
      console.log('No students found in school');
      return;
    }

    const studentIds = students.map((s: any) => s.id);
    await sendNotificationToUsers(studentIds, title, body, data);
  } catch (error) {
    console.error('Error notifying school students:', error);
  }
}

/**
 * Schedule reminder notifications for assignments due soon
 */
export async function scheduleAssignmentReminders(): Promise<void> {
  try {
    // Get assignments due in 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id, title, due_date, school_id')
      .eq('due_date', tomorrowStr);

    if (error || !assignments || assignments.length === 0) {
      return;
    }

    // Send reminders for each assignment
    for (const assignment of assignments) {
      await notifySchoolStudents(
        assignment.school_id,
        'Assignment Due Tomorrow',
        `"${assignment.title}" is due tomorrow. Don't forget to submit!`,
        {
          type: 'assignment_reminder',
          entityId: assignment.id,
        }
      );
    }
  } catch (error) {
    console.error('Error scheduling assignment reminders:', error);
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
    }
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting unread notifications:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUnreadNotifications:', error);
    return [];
  }
}

/**
 * Get notification preferences for user
 */
export async function getNotificationPreferences(userId?: string): Promise<any> {
  return {
    assignments: true,
    grades: true,
    videos: true,
    announcements: true,
    reminders: true,
    quietHours: { start: '22:00', end: '07:00' }
  };
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(preferences: any, userId?: string): Promise<boolean> {
  return true;
}

/**
 * Get notification history
 */
export async function getNotificationHistory(userId?: string): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  } catch (error) {
    return [];
  }
}
