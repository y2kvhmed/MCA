import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationContext';
import { hapticFeedback } from '../lib/haptics';
import { getCurrentUser } from '../lib/auth';
import { formatRelativeDate } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, unreadCount, refreshNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      setUser(currentUser);
      await refreshNotifications();
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: any) => {
    hapticFeedback.light();
    
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    setSelectedNotification(notification);
  };

  const openAttachment = async (notif: any) => {
    try {
      if (!notif.file_path && !notif.file_url) return;
      let url = notif.file_url;
      if (!url && notif.file_path) {
        const { data } = await supabase.storage.from('materials').createSignedUrl(notif.file_path, 3600);
        url = data?.signedUrl;
        if (!url) {
          const { data: pubData } = supabase.storage.from('materials').getPublicUrl(notif.file_path);
          url = pubData?.publicUrl;
        }
      }
      if (url) {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank');
        } else {
          await Linking.openURL(url);
        }
      }
    } catch (err) {
      console.warn('Failed to open attachment:', err);
    }
  };

  const handleModalAction = () => {
    if (!selectedNotification) return;
    const notif = selectedNotification;
    setSelectedNotification(null);

    if (notif.type === 'assignment' && notif.entity_id) {
      router.push(`/assignment-details?assignmentId=${notif.entity_id}`);
    } else if (notif.type === 'material') {
      router.push('/student-materials');
    } else if (notif.type === 'recording') {
      router.push('/recordings');
    } else if (notif.type === 'message') {
      router.push('/(tabs)/student-chat');
    } else if (notif.file_path || notif.file_url) {
      openAttachment(notif);
    }
  };

  const handleMarkAllRead = async () => {
    hapticFeedback.medium();
    await markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment': return 'document-text';
      case 'material': return 'folder';
      case 'recording': return 'videocam';
      case 'assignment_reminder': return 'alarm';
      case 'message': return 'chatbubble';
      case 'grade': return 'trophy';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'assignment': return Colors.primary;
      case 'material': return Colors.info;
      case 'recording': return Colors.warning;
      case 'assignment_reminder': return '#FF5722';
      case 'message': return '#9C27B0';
      case 'grade': return Colors.success;
      default: return Colors.primary;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inbox</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark All Read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Ionicons name="mail" size={16} color={Colors.text.inverse} />
          <Text style={styles.unreadText}>{unreadCount} unread message{unreadCount > 1 ? 's' : ''}</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {notifications.length === 0 ? (
          <EmptyState
            icon="mail-unread-outline"
            message="Your inbox is empty. You'll receive updates about assignments, announcements, and feedback here."
          />
        ) : (
          notifications.map((notification, index) => (
            <AnimatedCard
              key={notification.id}
              delay={50 * (index + 1)}
              style={!notification.is_read ? { ...styles.notificationCard, ...styles.unreadCard } : styles.notificationCard}
            >
              <TouchableOpacity
                onPress={() => handleNotificationPress(notification)}
                style={styles.notificationContent}
              >
                <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(notification.type) + '20' }]}>
                  <Ionicons
                    name={getNotificationIcon(notification.type)}
                    size={24}
                    color={getNotificationColor(notification.type)}
                  />
                </View>
                <View style={styles.textContainer}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.notificationTitle, !notification.is_read && styles.unreadTitle]}>
                      {notification.title}
                    </Text>
                    {!notification.is_read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationBody} numberOfLines={2}>{notification.body}</Text>
                  <Text style={styles.notificationTime}>
                    {formatRelativeDate(notification.created_at)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      {/* Message Reader Modal */}
      <Modal
        visible={!!selectedNotification}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNotification && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIconBox, { backgroundColor: getNotificationColor(selectedNotification.type) + '20' }]}>
                    <Ionicons
                      name={getNotificationIcon(selectedNotification.type)}
                      size={24}
                      color={getNotificationColor(selectedNotification.type)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{selectedNotification.title}</Text>
                    <Text style={styles.modalDate}>{formatRelativeDate(selectedNotification.created_at)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedNotification(null)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={22} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBodyScroll}>
                  <Text style={styles.modalMessageText}>{selectedNotification.body || selectedNotification.message || 'No additional message details.'}</Text>
                  
                  {(selectedNotification.file_path || selectedNotification.file_name) && (
                    <TouchableOpacity
                      style={styles.attachmentBox}
                      onPress={() => openAttachment(selectedNotification)}
                    >
                      <Ionicons name="document-attach" size={24} color={Colors.primary} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {selectedNotification.file_name || 'Attached File'}
                        </Text>
                        <Text style={styles.attachmentSub}>Tap to open / download</Text>
                      </View>
                      <Ionicons name="open-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </ScrollView>

                <View style={styles.modalActions}>
                  {['assignment', 'material', 'recording', 'message'].includes(selectedNotification.type) && (
                    <TouchableOpacity style={styles.modalActionBtn} onPress={handleModalAction}>
                      <Ionicons
                        name={
                          selectedNotification.type === 'assignment' ? 'document-text-outline' :
                          selectedNotification.type === 'material' ? 'folder-open-outline' :
                          selectedNotification.type === 'recording' ? 'play-circle-outline' : 'chatbubble-ellipses-outline'
                        }
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.modalActionBtnText}>
                        {selectedNotification.type === 'assignment' ? 'View Assignment' :
                         selectedNotification.type === 'material' ? 'Open Materials' :
                         selectedNotification.type === 'recording' ? 'Watch Recording' : 'Go to Chat'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.modalDismissBtn} onPress={() => setSelectedNotification(null)}>
                    <Text style={styles.modalDismissBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  markAllRead: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  unreadText: {
    color: Colors.text.inverse,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  notificationCard: {
    marginBottom: Spacing.md,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  notificationBody: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.card.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBodyScroll: {
    maxHeight: 260,
    marginBottom: Spacing.xl,
  },
  modalMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  modalDismissBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  modalDismissBtnText: {
    color: Colors.text.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  attachmentSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
});
