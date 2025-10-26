import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

export default function StudentDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [student, setStudent] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.studentId) {
      loadData();
    }
  }, [params.studentId]);

  const loadData = async () => {
    try {
      const studentId = params.studentId as string;
      
      // Load student details
      const { data: studentData } = await getUserById(studentId);
      if (studentData) {
        setStudent(studentData);
        
        // Load student submissions
        const { data: submissionsData } = await getStudentSubmissions(studentId);
        if (submissionsData) setSubmissions(submissionsData);
        
        // Load all assignments from the student's school to check for missing ones
        if (studentData.school_id) {
          const { data: assignmentsData } = await getAssignmentsBySchool(studentData.school_id);
          if (assignmentsData) setAssignments(assignmentsData);
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  const exportStudentReport = async () => {
    try {
      const submittedAssignmentIds = submissions.map(s => s.assignment_id);
      
      const reportData = assignments.map(assignment => {
        const submission = submissions.find(s => s.assignment_id === assignment.id);
        return {
          'Assignment Name': assignment.title,
          'Type': assignment.assignment_type,
          'Due Date': assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date',
          'Status': submission ? 'Submitted' : 'Missing',
          'Submitted Date': submission ? new Date(submission.submitted_at).toLocaleDateString() : 'Not submitted',
          'Grade': submission?.grade ? `${submission.grade}/${assignment.max_score}` : 'Not graded',
          'Feedback': submission?.feedback || 'No feedback',
        };
      });

      await exportToCSV(reportData, `${student.name.replace(/\s+/g, '-')}-report`);
      showSuccess('Student report exported successfully');
    } catch (error) {
      handleError(error, 'Failed to export report');
    }
  };

  const getSubmissionStatus = (assignment: any) => {
    const submission = submissions.find(s => s.assignment_id === assignment.id);
    if (!submission) return 'missing';
    if (submission.grade !== null) return 'graded';
    return 'submitted';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded': return Colors.success;
      case 'submitted': return Colors.info;
      case 'missing': return Colors.error;
      default: return Colors.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded': return 'checkmark-circle';
      case 'submitted': return 'time';
      case 'missing': return 'close-circle';
      default: return 'help-circle';
    }
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

  const submittedCount = submissions.length;
  const totalAssignments = assignments.length;
  const missingCount = totalAssignments - submittedCount;
  const gradedSubmissions = submissions.filter(s => s && s.grade !== null && s.grade !== undefined);
  const averageGrade = gradedSubmissions.length > 0
    ? gradedSubmissions.reduce((sum, s) => sum + (Number(s.grade) || 0), 0) / gradedSubmissions.length
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Details</Text>
        <TouchableOpacity onPress={exportStudentReport}>
          <Ionicons name="download" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Student Info */}
        <Card style={styles.studentCard}>
          <View style={styles.studentHeader}>
            <View style={styles.studentAvatar}>
              <Ionicons name="person" size={32} color={Colors.text.inverse} />
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentEmail}>{student.email || 'No email'}</Text>
              <Text style={styles.studentPhone}>{student.phone || 'No phone'}</Text>
            </View>
          </View>
        </Card>

        {/* Statistics */}
        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <Text style={styles.statValue}>{submittedCount}</Text>
              <Text style={styles.statLabel}>Submitted</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="close-circle" size={24} color={Colors.error} />
              <Text style={styles.statValue}>{missingCount}</Text>
              <Text style={styles.statLabel}>Missing</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="star" size={24} color={Colors.warning} />
              <Text style={styles.statValue}>{averageGrade.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avg Grade</Text>
            </View>
          </View>
        </Card>

        {/* Assignment Status */}
        <Card style={styles.assignmentsCard}>
          <Text style={styles.sectionTitle}>Assignment Status</Text>
          
          {assignments.length === 0 ? (
            <EmptyState
              icon="document-text"
              title="No Assignments"
              description="No assignments found for this student's school."
            />
          ) : (
            assignments.map((assignment) => {
              const status = getSubmissionStatus(assignment);
              const submission = submissions.find(s => s.assignment_id === assignment.id);
              
              return (
                <TouchableOpacity
                  key={assignment.id}
                  style={styles.assignmentItem}
                  onPress={() => {
                    if (submission) {
                      router.push(`/submission-details?submissionId=${submission.id}`);
                    }
                  }}
                >
                  <View style={styles.assignmentIcon}>
                    <Ionicons 
                      name={getStatusIcon(status)} 
                      size={20} 
                      color={getStatusColor(status)} 
                    />
                  </View>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                    <Text style={styles.assignmentType}>{assignment.assignment_type}</Text>
                    <View style={styles.assignmentMeta}>
                      {assignment.due_date && (
                        <Text style={styles.assignmentDue}>
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </Text>
                      )}
                      {submission && (
                        <Text style={styles.assignmentSubmitted}>
                          Submitted: {formatRelativeDate(submission.submitted_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.assignmentStatus}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(status) + '20' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(status) }
                      ]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </View>
                    {submission && submission.grade !== null && submission.grade !== undefined && (
                      <Text style={styles.gradeText}>
                        {submission.grade}/{assignment.max_score || 100}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
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
  studentPhone: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  statsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
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
  assignmentsCard: {
    marginBottom: Spacing.xl,
  },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  assignmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
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
  assignmentType: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  assignmentMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  assignmentDue: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  assignmentSubmitted: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  assignmentStatus: {
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    marginBottom: Spacing.xs,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
});