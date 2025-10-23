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
  const [parentPhone, setParentPhone] = useState('');
  // Removed unnecessary fields: emergencyContact, address, dateOfBirth
  const [gradeLevel, setGradeLevel] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | ''>('');
  const [schoolId, setSchoolId] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      const { data } = await getSchools();
      if (data) setSchools(data);
    } catch (error) {
      console.error('Load schools error:', error);
    } finally {
      setLoadingSchools(false);
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

    if ((role === 'teacher' || role === 'student') && !schoolId) {
      Alert.alert('Error', 'Please select a school');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Password is required');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating user with role:', role, 'school:', schoolId);
      
      const userData = {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
        parent_phone: parentPhone.trim() || undefined,
        grade_level: gradeLevel.trim() || undefined,
        role,
        school_id: schoolId || undefined,
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
          
          // Always show success message and log email details
          console.log('📧 Welcome Email Details:');
          console.log('=========================');
          console.log(`To: ${userData.email}`);
          console.log(`Name: ${userData.name}`);
          console.log(`Role: ${userData.role}`);
          console.log(`Password: ${userData.password}`);
          console.log(`School: ${schoolName || 'Physics, with Mr. Saddam'}`);
          console.log('=========================');
          
          const emailSent = await emailService.sendWelcomeEmail({
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role,
            schoolName
          });
          
          if (emailSent) {
            showSuccess(`🎉 User created and ${userData.role} welcome email sent automatically!`);
          } else {
            showSuccess(`✅ User created successfully!\n📧 Email details logged to console - you can copy and send manually if needed.`);
          }
        } catch (emailError) {
          console.error('Welcome email error:', emailError);
          showSuccess('✅ User created successfully!\n⚠️ Email service unavailable - check console for login details.');
        }
        
        // Clear all form fields
        setEmail('');
        setName('');
        setPassword('');
        setPhone('');
        setParentPhone('');
        setGradeLevel('');
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

        {/* Show parent phone and grade level only for students */}
        {role === 'student' && (
          <>
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
          </>
        )}

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
});
