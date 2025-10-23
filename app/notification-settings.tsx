import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  getNotificationPreferences, 
  updateNotificationPreferences,
  registerForPushNotifications,
  getNotificationHistory 
} from '../lib/pushNotifications';
import { handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function NotificationSettings() {
  const router = useRouter();
  const [preferences, setPreferences] = useState({
    assignments: true,
    grades: true,
    videos: true,
    announcements: true,
    reminders: true,
    quietHours: { start: '22:00', end: '07:00' }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<any[]>([]);

  useEffect(() => {
    loadPreferences();
    loadNotificationHistory();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      handleError(error, 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationHistory = async () => {
    try {
      const history = await getNotificationHistory();
      setNotificationHistory(history.slice(0, 10)); // Show last 10
    } catch (error) {
      console.error('Failed to load notification history:', error);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await updateNotificationPreferences(preferences);
      showSuccess('Notification preferences saved');
    } catch (error) {
      handleError(error, 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterNotifications = async () => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        showSuccess('Push notifications enabled successfully');
      } else {
        handleError(null, 'Failed to enable push notifications');
      }
    } catch (error) {
      handleError(error, 'Failed to register for notifications');
    }
  };

  const updatePreference = (key: string, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateQuietHours = (type: 'start' | 'end', value: string) => {
    setPreferences(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [type]: value
      }
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Push Notification Setup */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications" size={24} color={Colors.primary} />
            <Text style={styles.cardTitle}>Push Notifications</Text>
          </View>
          <Text style={styles.cardDescription}>
            Enable push notifications to receive real-time updates about assignments, grades, and more.
          </Text>
          <Button
            title="Enable Push Notifications"
            onPress={handleRegisterNotifications}
            variant="outline"
            size="small"
          />
        </Card>

        {/* Notification Categories */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="document-text" size={20} color={Colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Assignments</Text>
                <Text style={styles.settingDescription}>New assignments and due date reminders</Text>
              </View>
            </View>
            <Switch
              value={preferences.assignments}
              onValueChange={(value) => updatePreference('assignments', value)}
              trackColor={{ false: Colors.border.medium, true: Colors.primary + '40' }}
              thumbColor={preferences.assignments ? Colors.primary : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="trophy" size={20} color={Colors.success} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Grades</Text>
                <Text style={styles.settingDescription}>Grade releases and updates</Text>
              </View>
            </View>
            <Switch
              value={preferences.grades}
              onValueChange={(value) => updatePreference('grades', value)}
              trackColor={{ false: Colors.border.medium, true: Colors.success + '40' }}
              thumbColor={preferences.grades ? Colors.success : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="videocam" size={20} color={Colors.info} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>New Videos</Text>
                <Text style={styles.settingDescription}>New physics videos and lessons</Text>
              </View>
            </View>
            <Switch
              value={preferences.videos}
              onValueChange={(value) => updatePreference('videos', value)}
              trackColor={{ false: Colors.border.medium, true: Colors.info + '40' }}
              thumbColor={preferences.videos ? Colors.info : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="megaphone" size={20} color={Colors.warning} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Announcements</Text>
                <Text style={styles.settingDescription}>Class announcements and updates</Text>
              </View>
            </View>
            <Switch
              value={preferences.announcements}
              onValueChange={(value) => updatePreference('announcements', value)}
              trackColor={{ false: Colors.border.medium, true: Colors.warning + '40' }}
              thumbColor={preferences.announcements ? Colors.warning : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="alarm" size={20} color={Colors.accent} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Reminders</Text>
                <Text style={styles.settingDescription}>Study reminders and due date alerts</Text>
              </View>
            </View>
            <Switch
              value={preferences.reminders}
              onValueChange={(value) => updatePreference('reminders', value)}
              trackColor={{ false: Colors.border.medium, true: Colors.accent + '40' }}
              thumbColor={preferences.reminders ? Colors.accent : Colors.text.secondary}
            />
          </View>
        </Card>

        {/* Quiet Hours */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <Text style={styles.cardDescription}>
            Set quiet hours when you don't want to receive notifications.
          </Text>
          
          <View style={styles.quietHoursContainer}>
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>Start Time</Text>
              <Input
                value={preferences.quietHours.start}
                onChangeText={(value) => updateQuietHours('start', value)}
                placeholder="22:00"
                style={styles.timeField}
              />
            </View>
            
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>End Time</Text>
              <Input
                value={preferences.quietHours.end}
                onChangeText={(value) => updateQuietHours('end', value)}
                placeholder="07:00"
                style={styles.timeField}
              />
            </View>
          </View>
        </Card>

        {/* Notification History */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          {notificationHistory.length === 0 ? (
            <Text style={styles.emptyText}>No recent notifications</Text>
          ) : (
            notificationHistory.map((notification, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyTitle}>{notification.content.title}</Text>
                <Text style={styles.historyBody}>{notification.content.body}</Text>
                <Text style={styles.historyDate}>
                  {new Date(notification.date).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* Save Button */}
        <Button
          title="Save Preferences"
          onPress={handleSavePreferences}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />
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
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  card: {
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  quietHoursContainer: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  timeField: {
    marginBottom: 0,
  },
  historyItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  historyBody: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  historyDate: {
    fontSize: 10,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  saveButton: {
    marginBottom: Spacing.xxxl,
  },
});