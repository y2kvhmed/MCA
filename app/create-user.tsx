import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createUser, getSchools } from '../lib/database';
import { handleError, showSuccess, isValidEmail } from '../lib/utils';
import { FinalEmailService } from '../lib/finalEmailService';
import { createUserSafely, updateExistingUser } from '../lib/userCreationHelper';
import LoadingSpinner from '../components/LoadingSpinner';
import Input from '../components/Input';
import Button from '../components/Button';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function CreateUser() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | ''>('');
  const [schoolId, setSchoolId] = useState('');
  const [selectedTeacherSchools, setSelectedTeacherSchools] = useState<string[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      const { data, error } = await getSchools();
      if (error) {
        handleError(error);
      } else {
        setSchools(data || []);
      }
    } catch (error) {
      handleError('Failed to load schools');
    } finally {
      setLoadingSchools(false);
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

  const handleSubmit = async () => {
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

    if (!password.trim()) {
      Alert.alert('Error', 'Password is required');
      return;
    }

    setLoading(true);
    try {
      const primarySchool = role === 'student' ? schoolId : (selectedTeacherSchools[0] || undefined);
      console.log('Creating user with role:', role, 'schools:', role === 'teacher' ? selectedTeacherSchools : primarySchool);
      
      const userData: any = {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
        role,
        school_id: primarySchool,
        school_ids: role === 'teacher' ? selectedTeacherSchools : undefined,
        is_active: true,
      };

      console.log('User data to create:', { ...userData, password: '[HIDDEN]' });
      
      const result = await createUserSafely(userData);
      
      console.log('Create user result:', result);
      
      if (!result.success) {
        if (result.isDuplicate) {
          Alert.alert(
            'User Already Exists',
            `A user with email ${userData.email} already exists. Would you like to update their information instead?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Update User', 
                onPress: async () => {
                  if (result.data?.id) {
                    const updateResult = await updateExistingUser(result.data.id, userData);
                    if (updateResult.success) {
                      showSuccess('User updated successfully');
                      router.back();
                    } else {
                      handleError({ message: updateResult.error }, 'Failed to update user');
                    }
                  }
                }
              }
            ]
          );
        } else {
          handleError({ message: result.error }, 'Failed to create user');
        }
      } else {
        console.log('User created successfully:', result.data);
        
        // Send role-specific welcome email (multiple methods)
        try {
          const schoolName = schools.find(s => s.id === schoolId)?.name;
          const emailService = FinalEmailService.getInstance();
          
          console.log('Welcome Email Details:');
          console.log('=========================');
          console.log(`To: ${userData.email}`);
          console.log(`Name: ${userData.name}`);
          console.log(`Role: ${userData.role}`);
          console.log(`Password: ${userData.password}`);
          console.log(`School: ${schoolName || 'Physics Platform'}`);
          console.log('=========================');
          
          const emailSent = await emailService.sendWelcomeEmail({
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role,
            schoolName
          });
          
          if (emailSent) {
            showSuccess('User created and welcome email sent!');
          } else {
            showSuccess('User created successfully!');
          }
        } catch (emailError) {
          console.error('Welcome email error:', emailError);
          showSuccess('User created successfully!');
        }

        // Clear all form fields
        setEmail('');
        setName('');
        setPassword('');
        setPhone('');
        setRole('');
        setSchoolId('');
        router.back();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      handleError(error, 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSchools) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create User</Text>
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
          label="Password *"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          secureTextEntry
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

        {role === 'student' && (
          <>
            <Text style={styles.label}>School *</Text>
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
          </>
        )}

        {role === 'teacher' && (
          <>
            <View style={styles.multiSchoolHeader}>
              <Text style={styles.label}>
                Assigned Schools * ({selectedTeacherSchools.length}/{schools.length})
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
              Teachers can be assigned to multiple schools. Select all that apply.
            </Text>
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
          </>
        )}

        <Button
          title="Create User"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
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
  submitButton: {
    marginTop: Spacing.lg,
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
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  noStudentsText: {
    fontSize: 14,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: Spacing.lg,
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
});
