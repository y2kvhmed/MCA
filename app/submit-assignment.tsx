import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { pickAssignmentFile, submitAssignment, getSubmissionWithFile } from '../lib/fileUpload';
import { formatFileSize, formatDueDate, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function SubmitAssignment() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load assignment details
      const { data: assignmentData, error } = await supabase
        .from('assignments')
        .select(`
          *,
          school:schools(id, name),
          teacher:app_users!assignments_teacher_id_fkey(id, name)
        `)
        .eq('id', assignmentId)
        .single();

      if (error) throw error;
      setAssignment(assignmentData);

      // Check for existing submission
      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', currentUser.id)
        .single();

      if (submissionError && submissionError.code !== 'PGRST116') {
        throw submissionError;
      }

      if (submissionData) {
        setExistingSubmission(submissionData);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await pickAssignmentFile();
      
      if (result.success && result.file) {
        setSelectedFile(result.file);
      } else if (result.error) {
        handleError(null, result.error);
      }
    } catch (error) {
      handleError(error, 'Failed to pick file');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !user || !assignment) return;

    setSubmitting(true);
    try {
      const result = await submitAssignment(
        assignment.id,
        user.id,
        selectedFile,
        {
          comments: existingSubmission ? 'Resubmission' : 'Initial submission',
          attemptNumber: existingSubmission ? existingSubmission.attempt_number + 1 : 1
        }
      );

      if (result.success) {
        showSuccess(existingSubmission ? 'Assignment resubmitted successfully!' : 'Assignment submitted successfully!');
        router.back();
      } else {
        handleError(null, result.error || 'Failed to submit assignment');
      }
    } catch (error) {
      handleError(error, 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
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

  const isOverdue = new Date() > new Date(assignment.due_date);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existingSubmission ? 'Resubmit Assignment' : 'Submit Assignment'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.assignmentCard}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <Text style={styles.className}>{assignment.class.name}</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={Colors.text.secondary} />
            <Text style={[styles.dueDate, isOverdue && styles.overdue]}>
              {assignment.due_date ? formatDueDate(assignment.due_date) : 'No due date'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="trophy" size={16} color={Colors.text.secondary} />
            <Text style={styles.maxScore}>Max Score: {assignment.max_score}</Text>
          </View>

          {assignment.instructions && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <Text style={styles.instructions}>{assignment.instructions}</Text>
            </View>
          )}
        </Card>

        {/* Existing Submission Info */}
        {existingSubmission && (
          <Card style={[styles.existingSubmissionCard, { backgroundColor: Colors.info + '10' }]}>
            <View style={styles.existingSubmissionHeader}>
              <Ionicons name="information-circle" size={24} color={Colors.info} />
              <Text style={styles.existingSubmissionTitle}>Previous Submission</Text>
            </View>
            <Text style={styles.existingSubmissionText}>
              You submitted "{existingSubmission.file_name}" on{' '}
              {new Date(existingSubmission.submitted_at).toLocaleDateString()}
            </Text>
            {existingSubmission.status === 'graded' && (
              <Text style={styles.gradedWarning}>
                ⚠️ This assignment has already been graded. Resubmitting will replace your graded submission.
              </Text>
            )}
          </Card>
        )}

        <Card style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Upload Your Submission</Text>
          <Text style={styles.uploadSubtitle}>Only PDF files are accepted (Max 10MB)</Text>

          {!selectedFile ? (
            <TouchableOpacity style={styles.uploadButton} onPress={handlePickFile}>
              <Ionicons name="cloud-upload" size={32} color={Colors.primary} />
              <Text style={styles.uploadButtonText}>Choose PDF File</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.fileContainer}>
              <View style={styles.fileInfo}>
                <Ionicons name="document" size={24} color={Colors.primary} />
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName}>{selectedFile.name}</Text>
                  <Text style={styles.fileSize}>{formatFileSize(selectedFile.size)}</Text>
                </View>
                <TouchableOpacity onPress={handleRemoveFile}>
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {isOverdue && (
          <Card style={[styles.warningCard, { backgroundColor: Colors.warning + '20' }]}>
            <View style={styles.warningContent}>
              <Ionicons name="warning" size={24} color={Colors.warning} />
              <Text style={styles.warningText}>
                This assignment is overdue. Late submissions may receive reduced points.
              </Text>
            </View>
          </Card>
        )}

        <Button
          title={
            existingSubmission 
              ? (isOverdue ? 'Resubmit Late' : 'Resubmit Assignment')
              : (isOverdue ? 'Submit Late' : 'Submit Assignment')
          }
          onPress={handleSubmit}
          loading={submitting}
          disabled={!selectedFile || submitting}
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
  assignmentCard: {
    marginBottom: Spacing.lg,
  },
  assignmentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  className: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dueDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  overdue: {
    color: Colors.error,
    fontWeight: '600',
  },
  maxScore: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  instructionsContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  instructions: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  existingSubmissionCard: {
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  existingSubmissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  existingSubmissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.info,
    marginLeft: Spacing.sm,
  },
  existingSubmissionText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  gradedWarning: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500',
  },
  uploadCard: {
    marginBottom: Spacing.lg,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  fileContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  warningCard: {
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: Colors.warning,
    marginLeft: Spacing.md,
    fontWeight: '500',
  },
  submitButton: {
    marginBottom: Spacing.xl,
  },
});