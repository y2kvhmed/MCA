import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function DashboardAnalytics() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'semester'>('month');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Load analytics based on user role
      if (currentUser.role === 'admin') {
        await loadAdminAnalytics();
      } else if (currentUser.role === 'teacher') {
        await loadTeacherAnalytics(currentUser.id);
      } else if (currentUser.role === 'student') {
        await loadStudentAnalytics(currentUser.id);
      }

    } catch (error) {
      console.error('Load analytics error:', error);
      handleError(error, 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAdminAnalytics = async () => {
    try {
      const dateFilter = getDateFilter();
      
      // Get overall statistics
      const [schools, users, assignments, submissions] = await Promise.all([
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('app_users').select('id, role, created_at').gte('created_at', dateFilter),
        supabase.from('assignments').select('id, created_at').gte('created_at', dateFilter),
        supabase.from('submissions').select('id, submitted_at, grade').gte('submitted_at', dateFilter)
      ]);

      // Calculate metrics
      const totalSchools = schools.count || 0;
      const newUsers = users.data?.length || 0;
      const newAssignments = assignments.data?.length || 0;
      const newSubmissions = submissions.data?.length || 0;
      
      const usersByRole = users.data?.reduce((acc: any, user: any) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {}) || {};

      const gradedSubmissions = submissions.data?.filter(s => s.grade !== null) || [];
      const averageGrade = gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((sum, s) => sum + (Number(s.grade) || 0), 0) / gradedSubmissions.length
        : 0;

      setAnalytics({
        totalSchools,
        newUsers,
        newAssignments,
        newSubmissions,
        usersByRole,
        averageGrade,
        gradingRate: submissions.data?.length > 0 ? (gradedSubmissions.length / submissions.data.length) * 100 : 0
      });

    } catch (error) {
      console.error('Admin analytics error:', error);
    }
  };

  const loadTeacherAnalytics = async (teacherId: string) => {
    try {
      const dateFilter = getDateFilter();
      
      // Get teacher-specific statistics
      const [assignments, submissions, students] = await Promise.all([
        supabase.from('assignments').select('id, created_at, max_score').eq('teacher_id', teacherId).gte('created_at', dateFilter),
        supabase.from('submissions').select('id, submitted_at, grade, assignment:assignments!inner(teacher_id)').eq('assignment.teacher_id', teacherId).gte('submitted_at', dateFilter),
        supabase.from('app_users').select('id, school_id').eq('role', 'student').eq('school_id', user?.school_id || '')
      ]);

      const totalAssignments = assignments.data?.length || 0;
      const totalSubmissions = submissions.data?.length || 0;
      const totalStudents = students.data?.length || 0;
      
      const gradedSubmissions = submissions.data?.filter(s => s.grade !== null) || [];
      const averageGrade = gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((sum, s) => sum + (Number(s.grade) || 0), 0) / gradedSubmissions.length
        : 0;

      const submissionRate = totalStudents > 0 && totalAssignments > 0 
        ? (totalSubmissions / (totalStudents * totalAssignments)) * 100 
        : 0;

      setAnalytics({
        totalAssignments,
        totalSubmissions,
        totalStudents,
        averageGrade,
        submissionRate,
        gradingRate: totalSubmissions > 0 ? (gradedSubmissions.length / totalSubmissions) * 100 : 0
      });

    } catch (error) {
      console.error('Teacher analytics error:', error);
    }
  };

  const loadStudentAnalytics = async (studentId: string) => {
    try {
      const dateFilter = getDateFilter();
      
      // Get student-specific statistics
      const [submissions, assignments] = await Promise.all([
        supabase.from('submissions').select('id, submitted_at, grade, assignment:assignments(max_score)').eq('student_id', studentId).gte('submitted_at', dateFilter),
        supabase.from('assignments').select('id, created_at').gte('created_at', dateFilter)
      ]);

      const totalSubmissions = submissions.data?.length || 0;
      const totalAssignments = assignments.data?.length || 0;
      
      const gradedSubmissions = submissions.data?.filter(s => s.grade !== null) || [];
      const averageGrade = gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((sum, s) => {
            const maxScore = s.assignment?.max_score || 100;
            return sum + ((Number(s.grade) || 0) / maxScore) * 100;
          }, 0) / gradedSubmissions.length
        : 0;

      const completionRate = totalAssignments > 0 ? (totalSubmissions / totalAssignments) * 100 : 0;

      setAnalytics({
        totalSubmissions,
        totalAssignments,
        averageGrade,
        completionRate,
        gradedCount: gradedSubmissions.length,
        pendingGrades: totalSubmissions - gradedSubmissions.length
      });

    } catch (error) {
      console.error('Student analytics error:', error);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'semester':
        return new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const exportAnalytics = async () => {
    try {
      const reportData = [
        {
          'Metric': 'Time Range',
          'Value': timeRange.charAt(0).toUpperCase() + timeRange.slice(1),
          'Date': new Date().toLocaleDateString()
        },
        ...Object.entries(analytics).map(([key, value]) => ({
          'Metric': key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          'Value': typeof value === 'number' ? value.toFixed(2) : value,
          'Date': new Date().toLocaleDateString()
        }))
      ];

      await exportToCSV(reportData, `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}`);
      showSuccess('Analytics exported successfully');
    } catch (error) {
      handleError(error, 'Failed to export analytics');
    }
  };

  const getPerformanceColor = (value: number, isGrade: boolean = false) => {
    if (isGrade) {
      if (value >= 90) return Colors.success;
      if (value >= 80) return Colors.info;
      if (value >= 70) return Colors.warning;
      return Colors.error;
    } else {
      if (value >= 80) return Colors.success;
      if (value >= 60) return Colors.info;
      if (value >= 40) return Colors.warning;
      return Colors.error;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <TouchableOpacity onPress={exportAnalytics}>
          <Ionicons name="download" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Time Range Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'week', label: 'Last Week' },
            { key: 'month', label: 'Last Month' },
            { key: 'semester', label: 'This Semester' }
          ].map((range) => (
            <TouchableOpacity
              key={range.key}
              style={[
                styles.filterTab,
                timeRange === range.key && styles.activeFilterTab
              ]}
              onPress={() => setTimeRange(range.key as any)}
            >
              <Text style={[
                styles.filterText,
                timeRange === range.key && styles.activeFilterText
              ]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Key Metrics */}
        <Card style={styles.metricsCard}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          
          {user?.role === 'admin' && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Ionicons name="library" size={24} color={Colors.primary} />
                <Text style={styles.metricValue}>{analytics.totalSchools || 0}</Text>
                <Text style={styles.metricLabel}>Schools</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="person-add" size={24} color={Colors.info} />
                <Text style={styles.metricValue}>{analytics.newUsers || 0}</Text>
                <Text style={styles.metricLabel}>New Users</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="document-text" size={24} color={Colors.success} />
                <Text style={styles.metricValue}>{analytics.newAssignments || 0}</Text>
                <Text style={styles.metricLabel}>New Assignments</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.warning} />
                <Text style={styles.metricValue}>{analytics.newSubmissions || 0}</Text>
                <Text style={styles.metricLabel}>New Submissions</Text>
              </View>
            </View>
          )}

          {user?.role === 'teacher' && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Ionicons name="document-text" size={24} color={Colors.primary} />
                <Text style={styles.metricValue}>{analytics.totalAssignments || 0}</Text>
                <Text style={styles.metricLabel}>Assignments</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="people" size={24} color={Colors.info} />
                <Text style={styles.metricValue}>{analytics.totalStudents || 0}</Text>
                <Text style={styles.metricLabel}>Students</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <Text style={styles.metricValue}>{analytics.totalSubmissions || 0}</Text>
                <Text style={styles.metricLabel}>Submissions</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="analytics" size={24} color={getPerformanceColor(analytics.submissionRate || 0)} />
                <Text style={[styles.metricValue, { color: getPerformanceColor(analytics.submissionRate || 0) }]}>
                  {(analytics.submissionRate || 0).toFixed(1)}%
                </Text>
                <Text style={styles.metricLabel}>Submission Rate</Text>
              </View>
            </View>
          )}

          {user?.role === 'student' && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Ionicons name="document-text" size={24} color={Colors.primary} />
                <Text style={styles.metricValue}>{analytics.totalAssignments || 0}</Text>
                <Text style={styles.metricLabel}>Assignments</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <Text style={styles.metricValue}>{analytics.totalSubmissions || 0}</Text>
                <Text style={styles.metricLabel}>Submitted</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="star" size={24} color={Colors.warning} />
                <Text style={styles.metricValue}>{analytics.gradedCount || 0}</Text>
                <Text style={styles.metricLabel}>Graded</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="trophy" size={24} color={getPerformanceColor(analytics.averageGrade || 0, true)} />
                <Text style={[styles.metricValue, { color: getPerformanceColor(analytics.averageGrade || 0, true) }]}>
                  {(analytics.averageGrade || 0).toFixed(1)}%
                </Text>
                <Text style={styles.metricLabel}>Avg Grade</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Performance Overview */}
        <Card style={styles.performanceCard}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          
          {user?.role === 'teacher' && (
            <>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Average Grade</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${analytics.averageGrade || 0}%`,
                        backgroundColor: getPerformanceColor(analytics.averageGrade || 0, true)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>{(analytics.averageGrade || 0).toFixed(1)}%</Text>
              </View>
              
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Grading Progress</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${analytics.gradingRate || 0}%`,
                        backgroundColor: getPerformanceColor(analytics.gradingRate || 0)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>{(analytics.gradingRate || 0).toFixed(1)}%</Text>
              </View>
            </>
          )}

          {user?.role === 'student' && (
            <>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Completion Rate</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${analytics.completionRate || 0}%`,
                        backgroundColor: getPerformanceColor(analytics.completionRate || 0)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>{(analytics.completionRate || 0).toFixed(1)}%</Text>
              </View>
              
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Average Grade</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${analytics.averageGrade || 0}%`,
                        backgroundColor: getPerformanceColor(analytics.averageGrade || 0, true)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>{(analytics.averageGrade || 0).toFixed(1)}%</Text>
              </View>
            </>
          )}
        </Card>

        {/* Insights */}
        <Card style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>Insights & Recommendations</Text>
          
          {user?.role === 'teacher' && (
            <View>
              {(analytics.submissionRate || 0) < 70 && (
                <View style={styles.insightItem}>
                  <Ionicons name="warning" size={20} color={Colors.warning} />
                  <Text style={styles.insightText}>
                    Submission rate is below 70%. Consider sending reminders to students.
                  </Text>
                </View>
              )}
              
              {(analytics.gradingRate || 0) < 80 && (
                <View style={styles.insightItem}>
                  <Ionicons name="time" size={20} color={Colors.info} />
                  <Text style={styles.insightText}>
                    {analytics.totalSubmissions - (analytics.totalSubmissions * (analytics.gradingRate || 0) / 100)} submissions are pending grading.
                  </Text>
                </View>
              )}
              
              {(analytics.averageGrade || 0) >= 85 && (
                <View style={styles.insightItem}>
                  <Ionicons name="trophy" size={20} color={Colors.success} />
                  <Text style={styles.insightText}>
                    Excellent class performance! Average grade is above 85%.
                  </Text>
                </View>
              )}
            </View>
          )}

          {user?.role === 'student' && (
            <View>
              {(analytics.completionRate || 0) >= 90 && (
                <View style={styles.insightItem}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  <Text style={styles.insightText}>
                    Outstanding completion rate! Keep up the excellent work.
                  </Text>
                </View>
              )}
              
              {(analytics.averageGrade || 0) < 70 && (
                <View style={styles.insightItem}>
                  <Ionicons name="school" size={20} color={Colors.warning} />
                  <Text style={styles.insightText}>
                    Consider reaching out to your teacher for additional support.
                  </Text>
                </View>
              )}
              
              {(analytics.pendingGrades || 0) > 0 && (
                <View style={styles.insightItem}>
                  <Ionicons name="time" size={20} color={Colors.info} />
                  <Text style={styles.insightText}>
                    You have {analytics.pendingGrades} assignments awaiting grades.
                  </Text>
                </View>
              )}
            </View>
          )}
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
  filterContainer: {
    backgroundColor: Colors.card.background,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  activeFilterTab: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  activeFilterText: {
    color: Colors.text.inverse,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  metricsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  performanceCard: {
    marginBottom: Spacing.lg,
  },
  progressItem: {
    marginBottom: Spacing.lg,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border.light,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  insightsCard: {
    marginBottom: Spacing.xl,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginLeft: Spacing.md,
  },
});