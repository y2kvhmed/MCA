import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { getSchools, getTeacherSchoolIds, setTeacherSchools } from '../lib/database';
import { handleError, showSuccess, isValidEmail } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function EditUser() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | ''>('');
  const [schoolId, setSchoolId] = useState('');
  const [selectedTeacherSchools, setSelectedTeacherSchools] = useState<string[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const authUser = await getCurrentUser();
      if (authUser) setCurrentUserId(authUser.id);

      // Load user data
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      setEmail(userData.email);
      setName(userData.name);
      setPhone(userData.phone || '');
      setCurrentPassword(userData.password_hash || '');
      const rawRole = (userData.role || 'student').toLowerCase().trim() as 'admin' | 'teacher' | 'student';
      setRole(rawRole);
      setSchoolId(userData.school_id || '');

      // Load schools reliably with direct query and fallback
      let loadedSchools: any[] = [];
      const { data: sData } = await supabase
        .from('schools')
        .select('*')
        .order('name', { ascending: true });
      if (sData && sData.length > 0) {
        loadedSchools = sData;
      } else {
        const { data: dbSchools } = await getSchools();
        if (dbSchools) loadedSchools = dbSchools;
      }
      setSchools(loadedSchools);

      // If teacher, load assigned schools from teacher_schools
      if (rawRole === 'teacher') {
        const teacherSchoolIds = await getTeacherSchoolIds(userId as string);
        if (teacherSchoolIds && teacherSchoolIds.length > 0) {
          setSelectedTeacherSchools(teacherSchoolIds);
        } else if (userData.school_id) {
          setSelectedTeacherSchools([userData.school_id]);
        }
      } else if (userData.school_id) {
        // Pre-fill teacher schools so if role is switched to teacher, their school is ready
        setSelectedTeacherSchools([userData.school_id]);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (newRole: 'admin' | 'teacher' | 'student') => {
    if (role === newRole) return;
    setRole(newRole);

    if (newRole === 'teacher') {
      if (selectedTeacherSchools.length === 0) {
        if (schoolId) {
          setSelectedTeacherSchools([schoolId]);
        } else if (schools.length > 0) {
          setSelectedTeacherSchools([schools[0].id]);
        }
      }
    } else if (newRole === 'student') {
      if (!schoolId) {
        if (selectedTeacherSchools.length > 0) {
          setSchoolId(selectedTeacherSchools[0]);
        } else if (schools.length > 0) {
          setSchoolId(schools[0].id);
        }
      }
    }
  };

  const toggleTeacherSchool = (id: string) => {
    setSelectedTeacherSchools(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleSelectAllSchools = () => {
    if (selectedTeacherSchools.length === schools.length) {
      setSelectedTeacherSchools([]);
    } else {
      setSelectedTeacherSchools(schools.map(s => s.id));
    }
  };

  const handleSave = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Invalid email format');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (!role) {
      Alert.alert('Error', 'Please select a role');
      return;
    }

    if (role === 'student' && !schoolId) {
      Alert.alert('Error', 'Please select a school for the student');
      return;
    }

    if (role === 'teacher' && selectedTeacherSchools.length === 0) {
      Alert.alert('Error', 'Please select at least one school for the teacher');
      return;
    }

    if (currentUserId === userId && role !== 'admin') {
      Alert.alert('Action Denied', 'You cannot change the role of your own administrator account.');
      return;
    }

    setSaving(true);
    try {
      const primarySchool = role === 'student' 
        ? schoolId 
        : (role === 'teacher' ? (selectedTeacherSchools[0] || null) : null);

      const updateData: any = {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone.trim() || null,
        role: role,
        school_id: primarySchool,
        updated_at: new Date().toISOString(),
      };

      if (newPassword.trim()) {
        if (newPassword.trim().length < 6) {
          Alert.alert('Error', 'New password must be at least 6 characters long');
          setSaving(false);
          return;
        }
        updateData.password_hash = newPassword.trim();
      }

      const { error: userError } = await supabase
        .from('app_users')
        .update(updateData)
        .eq('id', userId);

      if (userError) throw userError;

      // Handle teacher_schools table cleanly
      if (role === 'teacher') {
        await setTeacherSchools(userId as string, selectedTeacherSchools);
      } else {
        // If changed to student or admin, clean up any previous teacher_schools links!
        await supabase
          .from('teacher_schools')
          .delete()
          .eq('teacher_id', userId);
      }

      showSuccess('User updated successfully');
      router.back();
    } catch (error) {
      handleError(error, 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = () => {
    if (currentUserId === userId) {
      Alert.alert('Action Denied', 'You cannot delete your own administrator account.');
      return;
    }

    const doDelete = async () => {
      try {
        setSaving(true);
        const { deleteUser } = await import('../lib/database');
        const { error } = await deleteUser(userId as string);
        if (error) throw error;
        showSuccess('User account deleted successfully');
        router.back();
      } catch (err: any) {
        handleError(err, 'Failed to delete user');
      } finally {
        setSaving(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to permanently delete "${name || email}"? This action cannot be undone.`)) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete "${name || email}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]
    );
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
        <Text style={styles.headerTitle}>Edit User</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Input
          label="Email *"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter email"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Input
          label="Full Name *"
          value={name}
          onChangeText={setName}
          placeholder="Enter full name"
        />

        <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Role *</Text>
        <View style={styles.roleSelector}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'admin' && styles.roleButtonSelected,
            ]}
            onPress={() => handleRoleChange('admin')}
          >
            <Text
              style={[
                styles.roleButtonText,
                role === 'admin' && styles.roleButtonTextSelected,
              ]}
            >
              ADMIN
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'teacher' && styles.roleButtonSelected,
            ]}
            onPress={() => handleRoleChange('teacher')}
          >
            <Text
              style={[
                styles.roleButtonText,
                role === 'teacher' && styles.roleButtonTextSelected,
              ]}
            >
              TEACHER
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'student' && styles.roleButtonSelected,
            ]}
            onPress={() => handleRoleChange('student')}
          >
            <Text
              style={[
                styles.roleButtonText,
                role === 'student' && styles.roleButtonTextSelected,
              ]}
            >
              STUDENT
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic School Section based on Selected Role */}
        {role === 'student' && (
          <View style={styles.schoolSectionContainer}>
            <Text style={styles.label}>Assigned School *</Text>
            <Text style={styles.subLabel}>
              Select the school this student is enrolled in (1 required):
            </Text>
            {schools.length === 0 ? (
              <View style={styles.noSchoolsNotice}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.text.secondary} />
                <Text style={styles.noSchoolsNoticeText}>No schools registered in the system yet. Please add a school first.</Text>
              </View>
            ) : (
              <View style={styles.schoolSelector}>
                {schools.map((school) => {
                  const isSelected = schoolId === school.id;
                  return (
                    <TouchableOpacity
                      key={school.id}
                      style={[
                        styles.schoolButton,
                        isSelected && styles.schoolButtonSelected,
                      ]}
                      onPress={() => setSchoolId(school.id)}
                    >
                      <View style={styles.schoolRow}>
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={isSelected ? Colors.text.inverse : Colors.text.secondary}
                          style={{ marginRight: 10 }}
                        />
                        <Text
                          style={[
                            styles.schoolButtonText,
                            isSelected && styles.schoolButtonTextSelected,
                          ]}
                        >
                          {school.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {role === 'teacher' && (
          <View style={styles.schoolSectionContainer}>
            <View style={styles.multiSchoolHeader}>
              <Text style={styles.label}>
                Assigned Schools * ({selectedTeacherSchools.length}/{schools.length} selected)
              </Text>
              {schools.length > 0 && (
                <TouchableOpacity onPress={toggleSelectAllSchools} style={styles.selectAllBtn}>
                  <Text style={styles.selectAllBtnText}>
                    {selectedTeacherSchools.length === schools.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.subLabel}>
              Teachers can be assigned to multiple schools. Select all that apply (at least 1 required):
            </Text>
            {schools.length === 0 ? (
              <View style={styles.noSchoolsNotice}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.text.secondary} />
                <Text style={styles.noSchoolsNoticeText}>No schools registered in the system yet. Please add a school first.</Text>
              </View>
            ) : (
              <View style={styles.schoolSelector}>
                {schools.map((school) => {
                  const isSelected = selectedTeacherSchools.includes(school.id);
                  return (
                    <TouchableOpacity
                      key={school.id}
                      style={[
                        styles.schoolButton,
                        isSelected && styles.schoolButtonSelected,
                      ]}
                      onPress={() => toggleTeacherSchool(school.id)}
                    >
                      <View style={styles.schoolRow}>
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={18}
                          color={isSelected ? Colors.text.inverse : Colors.text.secondary}
                          style={{ marginRight: 10 }}
                        />
                        <Text
                          style={[
                            styles.schoolButtonText,
                            isSelected && styles.schoolButtonTextSelected,
                          ]}
                        >
                          {school.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {role === 'admin' && (
          <View style={styles.adminNoticeBox}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={styles.adminNoticeText}>
              Administrator role selected. Administrators have full system-wide access across all schools.
            </Text>
          </View>
        )}

        <View style={styles.passwordSection}>
          <Text style={styles.passwordSectionHeading}>Password Management</Text>
          <View style={styles.currentPasswordRow}>
            <Text style={styles.currentPasswordLabel}>Current Password:</Text>
            <Text style={styles.currentPasswordValue}>
              {showPassword ? (currentPassword || 'None') : '••••••••'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.eyeToggleBtn}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.primary}
              />
            </TouchableOpacity>
          </View>

          <Input
            label="Reset Password (Leave blank to keep unchanged)"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password (min. 6 chars)"
            secureTextEntry
          />
        </View>

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />

        {currentUserId !== userId ? (
          <TouchableOpacity
            onPress={handleDeleteUser}
            disabled={saving}
            style={styles.deleteUserBtn}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={styles.deleteUserBtnText}>Delete User Account</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.selfNoticeBox}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
            <Text style={styles.selfNoticeText}>
              You are currently logged into this administrator account. Self-deletion is disabled.
            </Text>
          </View>
        )}
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  roleSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  roleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    marginHorizontal: Spacing.xs,
    alignItems: 'center',
  },
  roleButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  roleButtonTextSelected: {
    color: Colors.text.inverse,
  },
  schoolSectionContainer: {
    marginBottom: Spacing.md,
  },
  noSchoolsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  noSchoolsNoticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  adminNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  adminNoticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  schoolSelector: {
    marginBottom: Spacing.xl,
  },
  schoolButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    marginBottom: Spacing.sm,
  },
  schoolButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  schoolButtonTextSelected: {
    color: Colors.text.inverse,
  },
  saveButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiSchoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  passwordSection: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  passwordSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  currentPasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  currentPasswordLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginRight: 8,
  },
  currentPasswordValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  eyeToggleBtn: {
    padding: 4,
  },
  deleteUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: 'transparent',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl * 2,
    gap: 8,
  },
  deleteUserBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  selfNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl * 2,
    gap: 10,
  },
  selfNoticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
    lineHeight: 18,
  },
});