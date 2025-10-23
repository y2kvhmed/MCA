import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUsers, deleteUser, deactivateUser, activateUser } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import { Alert } from 'react-native';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ViewUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [filter, users]);

  const loadUsers = async () => {
    try {
      const { data } = await getUsers();
      if (data) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Load users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (filter === 'all') {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(users.filter(u => u.role === filter));
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const { error } = await deleteUser(userId);
      if (error) {
        handleError(error, 'Failed to delete user');
      } else {
        showSuccess(`User "${userName}" deleted successfully`);
        loadUsers(); // Reload users
      }
    } catch (error) {
      handleError(error, 'Failed to delete user');
    }
  };

  const handleToggleUserStatus = async (userId: string, userName: string, isActive: boolean) => {
    const action = isActive ? 'deactivate' : 'activate';
    try {
      const { error } = isActive 
        ? await deactivateUser(userId)
        : await activateUser(userId);
      
      if (error) {
        handleError(error, `Failed to ${action} user`);
      } else {
        showSuccess(`User "${userName}" ${action}d successfully`);
        loadUsers(); // Reload users
      }
    } catch (error) {
      handleError(error, `Failed to ${action} user`);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return Colors.role.admin;
      case 'teacher': return Colors.role.teacher;
      case 'student': return Colors.role.student;
      default: return Colors.text.secondary;
    }
  };

  const renderUser = ({ item }: { item: any }) => (
    <Card style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={Colors.text.inverse} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) }]}>
          <Text style={styles.roleBadgeText}>{item.role.toUpperCase()}</Text>
        </View>
      </View>
      
      {/* User Details */}
      {item.school && (
        <Text style={styles.userDetail}>🏫 {item.school.name}</Text>
      )}
      {item.phone && (
        <Text style={styles.userDetail}>📞 {item.phone}</Text>
      )}
      {item.parent_phone && (
        <Text style={styles.userDetail}>👨‍👩‍👧‍👦 {item.parent_phone}</Text>
      )}
      {item.grade_level && (
        <Text style={styles.userDetail}>🎓 {item.grade_level}</Text>
      )}
      
      <View style={styles.userFooter}>
        <View style={styles.userStatus}>
          <Text style={[styles.statusText, { color: item.is_active ? Colors.success : Colors.error }]}>
            {item.is_active ? '✓ Active' : '✗ Inactive'}
          </Text>
          <Text style={styles.userDate}>
            Joined {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.info + '20' }]}
            onPress={() => router.push(`/edit-user?userId=${item.id}`)}
          >
            <Ionicons name="create" size={16} color={Colors.info} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: item.is_active ? Colors.warning + '20' : Colors.success + '20' }]}
            onPress={() => handleToggleUserStatus(item.id, item.name, item.is_active)}
          >
            <Ionicons 
              name={item.is_active ? "pause" : "play"} 
              size={16} 
              color={item.is_active ? Colors.warning : Colors.success} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.error + '20' }]}
            onPress={() => handleDeleteUser(item.id, item.name)}
          >
            <Ionicons name="trash" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Users</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'admin', 'teacher', 'student'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterButton,
                filter === f && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(f as any)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === f && styles.filterButtonTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && ` (${users.filter(u => u.role === f).length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredUsers.length === 0 ? (
        <EmptyState icon="people-outline" message="No users found" />
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  filterButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  filterButtonTextActive: {
    color: Colors.text.inverse,
  },
  listContent: {
    padding: Spacing.lg,
  },
  userCard: {
    marginBottom: Spacing.md,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  userDetail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  userStatus: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
