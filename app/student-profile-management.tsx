import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess, validateEmail, validatePhone } from '../lib/utils';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function StudentProfileManagement() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    parent_phone: '',
    emergency_contact: '',
    address: '',
    date_of_birth: '',
    grade_level: '',
  });
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalAssignments: 0,
    averageGrade: 0,

  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load user profile data
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (userError) throw userError;

      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        parent_phone: userData.parent_phone || '',
        emergency_contact: userData.emergency_contact || '',
        address: userData.address || '',
        date_of_birth: userData.date_of_birth || '',
        grade_level: userData.grade_level || '',
      });

      // Load student statistics
      const [enrollmentsResult, submissionsResult] = await Promise.all([
        // Get enrolled classes
        supabase
          .from('enrollments')
          .select('class:classes(id, name)')
          .eq('student_id', currentUser.id)
          .eq('enrollment_status', 'active'),
        
        // Get submissions with grades
        supabase
          .from('submissions')
          .select('id, grade, percentage, status')
          .eq('student_id', currentUser.id)
          .eq('status', 'graded'),
        

      ]);

      const enrollments = enrollmentsResult.data || [];
      const submissions = submissionsResult.data || [];


      // Calculate statistics
      const totalClasses = enrollments.length;
      const totalAssignments = submissions.length;
      const averageGrade = submissions.length > 0 
        ? submissions.reduce((sum, s) => sum + s.percentage, 0) / submissions.length 
        : 0;


      setStats({
        totalClasses,
        totalAssignments,
        averageGrade,

      });

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return false;
    }

    if (!formData.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return false;
    }

    if (!validateEmail(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return false;
    }

    if (formData.parent_phone && !validatePhone(formData.parent_phone)) {
      Alert.alert('Error', 'Please enter a valid parent phone number');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_users')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || null,
          parent_phone: formData.parent_phone.trim() || null,
          emergency_contact: formData.emergency_contact.trim() || null,
          address: formData.address.trim() || null,
          date_of_birth: formData.date_of_birth || null,
          grade_level: formData.grade_level.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      showSuccess('Profile updated successfully!');
    } catch (error) {
      handleError(error, 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return Colors.success;
    if (percentage >= 80) return Colors.info;
    if (percentage >= 70) return Colors.warning;
    return Colors.error;
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
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Stats */}
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Academic Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="school" size={24} color={Colors.primary} />
              <Text style={styles.statValue}>{stats.totalClasses}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="document-text" size={24} color={Colors.info} />
              <Text style={styles.statValue}>{stats.totalAssignments}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trophy" size={24} color={getGradeColor(stats.averageGrade)} />
              <Text style={[styles.statValue, { color: getGradeColor(stats.averageGrade) }]}>
                {stats.averageGrade.toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Avg Grade</Text>
            </View>

          </View>
        </Card>

        {/* Personal Information */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Personal Information</Text>
          
          <Input
            label="Full Name *"
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholder="Enter your full name"
          />

          <Input
            label="Email Address *"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Phone Number"
            value={formData.phone}
            onChangeText={(value) => handleInputChange('phone', value)}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />

          <Input
            label="Date of Birth"
            value={formData.date_of_birth}
            onChangeText={(value) => handleInputChange('date_of_birth', value)}
            placeholder="YYYY-MM-DD"
          />

          <Input
            label="Grade Level"
            value={formData.grade_level}
            onChangeText={(value) => handleInputChange('grade_level', value)}
            placeholder="e.g., 9th Grade, Sophomore"
          />

          <Input
            label="Address"
            value={formData.address}
            onChangeText={(value) => handleInputChange('address', value)}
            placeholder="Enter your address"
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Emergency Contact Information */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Emergency Contact</Text>
          
          <Input
            label="Parent/Guardian Phone"
            value={formData.parent_phone}
            onChangeText={(value) => handleInputChange('parent_phone', value)}
            placeholder="Enter parent/guardian phone"
            keyboardType="phone-pad"
          />

          <Input
            label="Emergency Contact"
            value={formData.emergency_contact}
            onChangeText={(value) => handleInputChange('emergency_contact', value)}
            placeholder="Name and phone of emergency contact"
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/student-grades')}
          >
            <Ionicons name="trophy" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>View My Grades</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/student-dashboard')}
          >
            <Ionicons name="home" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>Go to Dashboard</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </Card>

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
  statsCard: {
    marginBottom: Spacing.lg,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  formCard: {
    marginBottom: Spacing.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  actionsCard: {
    marginBottom: Spacing.lg,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  saveButton: {
    marginBottom: Spacing.xl,
  },
});