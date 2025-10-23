import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { formatRelativeDate, formatFileSize, handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AssignmentSubmissions() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      // Load assignment details
      const { data: assignmentData, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (error) throw error;
      setAssignment(assignmentData);

      // Load submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          *,
          student:app_users(id, name, email)
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded': return Colors.success;
      case 'late': return Colors.warning;
      case 'resubmitted': return Colors.info;
      default: return Colors.text.secondary;
    }
  };

  const getGradeColor = (grade: number, maxScore: number) => {
    const percentage = (grade / maxScore) * 100;
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

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submissions</Text>
        <View style={{ width: 24 }} />
      </FadeInView>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Assignment Info */}
        <AnimatedCard style={styles.assignmentCard} delay={100}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <View style={styles.assignmentMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="document" size={16} color={Colors.text.secondary} />
              <Text style={styles.metaText}>{submissions.length} submissions</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="trophy" size={16} color={Colors.text.secondary} />
              <Text style={styles.metaText}>Max Score: {assignment.max_score}</Text>
            </View>
          </View>
        </AnimatedCard>

        {/* Submissions List */}
        {submissions.length === 0 ? (
          <EmptyState
            icon="document-outline"
            message="No submissions yet"
            description="Students haven't submitted their work for this assignment."
          />
        ) : (
          submissions.map((submission, index) => (
            <AnimatedCard key={submission.id} style={styles.submissionCard} delay={200 + (index * 50)}>
              <TouchableOpacity
                onPress={() => router.push(`/grade-submission?submissionId=${submission.id}`)}
              >
                <View style={styles.submissionHeader}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{submission.student?.name}</Text>
                    <Text style={styles.studentEmail}>{submission.student?.email}</Text>
                  </View>
                  <View style={styles.submissionStatus}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(submission.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(submission.status) }]}>
                        {submission.status}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.submissionDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color={Colors.text.secondary} />
                    <Text style={styles.detailText}>
                      Submitted {formatRelativeDate(submission.submitted_at)}
                    </Text>
                  </View>

                  {submission.file_name && (
                    <View style={styles.detailItem}>
                      <Ionicons name="document" size={16} color={Colors.text.secondary} />
                      <Text style={styles.detailText}>
                        {submission.file_name} ({formatFileSize(submission.file_size)})
                      </Text>
                    </View>
                  )}

                  {submission.is_late && (
                    <View style={styles.detailItem}>
                      <Ionicons name="warning" size={16} color={Colors.warning} />
                      <Text style={[styles.detailText, { color: Colors.warning }]}>
                        Late submission
                      </Text>
                    </View>
                  )}

                  {submission.grade !== null && (
                    <View style={styles.gradeContainer}>
                      <Text style={[
                        styles.gradeText,
                        { color: getGradeColor(submission.grade, assignment.max_score) }
                      ]}>
                        Grade: {submission.grade}/{assignment.max_score}
                      </Text>
                      {submission.feedback && (
                        <Text style={styles.feedbackText} numberOfLines={2}>
                          {submission.feedback}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.submissionFooter}>
                  <Text style={styles.tapToGrade}>
                    {submission.grade !== null ? 'Tap to view/edit grade' : 'Tap to grade'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            </AnimatedCard>
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
  content: {
    flex: 1,
    padding: Spacing.lg,
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
  assignmentMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  submissionCard: {
    marginBottom: Spacing.md,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  studentEmail: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  submissionStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  submissionDetails: {
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  detailText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  gradeContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  feedbackText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  submissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  tapToGrade: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
});