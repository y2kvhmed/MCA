import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getAssignmentsByTeacher } from '../lib/database';
import { formatDueDate, formatRelativeDate, handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function TeacherAssignments() {
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

      if (currentUser.role !== 'teacher') {
        handleError(null, 'Access denied: Teachers only');
        router.back();
        return;
      }

      const { data: assignmentsData, error } = await getAssignmentsByTeacher(currentUser.id);
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

  const getStatusColor = (assignment: any) => {
    const now = new Date();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    
    if (!assignment.is_published) return Colors.text.tertiary;
    if (dueDate && now > dueDate) return Colors.error;
    if (dueDate && (dueDate.getTime() - now.getTime()) < 24 * 60 * 60 * 1000) return Colors.warning;
    return Colors.success;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Assignments</Text>
        <TouchableOpacity onPress={() => router.push('/create-assignment')}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
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
            <Text style={styles.statValue}>
              {assignments.filter(a => a.is_published).length}
            </Text>
            <Text style={styles.statLabel}>Published</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {assignments.reduce((sum, a) => sum + (a.submissions?.length || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Submissions</Text>
          </View>
        </FadeInView>

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <EmptyState
            icon="document-text"
            message="No assignments created yet"
            description="Create your first assignment to get started with managing student work."
          />
        ) : (
          assignments.map((assignment, index) => (
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
                  </View>
                  <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(assignment) }]} />
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
                  
                  <View style={styles.metaItem}>
                    <Ionicons name="document" size={14} color={Colors.text.secondary} />
                    <Text style={styles.metaText}>
                      {assignment.submissions?.length || 0} submissions
                    </Text>
                  </View>
                </View>

                <View style={styles.assignmentActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(`/assignment-submissions?assignmentId=${assignment.id}`);
                    }}
                  >
                    <Ionicons name="people" size={16} color={Colors.primary} />
                    <Text style={styles.actionText}>View Submissions</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(`/edit-assignment?assignmentId=${assignment.id}`);
                    }}
                  >
                    <Ionicons name="create" size={16} color={Colors.info} />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </AnimatedCard>
          ))
        )}

        {/* Create Assignment Button */}
        <Button
          title="Create New Assignment"
          onPress={() => router.push('/create-assignment')}
          style={styles.createButton}
          icon="add-circle"
        />
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
    fontSize: 24,
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
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
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
  assignmentActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  actionText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
  createButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
});