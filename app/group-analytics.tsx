import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/utils';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface GroupStats {
  totalStudents: number;
  totalAssignments: number;
  averageGrade: number;
  attendanceRate: number;
  submissionRate: number;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  recentActivity: Array<{
    type: 'submission' | 'grade' | 'attendance';
    student: string;
    assignment?: string;
    date: string;
    value?: number;
  }>;
}

export default function GroupAnalytics() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await getCurrentUser();

      // Load group info
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroupInfo(groupData);

      // Load comprehensive analytics
      const [
        enrollmentsResult,
        assignmentsResult,
        submissionsResult,
        attendanceResult
      ] = await Promise.all([
        // Get enrolled students
        supabase
          .from('enrollments')
          .select('student:app_users!enrollments_student_id_fkey(id, name)')
          .eq('group_id', groupId)
          .eq('enrollment_status', 'active'),
        
        // Get assignments
        supabase
          .from('assignments')
          .select('id, title, max_score')
          .eq('group_id', groupId),
        
        // Get submissions with grades
        supabase
          .from('submissions')
          .select(`
            id, grade, percentage, status, submitted_at, graded_at,
            student:app_users!submissions_student_id_fkey(id, name),
            assignment:assignments(id, title, max_score)
          `)
          .eq('assignment.group_id', groupId),
        
        // Get attendance
        supabase
          .from('attendance')
          .select('id, status, date, student:app_users!attendance_student_id_fkey(id, name)')
          .eq('group_id', groupId)
      ]);

      const enrollments = enrollmentsResult.data || [];
      const assignments = assignmentsResult.data || [];
      const submissions = submissionsResult.data || [];
      const attendance = attendanceResult.data || [];

      // Calculate statistics
      const totalStudents = enrollments.length;
      const totalAssignments = assignments.length;
      
      // Grade statistics
      const gradedSubmissions = submissions.filter(s => s.status === 'graded' && s.grade !== null);
      const averageGrade = gradedSubmissions.length > 0 
        ? gradedSubmissions.reduce((sum, s) => sum + s.percentage, 0) / gradedSubmissions.length 
        : 0;

      // Grade distribution
      const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      gradedSubmissions.forEach(s => {
        if (s.percentage >= 90) gradeDistribution.A++;
        else if (s.percentage >= 80) gradeDistribution.B++;
        else if (s.percentage >= 70) gradeDistribution.C++;
        else if (s.percentage >= 60) gradeDistribution.D++;
        else gradeDistribution.F++;
      });

      // Attendance rate
      const presentAttendance = attendance.filter(a => a.status === 'present').length;
      const attendanceRate = attendance.length > 0 ? (presentAttendance / attendance.length) * 100 : 0;

      // Submission rate
      const expectedSubmissions = totalStudents * totalAssignments;
      const submissionRate = expectedSubmissions > 0 ? (submissions.length / expectedSubmissions) * 100 : 0;

      // Recent activity
      const recentActivity = [
        ...submissions.slice(-5).map(s => ({
          type: 'submission' as const,
          student: s.student.name,
          assignment: s.assignment.title,
          date: s.submitted_at,
        })),
        ...gradedSubmissions.slice(-5).map(s => ({
          type: 'grade' as const,
          student: s.student.name,
          assignment: s.assignment.title,
          date: s.graded_at,
          value: s.percentage,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

      setStats({
        totalStudents,
        totalAssignments,
        averageGrade,
        attendanceRate,
        submissionRate,
        gradeDistribution,
        recentActivity,
      });

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return Colors.success;
    if (percentage >= 80) return Colors.info;
    if (percentage >= 70) return Colors.warning;
    return Colors.error;
  };

  const renderGradeDistributionBar = () => {
    if (!stats) return null;

    const total = Object.values(stats.gradeDistribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) return null;

    const grades = [
      { letter: 'A', count: stats.gradeDistribution.A, color: Colors.success },
      { letter: 'B', count: stats.gradeDistribution.B, color: Colors.info },
      { letter: 'C', count: stats.gradeDistribution.C, color: Colors.warning },
      { letter: 'D', count: stats.gradeDistribution.D, color: '#FF8C00' },
      { letter: 'F', count: stats.gradeDistribution.F, color: Colors.error },
    ];

    return (
      <View style={styles.distributionContainer}>
        <Text style={styles.distributionTitle}>Grade Distribution</Text>
        <View style={styles.distributionBar}>
          {grades.map((grade) => {
            const percentage = (grade.count / total) * 100;
            return percentage > 0 ? (
              <View
                key={grade.letter}
                style={[
                  styles.distributionSegment,
                  {
                    width: `${percentage}%`,
                    backgroundColor: grade.color,
                  },
                ]}
              />
            ) : null;
          })}
        </View>
        <View style={styles.distributionLegend}>
          {grades.map((grade) => (
            <View key={grade.letter} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: grade.color }]} />
              <Text style={styles.legendText}>
                {grade.letter}: {grade.count}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Failed to load analytics</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Analytics</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Group Info */}
        <View style={styles.groupCard}>
          <Text style={styles.groupName}>{groupInfo?.name}</Text>
          <Text style={styles.groupDescription}>{groupInfo?.description}</Text>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsCard}>
          <Text style={styles.metricsTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Ionicons name="people" size={24} color={Colors.primary} />
              <Text style={styles.metricValue}>{stats.totalStudents}</Text>
              <Text style={styles.metricLabel}>Students</Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="document-text" size={24} color={Colors.info} />
              <Text style={styles.metricValue}>{stats.totalAssignments}</Text>
              <Text style={styles.metricLabel}>Assignments</Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="trophy" size={24} color={getGradeColor(stats.averageGrade)} />
              <Text style={[styles.metricValue, { color: getGradeColor(stats.averageGrade) }]}>
                {stats.averageGrade.toFixed(1)}%
              </Text>
              <Text style={styles.metricLabel}>Avg Grade</Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <Text style={[styles.metricValue, { color: Colors.success }]}>
                {stats.attendanceRate.toFixed(1)}%
              </Text>
              <Text style={styles.metricLabel}>Attendance</Text>
            </View>
          </View>
        </View>

        {/* Performance Overview */}
        <View style={styles.performanceCard}>
          <Text style={styles.performanceTitle}>Performance Overview</Text>
          
          <View style={styles.performanceItem}>
            <View style={styles.performanceHeader}>
              <Text style={styles.performanceLabel}>Submission Rate</Text>
              <Text style={styles.performanceValue}>{stats.submissionRate.toFixed(1)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(stats.submissionRate, 100)}%`,
                    backgroundColor: stats.submissionRate >= 80 ? Colors.success : 
                                   stats.submissionRate >= 60 ? Colors.warning : Colors.error
                  }
                ]} 
              />
            </View>
          </View>

          <View style={styles.performanceItem}>
            <View style={styles.performanceHeader}>
              <Text style={styles.performanceLabel}>Group Average</Text>
              <Text style={[styles.performanceValue, { color: getGradeColor(stats.averageGrade) }]}>
                {stats.averageGrade.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(stats.averageGrade, 100)}%`,
                    backgroundColor: getGradeColor(stats.averageGrade)
                  }
                ]} 
              />
            </View>
          </View>

          <View style={styles.performanceItem}>
            <View style={styles.performanceHeader}>
              <Text style={styles.performanceLabel}>Attendance Rate</Text>
              <Text style={[styles.performanceValue, { color: Colors.success }]}>
                {stats.attendanceRate.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(stats.attendanceRate, 100)}%`,
                    backgroundColor: stats.attendanceRate >= 90 ? Colors.success : 
                                   stats.attendanceRate >= 75 ? Colors.warning : Colors.error
                  }
                ]} 
              />
            </View>
          </View>
        </View>

        {/* Grade Distribution */}
        <View style={styles.distributionCard}>
          {renderGradeDistributionBar()}
        </View>

        {/* Recent Activity */}
        <View style={styles.activityCard}>
          <Text style={styles.activityTitle}>Recent Activity</Text>
          {stats.recentActivity.length === 0 ? (
            <Text style={styles.noActivity}>No recent activity</Text>
          ) : (
            stats.recentActivity.map((activity, index) => (
              <View key={index} style={[styles.activityItem, index > 0 && styles.activityItemBorder]}>
                <View style={styles.activityIcon}>
                  <Ionicons 
                    name={
                      activity.type === 'submission' ? 'document' :
                      activity.type === 'grade' ? 'trophy' : 'checkmark-circle'
                    } 
                    size={16} 
                    color={
                      activity.type === 'submission' ? Colors.info :
                      activity.type === 'grade' ? Colors.success : Colors.primary
                    } 
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>
                    <Text style={styles.activityStudent}>{activity.student}</Text>
                    {activity.type === 'submission' && ' submitted '}
                    {activity.type === 'grade' && ' received grade for '}
                    {activity.assignment && (
                      <Text style={styles.activityAssignment}>{activity.assignment}</Text>
                    )}
                    {activity.type === 'grade' && activity.value && (
                      <Text style={[styles.activityGrade, { color: getGradeColor(activity.value) }]}>
                        {' '}({activity.value}%)
                      </Text>
                    )}
                  </Text>
                  <Text style={styles.activityDate}>
                    {new Date(activity.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
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
  groupCard: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  groupDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  metricsCard: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  metricsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
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
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  performanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  performanceItem: {
    marginBottom: Spacing.lg,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  performanceLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border.light,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  distributionCard: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  distributionContainer: {
    marginBottom: Spacing.md,
  },
  distributionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  distributionBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  distributionSegment: {
    height: '100%',
  },
  distributionLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  legendText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  activityCard: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  noActivity: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
  },
  activityItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  activityStudent: {
    fontWeight: '600',
  },
  activityAssignment: {
    fontStyle: 'italic',
  },
  activityGrade: {
    fontWeight: '600',
  },
  activityDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
});