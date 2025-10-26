import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatRelativeDate, handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface AssignmentProgress {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  status: 'submitted' | 'missing';
  submitted_at?: string;
}

export default function StudentGrades() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assignments, setAssignments] = useState<AssignmentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    submittedAssignments: 0,
    missingAssignments: 0,
    completionPercentage: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load all assignments for student's school
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .eq('school_id', currentUser.school_id)
        .order('due_date', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Load student's submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('assignment_id, submitted_at')
        .eq('student_id', currentUser.id);

      if (submissionsError) throw submissionsError;

      // Create a map of submitted assignments
      const submittedMap = new Map();
      submissionsData?.forEach(sub => {
        submittedMap.set(sub.assignment_id, sub.submitted_at);
      });

      // Combine data
      const progressData: AssignmentProgress[] = (assignmentsData || []).map(assignment => ({
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        due_date: assignment.due_date,
        created_at: assignment.created_at,
        status: submittedMap.has(assignment.id) ? 'submitted' : 'missing',
        submitted_at: submittedMap.get(assignment.id),
      }));

      setAssignments(progressData);

      // Calculate statistics
      const total = progressData.length;
      const submitted = progressData.filter(a => a.status === 'submitted').length;
      const missing = total - submitted;
      const percentage = total > 0 ? Math.round((submitted / total) * 100) : 0;

      setStats({
        totalAssignments: total,
        submittedAssignments: submitted,
        missingAssignments: missing,
        completionPercentage: percentage,
      });
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load assignment progress');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'submitted' ? Colors.success : Colors.error;
  };

  const getStatusIcon = (status: string) => {
    return status === 'submitted' ? 'checkmark-circle' : 'close-circle';
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
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
        <Text style={styles.headerTitle}>Assignment Progress</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Statistics Card */}
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Completion Summary</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalAssignments}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.success }]}>
                {stats.submittedAssignments}
              </Text>
              <Text style={styles.statLabel}>Submitted</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.error }]}>
                {stats.missingAssignments}
              </Text>
              <Text style={styles.statLabel}>Missing</Text>
            </View>
          </View>

          <View style={styles.percentageContainer}>
            <Text style={styles.percentageLabel}>Completion Rate</Text>
            <Text style={[styles.percentageValue, { 
              color: stats.completionPercentage >= 80 ? Colors.success : 
                     stats.completionPercentage >= 60 ? Colors.warning : Colors.error 
            }]}>
              {stats.completionPercentage}%
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${stats.completionPercentage}%`,
                    backgroundColor: stats.completionPercentage >= 80 ? Colors.success : 
                                   stats.completionPercentage >= 60 ? Colors.warning : Colors.error
                  }
                ]} 
              />
            </View>
          </View>
        </Card>

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <EmptyState
            icon="document-text"
            title="No Assignments Yet"
            description="Your assignments will appear here once your teachers create them."
          />
        ) : (
          <View style={styles.assignmentsContainer}>
            <Text style={styles.assignmentsTitle}>All Assignments</Text>
            
            {assignments.map((assignment) => (
              <Card key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                    {assignment.description && (
                      <Text style={styles.assignmentDescription} numberOfLines={2}>
                        {assignment.description}
                      </Text>
                    )}
                    <View style={styles.assignmentMeta}>
                      <Ionicons name="calendar" size={14} color={Colors.text.secondary} />
                      <Text style={[
                        styles.dueDate,
                        isOverdue(assignment.due_date) && assignment.status === 'missing' && styles.overdue
                      ]}>
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </Text>
                    </View>
                    {assignment.status === 'submitted' && assignment.submitted_at && (
                      <View style={styles.submittedInfo}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={styles.submittedText}>
                          Submitted {formatRelativeDate(assignment.submitted_at)}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.statusBadge}>
                    <Ionicons 
                      name={getStatusIcon(assignment.status)} 
                      size={32} 
                      color={getStatusColor(assignment.status)} 
                    />
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(assignment.status) }
                    ]}>
                      {assignment.status === 'submitted' ? 'Submitted' : 'Missing'}
                    </Text>
                  </View>
                </View>

                {assignment.status === 'missing' && (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={() => router.push(`/submit-assignment?assignmentId=${assignment.id}`)}
                  >
                    <Text style={styles.submitButtonText}>Submit Assignment</Text>
                    <Ionicons name="arrow-forward" size={16} color={Colors.text.inverse} />
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </View>
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
  statsCard: {
    marginBottom: Spacing.lg,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  percentageContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  percentageLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  percentageValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginTop: Spacing.md,
  },
  progressBar: {
    height: 12,
    backgroundColor: Colors.border.light,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  assignmentsContainer: {
    flex: 1,
  },
  assignmentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  assignmentCard: {
    marginBottom: Spacing.md,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assignmentInfo: {
    flex: 1,
    marginRight: Spacing.md,
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
    marginBottom: Spacing.sm,
  },
  assignmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  dueDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  overdue: {
    color: Colors.error,
    fontWeight: '600',
  },
  submittedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  submittedText: {
    fontSize: 12,
    color: Colors.success,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
  statusBadge: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.inverse,
    marginRight: Spacing.sm,
  },
});
