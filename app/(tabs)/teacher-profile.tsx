import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../lib/auth';
import { getTeacherStats } from '../../lib/database';
import { handleError } from '../../lib/utils';
import Card from '../../components/Card';
import AnimatedCard from '../../components/AnimatedCard';
import FadeInView from '../../components/FadeInView';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import RoleProtection from '../../components/RoleProtection';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TeacherProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assignedSchools, setAssignedSchools] = useState<string[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      try {
        const { getTeacherSchools } = await import('../../lib/database');
        const { data: schoolsData } = await getTeacherSchools(currentUser.id);
        const names = (schoolsData || []).map((s: any) => s.name);
        if (currentUser.school?.name && !names.includes(currentUser.school.name)) {
          names.push(currentUser.school.name);
        }
        if (names.length === 0 && currentUser.school_id) {
          const { supabase } = await import('../../lib/supabase');
          const { data: sRow } = await supabase.from('schools').select('name').eq('id', currentUser.school_id).single();
          if (sRow?.name) names.push(sRow.name);
        }
        setAssignedSchools(names);
      } catch (sErr) {
        console.warn('Teacher schools error:', sErr);
      }

      // Load real teacher statistics from database
      const { supabase } = await import('../../lib/supabase');
      
      // Get assignments created by this teacher
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('teacher_id', currentUser.id);
      
      const assignmentIds = assignments?.map(a => a.id) || [];
      
      // Get submissions for teacher's assignments
      let totalSubmissions = 0;
      if (assignmentIds.length > 0) {
        const { count } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .in('assignment_id', assignmentIds);
        totalSubmissions = count || 0;
      }
      
      // Get all school IDs for teacher
      let teacherSchoolIds: string[] = [];
      try {
        const { getTeacherSchoolIds } = await import('../../lib/database');
        teacherSchoolIds = await getTeacherSchoolIds(currentUser.id);
      } catch (e) {
        if (currentUser.school_id) teacherSchoolIds = [currentUser.school_id];
      }
      if (teacherSchoolIds.length === 0 && currentUser.school_id) {
        teacherSchoolIds = [currentUser.school_id];
      }

      // Get students in teacher's assigned schools
      let studentQuery = supabase
        .from('app_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('is_active', true);

      if (teacherSchoolIds.length > 0) {
        studentQuery = studentQuery.in('school_id', teacherSchoolIds);
      }

      const { count: studentCount } = await studentQuery;
      
      setStats({
        totalAssignments: assignments?.length || 0,
        totalStudents: studentCount || 0,
        totalSubmissions: totalSubmissions,
      });
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {

    try {
      // Clear all storage
      await AsyncStorage.clear();
      
      // Force navigation
      if (typeof window !== 'undefined') {
        window.location.href = '/welcome';
      } else {
        router.dismissAll();
        router.replace('/welcome');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, try to navigate
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <RoleProtection allowedRoles={['teacher']}>
      <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={Colors.text.inverse} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRole}>Teacher</Text>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => router.push('/edit-teacher-profile')}
            >
              <Ionicons name="create" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Teaching Stats */}
        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Teaching Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="document-text" size={24} color={Colors.primary} />
              <Text style={styles.statValue}>{stats.totalAssignments || 0}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color={Colors.info} />
              <Text style={styles.statValue}>{stats.totalStudents || 0}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-done" size={24} color={Colors.success} />
              <Text style={styles.statValue}>{stats.totalSubmissions || 0}</Text>
              <Text style={styles.statLabel}>Submissions</Text>
            </View>
          </View>
        </Card>

        {/* Contact Information & School */}
        <Card style={styles.contactCard}>
          <Text style={styles.sectionTitle}>Contact & School</Text>
          
          <View style={styles.contactItem}>
            <Ionicons name="school" size={20} color={Colors.primary} />
            <Text style={styles.contactText}>
              {assignedSchools.length > 0 ? assignedSchools.join(', ') : (user?.school?.name || 'Not Assigned')}
            </Text>
          </View>

          <View style={styles.contactItem}>
            <Ionicons name="mail" size={20} color={Colors.text.secondary} />
            <Text style={styles.contactText}>{user?.email}</Text>
          </View>
          
          {user?.phone && (
            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color={Colors.text.secondary} />
              <Text style={styles.contactText}>{user.phone}</Text>
            </View>
          )}
        </Card>



        {/* Change Password */}
        <Button
          title="Change Password"
          onPress={() => router.push('/change-password')}
          variant="outline"
          icon="key-outline"
          style={{ marginBottom: Spacing.md }}
        />

        {/* Logout Button */}
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
    </RoleProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  profileRole: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  editButton: {
    padding: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
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
  contactCard: {
    marginBottom: Spacing.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  contactText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  actionsCard: {
    marginBottom: Spacing.lg,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  settingsCard: {
    marginBottom: Spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  settingValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  logoutButton: {
    marginBottom: Spacing.xl,
  },
});
