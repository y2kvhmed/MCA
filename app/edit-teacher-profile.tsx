import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, updateUserProfile } from '../lib/auth';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function EditTeacherProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setName(currentUser.name || '');
        setEmail(currentUser.email || '');
        setPhone(currentUser.phone || '');
      }
    } catch (error) {
      console.error('Load user error:', error);
      handleError(error, 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      };

      const { error } = await updateUserProfile(user.id, updates);
      
      if (error) {
        handleError(error, 'Failed to update profile');
      } else {
        showSuccess('Profile updated successfully');
        router.back();
      }
    } catch (error) {
      handleError(error, 'An unexpected error occurred');
    } finally {
      setSaving(false);
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={Colors.text.inverse} />
          </View>
          <Text style={styles.roleText}>Teacher</Text>
        </View>

        <Input
          label="Full Name *"
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
        />

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
        />

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="school" size={20} color={Colors.text.secondary} />
            <Text style={styles.infoText}>
              School: {user?.school?.name || 'Not assigned'}
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="calendar" size={20} color={Colors.text.secondary} />
            <Text style={styles.infoText}>
              Joined: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
            </Text>
          </View>
        </View>

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
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
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  avatarSection: {
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
    marginBottom: Spacing.md,
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
  },
  infoSection: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  saveButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
});