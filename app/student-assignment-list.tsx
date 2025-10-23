import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getAssignmentsForStudent } from '../lib/database';
import { formatDueDate, formatRelativeDate, handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function StudentAssignmentList() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      if (currentUser.role !== 'student') {
        handleError(null, 'Access denied: Students only');
        router.back();
        return;
      }

      const { data: assignmentsData, error } = await getAssignmentsForStudent(currentUser.id);
      if (error) throw error;
      
      setAssignments(assignmentsData || []);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getAssignmentStatus = (assignment: any) => {
    const hasSubmission = assignment.submissions && assignment.submissions.length > 0;
    const submission = hasSubmission ? assignment.submissions[0] : null;
    const now = new Date();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isOverdue = dueDate && now > dueDate;

    if (hasSubmission) {
      if (submission.grade !== null) {
        return { status: 'graded', color: Colors.success, icon: 'checkmark-circle' };
      }
      return { status: 'submitted', color: Colors.info, icon: 'document' };
    }
    
    if (isOverdue) {
      return { status: 'overdue', color: Colors.error, icon: 'time' };
    }
    
    if (dueDate && (dueDate.getTime() - now.getTime()) < 24 * 60 * 60 * 1000) {
      return { status: 'due_soon', color: Colors.warning, icon: 'warning' };
    }
    
    return { status: 'pending', color: Colors.text.secondary, icon: 'document-outline' };
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'graded': return 'Graded';
      case 'submitted': return 'Submitted';
      case 'overdue': return 'Overdue';
      case 'due_soon': return 'Due Soon';
      default: return 'Not Submitted';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const pendingAssignments = assignments.filter(a => !a.submissions || a.submissions.length === 0);
  const submittedAssignments = assignments.filter(a => a.submissions && a.submissions.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Assignments</Text>
        <View style={{ width: 24 }} />
      </FadeInView>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats */}
        <FadeInView style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{assignments.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pendingAssignments.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{submittedAssignments.length}</Text>
            <Text style={styles.statLabel}>Submitted</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {submittedAssignments.filter(a => a.submissions[0]?.grade !== null).length}
            </Text>
            <Text style={styles.statLabel}>Graded</Text>
          </View>
        </FadeInView>

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <EmptyState
            icon="document-text"
            message="No assignments available"
            description="Your teacher hasn't assigned any work yet. Check back later!"
          />
        ) : (
          assignments.map((assignment, index) => {
            const statusInfo = getAssignmentStatus(assignment);
            const hasSubmission = assignment.submissions && assignment.submissions.length > 0;
            const submission = hasSubmission ? assignment.submissions[0] : null;
            
            return (
              <AnimatedCard key={assignment.id} style={styles.assignmentCard} delay={100 + (index * 50)}>
                <TouchableOpacity
                  onPress={() => router.push(`/assignment-details?assignmentId=${assignment.id}`)}
                >
                  <View style={styles.assignmentHeader}>
                    <View style={styles.assignmentInfo}>
                      <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                      <Text style={styles.assignmentDescription} numberOfLines={2}>
                        {assignment.description || 'No description'}
                      </Text>
                      {assignment.teacher && (
                        <Text style={styles.teacherName}>
                          by {assignment.teacher.name}
                        </Text>
                      )}
                    </View>
                    <View style={styles.statusContainer}>
                      <Ionicons 
                        name={statusInfo.icon as any} 
                        size={20} 
                        color={statusInfo.color} 
                      />
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {getStatusText(statusInfo.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.assignmentMeta}>
                    {assignment.due_date && (
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar" size={14} color={Colors.text.secondary} />
                        <Text style={styles.metaText}>
                          Due {formatDueDate(assignment.due_date)}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.metaItem}>
                      <Ionicons name="trophy" size={14} color={Colors.text.secondary} />
                      <Text style={styles.metaText}>Max: {assignment.max_score} pts</Text>
                    </View>

                    {hasSubmission && submission.submitted_at && (
                      <View style={styles.metaItem}>
                        <Ionicons name="time" size={14} color={Colors.text.secondary} />
                        <Text style={styles.metaText}>
                          Submitted {formatRelativeDate(submission.submitted_at)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Grade Display */}
                  {hasSubmission && submission.grade !== null && (
                    <View style={styles.gradeContainer}>
                      <Text style={styles.gradeText}>
                        Grade: {submission.grade}/{assignment.max_score}
                      </Text>
                      <Text style={styles.percentageText}>
                        ({Math.round((submission.grade / assignment.max_score) * 100)}%)
                      </Text>
                    </View>
                  )}

                  {/* Action Button */}
                  <View style={styles.actionContainer}>
                    {!hasSubmission ? (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: Colors.primary }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/submit-assignment?assignmentId=${assignment.id}`);
                        }}
                      >
                        <Ionicons name="cloud-upload" size={16} color={Colors.text.inverse} />
                        <Text style={[styles.actionText, { color: Colors.text.inverse }]}>
                          Submit Work
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: Colors.info + '20' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/assignment-details?assignmentId=${assignment.id}`);
                        }}
                      >
                        <Ionicons name="eye" size={16} color={Colors.info} />
                        <Text style={[styles.actionText, { color: Colors.info }]}>
                          View Details
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </AnimatedCard>
            );
          })
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  assignmentCard: {
    marginBottom: Spacing.md,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  assignmentDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  teacherName: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  statusContainer: {
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  assignmentMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
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
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '10',
    padding: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.success,
  },
  percentageText: {
    fontSize: 12,
    color: Colors.success,
    marginLeft: Spacing.sm,
  },
  actionContainer: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },
});