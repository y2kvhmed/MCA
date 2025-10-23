import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getSchools } from '../lib/database';
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
  const [parentPhone, setParentPhone] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | ''>('');
  const [schoolId, setSchoolId] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
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
      setParentPhone(userData.parent_phone || '');
      setGradeLevel(userData.grade_level || '');
      setRole(userData.role);
      setSchoolId(userData.school_id || '');

      // Load schools
      const { data: schoolsData } = await getSchools();
      if (schoolsData) setSchools(schoolsData);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load user data');
    } finally {
      setLoading(false);
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

    if ((role === 'teacher' || role === 'student') && !schoolId) {
      Alert.alert('Error', 'Please select a school');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_users')
        .update({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          phone: phone.trim() || null,
          parent_phone: parentPhone.trim() || null,
          grade_level: gradeLevel.trim() || null,
          role,
          school_id: schoolId || null,
        })
        .eq('id', userId);

      if (error) throw error;

      showSuccess('User updated successfully');
      router.back();
    } catch (error) {
      handleError(error, 'Failed to update user');
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

        <Input
          label="Parent/Guardian Phone"
          value={parentPhone}
          onChangeText={setParentPhone}
          placeholder="Enter parent/guardian phone"
          keyboardType="phone-pad"
        />

        <Input
          label="Grade Level"
          value={gradeLevel}
          onChangeText={setGradeLevel}
          placeholder="e.g., 9th Grade, Sophomore"
        />

        <Text style={styles.label}>Role *</Text>
        <View style={styles.roleSelector}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'admin' && styles.roleButtonSelected,
            ]}
            onPress={() => setRole('admin')}
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
            onPress={() => setRole('teacher')}
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
            onPress={() => setRole('student')}
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

        {(role === 'teacher' || role === 'student') && (
          <>
            <Text style={styles.label}>School *</Text>
            <View style={styles.schoolSelector}>
              {schools.map((school) => (
                <TouchableOpacity
                  key={school.id}
                  style={[
                    styles.schoolButton,
                    schoolId === school.id && styles.schoolButtonSelected,
                  ]}
                  onPress={() => setSchoolId(school.id)}
                >
                  <Text
                    style={[
                      styles.schoolButtonText,
                      schoolId === school.id && styles.schoolButtonTextSelected,
                    ]}
                  >
                    {school.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

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
});