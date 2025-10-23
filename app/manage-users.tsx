import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getUsersBySchool, updateUserPassword } from '../lib/database';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
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
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    loadData();
  }, []);

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
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userToEdit: any) => {
    setEditingUser(userToEdit);
    setNewEmail(userToEdit.email);
    setNewPassword('');
  };

  const handleSaveChanges = async () => {
    if (!editingUser) return;

    try {
      const updates: any = {};
      
      if (newEmail !== editingUser.email) {
        updates.email = newEmail;
      }
      
      if (newPassword.trim()) {
        updates.password = newPassword;
      }

      if (Object.keys(updates).length === 0) {
        showError('No changes to save');
        return;
      }

      const { error } = await updateUserPassword(editingUser.id, updates);
      
      if (error) {
        throw error;
      }

      showSuccess('User updated successfully');
      setEditingUser(null);
      setNewPassword('');
      setNewEmail('');
      loadData();
    } catch (error) {
      console.error('Update error:', error);
      handleError(error, 'Failed to update user');
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
    setNewPassword('');
    setNewEmail('');
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
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {editingUser && (
          <Card style={styles.editCard}>
            <Text style={styles.editTitle}>Edit User: {editingUser.name}</Text>
            
            <Input
              label="Email"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Input
              label="New Password (leave empty to keep current)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Enter new password"
            />
            
            <View style={styles.editActions}>
              <Button
                title="Cancel"
                onPress={handleCancel}
                variant="outline"
                style={styles.editButton}
              />
              <Button
                title="Save Changes"
                onPress={handleSaveChanges}
                style={styles.editButton}
              />
            </View>
          </Card>
        )}

        <Card style={styles.usersCard}>
          <Text style={styles.sectionTitle}>Users ({users.length})</Text>
          
          {users.map((userItem) => (
            <View key={userItem.id} style={styles.userItem}>
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
                  {userItem.role} • {userItem.school?.name || 'No School'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.editUserButton}
                onPress={() => handleEditUser(userItem)}
              >
                <Ionicons name="create" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
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
  editUserButton: {
    padding: Spacing.sm,
  },
});