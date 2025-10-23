import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import DateTimePicker from '../components/DateTimePicker';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function EditAssignment() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [maxScore, setMaxScore] = useState('100');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (assignmentId) {
        const { data: assignment, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('id', assignmentId)
          .single();

        if (error) throw error;

        setTitle(assignment.title);
        setDescription(assignment.description || '');
        setInstructions(assignment.instructions || '');
        setDueDate(assignment.due_date ? new Date(assignment.due_date) : null);
        setMaxScore(assignment.max_score?.toString() || '100');
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Assignment title is required');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setSaving(true);
    try {
      const assignmentData = {
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        due_date: dueDate?.toISOString() || null,
        max_score: parseInt(maxScore) || 100,
      };

      const { error } = await supabase
        .from('assignments')
        .update(assignmentData)
        .eq('id', assignmentId);

      if (error) throw error;

      showSuccess('Assignment updated successfully');
      router.back();
    } catch (error) {
      console.error('Save error:', error);
      handleError(error, 'Failed to update assignment');
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
        <Text style={styles.headerTitle}>Edit Assignment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
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
          placeholder="Brief description of the assignment"
          multiline
          numberOfLines={3}
        />

        <Input
          label="Instructions"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Detailed instructions for students"
          multiline
          numberOfLines={5}
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Due Date</Text>
          <DateTimePicker
            value={dueDate}
            onChange={setDueDate}
            placeholder="Select due date (optional)"
          />
        </View>

        <Input
          label="Max Score"
          value={maxScore}
          onChangeText={setMaxScore}
          placeholder="100"
          keyboardType="numeric"
        />

        <Button
          title="Update Assignment"
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
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  saveButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxxl,
  },
});