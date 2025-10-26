import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getAssignmentsByTeacher, deleteAssignment } from '../lib/database';
import { formatDueDate, formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AssignmentManager() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'overdue'>('all');

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

  const handleDeleteAssignment = async (assignmentId: string, title: string) => {
    Alert.alert(
      'Delete Assignment',
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteAssignment(assignmentId);
              if (error) throw error;
              
              showSuccess('Assignment deleted successfully');
              loadData(); // Refresh the list
            } catch (error) {
              handleError(error, 'Failed to delete assignment');
            }
          }
        }
      ]
    );
  };

  const getFilteredAssignments = () => {
    const now = new Date();
    
    switch (filter) {
      case 'published':
        return assignments.filter(a => a.is_published);
      case 'draft':
        return assignments.filter(a => !a.is_published);
      case 'overdue':
        return assignments.filter(a => 
          a.due_date && new Date(a.due_date) < now && a.is_published
        );
      default:
        return assignments;
    }
  };

  const getStatusColor = (assignment: any) => {
    const now = new Date();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    
    if (!assignment.is_published) return Colors.text.tertiary;
    if (dueDate && now > dueDate) return Colors.error;
    if (dueDate && (dueDate.getTime() - now.getTime()) < 24 * 60 * 60 * 1000) return Colors.warning;
    return Colors.success;
  };

  const filteredAssignments = getFilteredAssignments();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignment Manager</Text>
        <TouchableOpacity onPress={() => router.push('/create-assignment')}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'all', label: 'All', count: assignments.length },
            { key: 'published', label: 'Published', count: assignments.filter(a => a.is_published).length },
            { key: 'draft', label: 'Drafts', count: assignments.filter(a => !a.is_published).length },
            { key: 'overdue', label: 'Overdue', count: assignments.filter(a => {
              const now = new Date();
              return a.due_date && new Date(a.due_date) < now && a.is_published;
            }).length }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                filter === tab.key && styles.activeFilterTab
              ]}
              onPress={() => setFilter(tab.key as any)}
            >
              <Text style={[
                styles.filterText,
                filter === tab.key && styles.activeFilterText
              ]}>
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredAssignments.length === 0 ? (
          <EmptyState
            icon="document-text"
            title="No Assignments"
            description={
              filter === 'all' 
                ? "You haven't created any assignments yet."
                : `No ${filter} assignments found.`
            }
          />
        ) : (
          filteredAssignments.map((assignment) => (
            <Card key={assignment.id} style={styles.assignmentCard}>
              <View style={styles.assignmentHeader}>
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                  <Text style={styles.assignmentDescription} numberOfLines={2}>
                    {assignment.description || 'No description'}
                  </Text>
                  <View style={styles.assignmentMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar" size={14} color={Colors.text.secondary} />
                      <Text style={styles.metaText}>
                        {assignment.due_date ? formatDueDate(assignment.due_date) : 'No due date'}
                      </Text>
                    </View>
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
                </View>
                <View style={[
                  styles.statusIndicator, 
                  { backgroundColor: getStatusColor(assignment) }
                ]} />
              </View>

              <View style={styles.assignmentActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/assignment-details?assignmentId=${assignment.id}`)}
                >
                  <Ionicons name="eye" size={16} color={Colors.primary} />
                  <Text style={styles.actionText}>View</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/assignment-submissions?assignmentId=${assignment.id}`)}
                >
                  <Ionicons name="people" size={16} color={Colors.info} />
                  <Text style={styles.actionText}>Submissions</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/edit-assignment?assignmentId=${assignment.id}`)}
                >
                  <Ionicons name="create" size={16} color={Colors.warning} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteAssignment(assignment.id, assignment.title)}
                >
                  <Ionicons name="trash" size={16} color={Colors.error} />
                  <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

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
  assignmentCard: {
    marginBottom: Spacing.md,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.sm,
  },
  assignmentMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
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
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  assignmentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
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