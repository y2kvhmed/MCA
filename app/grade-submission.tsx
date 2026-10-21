import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatRelativeDate, formatFileSize, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function GradeSubmission() {
  const router = useRouter();
  const { submissionId } = useLocalSearchParams();
  const [submission, setSubmission] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [grade, setGrade] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load submission details with student and assignment info
      let submissionData: any = null;
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          student:app_users(id, name, email, phone, avatar_url),
          assignment:assignments(
            id,
            title,
            school:schools(id, name)
          )
        `)
        .eq('id', submissionId)
        .single();

      if (error) {
        console.warn('Submission join query error, trying fallback:', error.message);
        const { data: fbData, error: fbError } = await supabase
          .from('submissions')
          .select('*')
          .eq('id', submissionId)
          .single();
        if (fbError) throw fbError;
        
        let student = null;
        if (fbData?.student_id) {
          const { data: st } = await supabase
            .from('app_users')
            .select('id, name, email, phone, avatar_url')
            .eq('id', fbData.student_id)
            .maybeSingle();
          student = st;
        }
        let assignment = null;
        if (fbData?.assignment_id) {
          const { data: asg } = await supabase
            .from('assignments')
            .select('id, title, school_id')
            .eq('id', fbData.assignment_id)
            .maybeSingle();
          assignment = asg;
        }
        submissionData = { ...fbData, student: student || { name: 'Student' }, assignment };
      } else {
        submissionData = data;
      }

      setSubmission(submissionData);
      
      if (submissionData.grade !== null && submissionData.grade !== undefined) {
        setGrade(String(submissionData.grade));
      }
      if (submissionData.feedback) {
        setFeedback(submissionData.feedback);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async () => {
    try {
      if (!submission?.file_path && !submission?.file_url) {
        Alert.alert('Error', 'No file available for this submission');
        return;
      }
      
      // 1. Direct stored URL
      let fileUrl = submission.file_url || '';

      // 2. Direct public URL
      if (!fileUrl && submission.file_path) {
        const { data } = supabase.storage
          .from('submissions')
          .getPublicUrl(submission.file_path);
        if (data?.publicUrl) fileUrl = data.publicUrl;
      }

      // 3. Signed URL
      if (!fileUrl && submission.file_path) {
        try {
          const { data, error } = await supabase.storage
            .from('submissions')
            .createSignedUrl(submission.file_path, 3600);
          if (!error && data?.signedUrl) fileUrl = data.signedUrl;
        } catch (_) {}
      }
      
      if (!fileUrl) {
        Alert.alert('Error', 'Could not get file URL. The file may have been deleted or access was denied.');
        return;
      }
      
      // Open the file
      if (Platform.OS === 'web') {
        window.open(fileUrl, '_blank');
      } else {
        const canOpen = await Linking.canOpenURL(fileUrl);
        if (canOpen) {
          await Linking.openURL(fileUrl);
        } else {
          Alert.alert('Error', 'Cannot open this file type on your device');
        }
      }
    } catch (error) {
      console.error('Open file error:', error);
      Alert.alert('Error', 'Failed to open file. The file may not exist in storage.');
    }
  };

  const handleSaveGrade = async () => {
    if (!submission || !user) return;

    setSaving(true);
    try {
      const parsedGrade = grade.trim() ? parseFloat(grade.trim()) : null;
      const { error } = await supabase
        .from('submissions')
        .update({
          grade: parsedGrade,
          feedback: feedback.trim() || null,
          status: 'graded',
          graded_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      if (error) throw error;

      showSuccess('Submission graded successfully!');
      router.back();
    } catch (error) {
      handleError(error, 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!submission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Submission not found</Text>
      </SafeAreaView>
    );
  }

  const isLate = submission.is_late;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submission Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Student Info Card */}
        <Card style={styles.studentCard}>
          <View style={styles.studentHeader}>
            {submission.student?.avatar_url ? (
              <Image
                source={{ uri: submission.student.avatar_url }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={Colors.text.inverse} />
              </View>
            )}
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{submission.student?.name || 'Student'}</Text>
              <Text style={styles.studentEmail}>{submission.student?.email || ''}</Text>
              {submission.student?.phone && (
                <Text style={styles.studentPhone}>Phone: {submission.student.phone}</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Assignment Info Card */}
        <Card style={styles.assignmentCard}>
          <Text style={styles.assignmentTitle}>{submission.assignment?.title || 'Assignment'}</Text>
          <Text style={styles.className}>{submission.assignment?.school?.name || 'School'}</Text>
          
          <View style={styles.submissionDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color={Colors.text.secondary} />
              <Text style={styles.detailText}>
                Submitted {formatRelativeDate(submission.submitted_at)}
              </Text>
            </View>

            {isLate && (
              <View style={styles.detailRow}>
                <Ionicons name="warning" size={16} color={Colors.warning} />
                <Text style={[styles.detailText, { color: Colors.warning }]}>Late Submission</Text>
              </View>
            )}
          </View>
        </Card>

        {/* File Info Card */}
        <Card style={styles.fileCard}>
          <Text style={styles.fileTitle}>Submitted File</Text>
          <View style={styles.fileInfo}>
            <Ionicons name="document" size={24} color={Colors.primary} />
            <View style={styles.fileDetails}>
              <Text style={styles.fileName}>{submission.file_name || 'Submission PDF'}</Text>
              {submission.file_size ? (
                <Text style={styles.fileSize}>{formatFileSize(submission.file_size)}</Text>
              ) : null}
            </View>
            <TouchableOpacity 
              style={styles.downloadButton} 
              onPress={handleOpenFile}
            >
              <Ionicons name="open" size={20} color={Colors.primary} />
              <Text style={styles.downloadText}>Open File</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Comments & Grading Card */}
        <Card style={styles.gradingCard}>
          <Text style={styles.gradingTitle}>Grading & Feedback</Text>
          
          <Input
            label="Grade (Optional, e.g. 95)"
            value={grade}
            onChangeText={setGrade}
            placeholder="Enter grade..."
            keyboardType="numeric"
          />

          <Input
            label="Teacher Feedback"
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Write feedback for the student..."
            multiline
            numberOfLines={4}
          />
        </Card>

        <Button
          title={submission.grade !== null || submission.feedback ? 'Update Grade & Feedback' : 'Save Grade & Feedback'}
          onPress={handleSaveGrade}
          loading={saving}
          disabled={saving}
          style={styles.submitButton}
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
  studentCard: {
    marginBottom: Spacing.lg,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  studentPhone: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.md,
  },
  assignmentCard: {
    marginBottom: Spacing.lg,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  className: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  submissionDetails: {
    marginTop: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  fileCard: {
    marginBottom: Spacing.lg,
  },
  fileTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
  },
  downloadText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  gradingCard: {
    marginBottom: Spacing.lg,
  },
  gradingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },

  existingFeedback: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.info + '10',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  existingFeedbackLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.info,
    marginBottom: Spacing.xs,
  },
  existingFeedbackText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  submitButton: {
    marginBottom: Spacing.xl,
  },
});