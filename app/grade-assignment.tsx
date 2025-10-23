import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { gradeSubmission } from '../lib/database';
import { formatRelativeDate, formatFileSize, handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function GradeAssignment() {
  const router = useRouter();
  const { submissionId } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      if (currentUser.role !== 'teacher' && currentUser.role !== 'admin') {
        handleError(null, 'Access denied: Teachers only');
        router.back();
        return;
      }

      // Load submission with assignment details
      const { data: submissionData, error } = await supabase
        .from('submissions')
        .select(`
          *,
          student:app_users(id, name, email),
          assignment:assignments(id, title, max_score, teacher_id)
        `)
        .eq('id', submissionId)
        .single();

      if (error) throw error;
      
      setSubmission(submissionData);
      setAssignment(submissionData.assignment);
      
      // Pre-fill existing grade and feedback
      if (submissionData.grade !== null) {
        setGrade(submissionData.grade.toString());
      }
      if (submissionData.feedback) {
        setFeedback(submissionData.feedback);
      }

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!grade.trim()) {
      Alert.alert('Error', 'Grade is required');
      return;
    }

    const gradeValue = parseInt(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > assignment.max_score) {
      Alert.alert('Error', `Grade must be between 0 and ${assignment.max_score}`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await gradeSubmission(
        submissionId as string,
        gradeValue,
        feedback.trim(),
        user.id
      );

      if (error) throw error;

      showSuccess('Grade saved successfully');
      router.back();
    } catch (error) {
      console.error('Save grade error:', error);
      handleError(error, 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  const getGradeColor = (gradeValue: number, maxScore: number) => {
    const percentage = (gradeValue / maxScore) * 100;
    if (percentage >= 90) return Colors.success;
    if (percentage >= 80) return Colors.info;
    if (percentage >= 70) return Colors.warning;
    return Colors.error;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!submission || !assignment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Submission not found</Text>
      </SafeAreaView>
    );
  }

  const currentGrade = parseInt(grade) || 0;
  const percentage = assignment.max_score > 0 ? Math.round((currentGrade / assignment.max_score) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grade Submission</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Assignment Info */}
        <View style={styles.assignmentInfo}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <Text style={styles.studentName}>Student: {submission.student?.name}</Text>
          <Text style={styles.submissionDate}>
            Submitted {formatRelativeDate(submission.submitted_at)}
          </Text>
          {submission.is_late && (
            <Text style={styles.lateText}>⚠️ Late Submission</Text>
          )}
        </View>

        {/* File Info */}
        {submission.file_name && (
          <View style={styles.fileContainer}>
            <View style={styles.fileHeader}>
              <Ionicons name="document" size={24} color={Colors.primary} />
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>{submission.file_name}</Text>
                <Text style={styles.fileSize}>{formatFileSize(submission.file_size)}</Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={() => {
                // TODO: Implement file download
                Alert.alert('Download', 'File download will be implemented');
              }}
            >
              <Ionicons name="download" size={16} color={Colors.primary} />
              <Text style={styles.downloadText}>Download File</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Grading Section */}
        <View style={styles.gradingContainer}>
          <Text style={styles.sectionTitle}>Grade This Submission</Text>
          
          <View style={styles.gradeInputContainer}>
            <Input
              label={`Grade (out of ${assignment.max_score})`}
              value={grade}
              onChangeText={setGrade}
              placeholder="0"
              keyboardType="numeric"
              style={styles.gradeInput}
            />
            
            {grade && !isNaN(parseInt(grade)) && (
              <View style={styles.percentageContainer}>
                <Text style={[
                  styles.percentageText,
                  { color: getGradeColor(parseInt(grade), assignment.max_score) }
                ]}>
                  {percentage}%
                </Text>
              </View>
            )}
          </View>

          <Input
            label="Feedback (Optional)"
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Provide feedback to help the student improve..."
            multiline
            numberOfLines={4}
            style={styles.feedbackInput}
          />

          {/* Grade Scale Reference */}
          <View style={styles.gradeScale}>
            <Text style={styles.gradeScaleTitle}>Grade Scale:</Text>
            <View style={styles.gradeScaleItems}>
              <Text style={[styles.gradeScaleItem, { color: Colors.success }]}>A: 90-100%</Text>
              <Text style={[styles.gradeScaleItem, { color: Colors.info }]}>B: 80-89%</Text>
              <Text style={[styles.gradeScaleItem, { color: Colors.warning }]}>C: 70-79%</Text>
              <Text style={[styles.gradeScaleItem, { color: Colors.error }]}>D/F: Below 70%</Text>
            </View>
          </View>
        </View>

        <Button
          title={submission.grade !== null ? "Update Grade" : "Save Grade"}
          onPress={handleSaveGrade}
          loading={saving}
          disabled={saving || !grade.trim()}
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
  assignmentInfo: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  studentName: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  submissionDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  lateText: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
  },
  fileContainer: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  fileInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
  },
  downloadText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },
  gradingContainer: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  gradeInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  gradeInput: {
    flex: 1,
  },
  percentageContainer: {
    paddingBottom: Spacing.md,
  },
  percentageText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  feedbackInput: {
    marginBottom: Spacing.lg,
  },
  gradeScale: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 8,
  },
  gradeScaleTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  gradeScaleItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gradeScaleItem: {
    fontSize: 12,
    fontWeight: '500',
  },
  saveButton: {
    marginBottom: Spacing.xxxl,
  },
});