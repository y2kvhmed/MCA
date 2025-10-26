import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'assignment' | 'grade' | 'announcement' | 'reminder' | 'system';
  read: boolean;
  created_at: string;
  related_id?: string;
  action_url?: string;
}

export default function NotificationCenter() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);
      await loadNotifications(currentUser.id);

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadNotifications = async (userId: string) => {
    try {
      // Generate mock notifications based on user activity
      const mockNotifications: Notification[] = [];
      
      // Get recent assignments for assignment notifications
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id, title, due_date, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recent submissions for grade notifications
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, grade, graded_at, assignment:assignments(title)')
        .eq('student_id', userId)
        .not('grade', 'is', null)
        .order('graded_at', { ascending: false })
        .limit(5);

      // Create assignment notifications
      assignments?.forEach((assignment, index) => {
        const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
        const now = new Date();
        
        if (dueDate && dueDate > now) {
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDue <= 3) {
            mockNotifications.push({
              id: `assignment-${assignment.id}`,
              title: 'Assignment Due Soon',
              message: `"${assignment.title}" is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`,
              type: 'reminder',
              read: index > 2,
              created_at: new Date(now.getTime() - index * 60 * 60 * 1000).toISOString(),
              related_id: assignment.id,
              action_url: `/assignment-details?assignmentId=${assignment.id}`
            });
          }
        }

        // New assignment notification
        const createdDate = new Date(assignment.created_at);
        if (now.getTime() - createdDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
          mockNotifications.push({
            id: `new-assignment-${assignment.id}`,
            title: 'New Assignment Available',
            message: `"${assignment.title}" has been assigned to you`,
            type: 'assignment',
            read: index > 1,
            created_at: assignment.created_at,
            related_id: assignment.id,
            action_url: `/assignment-details?assignmentId=${assignment.id}`
          });
        }
      });

      // Create grade notifications
      submissions?.forEach((submission, index) => {
        if (submission.graded_at) {
          mockNotifications.push({
            id: `grade-${submission.id}`,
            title: 'Assignment Graded',
            message: `Your submission for "${submission.assignment?.title}" has been graded`,
            type: 'grade',
            read: index > 1,
            created_at: submission.graded_at,
            related_id: submission.id,
            action_url: `/submission-details?submissionId=${submission.id}`
          });
        }
      });

      // Add some system notifications
      mockNotifications.push(
        {
          id: 'system-1',
          title: 'Welcome to Physics Learning',
          message: 'Complete your profile to get the most out of the platform',
          type: 'system',
          read: true,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          action_url: '/settings'
        },
        {
          id: 'announcement-1',
          title: 'Platform Update',
          message: 'New features have been added to improve your learning experience',
          type: 'announcement',
          read: false,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      );

      // Sort by date and set notifications
      mockNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(mockNotifications);

    } catch (error) {
      console.error('Load notifications error:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = async () => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark All Read', 
          onPress: () => {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            showSuccess('All notifications marked as read');
          }
        }
      ]
    );
  };

  const deleteNotification = async (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    showSuccess('Notification deleted');
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    if (notification.action_url) {
      router.push(notification.action_url as any);
    }
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'read':
        return notifications.filter(n => n.read);
      default:
        return notifications;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment': return 'document-text';
      case 'grade': return 'star';
      case 'announcement': return 'megaphone';
      case 'reminder': return 'alarm';
      case 'system': return 'settings';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'assignment': return Colors.primary;
      case 'grade': return Colors.success;
      case 'announcement': return Colors.info;
      case 'reminder': return Colors.warning;
      case 'system': return Colors.text.secondary;
      default: return Colors.primary;
    }
  };

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Notifications {unreadCount > 0 && `(${unreadCount})`}
        </Text>
        <TouchableOpacity onPress={markAllAsRead}>
          <Ionicons name="checkmark-done" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read', label: 'Read', count: notifications.length - unreadCount }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                filter === tab.key && styles.activeFilterTab
              ]}
              onPress={() => setFilter(tab.key as any)}
            >
              <Text style={[
                styles.filterText,
                filter === tab.key && styles.activeFilterText
              ]}>
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon="notifications-off"
            title="No Notifications"
            description={
              filter === 'all' 
                ? "You're all caught up! No notifications to show."
                : `No ${filter} notifications found.`
            }
          />
        ) : (
          filteredNotifications.map((notification) => (
            <Card key={notification.id} style={[
              styles.notificationCard,
              !notification.read && styles.unreadCard
            ]}>
              <TouchableOpacity
                style={styles.notificationContent}
                onPress={() => handleNotificationPress(notification)}
              >
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationIcon}>
                    <Ionicons 
                      name={getNotificationIcon(notification.type) as any} 
                      size={20} 
                      color={getNotificationColor(notification.type)} 
                    />
                  </View>
                  <View style={styles.notificationInfo}>
                    <Text style={[
                      styles.notificationTitle,
                      !notification.read && styles.unreadTitle
                    ]}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatRelativeDate(notification.created_at)}
                    </Text>
                  </View>
                  {!notification.read && (
                    <View style={styles.unreadIndicator} />
                  )}
                </View>
              </TouchableOpacity>
              
              <View style={styles.notificationActions}>
                {!notification.read && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => markAsRead(notification.id)}
                  >
                    <Ionicons name="checkmark" size={16} color={Colors.success} />
                    <Text style={styles.actionText}>Mark Read</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => deleteNotification(notification.id)}
                >
                  <Ionicons name="trash" size={16} color={Colors.error} />
                  <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  filterContainer: {
    backgroundColor: Colors.card.background,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  activeFilterTab: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  activeFilterText: {
    color: Colors.text.inverse,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  notificationCard: {
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border.light,
  },
  unreadCard: {
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
  },
  notificationContent: {
    marginBottom: Spacing.sm,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  actionText: {
    fontSize: 12,
    color: Colors.success,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
});