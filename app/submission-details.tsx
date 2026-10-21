import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function SubmissionDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (params.submissionId) {
      loadSubmission();
    }
  }, [params.submissionId]);

  const loadSubmission = async () => {
    try {
      const submissionId = params.submissionId as string;
      let submissionData: any = null;
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          student:app_users(id, name, email, avatar_url),
          assignment:assignments(id, title, description, max_score, due_date)
        `)
        .eq('id', submissionId)
        .single();

      if (error) {
        console.warn('Submission join error, trying fallback:', error.message);
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
            .select('id, name, email, avatar_url')
            .eq('id', fbData.student_id)
            .maybeSingle();
          student = st;
        }
        let assignment = null;
        if (fbData?.assignment_id) {
          const { data: asg } = await supabase
            .from('assignments')
            .select('id, title, description, max_score, due_date')
            .eq('id', fbData.assignment_id)
            .maybeSingle();
          assignment = asg;
        }
        submissionData = { ...fbData, student: student || { name: 'Student' }, assignment };
      } else {
        submissionData = data;
      }

      if (!submissionData) throw new Error('Submission not found');

      setSubmission(submissionData);
      setGrade(submissionData.grade?.toString() || '');
      setFeedback(submissionData.feedback || '');
    } catch (error) {
      console.error('Load submission error:', error);
      handleError(error, 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSubmission = async () => {
    if (!submission) return;

    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum) || gradeNum < 0) {
      Alert.alert('Invalid Grade', 'Please enter a valid grade (0 or higher)');
      return;
    }

    if (gradeNum > (submission.assignment?.max_score || 100)) {
      Alert.alert('Invalid Grade', `Grade cannot exceed ${submission.assignment?.max_score || 100} points`);
      return;
    }

    setGrading(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          grade: gradeNum,
          feedback,
          status: 'graded',
          graded_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      if (error) throw error;

      showSuccess('Grade saved successfully');
      loadSubmission();
    } catch (error) {
      handleError(error, 'Failed to save grade');
    } finally {
      setGrading(false);
    }
  };

  const handleOpenFile = async () => {
    try {
      let filePath = submission?.file_path || '';
      if (filePath.startsWith('http')) {
        const parts = filePath.split('/submissions/');
        if (parts.length > 1) {
          filePath = decodeURIComponent(parts[1]);
        }
      }
      if (filePath.startsWith('submissions/')) {
        filePath = filePath.replace(/^submissions\//, '');
      }

      // 1. Direct stored URL
      let fileUrl = submission?.file_url || '';

      // 2. Or public storage URL from filePath
      if (!fileUrl && filePath) {
        const { data } = supabase.storage.from('submissions').getPublicUrl(filePath);
        if (data?.publicUrl) fileUrl = data.publicUrl;
      }

      // 3. Or signed URL from filePath
      if (!fileUrl && filePath) {
        try {
          const { data, error } = await supabase.storage
            .from('submissions')
            .createSignedUrl(filePath, 3600);
          if (!error && data?.signedUrl) {
            fileUrl = data.signedUrl;
          }
        } catch (e) {
          console.warn('Signed URL error:', e);
        }
      }

      // If we have a direct URL, open it directly so browser's native PDF reader renders it
      if (fileUrl) {
        if (typeof window !== 'undefined') {
          window.open(fileUrl, '_blank');
        } else {
          await Linking.openURL(fileUrl);
        }
        return;
      }

      // Fallback on Web: download blob explicitly formatted as application/pdf
      if (typeof window !== 'undefined' && filePath) {
        try {
          const { data: blobData, error: blobErr } = await supabase.storage
            .from('submissions')
            .download(filePath);
          if (!blobErr && blobData) {
            const pdfBlob = new Blob([blobData], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');
            return;
          }
        } catch (e) {
          console.warn('Blob download error:', e);
        }
      }

      handleError(null, 'No file available for this submission');
    } catch (error) {
      handleError(error, 'Failed to open file');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!submission) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="document"
          title="Submission Not Found"
          description="The requested submission could not be found."
        />
      </SafeAreaView>
    );
  }

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
        {/* Assignment Info */}
        <Card style={styles.assignmentCard}>
          <Text style={styles.sectionTitle}>Assignment</Text>
          <Text style={styles.assignmentTitle}>{submission.assignment?.title}</Text>
          <Text style={styles.assignmentDescription}>
            {submission.assignment?.description || 'No description'}
          </Text>
          <View style={styles.assignmentMeta}>
            <Text style={styles.metaText}>
              Max Score: {submission.assignment?.max_score || 100} points
            </Text>
            {submission.assignment?.due_date && (
              <Text style={styles.metaText}>
                Due: {new Date(submission.assignment.due_date).toLocaleDateString()}
              </Text>
            )}
          </View>
        </Card>

        {/* Student Info */}
        <Card style={styles.studentCard}>
          <Text style={styles.sectionTitle}>Student</Text>
          <View style={styles.studentInfo}>
            <View style={styles.studentAvatar}>
              <Ionicons name="person" size={24} color={Colors.text.inverse} />
            </View>
            <View>
              <Text style={styles.studentName}>{submission.student?.name || 'Unknown Student'}</Text>
              <Text style={styles.studentEmail}>{submission.student?.email}</Text>
            </View>
          </View>
        </Card>

        {/* Submission Info */}
        <Card style={styles.submissionCard}>
          <Text style={styles.sectionTitle}>Submission</Text>

          <View style={styles.submissionMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="time" size={16} color={Colors.text.secondary} />
              <Text style={styles.metaText}>
                Submitted {formatRelativeDate(submission.submitted_at)}
              </Text>
            </View>

            {submission.file_url && (
              <View style={styles.metaRow}>
                <Ionicons name="document" size={16} color={Colors.text.secondary} />
                <Text style={styles.metaText}>File attached: {submission.file_name || 'Document'}</Text>
              </View>
            )}
          </View>

          {submission.content && (
            <View style={styles.contentSection}>
              <Text style={styles.contentTitle}>Content:</Text>
              <Text style={styles.contentText}>{submission.content}</Text>
            </View>
          )}

          {submission.file_url && (
            <TouchableOpacity style={styles.fileButton} onPress={handleOpenFile}>
              <Ionicons name="eye" size={16} color={Colors.primary} />
              <Text style={styles.fileButtonText}>Open Attachment</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Grading Section */}
        <Card style={styles.gradingCard}>
          <Text style={styles.sectionTitle}>Grading</Text>

          <View style={styles.gradeRow}>
            <View style={styles.gradeInput}>
              <Input
                label={`Grade (out of ${submission.assignment?.max_score || 100})`}
                value={grade}
                onChangeText={setGrade}
                keyboardType="numeric"
                placeholder="Enter grade"
              />
            </View>

            {submission.grade !== null && (
              <View style={styles.currentGrade}>
                <Text style={styles.currentGradeLabel}>Current:</Text>
                <Text style={styles.currentGradeValue}>
                  {submission.grade}/{submission.assignment?.max_score || 100}
                </Text>
              </View>
            )}
          </View>

          <Input
            label="Feedback"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
            placeholder="Enter feedback for the student..."
            style={styles.feedbackInput}
          />

          <Button
            title={submission.grade !== null ? "Update Grade" : "Grade Submission"}
            onPress={handleGradeSubmission}
            loading={grading}
            style={styles.gradeButton}
          />
        </Card>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  assignmentCard: {
    marginBottom: Spacing.lg,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  assignmentDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  assignmentMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  studentCard: {
    marginBottom: Spacing.lg,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  studentEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  submissionCard: {
    marginBottom: Spacing.lg,
  },
  submissionMeta: {
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  contentSection: {
    marginBottom: Spacing.md,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  contentText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 8,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  fileButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },
  gradingCard: {
    marginBottom: Spacing.xl,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  gradeInput: {
    flex: 1,
  },
  currentGrade: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  currentGradeLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  currentGradeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  feedbackInput: {
    marginBottom: Spacing.lg,
  },
  gradeButton: {
    marginTop: Spacing.md,
  },
});