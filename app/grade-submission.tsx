import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getSignedUrl } from '../lib/storage';
import { formatRelativeDate, formatFileSize, handleError, showSuccess } from '../lib/utils';
import { notifyGradePostedToStudent } from '../lib/notifications';
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
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load submission details with student and assignment info
      const { data: submissionData, error } = await supabase
        .from('submissions')
        .select(`
          *,
          student:app_users!submissions_student_id_fkey(id, name, email, phone, parent_phone),
          assignment:assignments(
            id,
            title,
            max_score,
            class:classes(id, name)
          )
        `)
        .eq('id', submissionId)
        .single();

      if (error) throw error;
      setSubmission(submissionData);
      
      // Set existing grade and feedback if already graded
      if (submissionData.grade !== null) {
        setGrade(submissionData.grade.toString());
      }
      if (submissionData.feedback) {
        setFeedback(submissionData.feedback);
      }

      // Get download URL for the file
      if (submissionData.file_path) {
        const signedUrl = await getSignedUrl('submissions', submissionData.file_path);
        setDownloadUrl(signedUrl);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (downloadUrl) {
      try {
        await Linking.openURL(downloadUrl);
      } catch (error) {
        handleError(error, 'Failed to open file');
      }
    }
  };

  const handleSubmitGrade = async () => {
    if (!submission || !user) return;

    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > submission.assignment.max_score) {
      Alert.alert('Error', `Grade must be between 0 and ${submission.assignment.max_score}`);
      return;
    }

    setGrading(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          grade: gradeValue,
          feedback: feedback.trim() || null,
          status: 'graded',
          graded_at: new Date().toISOString(),
          graded_by: user.id,
          percentage: Math.round((gradeValue / submission.assignment.max_score) * 100),
        })
        .eq('id', submission.id);

      if (error) throw error;

      // Send notification to student about their grade
      await notifyGradePostedToStudent(
        submission.student_id,
        submission.assignment.title,
        gradeValue,
        submission.assignment.max_score
      );

      showSuccess('Grade submitted successfully!');
      router.back();
    } catch (error) {
      handleError(error, 'Failed to submit grade');
    } finally {
      setGrading(false);
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
  const isAlreadyGraded = submission.status === 'graded';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grade Submission</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Student Info Card */}
        <Card style={styles.studentCard}>
          <View style={styles.studentHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={Colors.text.inverse} />
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{submission.student.name}</Text>
              <Text style={styles.studentEmail}>{submission.student.email}</Text>
              {submission.student.phone && (
                <Text style={styles.studentPhone}>📱 {submission.student.phone}</Text>
              )}
              {submission.student.parent_phone && (
                <Text style={styles.parentPhone}>👨‍👩‍👧‍👦 {submission.student.parent_phone}</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Assignment Info Card */}
        <Card style={styles.assignmentCard}>
          <Text style={styles.assignmentTitle}>{submission.assignment.title}</Text>
          <Text style={styles.className}>{submission.assignment.class.name}</Text>
          
          <View style={styles.submissionDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color={Colors.text.secondary} />
              <Text style={styles.detailText}>
                Submitted {formatRelativeDate(submission.submitted_at)}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="trophy" size={16} color={Colors.text.secondary} />
              <Text style={styles.detailText}>Max Score: {submission.assignment.max_score}</Text>
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
              <Text style={styles.fileName}>{submission.file_name}</Text>
              <Text style={styles.fileSize}>{formatFileSize(submission.file_size)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.downloadButton} 
              onPress={handleDownload}
              disabled={!downloadUrl}
            >
              <Ionicons name="download" size={20} color={Colors.primary} />
              <Text style={styles.downloadText}>Download</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Grading Card */}
        <Card style={styles.gradingCard}>
          <Text style={styles.gradingTitle}>
            {isAlreadyGraded ? 'Update Grade' : 'Grade Submission'}
          </Text>
          
          <Input
            label={`Grade (0 - ${submission.assignment.max_score})`}
            value={grade}
            onChangeText={setGrade}
            placeholder="Enter grade"
            keyboardType="numeric"
          />

          <Input
            label="Feedback (Optional)"
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Provide feedback to the student"
            multiline
            numberOfLines={4}
          />

          {grade && !isNaN(parseFloat(grade)) && (
            <View style={styles.gradePreview}>
              <Text style={styles.gradePreviewText}>
                Grade: {grade}/{submission.assignment.max_score} 
                ({Math.round((parseFloat(grade) / submission.assignment.max_score) * 100)}%)
              </Text>
            </View>
          )}
        </Card>

        <Button
          title={isAlreadyGraded ? 'Update Grade' : 'Submit Grade'}
          onPress={handleSubmitGrade}
          loading={grading}
          disabled={!grade || grading}
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
  parentPhone: {
    fontSize: 12,
    color: Colors.text.tertiary,
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
  gradePreview: {
    padding: Spacing.md,
    backgroundColor: Colors.success + '20',
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  gradePreviewText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
    textAlign: 'center',
  },
  submitButton: {
    marginBottom: Spacing.xl,
  },
});