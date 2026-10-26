import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { File as LocalFile } from 'expo-file-system';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { pickAssignmentFile } from '../lib/fileUpload';
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
      if (!currentUser) return;
      setUser(currentUser);

      let assignmentData: any = null;
      const { data, error } = await supabase
        .from('assignments')
        .select(`*, school:schools(id, name), teacher:app_users(id, name)`)
        .eq('id', assignmentId)
        .single();

      if (error) {
        console.warn('Assignment join failed, using fallback:', error.message);
        const { data: fbData, error: fbError } = await supabase
          .from('assignments')
          .select('*')
          .eq('id', assignmentId)
          .single();
        if (fbError) throw fbError;
        assignmentData = fbData;
      } else {
        assignmentData = data;
      }
      setAssignment(assignmentData);

      // Use maybeSingle() instead of single() to avoid 406 error when no submission exists
      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', currentUser.id)
        .maybeSingle();

      if (submissionError) {
        console.log('Submission check error:', submissionError);
        // Don't throw - just means no submission exists
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

  const openExistingSubmission = async () => {
    if (!existingSubmission) return;
    try {
      if (!existingSubmission.file_path && !existingSubmission.file_url) {
        handleError(null, 'No file available');
        return;
      }
      
      let fileUrl = '';
      
      // Try signed URL first
      if (existingSubmission.file_path) {
        const { data, error } = await supabase.storage
          .from('submissions')
          .createSignedUrl(existingSubmission.file_path, 3600);
        if (!error && data?.signedUrl) {
          fileUrl = data.signedUrl;
        }
      }
      
      // Fallback to public URL
      if (!fileUrl && existingSubmission.file_path) {
        const { data } = supabase.storage
          .from('submissions')
          .getPublicUrl(existingSubmission.file_path);
        if (data?.publicUrl) {
          fileUrl = data.publicUrl;
        }
      }
      
      // Fallback to stored URL
      if (!fileUrl && existingSubmission.file_url) {
        fileUrl = existingSubmission.file_url;
      }
      
      if (!fileUrl) {
        handleError(null, 'Could not get file URL');
        return;
      }
      
      if (typeof window !== 'undefined') {
        window.open(fileUrl, '_blank');
      } else {
        await Linking.openURL(fileUrl);
      }
    } catch (error) {
      handleError(error, 'Failed to open file');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !user || !assignment) return;
    setSubmitting(true);
    try {
      let uploadPayload: any;
      if (typeof window !== 'undefined') {
        if (selectedFile instanceof Blob) {
          uploadPayload = selectedFile;
        } else if (selectedFile.file instanceof Blob) {
          uploadPayload = selectedFile.file;
        } else if (selectedFile.uri && (selectedFile.uri.startsWith('blob:') || selectedFile.uri.startsWith('data:'))) {
          const response = await fetch(selectedFile.uri);
          uploadPayload = await response.blob();
        } else {
          throw new Error(`Unsupported web file object (${selectedFile?.name ?? 'unknown'})`);
        }
      } else {
        // React Native's fetch cannot read `file://` URIs, so read the picked file's
        // bytes straight off disk instead — this is why mobile uploads were failing.
        uploadPayload = await new LocalFile(selectedFile.uri).arrayBuffer();
      }
      
      const originalName = selectedFile.name || (selectedFile.file && selectedFile.file.name) || 'submission.pdf';
      const fileExt = originalName.split('.').pop() || 'pdf';
      const mimeType = selectedFile.type || selectedFile.mimeType || (selectedFile.file && selectedFile.file.type) || 'application/pdf';
      const fileSize = selectedFile.size || (uploadPayload && uploadPayload.size) || 0;
      
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `assignment_${assignment.id}/student_${user.id}/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('submissions')
        .upload(filePath, uploadPayload, { contentType: mimeType, upsert: false });

      if (storageError) throw new Error(`Storage upload rejected: ${storageError.message}`);

      const { data: { publicUrl } } = supabase.storage.from('submissions').getPublicUrl(filePath);

      const isLate = assignment.due_date ? new Date() > new Date(assignment.due_date) : false;
      let submissionError = null;

      if (existingSubmission) {
        const { error } = await supabase
          .from('submissions')
          .update({
            content: 'File submission',
            file_path: filePath,
            file_name: originalName,
            file_size: fileSize,
            file_url: publicUrl,
            submitted_at: new Date().toISOString(),
            status: 'submitted',
            is_late: isLate,
            attempt_number: (existingSubmission.attempt_number || 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSubmission.id);
        submissionError = error;
      } else {
        const { error } = await supabase
          .from('submissions')
          .insert({
            assignment_id: assignment.id,
            student_id: user.id,
            content: 'File submission',
            file_path: filePath,
            file_name: originalName,
            file_size: fileSize,
            file_url: publicUrl,
            submitted_at: new Date().toISOString(),
            status: 'submitted',
            is_late: isLate,
            attempt_number: 1,
          });
        submissionError = error;
      }

      if (submissionError) {
        await supabase.storage.from('submissions').remove([filePath]);
        throw new Error(`Could not save submission record: ${submissionError.message}`);
      }

      showSuccess(existingSubmission ? 'Assignment resubmitted successfully!' : 'Assignment submitted successfully!');
      handleBack();
    } catch (error) {
      console.error('Submit error:', error);
      handleError(error, 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/student-dashboard');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!assignment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={handleBack} 
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assignment</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: Colors.text.primary, fontSize: 16 }}>Assignment not found</Text>
          <Button title="Back to Dashboard" onPress={handleBack} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const now = new Date();
  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
  const isOverdue = dueDate && now > dueDate;
  const hasSubmitted = !!existingSubmission;
  const submittedBeforeDue = hasSubmitted && existingSubmission.submitted_at && 
    new Date(existingSubmission.submitted_at) <= (dueDate || new Date());
  const canSubmit = !isOverdue || !hasSubmitted; // Can only submit if not overdue, or if resubmitting before due
  const daysUntilDue = dueDate 
    ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Your work</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.assignmentHeader}>
          <View style={styles.assignmentIcon}>
            <Ionicons name="document-text" size={28} color={Colors.text.inverse} />
          </View>
          <View style={styles.assignmentInfo}>
            <Text style={styles.assignmentTitle}>{assignment.title}</Text>
            <Text style={styles.teacherName}>
              {assignment.teacher?.name || 'Teacher'} • {assignment.school?.name || 'School'}
            </Text>
          </View>
        </View>

        {assignment.due_date && (
          <View style={[styles.dueBanner, isOverdue ? styles.dueBannerOverdue : 
            (daysUntilDue !== null && daysUntilDue <= 1) ? styles.dueBannerUrgent : styles.dueBannerNormal]}>
            <Ionicons name={isOverdue ? "alert-circle" : "time"} size={20} 
              color={isOverdue ? Colors.error : (daysUntilDue !== null && daysUntilDue <= 1) ? Colors.warning : Colors.text.secondary} />
            <Text style={[styles.dueText, isOverdue && styles.dueTextOverdue,
              (daysUntilDue !== null && daysUntilDue <= 1 && !isOverdue) && styles.dueTextUrgent]}>
              {isOverdue ? 'Missing - ' : ''}{formatDueDate(assignment.due_date)}
            </Text>
          </View>
        )}

        {assignment.instructions && (
          <Card style={styles.instructionsCard}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.instructionsText}>{assignment.instructions}</Text>
          </Card>
        )}

        {existingSubmission && (
          <Card style={styles.existingCard}>
            <View style={styles.existingHeader}>
              <View style={styles.existingStatus}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <Text style={styles.existingStatusText}>
                  {submittedBeforeDue ? 'Turned In' : 'Turned In'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.existingFile} onPress={openExistingSubmission}>
              <View style={styles.fileIconBox}>
                <Ionicons name="document" size={24} color={Colors.error} />
              </View>
              <View style={styles.fileDetails}>
                <Text style={styles.existingFileName}>{existingSubmission.file_name}</Text>
                <Text style={styles.existingFileDate}>
                  Submitted {new Date(existingSubmission.submitted_at).toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="open-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            {existingSubmission.feedback && (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackLabel}>Teacher Feedback</Text>
                <Text style={styles.feedbackContent}>{existingSubmission.feedback}</Text>
              </View>
            )}
          </Card>
        )}

        <Card style={styles.uploadCard}>
          <Text style={styles.sectionTitle}>{existingSubmission ? 'Resubmit your work' : 'Add your work'}</Text>
          <Text style={styles.uploadHint}>Only PDF files are accepted (Max 10MB)</Text>
          {!selectedFile ? (
            <TouchableOpacity style={styles.uploadArea} onPress={handlePickFile}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="add" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.uploadText}>Add attachment</Text>
              <Text style={styles.uploadSubtext}>Tap to select a PDF file</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.selectedFileCard}>
              <View style={styles.selectedFileIcon}>
                <Ionicons name="document" size={28} color={Colors.error} />
              </View>
              <View style={styles.selectedFileInfo}>
                <Text style={styles.selectedFileName} numberOfLines={1}>{selectedFile.name}</Text>
                <Text style={styles.selectedFileSize}>{formatFileSize(selectedFile.size)}</Text>
              </View>
              <TouchableOpacity onPress={handleRemoveFile} style={styles.removeButton}>
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {isOverdue && !existingSubmission && (
          <View style={styles.errorBanner}>
            <Ionicons name="close-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>This assignment is overdue. Submissions are no longer accepted.</Text>
          </View>
        )}

        {existingSubmission && isOverdue && (
          <View style={styles.errorBanner}>
            <Ionicons name="close-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>Resubmission is not allowed after the due date.</Text>
          </View>
        )}

        {!isOverdue && (
          <Button
            title={existingSubmission ? 'Resubmit' : 'Turn in'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!selectedFile || submitting}
            style={styles.submitButton}
          />
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    backgroundColor: Colors.card.background, borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  backButton: { padding: Spacing.xs },
  headerContent: { flex: 1, marginLeft: Spacing.md },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary },
  content: { flex: 1 },
  assignmentHeader: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.card.background,
  },
  assignmentIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  assignmentInfo: { flex: 1 },
  assignmentTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary },
  teacherName: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
  dueBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  dueBannerNormal: { backgroundColor: Colors.background },
  dueBannerUrgent: { backgroundColor: Colors.warning + '15' },
  dueBannerOverdue: { backgroundColor: Colors.error + '15' },
  dueText: { fontSize: 14, color: Colors.text.secondary, marginLeft: Spacing.sm },
  dueTextUrgent: { color: Colors.warning, fontWeight: '500' },
  dueTextOverdue: { color: Colors.error, fontWeight: '500' },
  instructionsCard: { margin: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: Spacing.sm },
  instructionsText: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22 },
  existingCard: { margin: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.success },
  existingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  existingStatus: { flexDirection: 'row', alignItems: 'center' },
  existingStatusText: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginLeft: Spacing.sm },

  existingFile: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.background, borderRadius: 8,
  },
  fileIconBox: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.error + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  fileDetails: { flex: 1 },
  existingFileName: { fontSize: 14, fontWeight: '500', color: Colors.text.primary },
  existingFileDate: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  feedbackBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.info + '10', borderRadius: 8 },
  feedbackLabel: { fontSize: 12, fontWeight: '600', color: Colors.info, marginBottom: Spacing.xs },
  feedbackContent: { fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  uploadCard: { margin: Spacing.md },
  uploadHint: { fontSize: 12, color: Colors.text.tertiary, marginBottom: Spacing.md },
  uploadArea: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl,
    borderWidth: 2, borderColor: Colors.border.medium, borderStyle: 'dashed', borderRadius: 12, backgroundColor: Colors.background,
  },
  uploadIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  uploadText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  uploadSubtext: { fontSize: 12, color: Colors.text.tertiary, marginTop: 4 },
  selectedFileCard: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.success,
  },
  selectedFileIcon: {
    width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.error + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  selectedFileInfo: { flex: 1 },
  selectedFileName: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  selectedFileSize: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  removeButton: { padding: Spacing.xs },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', margin: Spacing.md, padding: Spacing.md,
    backgroundColor: Colors.warning + '15', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: Colors.warning,
  },
  warningText: { flex: 1, fontSize: 14, color: Colors.warning, marginLeft: Spacing.sm, fontWeight: '500' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', margin: Spacing.md, padding: Spacing.md,
    backgroundColor: Colors.error + '15', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: Colors.error,
  },
  errorText: { flex: 1, fontSize: 14, color: Colors.error, marginLeft: Spacing.sm, fontWeight: '500' },
  submitButton: { marginHorizontal: Spacing.md, marginTop: Spacing.md },
  bottomSpacer: { height: Spacing.xxxl },
});
