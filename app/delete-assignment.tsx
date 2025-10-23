import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { handleError, showSuccess } from '../lib/utils';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function DeleteAssignment() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      // Load assignment details
      const { data: assignmentData, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (error) throw error;
      setAssignment(assignmentData);

      // Load submissions count
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('id, student:app_users(name)')
        .eq('assignment_id', assignmentId);

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Assignment',
      `Are you sure you want to delete "${assignment?.title}"? This action cannot be undone and will also delete all ${submissions.length} submissions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: confirmDelete
        }
      ]
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      // Delete the assignment (submissions will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      showSuccess('Assignment deleted successfully');
      router.replace('/assignment-overview');
    } catch (error) {
      console.error('Delete error:', error);
      handleError(error, 'Failed to delete assignment');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Assignment not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Assignment</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={48} color={Colors.error} />
          <Text style={styles.warningTitle}>Delete Assignment</Text>
          <Text style={styles.warningText}>
            You are about to delete the assignment "{assignment.title}".
          </Text>
        </View>

        <View style={styles.impactContainer}>
          <Text style={styles.impactTitle}>This will also delete:</Text>
          <View style={styles.impactItem}>
            <Ionicons name="document" size={20} color={Colors.text.secondary} />
            <Text style={styles.impactText}>
              {submissions.length} student submissions
            </Text>
          </View>
          {submissions.length > 0 && (
            <View style={styles.submissionsList}>
              {submissions.slice(0, 5).map((submission, index) => (
                <Text key={index} style={styles.submissionItem}>
                  • {submission.student?.name || 'Unknown Student'}
                </Text>
              ))}
              {submissions.length > 5 && (
                <Text style={styles.submissionItem}>
                  • And {submissions.length - 5} more...
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="outline"
            style={styles.cancelButton}
          />
          <Button
            title="Delete Assignment"
            onPress={handleDelete}
            loading={deleting}
            disabled={deleting}
            style={[styles.deleteButton, { backgroundColor: Colors.error }]}
          />
        </View>
      </View>
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
    justifyContent: 'center',
  },
  warningContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.error,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  warningText: {
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
  },
  impactContainer: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.xl,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  impactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  impactText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  submissionsList: {
    marginTop: Spacing.sm,
    marginLeft: Spacing.xl,
  },
  submissionItem: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
});