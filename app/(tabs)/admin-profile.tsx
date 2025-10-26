import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, signOut, updateUserProfile } from '../../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleError } from '../../lib/utils';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';

export default function AdminProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setName(currentUser?.name || '');
      setPhone(currentUser?.phone || '');
    } catch (error) {
      console.error('Load user error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await updateUserProfile(user.id, { name, phone });
      if (error) {
        handleError(error, 'Failed to update profile');
      } else {
        showSuccess('Profile updated successfully');
        setEditMode(false);
        await loadUser();
      }
    } catch (error) {
      handleError(error, 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setEditMode(false);
  };

  const handleLogout = async () => {

    try {
      // Clear all storage and sign out
      await AsyncStorage.clear();
      await signOut();
      
      // Force navigation with multiple approaches
      if (typeof window !== 'undefined') {
        // Web: Force page reload to welcome
        window.location.href = '/welcome';
      } else {
        // Mobile: Clear stack and navigate
        router.dismissAll();
        router.replace('/welcome');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation even if signOut fails
      if (typeof window !== 'undefined') {
        window.location.href = '/welcome';
      } else {
        router.replace('/welcome');
      }
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setEditMode(!editMode)}
            style={styles.headerButton}
          >
            <Ionicons name="pencil" size={24} color={Colors.primary} />
          </TouchableOpacity>
          {/* Logout icon removed - use button at bottom instead */}
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={Colors.text.inverse} />
          </View>
          
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ADMINISTRATOR</Text>
          </View>

          {editMode ? (
            <>
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
              />
              <Input
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone"
                keyboardType="phone-pad"
              />
              <View style={styles.editActions}>
                <Button
                  title="Save"
                  onPress={handleSave}
                  loading={saving}
                  style={styles.saveButton}
                />
                <Button
                  title="Cancel"
                  onPress={handleCancel}
                  variant="outline"
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{user?.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email || 'No email provided'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{user?.phone || 'Not provided'}</Text>
              </View>
            </>
          )}
        </Card>

        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
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
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  headerButton: {
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    marginBottom: Spacing.xl,
  },
  badgeText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  editActions: {
    width: '100%',
    gap: Spacing.md,
  },
  saveButton: {
    marginBottom: Spacing.sm,
  },
  logoutButton: {
    marginBottom: Spacing.xl,
  },
});
