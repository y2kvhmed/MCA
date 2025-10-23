import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../lib/auth';
import { getStudentStats, getAssignmentsForStudent, getSubmissionsByStudent, getMaterialsForStudentFixed } from '../../lib/database';
import { formatDueDate, handleError } from '../../lib/utils';
import { loadStudentDashboard } from '../../lib/dashboardUtils';
import Card from '../../components/Card';
import AnimatedCard from '../../components/AnimatedCard';
import FadeInView from '../../components/FadeInView';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DashboardErrorBoundary from '../../components/DashboardErrorBoundary';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dashboardData = await loadStudentDashboard();
      
      if (dashboardData.error) {
        console.warn('Dashboard warning:', dashboardData.error);
      }
      
      setUser(dashboardData.user);
      setStats(dashboardData.stats || {});
      setAssignments(dashboardData.assignments || []);

      // Load recent submissions separately with error handling
      try {
        if (dashboardData.user) {
          const { data: submissionsData } = await getSubmissionsByStudent(dashboardData.user.id);
          setRecentSubmissions(submissionsData?.slice(0, 3) || []);
        }
      } catch (error) {
        console.error('Failed to load submissions:', error);
        setRecentSubmissions([]);
      }
      
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load dashboard data');
      
      // Set safe fallback data
      setStats({});
      setAssignments([]);
      setRecentSubmissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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

  return (
    <DashboardErrorBoundary>
      <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Welcome Header */}
        <FadeInView style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </FadeInView>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <AnimatedCard style={styles.statCard} delay={100}>
            <View style={styles.statContent}>
              <Ionicons name="folder" size={24} color={Colors.primary} />
              <Text style={styles.statValue}>{stats.totalMaterials || 0}</Text>
              <Text style={styles.statLabel}>Materials</Text>
            </View>
          </AnimatedCard>
          
          <AnimatedCard style={styles.statCard} delay={200}>
            <View style={styles.statContent}>
              <Ionicons name="document-text" size={24} color={Colors.info} />
              <Text style={styles.statValue}>{stats.totalAssignments || 0}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </View>
          </AnimatedCard>
          
          <AnimatedCard style={styles.statCard} delay={300}>
            <View style={styles.statContent}>
              <Ionicons name="trophy" size={24} color={getGradeColor(stats.averageGrade || 0)} />
              <Text style={[styles.statValue, { color: getGradeColor(stats.averageGrade || 0) }]}>
                {stats.averageGrade ? `${stats.averageGrade}%` : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Avg Grade</Text>
            </View>
          </AnimatedCard>
        </View>

        {/* Quick Actions */}
        <AnimatedCard style={styles.actionsCard} delay={400}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/student-assignment-list')}
            >
              <Ionicons name="document-text" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Assignments</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/student-materials')}
            >
              <Ionicons name="folder" size={24} color={Colors.info} />
              <Text style={styles.actionText}>Materials</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/student-grades')}
            >
              <Ionicons name="trophy" size={24} color={Colors.success} />
              <Text style={styles.actionText}>Grades</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/recordings')}
            >
              <Ionicons name="play-circle" size={24} color={Colors.warning} />
              <Text style={styles.actionText}>Videos</Text>
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        {/* Upcoming Assignments */}
        <AnimatedCard style={styles.assignmentsCard} delay={500}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Assignments</Text>
            <TouchableOpacity onPress={() => router.push('/student-assignment-list')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {assignments.length === 0 ? (
            <EmptyState
              icon="document-text"
              message="All caught up! Check back later for new assignments."
            />
          ) : (
            assignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentItem}>
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                  <Text style={styles.assignmentClass}>{assignment.class?.name}</Text>
                  <Text style={styles.assignmentDue}>
                    {assignment.due_date ? formatDueDate(assignment.due_date) : 'No due date'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => router.push(`/submit-assignment?assignmentId=${assignment.id}`)}
                >
                  <Text style={styles.submitButtonText}>Submit</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </AnimatedCard>

        {/* Recent Submissions */}
        <AnimatedCard style={styles.submissionsCard} delay={600}>
          <Text style={styles.sectionTitle}>Recent Submissions</Text>
          
          {recentSubmissions.length === 0 ? (
            <EmptyState
              icon="document"
              message="Your submitted assignments will appear here."
            />
          ) : (
            recentSubmissions.map((submission) => (
              <View key={submission.id} style={styles.submissionItem}>
                <View style={styles.submissionInfo}>
                  <Text style={styles.submissionTitle}>{submission.assignment?.title}</Text>
                  <Text style={styles.submissionDate}>
                    Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.submissionStatus}>
                  {submission.grade !== null ? (
                    <Text style={[styles.gradeText, { color: getGradeColor(submission.percentage || 0) }]}>
                      {submission.grade}/{submission.assignment?.max_score}
                    </Text>
                  ) : (
                    <Text style={styles.pendingText}>Pending</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </AnimatedCard>
      </ScrollView>
    </SafeAreaView>
    </DashboardErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
  },
  welcomeText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.xs,
  },
  statContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 100,
    width: '100%',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  actionsCard: {
    margin: Spacing.lg,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  actionButton: {
    width: '30%',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
  assignmentsCard: {
    margin: Spacing.lg,
    marginTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  assignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  assignmentClass: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  assignmentDue: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 2,
  },
  submitButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  submitButtonText: {
    fontSize: 12,
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  submissionsCard: {
    margin: Spacing.lg,
    marginTop: 0,
    marginBottom: Spacing.xl,
  },
  submissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  submissionInfo: {
    flex: 1,
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  submissionDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  submissionStatus: {
    alignItems: 'flex-end',
  },
  gradeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pendingText: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
  },
});