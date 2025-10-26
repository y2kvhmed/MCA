import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserById, getStudentSubmissions, getAssignmentsBySchool } from '../lib/database';
import { formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function StudentProgress() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [student, setStudent] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.studentId) {
      loadData();
    }
  }, [params.studentId]);

  const loadData = async () => {
    try {
      const studentId = params.studentId as string;
      
      const { data: studentData } = await getUserById(studentId);
      if (studentData) {
        setStudent(studentData);
        
        const { data: submissionsData } = await getStudentSubmissions(studentId);
        if (submissionsData) setSubmissions(submissionsData);
        
        if (studentData.school_id) {
          const { data: assignmentsData } = await getAssignmentsBySchool(studentData.school_id);
          if (assignmentsData) setAssignments(assignmentsData);
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load student progress');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const exportProgressReport = async () => {
    try {
      const reportData = assignments.map(assignment => {
        const submission = submissions.find(s => s.assignment_id === assignment.id);
        return {
          'Assignment': assignment.title,
          'Type': assignment.assignment_type,
          'Due Date': assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date',
          'Status': submission ? 'Submitted' : 'Missing',
          'Submitted Date': submission ? new Date(submission.submitted_at).toLocaleDateString() : 'Not submitted',
          'Grade': submission && submission.grade !== null ? `${submission.grade}/${assignment.max_score}` : 'Not graded',
          'Percentage': submission && submission.grade !== null ? `${Math.round((submission.grade / assignment.max_score) * 100)}%` : 'N/A',
          'Feedback': submission?.feedback || 'No feedback',
        };
      });

      await exportToCSV(reportData, `${student.name.replace(/\s+/g, '-')}-progress-report`);
      showSuccess('Progress report exported successfully');
    } catch (error) {
      handleError(error, 'Failed to export report');
    }
  };

  const calculateStats = () => {
    const submittedCount = submissions.length;
    const totalAssignments = assignments.length;
    const missingCount = totalAssignments - submittedCount;
    const gradedSubmissions = submissions.filter(s => s && s.grade !== null && s.grade !== undefined);
    const averageGrade = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, s) => sum + (Number(s.grade) || 0), 0) / gradedSubmissions.length
      : 0;
    
    const completionRate = totalAssignments > 0 ? (submittedCount / totalAssignments) * 100 : 0;
    
    return {
      submittedCount,
      totalAssignments,
      missingCount,
      averageGrade,
      completionRate,
      gradedCount: gradedSubmissions.length
    };
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return Colors.success;
    if (grade >= 80) return Colors.info;
    if (grade >= 70) return Colors.warning;
    return Colors.error;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="person"
          title="Student Not Found"
          description="The requested student could not be found."
        />
      </SafeAreaView>
    );
  }

  const stats = calculateStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Progress</Text>
        <TouchableOpacity onPress={exportProgressReport}>
          <Ionicons name="download" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Student Info */}
        <Card style={styles.studentCard}>
          <View style={styles.studentHeader}>
            <View style={styles.studentAvatar}>
              <Ionicons name="person" size={32} color={Colors.text.inverse} />
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentEmail}>{student.email || 'No email'}</Text>
              <Text style={styles.studentRole}>Student</Text>
            </View>
          </View>
        </Card>

        {/* Progress Overview */}
        <Card style={styles.progressCard}>
          <Text style={styles.sectionTitle}>Progress Overview</Text>
          
          {/* Completion Rate */}
          <View style={styles.progressBar}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${stats.completionRate}%`,
                    backgroundColor: getGradeColor(stats.completionRate)
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {stats.completionRate.toFixed(1)}% Complete
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <Text style={styles.statValue}>{stats.submittedCount}</Text>
              <Text style={styles.statLabel}>Submitted</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="close-circle" size={24} color={Colors.error} />
              <Text style={styles.statValue}>{stats.missingCount}</Text>
              <Text style={styles.statLabel}>Missing</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="star" size={24} color={Colors.warning} />
              <Text style={[styles.statValue, { color: getGradeColor(stats.averageGrade) }]}>
                {stats.averageGrade.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Avg Grade</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trophy" size={24} color={Colors.info} />
              <Text style={styles.statValue}>{stats.gradedCount}</Text>
              <Text style={styles.statLabel}>Graded</Text>
            </View>
          </View>
        </Card>

        {/* Recent Activity */}
        <Card style={styles.activityCard}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {submissions.length === 0 ? (
            <EmptyState
              icon="document-text"
              title="No Submissions"
              description="This student hasn't submitted any assignments yet."
            />
          ) : (
            submissions.slice(0, 5).map((submission) => {
              const assignment = assignments.find(a => a.id === submission.assignment_id);
              if (!assignment) return null;
              
              return (
                <TouchableOpacity
                  key={submission.id}
                  style={styles.activityItem}
                  onPress={() => router.push(`/submission-details?submissionId=${submission.id}`)}
                >
                  <View style={styles.activityIcon}>
                    <Ionicons 
                      name={submission.grade !== null ? "checkmark-circle" : "time"} 
                      size={20} 
                      color={submission.grade !== null ? Colors.success : Colors.warning} 
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>{assignment.title}</Text>
                    <Text style={styles.activityDate}>
                      Submitted {formatRelativeDate(submission.submitted_at)}
                    </Text>
                    {submission.grade !== null && (
                      <Text style={[styles.activityGrade, { color: getGradeColor((submission.grade / assignment.max_score) * 100) }]}>
                        Grade: {submission.grade}/{assignment.max_score} ({Math.round((submission.grade / assignment.max_score) * 100)}%)
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              );
            })
          )}
          
          {submissions.length > 5 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push(`/student-details?studentId=${student.id}`)}
            >
              <Text style={styles.viewAllText}>View All Submissions</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </Card>

        {/* Performance Insights */}
        <Card style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>Performance Insights</Text>
          
          <View style={styles.insightItem}>
            <Ionicons name="trending-up" size={20} color={Colors.success} />
            <Text style={styles.insightText}>
              {stats.completionRate >= 80 
                ? "Excellent completion rate! Keep up the good work."
                : stats.completionRate >= 60
                ? "Good progress, but there's room for improvement."
                : "Consider reaching out to help with missing assignments."
              }
            </Text>
          </View>
          
          {stats.averageGrade > 0 && (
            <View style={styles.insightItem}>
              <Ionicons name="analytics" size={20} color={getGradeColor(stats.averageGrade)} />
              <Text style={styles.insightText}>
                {stats.averageGrade >= 90 
                  ? "Outstanding academic performance!"
                  : stats.averageGrade >= 80
                  ? "Strong academic performance."
                  : stats.averageGrade >= 70
                  ? "Satisfactory performance with potential for growth."
                  : "May benefit from additional support and resources."
                }
              </Text>
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
  studentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  studentEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  studentRole: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  progressCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  progressBar: {
    marginBottom: Spacing.lg,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: Colors.border.light,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
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
  activityCard: {
    marginBottom: Spacing.lg,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  activityDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  activityGrade: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginRight: Spacing.xs,
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