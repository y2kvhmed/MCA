import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface NotificationContextType {
  expoPushToken: string | null;
  notifications: any[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notifications: [],
  unreadCount: 0,
  refreshNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load initial notifications
      await refreshNotifications();

      // Try to set up push notifications (will fail gracefully on web/simulator)
      try {
        const Notifications = await import('expo-notifications');
        
        // Configure notification behavior
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch (error) {
        console.log('Push notifications not available:', error);
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  };

  const refreshNotifications = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Try to get notifications from database
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Table might not exist yet - fail silently
        console.log('Notifications table not ready:', error.message);
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const allNotifications = data || [];
      const unreadNotifications = allNotifications.filter((n: any) => !n.is_read);
      
      setNotifications(allNotifications);
      setUnreadCount(unreadNotifications.length);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      await refreshNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return;
      }

      await refreshNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notifications,
        unreadCount,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
