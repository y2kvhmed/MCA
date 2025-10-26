import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      // Don't show alert, just return null
      return null;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
    
    return token;
  } catch (error) {
    // Silently handle errors in notification setup
    return null;
  }
}

export async function sendLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Send immediately
  });
}

export async function scheduleNotification(
  title: string, 
  body: string, 
  trigger: Date | number,
  data?: any
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: typeof trigger === 'number' ? { seconds: trigger } : trigger,
  });
}

// Notification types for the app
export const NotificationTypes = {
  NEW_ASSIGNMENT: 'new_assignment',
  ASSIGNMENT_DUE: 'assignment_due',
  GRADE_POSTED: 'grade_posted',
  NEW_MESSAGE: 'new_message',
  CLASS_ANNOUNCEMENT: 'class_announcement',
  LESSON_PUBLISHED: 'lesson_published',
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

// Helper functions for specific notification types
export async function notifyNewAssignment(assignmentTitle: string, className: string) {
  await sendLocalNotification(
    'New Assignment',
    `${assignmentTitle} has been posted in ${className}`,
    { type: NotificationTypes.NEW_ASSIGNMENT }
  );
}

export async function notifyAssignmentDue(assignmentTitle: string, hoursLeft: number) {
  await sendLocalNotification(
    'Assignment Due Soon',
    `${assignmentTitle} is due in ${hoursLeft} hours`,
    { type: NotificationTypes.ASSIGNMENT_DUE }
  );
}

export async function notifyGradePosted(assignmentTitle: string, grade: number, maxScore: number) {
  await sendLocalNotification(
    'Grade Posted',
    `You received ${grade}/${maxScore} on ${assignmentTitle}`,
    { type: NotificationTypes.GRADE_POSTED }
  );
}

export async function notifyNewMessage(senderName: string, className: string) {
  await sendLocalNotification(
    'New Message',
    `${senderName} sent a message in ${className}`,
    { type: NotificationTypes.NEW_MESSAGE }
  );
}

export async function notifyClassAnnouncement(title: string, className: string) {
  await sendLocalNotification(
    'Class Announcement',
    `${title} - ${className}`,
    { type: NotificationTypes.CLASS_ANNOUNCEMENT }
  );
}

export async function notifyLessonPublished(lessonTitle: string, className: string) {
  await sendLocalNotification(
    'New Lesson Available',
    `${lessonTitle} is now available in ${className}`,
    { type: NotificationTypes.LESSON_PUBLISHED }
  );
}

// Save push token to database
export async function savePushToken(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('app_users')
      .update({ push_token: token })
      .eq('id', userId);
    
    if (error) {
      console.error('Error saving push token:', error);
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

// Get push tokens for students in a specific class
export async function getClassStudentTokens(classId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        student:app_users!enrollments_student_id_fkey(push_token)
      `)
      .eq('class_id', classId);

    if (error) {
      console.error('Error getting student tokens:', error);
      return [];
    }

    return data
      ?.map((enrollment: any) => enrollment.student?.push_token)
      .filter((token: string) => token) || [];
  } catch (error) {
    console.error('Error getting student tokens:', error);
    return [];
  }
}

// Send targeted notification to specific class
export async function notifyClassStudents(
  classId: string,
  title: string,
  body: string,
  data?: any
) {
  try {
    // Get all student tokens for this class
    const tokens = await getClassStudentTokens(classId);
    
    if (tokens.length === 0) {
      console.log('No push tokens found for class:', classId);
      return;
    }

    // Send notifications to all students in the class
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }));

    // For now, just send local notifications
    // In production, you would use Expo's push service or another provider
    for (const message of messages) {
      await sendLocalNotification(message.title, message.body, message.data);
    }
  } catch (error) {
    console.error('Error sending class notifications:', error);
  }
}

// Specific notification functions for class-targeted notifications
export async function notifyNewAssignmentToClass(
  classId: string,
  assignmentTitle: string,
  className: string
) {
  await notifyClassStudents(
    classId,
    'New Assignment Posted',
    `${assignmentTitle} has been posted in ${className}`,
    { 
      type: NotificationTypes.NEW_ASSIGNMENT,
      classId,
      assignmentTitle 
    }
  );
}

export async function notifyGradePostedToStudent(
  studentId: string,
  assignmentTitle: string,
  grade: number,
  maxScore: number
) {
  try {
    // Get student's push token
    const { data, error } = await supabase
      .from('app_users')
      .select('push_token')
      .eq('id', studentId)
      .single();

    if (error || !data?.push_token) {
      console.log('No push token found for student:', studentId);
      return;
    }

    // Send local notification for now
    await sendLocalNotification(
      'Grade Posted',
      `You received ${grade}/${maxScore} on ${assignmentTitle}`,
      { 
        type: NotificationTypes.GRADE_POSTED,
        studentId,
        assignmentTitle,
        grade,
        maxScore
      }
    );
  } catch (error) {
    console.error('Error sending grade notification:', error);
  }
}

export async function notifyNewMessageToClass(
  classId: string,
  senderName: string,
  className: string,
  messageContent: string
) {
  await notifyClassStudents(
    classId,
    `New message from ${senderName}`,
    `${className}: ${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}`,
    { 
      type: NotificationTypes.NEW_MESSAGE,
      classId,
      senderName 
    }
  );
}

// Smart Notifications - Enhanced Features
export async function scheduleAssignmentReminder(assignmentId: string, dueDate: string, studentIds: string[]) {
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 1); // 1 day before due date

  if (reminderDate > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Assignment Due Tomorrow',
        body: 'You have an assignment due tomorrow. Don\'t forget to submit!',
        data: { assignmentId, type: 'assignment_reminder' },
      },
      trigger: { date: reminderDate },
    });
  }
}

export async function notifyNewVideoToClass(classId: string, videoTitle: string, className: string) {
  await notifyClassStudents(
    classId,
    'New Physics Video Available',
    `Check out the new video in ${className}: ${videoTitle}`,
    { type: 'new_video', videoTitle, classId }
  );
}

export async function notifyGradeReleaseToStudent(studentId: string, assignmentTitle: string, grade: number) {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('push_token')
      .eq('id', studentId)
      .single();

    if (error || !data?.push_token) return;

    await sendLocalNotification(
      'Grade Released',
      `Your grade for "${assignmentTitle}" is now available: ${grade}%`,
      { type: 'grade_release', assignmentTitle, grade }
    );
  } catch (error) {
    console.error('Error sending grade release notification:', error);
  }
}