import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getTeacherSchools, createTest } from '../lib/database';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import RoleGuard from '../components/RoleGuard';
import DateTimePicker from '../components/DateTimePicker';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function CreateTest() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [testDate, setTestDate] = useState(new Date());
  const [maxScore, setMaxScore] = useState('100');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      setUser(currentUser);

      const { data: teacherSchools } = await getTeacherSchools(currentUser.id);
      setSchools(teacherSchools || []);
      
      if (teacherSchools && teacherSchools.length > 0) {
        setSelectedSchoolId(teacherSchools[0].id);
      } else if (currentUser.school_id) {
        setSelectedSchoolId(currentUser.school_id);
      }
    } catch (error) {
      handleError(error, 'Failed to load teacher schools');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a test title');
      return;
    }

    if (!selectedSchoolId) {
      Alert.alert('Error', 'Please select a school');
      return;
    }

    const maxScoreNum = parseFloat(maxScore);
    if (isNaN(maxScoreNum) || maxScoreNum <= 0) {
      Alert.alert('Error', 'Please enter a valid maximum score');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await createTest({
        title: title.trim(),
        description: description.trim(),
        test_date: testDate.toISOString().split('T')[0],
        max_score: maxScoreNum,
        school_id: selectedSchoolId,
        created_by: user.id,
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Test created successfully! Would you like to enter marks now?',
        [
          {
            text: 'Later',
            onPress: () => router.back(),
            style: 'cancel',
          },
          {
            text: 'Enter Marks',
            onPress: () => router.replace(`/enter-marks?testId=${data.id}`),
          },
        ]
      );
    } catch (error) {
      handleError(error, 'Failed to create test');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <RoleGuard allowedRoles={['teacher', 'admin']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create New Test</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <Card style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Test Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mid-term Physics Exam"
                placeholderTextColor={Colors.text.tertiary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Details about the test..."
                placeholderTextColor={Colors.text.tertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Test Date</Text>
              <DateTimePicker
                value={testDate}
                onChange={setTestDate}
                label="Select Date"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Maximum Score</Text>
              <TextInput
                style={styles.input}
                placeholder="100"
                placeholderTextColor={Colors.text.tertiary}
                value={maxScore}
                onChangeText={setMaxScore}
                keyboardType="numeric"
              />
            </View>

            {schools.length > 1 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Select School</Text>
                <View style={styles.schoolSelector}>
                  {schools.map((school) => (
                    <TouchableOpacity
                      key={school.id}
                      style={[
                        styles.schoolChip,
                        selectedSchoolId === school.id && styles.schoolChipSelected,
                      ]}
                      onPress={() => setSelectedSchoolId(school.id)}
                    >
                      <Text
                        style={[
                          styles.schoolChipText,
                          selectedSchoolId === school.id && styles.schoolChipTextSelected,
                        ]}
                      >
                        {school.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Button
              title={saving ? 'Creating...' : 'Create Test'}
              onPress={handleCreate}
              loading={saving}
              disabled={saving}
              style={styles.submitButton}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </RoleGuard>
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
  formCard: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text.primary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  schoolSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  schoolChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  schoolChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolChipText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  schoolChipTextSelected: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: Spacing.md,
  },
});
