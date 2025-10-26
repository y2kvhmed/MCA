import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadAdminDashboard } from '../../lib/dashboardUtils';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import DashboardErrorBoundary from '../../components/DashboardErrorBoundary';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalSchools: 0,
    totalUsers: 0,
    totalAssignments: 0,
    activeStudents: 0,
  });
  const [loading, setLoading] = useState(true);

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
      
      // Set safe fallback data
      setStats({
        totalSchools: 0,
        totalUsers: 0,
        totalAssignments: 0,
        activeStudents: 0,
      });
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <DashboardErrorBoundary>
      <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="library" size={32} color={Colors.info} />
            <Text style={styles.statValue}>{stats.totalSchools}</Text>
            <Text style={styles.statLabel}>Total Schools</Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="people" size={32} color={Colors.success} />
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>All Time Total Users</Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="document-text" size={32} color={Colors.warning} />
            <Text style={styles.statValue}>{stats.totalAssignments}</Text>
            <Text style={styles.statLabel}>Total Assignments</Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="person" size={32} color={Colors.role.student} />
            <Text style={styles.statValue}>{stats.activeStudents}</Text>
            <Text style={styles.statLabel}>Active Students</Text>
          </Card>
        </View>

        <View style={styles.actions}>
          <Button
            title="View All Users"
            onPress={() => router.push('/view-users')}
            style={styles.actionButton}
            variant="secondary"
          />
          <Button
            title="Create School"
            onPress={() => router.push('/create-school')}
            style={styles.actionButton}
          />
          <Button
            title="Create User"
            onPress={() => router.push('/create-user')}
            style={styles.actionButton}
          />
          <Button
            title="Manage Schools"
            onPress={() => router.push('/view-schools')}
            variant="secondary"
            style={styles.actionButton}
          />
          <Button
            title="Manage Recordings"
            onPress={() => router.push('/recordings')}
            variant="outline"
            style={styles.actionButton}
          />
          <Button
            title="Edit User Passwords"
            onPress={() => router.push('/manage-users')}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>

        <Card style={styles.activityCard}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.placeholderText}>No recent activity</Text>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  actions: {
    marginBottom: Spacing.xl,
  },
  actionButton: {
    marginBottom: Spacing.md,
  },
  activityCard: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    padding: Spacing.xl,
  },
});
