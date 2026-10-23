import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getUsersBySchool, deleteUser } from '../lib/database';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ManageUsers() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-refresh user list whenever returning to this screen
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        showError('Access denied. Admin privileges required.');
        router.back();
        return;
      }
      
      setUser(currentUser);

      // Load all users except admins
      const { data: usersData } = await getUsersBySchool(null, true); // true = exclude admins
      if (usersData) {
        const teacherIds = usersData.filter(u => u.role === 'teacher').map(u => u.id);
        if (teacherIds.length > 0) {
          const { data: tsData } = await supabase
            .from('teacher_schools')
            .select('teacher_id, schools(id, name)')
            .in('teacher_id', teacherIds);

          if (tsData && tsData.length > 0) {
            const map: Record<string, string[]> = {};
            tsData.forEach((ts: any) => {
              if (ts.schools?.name) {
                if (!map[ts.teacher_id]) map[ts.teacher_id] = [];
                map[ts.teacher_id].push(ts.schools.name);
              }
            });
            const enriched = usersData.map(u => {
              if (u.role === 'teacher' && map[u.id] && map[u.id].length > 0) {
                return { ...u, schoolDisplay: map[u.id].join(', ') };
              }
              return { ...u, schoolDisplay: u.school?.name || 'No School' };
            });
            setUsers(enriched);
            return;
          }
        }
        setUsers(usersData.map(u => ({ ...u, schoolDisplay: u.school?.name || 'No School' })));
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userToEdit: any) => {
    router.push(`/edit-user?userId=${userToEdit.id}`);
  };

  const confirmDeleteUser = (userItem: any) => {
    if (user?.id === userItem.id) {
      showError('Security restriction: You cannot delete your own account.');
      return;
    }

    const doDelete = async () => {
      try {
        setLoading(true);
        const { error } = await deleteUser(userItem.id);
        if (error) throw error;
        showSuccess(`User "${userItem.name}" deleted successfully`);
        await loadData();
      } catch (err: any) {
        console.error('Delete user error:', err);
        handleError(err, 'Failed to delete user');
        setLoading(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to permanently delete "${userItem.name}" (${userItem.email})? This action cannot be undone.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete User',
        `Are you sure you want to delete ${userItem.name}? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
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
        <Text style={styles.headerTitle}>Manage Users</Text>
        <TouchableOpacity onPress={() => router.push('/create-user')}>
          <Ionicons name="person-add" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.usersCard}>
          <Text style={styles.sectionTitle}>Users ({users.length})</Text>
          
          {users.map((userItem) => (
            <TouchableOpacity 
              key={userItem.id} 
              style={styles.userItem}
              activeOpacity={0.7}
              onPress={() => handleEditUser(userItem)}
            >
              <View style={styles.userIcon}>
                <Ionicons 
                  name={userItem.role === 'teacher' ? 'person' : 'school'} 
                  size={20} 
                  color={Colors.text.inverse} 
                />
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{userItem.name}</Text>
                <Text style={styles.userEmail}>{userItem.email}</Text>
                <Text style={styles.userRole}>
                  {userItem.role?.toUpperCase()} • {userItem.schoolDisplay || userItem.school?.name || 'No School'}
                </Text>
              </View>
              
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleEditUser(userItem);
                  }}
                  accessibilityLabel="Edit User"
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>

                {user?.id === userItem.id ? (
                  <View style={styles.selfBadge}>
                    <Text style={styles.selfBadgeText}>You</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      confirmDeleteUser(userItem);
                    }}
                    accessibilityLabel="Delete User"
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </Card>
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
  editCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  editButton: {
    flex: 1,
  },
  usersCard: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionButton: {
    padding: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.card.background,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  selfBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  selfBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});