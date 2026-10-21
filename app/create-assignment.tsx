import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import DateTimePicker from '../components/DateTimePicker';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { supabase } from '../lib/supabase';

export default function CreateAssignment() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        let availableSchools: any[] = [];
        if (currentUser.role === 'admin') {
          const { getSchools } = await import('../lib/database');
          const { data } = await getSchools();
          if (data) availableSchools = data;
        } else {
          const { getTeacherSchools } = await import('../lib/database');
          const { data } = await getTeacherSchools(currentUser.id);
          if (data && data.length > 0) {
            availableSchools = data;
          } else if (currentUser.school_id) {
            const { data: directSchool } = await supabase.from('schools').select('*').eq('id', currentUser.school_id).single();
            if (directSchool) availableSchools = [directSchool];
          }
        }
        setSchools(availableSchools);
        if (availableSchools.length > 0) {
          setSelectedSchoolId(availableSchools[0].id);
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Assignment title is required');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setSubmitting(true);
    try {
      // Create assignment in assignments table
      const assignmentData: any = {
        title: title.trim(),
        teacher_id: user.id,
        school_id: selectedSchoolId || user.school_id || null,
        is_published: true, // Ensure assignments are published by default
      };

      // Add optional fields
      if (description.trim()) assignmentData.description = description.trim();
      if (instructions.trim()) assignmentData.instructions = instructions.trim();
      if (dueDate) assignmentData.due_date = dueDate.toISOString();

      console.log('Inserting assignment:', assignmentData);

      const { data, error } = await supabase
        .from('assignments')
        .insert(assignmentData)
        .select()
        .single();

      if (error) {
        console.error('Assignment creation error:', error);
        Alert.alert('Assignment Error', error.message || JSON.stringify(error));
        throw error;
      }

      console.log('Assignment created successfully:', data);
      showSuccess('Assignment created successfully');
      
      // Send push notification to all students
      try {
        const { notifySchoolStudents } = await import('../lib/pushNotifications');
        await notifySchoolStudents(
          selectedSchoolId || user.school_id,
          'New Assignment',
          `New assignment: ${title.trim()}`,
          { type: 'assignment', entityId: data.id }
        );
      } catch (notifError) {
        console.log('Push notification failed:', notifError);
      }
      
      router.back();
    } catch (error) {
      console.error('Submit error:', error);
      handleError(error, 'Failed to create assignment');
    } finally {
      setSubmitting(false);
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
        <Text style={styles.headerTitle}>Create Assignment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* School Selector */}
        <View style={styles.schoolSelectorSection}>
          <Text style={styles.selectorLabel}>Target School</Text>
          {schools.length === 0 ? (
            <Text style={styles.noSchoolsText}>No assigned schools found</Text>
          ) : (
            <View style={styles.schoolChipsContainer}>
              {user?.role === 'admin' && (
                <TouchableOpacity
                  style={[styles.schoolChip, selectedSchoolId === null && styles.schoolChipActive]}
                  onPress={() => setSelectedSchoolId(null)}
                >
                  <Ionicons name="globe-outline" size={16} color={selectedSchoolId === null ? '#FFF' : Colors.primary} />
                  <Text style={[styles.schoolChipText, selectedSchoolId === null && styles.schoolChipTextActive]}>
                    All Schools
                  </Text>
                </TouchableOpacity>
              )}
              {schools.map((school) => {
                const isSelected = selectedSchoolId === school.id;
                return (
                  <TouchableOpacity
                    key={school.id}
                    style={[styles.schoolChip, isSelected && styles.schoolChipActive]}
                    onPress={() => setSelectedSchoolId(school.id)}
                  >
                    <Ionicons name="business" size={16} color={isSelected ? '#FFF' : Colors.primary} />
                    <Text style={[styles.schoolChipText, isSelected && styles.schoolChipTextActive]}>
                      {school.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <Input
          label="Assignment Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter assignment title"
        />

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Enter assignment description"
          multiline
          numberOfLines={3}
        />

        <Input
          label="Instructions"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Enter detailed instructions"
          multiline
          numberOfLines={4}
        />

        <DateTimePicker
          label="Due Date & Time"
          value={dueDate}
          onChange={setDueDate}
          placeholder="Select due date and time"
        />

        <Button
          title="Create Assignment"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
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
  schoolSelectorSection: {
    marginBottom: Spacing.lg,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  noSchoolsText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  schoolChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  schoolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.card.background,
    gap: 6,
  },
  schoolChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  schoolChipTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
});
