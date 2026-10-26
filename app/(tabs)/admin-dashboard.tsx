import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadAdminDashboard } from '../../lib/dashboardUtils';

import Card from '../../components/Card';
import AnimatedCard from '../../components/AnimatedCard';
import FadeInView from '../../components/FadeInView';
import LoadingSpinner from '../../components/LoadingSpinner';
import DashboardErrorBoundary from '../../components/DashboardErrorBoundary';
import RoleProtection from '../../components/RoleProtection';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';

export default function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width > 768;

  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalSchools: 0,
    totalUsers: 0,
    totalAssignments: 0,
    activeStudents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dashboardData = await loadAdminDashboard();
      
      if (dashboardData.error) {
        console.warn('Dashboard warning:', dashboardData.error);
      }
      
      setUser(dashboardData.user);
      setStats(dashboardData.stats || {
        totalSchools: 0,
        totalUsers: 0,
        totalAssignments: 0,
        activeStudents: 0,
      });
      
    } catch (error) {
      console.error('Load data error:', error);
      setStats({
        totalSchools: 0,
        totalUsers: 0,
        totalAssignments: 0,
        activeStudents: 0,
      });
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
    <RoleProtection allowedRoles={['admin']}>
      <DashboardErrorBoundary>
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <FadeInView style={styles.header}>
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{user?.name || 'Admin'}</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
          </FadeInView>

          <ScrollView 
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Stats Grid */}
            <View style={[styles.statsGrid, isWide && styles.statsGridWide]}>
              <AnimatedCard style={[styles.statCard, isWide && styles.statCardWide]} delay={100}>
                <View style={[styles.statIcon, { backgroundColor: Colors.info + '20' }]}>
                  <Ionicons name="library" size={24} color={Colors.info} />
                </View>
                <Text style={styles.statValue}>{stats.totalSchools}</Text>
                <Text style={styles.statLabel}>Schools</Text>
              </AnimatedCard>

              <AnimatedCard style={[styles.statCard, isWide && styles.statCardWide]} delay={150}>
                <View style={[styles.statIcon, { backgroundColor: Colors.success + '20' }]}>
                  <Ionicons name="people" size={24} color={Colors.success} />
                </View>
                <Text style={styles.statValue}>{stats.totalUsers}</Text>
                <Text style={styles.statLabel}>Users</Text>
              </AnimatedCard>

              <AnimatedCard style={[styles.statCard, isWide && styles.statCardWide]} delay={200}>
                <View style={[styles.statIcon, { backgroundColor: Colors.warning + '20' }]}>
                  <Ionicons name="document-text" size={24} color={Colors.warning} />
                </View>
                <Text style={styles.statValue}>{stats.totalAssignments}</Text>
                <Text style={styles.statLabel}>Assignments</Text>
              </AnimatedCard>

              <AnimatedCard style={[styles.statCard, isWide && styles.statCardWide]} delay={250}>
                <View style={[styles.statIcon, { backgroundColor: Colors.primary + '20' }]}>
                  <Ionicons name="school" size={24} color={Colors.primary} />
                </View>
                <Text style={styles.statValue}>{stats.activeStudents}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </AnimatedCard>
            </View>

            {/* Quick Actions */}
            <AnimatedCard style={styles.actionsCard} delay={300}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/create-user')}>
                  <View style={[styles.actionIcon, { backgroundColor: Colors.success + '20' }]}>
                    <Ionicons name="person-add" size={24} color={Colors.success} />
                  </View>
                  <Text style={styles.actionText}>Add User</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/create-school')}>
                  <View style={[styles.actionIcon, { backgroundColor: Colors.info + '20' }]}>
                    <Ionicons name="add-circle" size={24} color={Colors.info} />
                  </View>
                  <Text style={styles.actionText}>Add School</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/view-users')}>
                  <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '20' }]}>
                    <Ionicons name="people" size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.actionText}>View Users</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/view-schools')}>
                  <View style={[styles.actionIcon, { backgroundColor: Colors.warning + '20' }]}>
                    <Ionicons name="library" size={24} color={Colors.warning} />
                  </View>
                  <Text style={styles.actionText}>Schools</Text>
                </TouchableOpacity>
              </View>
            </AnimatedCard>

            {/* Management Section */}
            <AnimatedCard style={styles.managementCard} delay={400}>
              <Text style={styles.sectionTitle}>Management</Text>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/recordings')}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="videocam" size={22} color={Colors.primary} />
                  <Text style={styles.menuItemText}>Manage Recordings</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>


              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/materials-list')}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="folder" size={22} color={Colors.info} />
                  <Text style={styles.menuItemText}>View Materials</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin-chats')}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="chatbubbles" size={22} color="#9C27B0" />
                  <Text style={styles.menuItemText}>View School Chats</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => router.push('/admin-controls')}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="settings" size={22} color={Colors.text.secondary} />
                  <Text style={styles.menuItemText}>Controls</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </AnimatedCard>
          </ScrollView>
        </SafeAreaView>
      </DashboardErrorBoundary>
    </RoleProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    fontSize: 14,
    color: Colors.text.secondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },

  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  statsGridWide: {
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '47%',
    minWidth: 150,
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  statCardWide: {
    width: '23%',
    flex: 1,
    maxWidth: 250,
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
    marginBottom: Spacing.lg,
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
    gap: Spacing.md,
  },
  actionItem: {
    width: '47%',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionText: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  managementCard: {
    marginBottom: Spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

});
