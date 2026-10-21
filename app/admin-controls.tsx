import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import RoleProtection from '../components/RoleProtection';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface AppSettings {
  maintenance_mode: boolean;
  allow_student_login: boolean;
  allow_teacher_login: boolean;
  maintenance_message: string;
}

export default function AdminControls() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTarget, setNotificationTarget] = useState<'all' | 'students' | 'teachers'>('all');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    maintenance_mode: false,
    allow_student_login: true,
    allow_teacher_login: true,
    maintenance_message: 'The app is currently under maintenance. Please try again later.',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        router.replace('/');
        return;
      }
      setUser(currentUser);

      // Try to get settings, create if doesn't exist
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error && error.code === 'PGRST116') {
        // No settings exist, create default
        const { data: newData } = await supabase
          .from('app_settings')
          .insert({
            id: 1,
            maintenance_mode: false,
            allow_student_login: true,
            allow_teacher_login: true,
            maintenance_message: 'The app is currently under maintenance.',
          })
          .select()
          .single();
        
        if (newData) {
          setSettings({
            maintenance_mode: newData.maintenance_mode ?? false,
            allow_student_login: newData.allow_student_login ?? true,
            allow_teacher_login: newData.allow_teacher_login ?? true,
            maintenance_message: newData.maintenance_message || 'The app is currently under maintenance.',
          });
        }
      } else if (data) {
        setSettings({
          maintenance_mode: data.maintenance_mode ?? false,
          allow_student_login: data.allow_student_login ?? true,
          allow_teacher_login: data.allow_teacher_login ?? true,
          maintenance_message: data.maintenance_message || 'The app is currently under maintenance.',
        });
      }
    } catch (error) {
      console.log('Settings table may not exist yet:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Use upsert with onConflict to handle both insert and update
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          id: 1,
          maintenance_mode: settings.maintenance_mode,
          allow_student_login: settings.allow_student_login,
          allow_teacher_login: settings.allow_teacher_login,
          maintenance_message: settings.maintenance_message,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        console.error('Save settings error:', error);
        throw error;
      }
      showSuccess('Settings saved!');
    } catch (error) {
      handleError(error, 'Failed to save settings. Make sure the app_settings table exists.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof AppSettings) => {
    if (typeof settings[key] === 'boolean') {
      setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      handleError(error, 'Failed to pick file');
    }
  };

  const sendBroadcastNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      Alert.alert('Error', 'Please enter both title and message');
      return;
    }

    setSendingNotification(true);
    try {
      let filePath = null;
      let fileName = null;
      let fileSize = null;
      let fileType = null;

      // Upload file if selected
      if (selectedFile) {
        setUploading(true);
        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();
        
        const fileExt = selectedFile.name.split('.').pop();
        const uploadFileName = `notifications/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('materials')
          .upload(uploadFileName, blob, { contentType: selectedFile.mimeType });

        if (uploadError) throw uploadError;

        filePath = uploadFileName;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.mimeType;
        setUploading(false);
      }

      // Get target users
      let query = supabase.from('app_users').select('id').eq('is_active', true);
      
      if (notificationTarget === 'students') {
        query = query.eq('role', 'student');
      } else if (notificationTarget === 'teachers') {
        query = query.eq('role', 'teacher');
      } else {
        query = query.in('role', ['student', 'teacher']);
      }

      const { data: users, error: usersError } = await query;
      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        Alert.alert('No Users', 'No users found for the selected target');
        return;
      }

      // Create notifications
      const notifications = users.map(u => ({
        user_id: u.id,
        title: notificationTitle.trim(),
        message: notificationMessage.trim(),
        body: notificationMessage.trim(),
        type: 'announcement',
        is_read: false,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        created_at: new Date().toISOString(),
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) throw notifError;

      showSuccess(`Notification sent to ${users.length} ${notificationTarget}!`);
      setNotificationTitle('');
      setNotificationMessage('');
      setSelectedFile(null);
    } catch (error) {
      handleError(error, 'Failed to send notification');
    } finally {
      setSendingNotification(false);
      setUploading(false);
    }
  };

  const handleToggleMaintenance = async (newVal: boolean) => {
    setSettings(prev => ({ ...prev, maintenance_mode: newVal }));
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          id: 1,
          maintenance_mode: newVal,
          allow_student_login: settings.allow_student_login,
          allow_teacher_login: settings.allow_teacher_login,
          maintenance_message: settings.maintenance_message,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;
      showSuccess(newVal ? 'Maintenance mode enabled! Only admins can access.' : 'Maintenance mode disabled! Students & teachers can access.');
    } catch (err) {
      setSettings(prev => ({ ...prev, maintenance_mode: !newVal }));
      handleError(err, 'Failed to update maintenance mode');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <RoleProtection allowedRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Controls</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Broadcast Notification */}
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="megaphone" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Broadcast Notification</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Send a notification to all students, teachers, or everyone
            </Text>

            <View style={styles.targetSelector}>
              {(['all', 'students', 'teachers'] as const).map((target) => (
                <TouchableOpacity
                  key={target}
                  style={[styles.targetButton, notificationTarget === target && styles.targetButtonActive]}
                  onPress={() => setNotificationTarget(target)}
                >
                  <Text style={[styles.targetText, notificationTarget === target && styles.targetTextActive]}>
                    {target === 'all' ? 'Everyone' : target.charAt(0).toUpperCase() + target.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              value={notificationTitle}
              onChangeText={setNotificationTitle}
              placeholder="Notification Title"
              placeholderTextColor={Colors.text.tertiary}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              value={notificationMessage}
              onChangeText={setNotificationMessage}
              placeholder="Notification Message"
              placeholderTextColor={Colors.text.tertiary}
              multiline
              numberOfLines={3}
            />

            {selectedFile && (
              <View style={styles.selectedFile}>
                <Ionicons name="document" size={20} color={Colors.success} />
                <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.attachButton} onPress={pickFile}>
              <Ionicons name="attach" size={20} color={Colors.primary} />
              <Text style={styles.attachText}>Attach File (Optional)</Text>
            </TouchableOpacity>

            <Button
              title={uploading ? 'Uploading...' : sendingNotification ? 'Sending...' : 'Send Notification'}
              onPress={sendBroadcastNotification}
              loading={sendingNotification || uploading}
              disabled={sendingNotification || uploading || !notificationTitle.trim() || !notificationMessage.trim()}
            />
          </Card>

          {/* Maintenance Mode */}
          <Card style={settings.maintenance_mode ? styles.dangerCard : styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingHeader}>
                  <Ionicons name="construct" size={24} color={settings.maintenance_mode ? Colors.error : Colors.warning} />
                  <Text style={styles.settingTitle}>Maintenance Mode</Text>
                </View>
                <Text style={styles.settingDescription}>
                  {settings.maintenance_mode 
                    ? 'App is in maintenance - only admins can login' 
                    : 'Enable to block all student and teacher logins'}
                </Text>
              </View>
              <Switch
                value={settings.maintenance_mode}
                onValueChange={handleToggleMaintenance}
                trackColor={{ false: Colors.border.medium, true: Colors.error }}
              />
            </View>
          </Card>


          {/* Quick Actions */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            
            <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/manage-users')}>
              <Ionicons name="people" size={20} color={Colors.primary} />
              <Text style={styles.actionText}>Manage Users</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/view-schools')}>
              <Ionicons name="library" size={20} color={Colors.info} />
              <Text style={styles.actionText}>Manage Schools</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>
          </Card>

          <Button
            title="Save Settings"
            onPress={saveSettings}
            loading={saving}
            style={styles.saveButton}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </RoleProtection>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, backgroundColor: Colors.card.background,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary },
  content: { flex: 1, padding: Spacing.lg },
  card: { marginBottom: Spacing.lg },
  dangerCard: { borderWidth: 2, borderColor: Colors.error },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginLeft: Spacing.sm },
  sectionDescription: { fontSize: 13, color: Colors.text.secondary, marginBottom: Spacing.md },
  targetSelector: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
  targetButton: {
    flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border.medium, alignItems: 'center',
  },
  targetButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  targetText: { fontSize: 14, color: Colors.text.secondary, fontWeight: '500' },
  targetTextActive: { color: Colors.text.inverse },
  input: {
    backgroundColor: Colors.background, borderRadius: 8, padding: Spacing.md,
    fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  settingInfo: { flex: 1, marginRight: Spacing.md },
  settingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  settingTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginLeft: Spacing.sm },
  settingLabel: { fontSize: 16, color: Colors.text.primary, marginLeft: Spacing.sm },
  settingDescription: { fontSize: 12, color: Colors.text.secondary, marginLeft: 32 },
  divider: { height: 1, backgroundColor: Colors.border.light, marginVertical: Spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
  actionText: { flex: 1, fontSize: 16, color: Colors.text.primary, marginLeft: Spacing.md },
  saveButton: { marginTop: Spacing.md },
  bottomSpacer: { height: Spacing.xxxl },
  attachButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: Spacing.md, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10', marginBottom: Spacing.md,
  },
  attachText: { fontSize: 14, color: Colors.primary, fontWeight: '500', marginLeft: Spacing.sm },
  selectedFile: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.success + '10', borderRadius: 8, marginBottom: Spacing.md,
  },
  selectedFileName: { flex: 1, fontSize: 14, color: Colors.text.primary, marginLeft: Spacing.sm },
});
