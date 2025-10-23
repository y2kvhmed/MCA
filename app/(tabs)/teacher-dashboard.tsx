import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../lib/auth';
import { getSchoolStats, getAssignmentsByTeacher } from '../../lib/database';
import { formatRelativeDate, handleError } from '../../lib/utils';
import { loadTeacherDashboard } from '../../lib/dashboardUtils';
import Card from '../../components/Card';
import AnimatedCard from '../../components/AnimatedCard';
import FadeInView from '../../components/FadeInView';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DashboardErrorBoundary from '../../components/DashboardErrorBoundary';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dashboardData = await loadTeacherDashboard();
      
      if (dashboardData.error) {
        console.warn('Dashboard warning:', dashboardData.error);
      }
      
      setUser(dashboardData.user);
      setStats(dashboardData.stats || {});
      setAssignments(dashboardData.assignments || []);
      
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load dashboard data');
      
      // Set safe fallback data
      setStats({});
      setAssignments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
          <TouchableOpacity onPress={() => router.push('/teacher-assignments')}>
            <Card style={styles.statCard}>
              <View style={styles.statContent}>
                <Ionicons name="document-text" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{stats.myAssignments || 0}</Text>
                <Text style={styles.statLabel}>My Assignments</Text>
              </View>
            </Card>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push('/materials-list')}>
            <Card style={styles.statCard}>
              <View style={styles.statContent}>
                <Ionicons name="folder" size={24} color={Colors.info} />
                <Text style={styles.statValue}>{stats.materialsSent || 0}</Text>
                <Text style={styles.statLabel}>Materials</Text>
              </View>
            </Card>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push('/students-list')}>
            <Card style={styles.statCard}>
              <View style={styles.statContent}>
                <Ionicons name="people" size={24} color={Colors.success} />
                <Text style={styles.statValue}>{stats.totalStudents || 0}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/create-assignment')}
            >
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>New Assignment</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/class-management')}
            >
              <Ionicons name="school" size={24} color={Colors.info} />
              <Text style={styles.actionText}>Manage Classes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/grade-book')}
            >
              <Ionicons name="clipboard" size={24} color={Colors.success} />
              <Text style={styles.actionText}>Gradebook</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/add-recording')}
            >
              <Ionicons name="videocam" size={24} color={Colors.warning} />
              <Text style={styles.actionText}>Add Recording</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/recordings')}
            >
              <Ionicons name="library" size={24} color={Colors.error} />
              <Text style={styles.actionText}>Recordings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/students-list')}
            >
              <Ionicons name="people" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Students</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* My Assignments */}
        <Card style={styles.classesCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Assignments</Text>
            <TouchableOpacity onPress={() => router.push('/teacher-assignments')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {assignments.length === 0 ? (
            <EmptyState
              icon="document-text"
              title="No Assignments Yet"
              description="Create your first assignment to get started."
            />
          ) : (
            assignments.map((assignment) => (
              <TouchableOpacity
                key={assignment.id}
                style={styles.classItem}
                onPress={() => router.push(`/assignment-details?assignmentId=${assignment.id}`)}
              >
                <View style={styles.classIcon}>
                  <Ionicons name="document-text" size={20} color={Colors.text.inverse} />
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{assignment.title}</Text>
                  <Text style={styles.classDescription}>{assignment.description || 'Physics Assignment'}</Text>
                  <Text style={styles.classStudents}>
                    {assignment.submissions?.length || 0} submissions
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            ))
          )}
        </Card>


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
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
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
    gap: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
  classesCard: {
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
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  classIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  classDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  classStudents: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
});
