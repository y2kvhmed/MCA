import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getTeacherSchools, getSchools } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function BroadcastNotificationScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadUserAndSchools();
  }, []);

  const loadUserAndSchools = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace('/welcome');
        return;
      }
      setUser(currentUser);

      let schoolsList: any[] = [];
      if (currentUser.role === 'admin') {
        const { data } = await getSchools();
        schoolsList = data || [];
      } else {
        const { data: teacherSchools } = await getTeacherSchools(currentUser.id);
        if (teacherSchools && teacherSchools.length > 0) {
          schoolsList = teacherSchools;
        } else if (currentUser.school_id) {
          const { data: singleSchool } = await supabase
            .from('schools')
            .select('*')
            .eq('id', currentUser.school_id)
            .single();
          if (singleSchool) schoolsList = [singleSchool];
        }
      }

      setSchools(schoolsList);
      if (schoolsList.length === 1) {
        setSelectedSchoolId(schoolsList[0].id);
      } else {
        setSelectedSchoolId('all');
      }
    } catch (error) {
      console.error('Error loading broadcast screen:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/teacher-dashboard');
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        if (result.assets[0].size && result.assets[0].size > 30 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Attachments must be under 30MB');
          return;
        }
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      handleError(error, 'Failed to pick file');
    }
  };

  const sendAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Required Fields', 'Please enter both a title and message.');
      return;
    }

    setSending(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let fileType: string | null = null;

      if (selectedFile) {
        setUploading(true);
        let blob: Blob;
        if (Platform.OS === 'web' && selectedFile.file) {
          blob = selectedFile.file;
        } else {
          const response = await fetch(selectedFile.uri);
          blob = await response.blob();
        }
        
        const fileExt = selectedFile.name?.split('.').pop() || 'dat';
        const uploadFileName = `announcements/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('materials')
          .upload(uploadFileName, blob, { contentType: selectedFile.mimeType || 'application/octet-stream' });

        if (uploadError) {
          console.warn('Storage upload error:', uploadError);
        } else {
          filePath = uploadFileName;
          fileName = selectedFile.name;
          fileSize = selectedFile.size;
          fileType = selectedFile.mimeType;
        }
        setUploading(false);
      }

      // Query recipients: students in selected school or teacher's schools
      let query = supabase
        .from('app_users')
        .select('id, name, school_id')
        .eq('role', 'student')
        .eq('is_active', true);

      if (selectedSchoolId !== 'all') {
        query = query.eq('school_id', selectedSchoolId);
      } else if (schools.length > 0 && user?.role !== 'admin') {
        const schoolIds = schools.map(s => s.id);
        query = query.in('school_id', schoolIds);
      }

      const { data: recipients, error: recipientsError } = await query;
      if (recipientsError) throw recipientsError;

      if (!recipients || recipients.length === 0) {
        Alert.alert('No Students Found', 'No active students found in the selected school audience.');
        setSending(false);
        return;
      }

      const notifications = recipients.map(r => ({
        user_id: r.id,
        title: title.trim(),
        message: message.trim(),
        body: message.trim(),
        type: 'announcement',
        is_read: false,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        created_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) throw insertError;

      showSuccess(`Announcement sent to ${recipients.length} student${recipients.length > 1 ? 's' : ''}!`);
      setTitle('');
      setMessage('');
      setSelectedFile(null);
      setTimeout(() => handleBack(), 700);
    } catch (error) {
      console.error('Announcement send error:', error);
      handleError(error, 'Failed to send announcement');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Announcement</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="megaphone" size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.title}>School Announcement</Text>
              <Text style={styles.subtitle}>Broadcast to students across your assigned schools</Text>
            </View>
          </View>

          {/* School Selector (Audience) */}
          <Text style={styles.label}>Target School</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schoolScroll}>
            {schools.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.schoolChip,
                  selectedSchoolId === 'all' && styles.schoolChipSelected,
                ]}
                onPress={() => setSelectedSchoolId('all')}
              >
                <Ionicons
                  name="globe-outline"
                  size={16}
                  color={selectedSchoolId === 'all' ? '#FFFFFF' : Colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.schoolChipText,
                    selectedSchoolId === 'all' && styles.schoolChipTextSelected,
                  ]}
                >
                  All My Schools
                </Text>
              </TouchableOpacity>
            )}

            {schools.map((school) => {
              const isSelected = selectedSchoolId === school.id;
              return (
                <TouchableOpacity
                  key={school.id}
                  style={[
                    styles.schoolChip,
                    isSelected && styles.schoolChipSelected,
                  ]}
                  onPress={() => setSelectedSchoolId(school.id)}
                >
                  <Ionicons
                    name="school-outline"
                    size={16}
                    color={isSelected ? '#FFFFFF' : Colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.schoolChipText,
                      isSelected && styles.schoolChipTextSelected,
                    ]}
                  >
                    {school.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Physics Exam Review Session Tomorrow"
            placeholderTextColor={Colors.text.tertiary}
            maxLength={120}
          />

          <Text style={styles.label}>Message *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Type your announcement details here..."
            placeholderTextColor={Colors.text.tertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          {selectedFile && (
            <View style={styles.fileCard}>
              <Ionicons name="document-attach" size={22} color={Colors.primary} />
              <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.attachBtn} onPress={pickFile}>
            <Ionicons name="attach" size={20} color={Colors.primary} />
            <Text style={styles.attachBtnText}>
              {selectedFile ? 'Change Attachment' : 'Add Attachment (Optional)'}
            </Text>
          </TouchableOpacity>

          <Button
            title={sending ? (uploading ? 'Uploading File...' : 'Sending...') : 'Post Announcement'}
            onPress={sendAnnouncement}
            loading={sending}
            disabled={sending || !title.trim() || !message.trim()}
            style={styles.sendButton}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg },
  card: { padding: Spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardHeaderText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text.primary },
  subtitle: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  schoolScroll: { flexDirection: 'row', marginVertical: Spacing.xs },
  schoolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    marginRight: Spacing.sm,
  },
  schoolChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolChipText: { fontSize: 13, fontWeight: '500', color: Colors.text.primary },
  schoolChipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  textArea: { minHeight: 120 },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    padding: Spacing.md,
    borderRadius: 10,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  fileName: { flex: 1, fontSize: 13, color: Colors.text.primary, fontWeight: '500' },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderStyle: 'dashed',
    marginTop: Spacing.md,
  },
  attachBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  sendButton: { marginTop: Spacing.xl },
});
