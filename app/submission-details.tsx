import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSubmissionById, updateSubmissionGrade } from '../lib/database';
import { formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function SubmissionDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (params.submissionId) {
      loadSubmission();
    }
  }, [params.submissionId]);

  const loadSubmission = async () => {
    try {
      const submissionId = params.submissionId as string;
      const { data, error } = await getSubmissionById(submissionId);
      
      if (error) throw error;
      if (!data) throw new Error('Submission not found');
      
      setSubmission(data);
      setGrade(data.grade?.toString() || '');
      setFeedback(data.feedback || '');
    } catch (error) {
      console.error('Load submission error:', error);
      handleError(error, 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSubmission = async () => {
    if (!submission) return;
    
    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum) || gradeNum < 0) {
      Alert.alert('Invalid Grade', 'Please enter a valid grade (0 or higher)');
      return;
    }

    if (gradeNum > (submission.assignment?.max_score || 100)) {
      Alert.alert('Invalid Grade', `Grade cannot exceed ${submission.assignment?.max_score || 100} points`);
      return;
    }

    setGrading(true);
    try {
      const { error } = await updateSubmissionGrade(submission.id, gradeNum, feedback);
      if (error) throw error;
      
      showSuccess('Grade saved successfully');
      loadSubmission(); // Reload to get updated data
    } catch (error) {
      handleError(error, 'Failed to save grade');
    } finally {
      setGrading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!submission) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="document"
          title="Submission Not Found"
          description="The requested submission could not be found."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submission Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Assignment Info */}
        <Card style={styles.assignmentCard}>
          <Text style={styles.sectionTitle}>Assignment</Text>
          <Text style={styles.assignmentTitle}>{submission.assignment?.title}</Text>
          <Text style={styles.assignmentDescription}>
            {submission.assignment?.description || 'No description'}
          </Text>
          <View style={styles.assignmentMeta}>
            <Text style={styles.metaText}>
              Max Score: {submission.assignment?.max_score || 100} points
            </Text>
            {submission.assignment?.due_date && (
              <Text style={styles.metaText}>
                Due: {new Date(submission.assignment.due_date).toLocaleDateString()}
              </Text>
            )}
          </View>
        </Card>

        {/* Student Info */}
        <Card style={styles.studentCard}>
          <Text style={styles.sectionTitle}>Student</Text>
          <View style={styles.studentInfo}>
            <View style={styles.studentAvatar}>
              <Ionicons name="person" size={24} color={Colors.text.inverse} />
            </View>
            <View>
              <Text style={styles.studentName}>{submission.student?.name}</Text>
              <Text style={styles.studentEmail}>{submission.student?.email}</Text>
            </View>
          </View>
        </Card>

        {/* Submission Info */}
        <Card style={styles.submissionCard}>
          <Text style={styles.sectionTitle}>Submission</Text>
          
          <View style={styles.submissionMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="time" size={16} color={Colors.text.secondary} />
              <Text style={styles.metaText}>
                Submitted {formatRelativeDate(submission.submitted_at)}
              </Text>
            </View>
            
            {submission.file_url && (
              <View style={styles.metaRow}>
                <Ionicons name="document" size={16} color={Colors.text.secondary} />
                <Text style={styles.metaText}>File attached</Text>
              </View>
            )}
          </View>

          {submission.content && (
            <View style={styles.contentSection}>
              <Text style={styles.contentTitle}>Content:</Text>
              <Text style={styles.contentText}>{submission.content}</Text>
            </View>
          )}

          {submission.file_url && (
            <TouchableOpacity style={styles.fileButton}>
              <Ionicons name="download" size={16} color={Colors.primary} />
              <Text style={styles.fileButtonText}>Download Attachment</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Grading Section */}
        <Card style={styles.gradingCard}>
          <Text style={styles.sectionTitle}>Grading</Text>
          
          <View style={styles.gradeRow}>
            <View style={styles.gradeInput}>
              <Input
                label={`Grade (out of ${submission.assignment?.max_score || 100})`}
                value={grade}
                onChangeText={setGrade}
                keyboardType="numeric"
                placeholder="Enter grade"
              />
            </View>
            
            {submission.grade !== null && (
              <View style={styles.currentGrade}>
                <Text style={styles.currentGradeLabel}>Current:</Text>
                <Text style={styles.currentGradeValue}>
                  {submission.grade}/{submission.assignment?.max_score || 100}
                </Text>
              </View>
            )}
          </View>

          <Input
            label="Feedback"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
            placeholder="Enter feedback for the student..."
            style={styles.feedbackInput}
          />

          <Button
            title={submission.grade !== null ? "Update Grade" : "Grade Submission"}
            onPress={handleGradeSubmission}
            loading={grading}
            style={styles.gradeButton}
          />
        </Card>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  assignmentCard: {
    marginBottom: Spacing.lg,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  assignmentDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  assignmentMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  studentCard: {
    marginBottom: Spacing.lg,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  studentEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  submissionCard: {
    marginBottom: Spacing.lg,
  },
  submissionMeta: {
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  contentSection: {
    marginBottom: Spacing.md,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  contentText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 8,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  fileButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },
  gradingCard: {
    marginBottom: Spacing.xl,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  gradeInput: {
    flex: 1,
  },
  currentGrade: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  currentGradeLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  currentGradeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  feedbackInput: {
    marginBottom: Spacing.lg,
  },
  gradeButton: {
    marginTop: Spacing.md,
  },
});