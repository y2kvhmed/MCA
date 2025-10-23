import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getSignedUrl } from '../lib/storage';
import { formatDueDate, formatRelativeDate, formatFileSize, handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AssignmentDetails() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load assignment details
      const { data: assignmentData, error } = await supabase
        .from('assignments')
        .select(`
          *,
          class:classes(id, name),
          teacher:app_users!assignments_teacher_id_fkey(id, name)
        `)
        .eq('id', assignmentId)
        .single();

      if (error) throw error;
      setAssignment(assignmentData);

      // Load student's submission if exists
      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', currentUser.id)
        .single();

      if (submissionError && submissionError.code !== 'PGRST116') {
        throw submissionError;
      }

      if (submissionData) {
        setSubmission(submissionData);
        
        // Get download URL if file exists
        if (submissionData.file_path) {
          const signedUrl = await getSignedUrl('submissions', submissionData.file_path);
          setDownloadUrl(signedUrl);
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load assignment details');
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

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return Colors.success;
    if (percentage >= 80) return Colors.info;
    if (percentage >= 70) return Colors.warning;
    return Colors.error;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Assignment not found</Text>
      </SafeAreaView>
    );
  }

  const isOverdue = assignment.due_date && new Date() > new Date(assignment.due_date);
  const hasSubmission = !!submission;
  const isGraded = submission?.grade !== null;

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignment Details</Text>
        <View style={{ width: 24 }} />
      </FadeInView>

      <ScrollView style={styles.content}>
        {/* Assignment Info */}
        <AnimatedCard style={styles.assignmentCard} delay={100}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <Text style={styles.className}>{assignment.class?.name || 'Physics Assignment'}</Text>
          
          <View style={styles.assignmentMeta}>
            {assignment.due_date && (
              <View style={styles.metaItem}>
                <Ionicons 
                  name="calendar" 
                  size={16} 
                  color={isOverdue ? Colors.error : Colors.text.secondary} 
                />
                <Text style={[
                  styles.metaText,
                  isOverdue && styles.overdueText
                ]}>
                  {formatDueDate(assignment.due_date)}
                </Text>
              </View>
            )}
            
            <View style={styles.metaItem}>
              <Ionicons name="trophy" size={16} color={Colors.text.secondary} />
              <Text style={styles.metaText}>Max Score: {assignment.max_score}</Text>
            </View>
            
            <View style={styles.metaItem}>
              <Ionicons name="person" size={16} color={Colors.text.secondary} />
              <Text style={styles.metaText}>Teacher: {assignment.teacher?.name || 'Unknown'}</Text>
            </View>
          </View>

          {assignment.instructions && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <Text style={styles.instructions}>{assignment.instructions}</Text>
            </View>
          )}
        </AnimatedCard>

        {/* Submission Status */}
        <AnimatedCard style={styles.statusCard} delay={200}>
          <Text style={styles.sectionTitle}>Submission Status</Text>
          
          {!hasSubmission ? (
            <View style={styles.noSubmissionContainer}>
              <Ionicons name="document-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.noSubmissionText}>No submission yet</Text>
              <Text style={styles.noSubmissionSubtext}>
                {isOverdue ? 'This assignment is overdue' : 'Submit your work before the due date'}
              </Text>
            </View>
          ) : (
            <View style={styles.submissionContainer}>
              <View style={styles.submissionHeader}>
                <View style={styles.submissionIcon}>
                  <Ionicons name="document" size={24} color={Colors.success} />
                </View>
                <View style={styles.submissionInfo}>
                  <Text style={styles.submissionTitle}>Submitted</Text>
                  <Text style={styles.submissionDate}>
                    {formatRelativeDate(submission.submitted_at)}
                  </Text>
                  {submission.is_late && (
                    <Text style={styles.lateText}>⚠️ Late Submission</Text>
                  )}
                </View>
              </View>

              {/* File Info */}
              <View style={styles.fileContainer}>
                <View style={styles.fileInfo}>
                  <Ionicons name="document" size={20} color={Colors.primary} />
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName}>{submission.file_name}</Text>
                    <Text style={styles.fileSize}>{formatFileSize(submission.file_size)}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.downloadButton}
                    onPress={handleDownload}
                    disabled={!downloadUrl}
                  >
                    <Ionicons name="download" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Grade Info */}
              {isGraded && (
                <View style={styles.gradeContainer}>
                  <View style={styles.gradeHeader}>
                    <Text style={styles.gradeTitle}>Grade</Text>
                    <Text style={[styles.gradeValue, { color: getGradeColor(submission.percentage || 0) }]}>
                      {submission.grade}/{assignment.max_score} ({submission.percentage}%)
                    </Text>
                  </View>
                  
                  {submission.feedback && (
                    <View style={styles.feedbackContainer}>
                      <Text style={styles.feedbackTitle}>Teacher Feedback:</Text>
                      <Text style={styles.feedbackText}>{submission.feedback}</Text>
                    </View>
                  )}
                  
                  <Text style={styles.gradedDate}>
                    Graded {formatRelativeDate(submission.graded_at)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </AnimatedCard>

        {/* Action Buttons - Role Based */}
        <AnimatedCard style={styles.actionsCard} delay={300}>
          {user?.role === 'student' ? (
            // Student Actions
            !hasSubmission ? (
              <Button
                title={isOverdue ? "Submit Late" : "Submit Assignment"}
                onPress={() => router.push(`/submit-assignment?assignmentId=${assignment.id}`)}
                style={styles.actionButton}
              />
            ) : (
              <View style={styles.actionButtons}>
                <Button
                  title="Resubmit"
                  onPress={() => router.push(`/submit-assignment?assignmentId=${assignment.id}`)}
                  variant="outline"
                  style={styles.resubmitButton}
                />
                {downloadUrl && (
                  <Button
                    title="Download"
                    onPress={handleDownload}
                    variant="secondary"
                    style={styles.downloadActionButton}
                  />
                )}
              </View>
            )
          ) : (
            // Teacher/Admin Actions
            <View style={styles.actionButtons}>
              <Button
                title="View Submissions"
                onPress={() => router.push(`/assignment-submissions?assignmentId=${assignment.id}`)}
                style={styles.actionButton}
              />
              <Button
                title="Edit Assignment"
                onPress={() => router.push(`/edit-assignment?assignmentId=${assignment.id}`)}
                variant="outline"
                style={styles.resubmitButton}
              />
              <Button
                title="Grade Submissions"
                onPress={() => router.push(`/grade-assignment?assignmentId=${assignment.id}`)}
                variant="secondary"
                style={styles.downloadActionButton}
              />
            </View>
          )}
        </AnimatedCard>
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
  assignmentCard: {
    marginBottom: Spacing.lg,
  },
  assignmentTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  className: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  assignmentMeta: {
    marginBottom: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  metaText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  overdueText: {
    color: Colors.error,
    fontWeight: '600',
  },
  instructionsContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  instructions: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  statusCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  noSubmissionContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noSubmissionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  noSubmissionSubtext: {
    fontSize: 14,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  submissionContainer: {
    // Container styles handled by card
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  submissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  submissionInfo: {
    flex: 1,
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
  },
  submissionDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  lateText: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500',
    marginTop: 2,
  },
  fileContainer: {
    marginBottom: Spacing.lg,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
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
    padding: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
  },
  gradeContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.success + '10',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  gradeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  gradeValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  feedbackContainer: {
    marginBottom: Spacing.md,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  feedbackText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  gradedDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  actionsCard: {
    marginBottom: Spacing.xl,
  },
  actionButton: {
    marginBottom: Spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  resubmitButton: {
    flex: 1,
  },
  downloadActionButton: {
    flex: 1,
  },
});