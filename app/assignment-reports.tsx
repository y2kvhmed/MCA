import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getAllAssignments, getAssignmentSubmissions } from '../lib/database';
import { exportAssignmentSubmissions, exportMonthlyAssignments, exportStudentPerformance, exportAllUsers } from '../lib/csvExport';
import { handleError, showSuccess } from '../lib/utils';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import AssignmentStatusGrid from '../components/AssignmentStatusGrid';
import Button from '../components/Button';
import { SkeletonList } from '../components/LoadingSkeleton';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AssignmentReports() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<string>('');

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser?.role === 'admin' || currentUser?.role === 'teacher') {
        const { data } = await getAllAssignments();
        if (data) {
          // Get submissions for each assignment
          const assignmentsWithSubmissions = await Promise.all(
            data.map(async (assignment) => {
              const { data: submissions } = await getAssignmentSubmissions(assignment.id);
              return {
                ...assignment,
                submissions: submissions || []
              };
            })
          );
          setAssignments(assignmentsWithSubmissions);
        }
      }
    } catch (error) {
      handleError(error, 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = usePullToRefresh(loadData);

  useEffect(() => {
    loadData();
  }, []);

  const handleExportAssignment = async (assignmentId: string) => {
    try {
      const result = await exportAssignmentSubmissions(assignmentId);
      if (result.success) {
        showSuccess('Assignment report exported successfully');
      } else {
        handleError(result.error, 'Failed to export assignment report');
      }
    } catch (error) {
      handleError(error, 'Failed to export assignment report');
    }
  };

  const handleExportMonthly = async () => {
    const now = new Date();
    try {
      const result = await exportMonthlyAssignments(now.getFullYear(), now.getMonth() + 1);
      if (result.success) {
        showSuccess('Monthly report exported successfully');
      } else {
        handleError(result.error, 'Failed to export monthly report');
      }
    } catch (error) {
      handleError(error, 'Failed to export monthly report');
    }
  };

  const handleExportAllUsers = async () => {
    try {
      const result = await exportAllUsers();
      if (result.success) {
        showSuccess('Users report exported successfully');
      } else {
        handleError(result.error, 'Failed to export users report');
      }
    } catch (error) {
      handleError(error, 'Failed to export users report');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assignment Reports</Text>
        </View>
        <View style={styles.content}>
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'teacher') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Access Denied</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>Only administrators and teachers can view reports.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignment Reports</Text>
        <TouchableOpacity onPress={() => router.push('/compose-email')}>
          <Ionicons name="mail" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Export Options */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Quick Exports</Text>
          
          <View style={styles.exportButtons}>
            <Button
              title="Export Monthly Report"
              onPress={handleExportMonthly}
              variant="outline"
              size="small"
              style={styles.exportButton}
            />
            
            {user?.role === 'admin' && (
              <Button
                title="Export All Users"
                onPress={handleExportAllUsers}
                variant="outline"
                size="small"
                style={styles.exportButton}
              />
            )}
          </View>
        </View>

        {/* Assignment Reports */}
        <Text style={styles.sectionTitle}>Assignment Details</Text>
        
        {assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={Colors.text.secondary} />
            <Text style={styles.emptyText}>No assignments found</Text>
            <Text style={styles.emptySubtext}>Create assignments to see reports here</Text>
          </View>
        ) : (
          assignments.map((assignment) => (
            <View key={assignment.id} style={styles.assignmentCard}>
              <AssignmentStatusGrid
                assignment={assignment}
                students={assignment.submissions.map((sub: any) => ({
                  id: sub.student_id,
                  name: sub.student?.name || 'Unknown',
                  email: sub.student?.email || '',
                  submission: sub.submitted_at ? {
                    submitted_at: sub.submitted_at,
                    grade: sub.grade
                  } : undefined
                }))}
                onStudentPress={(studentId) => {
                  // Navigate to student details or grade submission
                  router.push(`/grade-submission?submissionId=${assignment.submissions.find((s: any) => s.student_id === studentId)?.id}`);
                }}
              />
              
              <Button
                title="Export Assignment Report"
                onPress={() => handleExportAssignment(assignment.id)}
                variant="outline"
                size="small"
                style={styles.exportAssignmentButton}
              />
            </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  exportSection: {
    marginBottom: Spacing.xl,
  },
  exportButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  exportButton: {
    flex: 1,
    minWidth: 150,
  },
  assignmentCard: {
    marginBottom: Spacing.lg,
  },
  exportAssignmentButton: {
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.xxxl,
  },
});