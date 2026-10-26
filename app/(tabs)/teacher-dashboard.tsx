import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../lib/auth';
import { formatRelativeDate, handleError } from '../../lib/utils';
import { loadTeacherDashboard } from '../../lib/dashboardUtils';
import { useNotifications } from '../../contexts/NotificationContext';
import Card from '../../components/Card';
import AnimatedCard from '../../components/AnimatedCard';
import FadeInView from '../../components/FadeInView';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DashboardErrorBoundary from '../../components/DashboardErrorBoundary';
import RoleGuard from '../../components/RoleGuard';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';

export default function TeacherDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width > 768;
  const { unreadCount } = useNotifications();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [recentTests, setRecentTests] = useState<any[]>([]);
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
      setRecentTests(dashboardData.recentTests || []);
      
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load dashboard data');
      
      // Set safe fallback data
      setStats({});
      setAssignments([]);
      setRecentTests([]);
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
    <RoleGuard allowedRoles={['teacher']}>
      <DashboardErrorBoundary>
        <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Welcome Header */}
        <FadeInView style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
        </FadeInView>

        {/* Stats Grid */}
        <View style={[styles.statsGrid, isWide && styles.statsGridWide]}>
          <TouchableOpacity
            style={[styles.statCardTouchable, isWide && styles.statCardWide]}
            activeOpacity={0.8}
            onPress={() => router.push('/teacher-assignments')}
          >
            <AnimatedCard style={styles.statCard} delay={100}>
              <View style={[styles.statIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="document-text" size={24} color={Colors.warning} />
              </View>
              <Text style={styles.statValue}>{stats.myAssignments || 0}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </AnimatedCard>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCardTouchable, isWide && styles.statCardWide]}
            activeOpacity={0.8}
            onPress={() => router.push('/materials-list')}
          >
            <AnimatedCard style={styles.statCard} delay={150}>
              <View style={[styles.statIcon, { backgroundColor: Colors.info + '20' }]}>
                <Ionicons name="folder" size={24} color={Colors.info} />
              </View>
              <Text style={styles.statValue}>{stats.materialsSent || 0}</Text>
              <Text style={styles.statLabel}>Materials</Text>
            </AnimatedCard>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCardTouchable, isWide && styles.statCardWide]}
            activeOpacity={0.8}
            onPress={() => router.push('/students-list')}
          >
            <AnimatedCard style={styles.statCard} delay={200}>
              <View style={[styles.statIcon, { backgroundColor: Colors.success + '20' }]}>
                <Ionicons name="people" size={24} color={Colors.success} />
              </View>
              <Text style={styles.statValue}>{stats.totalStudents || 0}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </AnimatedCard>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCardTouchable, isWide && styles.statCardWide]}
            activeOpacity={0.8}
            onPress={() => router.push('/test-scores')}
          >
            <AnimatedCard style={styles.statCard} delay={250}>
              <View style={[styles.statIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="stats-chart" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.statValue}>{stats.totalTests || 0}</Text>
              <Text style={styles.statLabel}>Tests</Text>
            </AnimatedCard>
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
              onPress={() => router.push('/materials-list')}
            >
              <Ionicons name="folder" size={24} color={Colors.info} />
              <Text style={styles.actionText}>Materials</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/recordings')}
            >
              <Ionicons name="videocam" size={24} color={Colors.warning} />
              <Text style={styles.actionText}>Recordings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/students-list')}
            >
              <Ionicons name="people" size={24} color={Colors.success} />
              <Text style={styles.actionText}>Students</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/attendance')}
            >
              <Ionicons name="calendar-outline" size={24} color="#9C27B0" />
              <Text style={styles.actionText}>Attendance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/broadcast')}
            >
              <Ionicons name="megaphone" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Announcements</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/notes')}
            >
              <Ionicons name="document-text-outline" size={24} color="#9C27B0" />
              <Text style={styles.actionText}>Student Notes</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/test-scores')}
            >
              <Ionicons name="stats-chart" size={24} color={Colors.success} />
              <Text style={styles.actionText}>Test Scores</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Recent Tests */}
        {recentTests.length > 0 && (
          <Card style={styles.classesCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Tests</Text>
              <TouchableOpacity onPress={() => router.push('/test-scores')}>
                <Text style={styles.seeAllText}>Manage All</Text>
              </TouchableOpacity>
            </View>
            
            {recentTests.map((test) => (
              <TouchableOpacity
                key={test.id}
                style={styles.classItem}
                onPress={() => router.push(`/enter-marks?testId=${test.id}`)}
              >
                <View style={[styles.classIcon, { backgroundColor: Colors.success }]}>
                  <Ionicons name="stats-chart" size={20} color={Colors.text.inverse} />
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{test.title}</Text>
                  <Text style={styles.classDescription}>
                    Test Date: {new Date(test.test_date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.classStudents}>
                    Max Score: {test.max_score}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* School Assignments */}
        <Card style={styles.classesCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>School Assignments</Text>
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
    </RoleGuard>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  notificationButton: {
    position: 'relative',
    padding: Spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.text.inverse,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  statsGridWide: {
    flexWrap: 'nowrap',
    justifyContent: 'center',
  },
  statCardTouchable: {
    width: '47%',
  },
  statCardWide: {
    width: '23%',
    flex: 1,
    maxWidth: 250,
  },
  statCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    width: '100%',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
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
