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

export default function StudentAssignments() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      const { data: assignmentsData } = await getAssignmentsForStudent(currentUser.id);
      if (assignmentsData) {
        setAssignments(assignmentsData);
      }
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

  const getFilteredAssignments = () => {
    switch (filter) {
      case 'pending':
        return assignments.filter(a => !a.submissions || a.submissions.length === 0);
      case 'submitted':
        return assignments.filter(a => a.submissions && a.submissions.length > 0 && !a.submissions[0].grade);
      case 'graded':
        return assignments.filter(a => a.submissions && a.submissions.length > 0 && a.submissions[0].grade !== null);
      default:
        return assignments;
    }
  };

  const getAssignmentStatus = (assignment: any) => {
    if (!assignment.submissions || assignment.submissions.length === 0) {
      return { status: 'pending', color: Colors.warning, icon: 'time' };
    }
    
    const submission = assignment.submissions[0];
    if (submission.grade !== null) {
      return { status: 'graded', color: Colors.success, icon: 'checkmark-circle' };
    }
    
    return { status: 'submitted', color: Colors.info, icon: 'document' };
  };

  const isOverdue = (dueDate: string) => {
    return new Date() > new Date(dueDate);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const filteredAssignments = getFilteredAssignments();

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Assignments</Text>
        <View style={{ width: 24 }} />
      </FadeInView>

      {/* Filter Tabs */}
      <FadeInView style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'all', label: 'All', count: assignments.length },
            { key: 'pending', label: 'Pending', count: assignments.filter(a => !a.submissions || a.submissions.length === 0).length },
            { key: 'submitted', label: 'Submitted', count: assignments.filter(a => a.submissions && a.submissions.length > 0 && !a.submissions[0].grade).length },
            { key: 'graded', label: 'Graded', count: assignments.filter(a => a.submissions && a.submissions.length > 0 && a.submissions[0].grade !== null).length },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                filter === tab.key && styles.filterTabActive,
              ]}
              onPress={() => setFilter(tab.key as any)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === tab.key && styles.filterTabTextActive,
                ]}
              >
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </FadeInView>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredAssignments.length === 0 ? (
          <EmptyState
            icon="document-text"
            title={`No ${filter === 'all' ? '' : filter} Assignments`}
            description={
              filter === 'all' 
                ? "No assignments available yet."
                : `No ${filter} assignments found.`
            }
          />
        ) : (
          filteredAssignments.map((assignment, index) => {
            const statusInfo = getAssignmentStatus(assignment);
            const overdue = assignment.due_date && isOverdue(assignment.due_date);
            
            return (
              <AnimatedCard key={assignment.id} delay={100 * (index + 1)} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                    <Text style={styles.className}>{assignment.class?.name}</Text>
                    
                    <View style={styles.assignmentMeta}>
                      {assignment.due_date && (
                        <View style={styles.metaItem}>
                          <Ionicons 
                            name="calendar" 
                            size={14} 
                            color={overdue ? Colors.error : Colors.text.secondary} 
                          />
                          <Text style={[
                            styles.metaText,
                            overdue && styles.overdueText
                          ]}>
                            {formatDueDate(assignment.due_date)}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.metaItem}>
                        <Ionicons name="trophy" size={14} color={Colors.text.secondary} />
                        <Text style={styles.metaText}>Max: {assignment.max_score}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                      <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.status.toUpperCase()}
                      </Text>
                    </View>
                    
                    {assignment.submissions && assignment.submissions.length > 0 && assignment.submissions[0].grade !== null && (
                      <Text style={styles.gradeText}>
                        {assignment.submissions[0].grade}/{assignment.max_score}
                      </Text>
                    )}
                  </View>
                </View>

                {assignment.description && (
                  <Text style={styles.assignmentDescription}>{assignment.description}</Text>
                )}

                <View style={styles.assignmentActions}>
                  {statusInfo.status === 'pending' ? (
                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={() => router.push(`/submit-assignment?assignmentId=${assignment.id}`)}
                    >
                      <Ionicons name="cloud-upload" size={16} color={Colors.text.inverse} />
                      <Text style={styles.submitButtonText}>Submit</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.viewButton}
                      onPress={() => router.push(`/assignment-details?assignmentId=${assignment.id}`)}
                    >
                      <Ionicons name="eye" size={16} color={Colors.primary} />
                      <Text style={styles.viewButtonText}>View Details</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
  filterContainer: {
    backgroundColor: Colors.card.background,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  filterTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  filterTabTextActive: {
    color: Colors.text.inverse,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  assignmentCard: {
    marginBottom: Spacing.lg,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  assignmentInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  className: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
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
  overdueText: {
    color: Colors.error,
    fontWeight: '600',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: Spacing.xs,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  gradeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.success,
  },
  assignmentDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  assignmentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  submitButtonText: {
    fontSize: 14,
    color: Colors.text.inverse,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
  },
  viewButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});