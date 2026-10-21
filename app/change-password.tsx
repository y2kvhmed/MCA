import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setCurrentUser(user);
    } catch (err) {
      console.error('Failed to load user session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      const fallback =
        currentUser?.role === 'admin'
          ? '/(tabs)/admin-dashboard'
          : currentUser?.role === 'teacher'
          ? '/(tabs)/teacher-dashboard'
          : '/(tabs)/student-dashboard';
      router.replace(fallback as any);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      notifyError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      notifyError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      notifyError('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      notifyError('New password cannot be the same as your current password.');
      return;
    }

    setSaving(true);
    try {
      // 1. Verify current password in app_users
      const { data: dbUser, error: checkError } = await supabase
        .from('app_users')
        .select('id, password_hash')
        .eq('id', currentUser.id)
        .single();

      if (checkError || !dbUser) {
        throw new Error('Could not verify your account. Please log in again.');
      }

      if (dbUser.password_hash !== currentPassword) {
        notifyError('Incorrect current password. Please try again.');
        setSaving(false);
        return;
      }

      // 2. Update password_hash in database
      const { error: updateError } = await supabase
        .from('app_users')
        .update({
          password_hash: newPassword.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      // 3. Update local session cache
      const updatedUser = { ...currentUser, password_hash: newPassword.trim() };
      await AsyncStorage.setItem('current_user', JSON.stringify(updatedUser));

      showSuccess('Password updated successfully.');
      handleBack();
    } catch (err: any) {
      handleError(err, 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const notifyError = (message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message);
    } else {
      Alert.alert('Change Password', message);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.formCard}>
          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoBoxText}>
              Keep your account secure by choosing a password of at least 6 characters.
            </Text>
          </View>

          {/* Current Password */}
          <View style={styles.inputWrap}>
            <Input
              label="Current Password *"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              secureTextEntry={!showCurrentPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <View style={styles.inputWrap}>
            <Input
              label="New Password *"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password (min. 6 chars)"
              secureTextEntry={!showNewPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowNewPassword(!showNewPassword)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm New Password */}
          <View style={styles.inputWrap}>
            <Input
              label="Confirm New Password *"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          <Button
            title="Update Password"
            onPress={handleChangePassword}
            loading={saving}
            disabled={saving}
            style={styles.submitBtn}
          />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  formCard: {
    padding: Spacing.lg,
    borderRadius: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    gap: 10,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  inputWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 38,
    padding: 6,
  },
  submitBtn: {
    marginTop: Spacing.lg,
  },
});
