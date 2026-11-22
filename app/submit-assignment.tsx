import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { File as LocalFile } from 'expo-file-system';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { pickAssignmentFiles, pickAssignmentImages, captureAssignmentPhoto, uploadFileToSupabase, isImageFile, compressImageFile, FILE_CONFIG } from '../lib/fileUpload';
import { formatFileSize, formatDueDate, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import MediaViewer from '../components/MediaViewer';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function SubmitAssignment() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [preparing, setPreparing] = useState(false);
  const [viewerFiles, setViewerFiles] = useState<any[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const showSubmissionError = (title: string, error: any) => {
    const message = error?.message || error?.error || String(error || 'Please try again.');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

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
      handleError(error, 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  // Shrink photos (web only) and attach a preview URI before adding them to the list.
  const prepareAndAdd = async (files: any[]) => {
    setPreparing(true);
    try {
      const enriched = await Promise.all(
        files.map(async (file: any) => {
          const source = file?.uploadSource || file;
          const prepared = await compressImageFile(source);
          const name = prepared?.name || file?.name || file?.fileName || 'submission';
          const type = prepared?.type || file?.type || file?.mimeType || '';
          const rawSize = prepared?.size ?? file?.size ?? file?.fileSize;
          const size = Number.isFinite(Number(rawSize)) ? Number(rawSize) : undefined;
          let previewUri = prepared?.uri || file?.uri;
          if (!previewUri && typeof window !== 'undefined' && prepared instanceof Blob) {
            try { previewUri = URL.createObjectURL(prepared); } catch {}
          }
          return {
            uploadSource: prepared,
            name,
            type,
            mimeType: type,
            size,
            uri: prepared?.uri || file?.uri,
            previewUri,
          };
        })
      );
      setSelectedFiles((prev) => [...prev, ...enriched]);
    } catch (error) {
      showSubmissionError('Could not prepare selected files', error);
    } finally {
      setPreparing(false);
    }
  };

  const handlePickFiles = async () => {
    try {
      const result = await pickAssignmentFiles();
      if (result.success && result.files) {
        await prepareAndAdd(result.files);
      } else if (result.error && !/cancel/i.test(result.error) && !/No file was selected/i.test(result.error)) {
        showSubmissionError('Could not select files', result.error);
      }
    } catch (error: any) {
      showSubmissionError('Could not select files', error);
    }
  };

  const handlePickImages = async () => {
    try {
      const result = await pickAssignmentImages();
      if (result.success && result.files) {
        await prepareAndAdd(result.files);
      } else if (result.error && !/cancel/i.test(result.error)) {
        showSubmissionError('Could not select photos', result.error);
      }
    } catch (error) {
      showSubmissionError('Could not select photos', error);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await captureAssignmentPhoto();
      if (result.success && result.file) {
        await prepareAndAdd([result.file]);
      } else if (result.error && !/cancel/i.test(result.error)) {
        showSubmissionError('Could not capture photo', result.error);
      }
    } catch (error: any) {
      showSubmissionError('Could not capture photo', error);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Open a set of files in the in-app viewer (images swipe, PDFs render inline).
  const openInViewer = (list: any[], index: number) => {
    if (!list.length) return;
    setViewerFiles(
      list.map((f) => ({ path: f.path, url: f.url || f.previewUri, name: f.name, type: f.type || f.mimeType }))
    );
    setViewerIndex(index);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || !user || !assignment) {
      return;
    }
    setSubmitting(true);
    const uploaded: any[] = [];
    try {
      const isLate = assignment.due_date ? new Date() > new Date(assignment.due_date) : false;

      // Upload every attached file to storage.
      for (const file of selectedFiles) {
        const originalName = file.name || file.fileName || file.uploadSource?.name || 'submission';
        const fileExt = originalName.split('.').pop() || 'bin';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        // Sorted by school / assignment / student so the bucket stays browsable.
        const schoolKey = assignment.school_id || 'unassigned';
        const filePath = `schools/${schoolKey}/assignments/${assignment.id}/students/${user.id}/${fileName}`;

        const uploadResult = await uploadFileToSupabase(
          file,
          FILE_CONFIG.buckets.assignments,
          filePath
        );

        if (!uploadResult.success) {
          throw new Error(`Storage upload rejected for "${originalName}": ${uploadResult.error}`);
        }

        uploaded.push({
          path: filePath,
          url: uploadResult.data!.publicUrl,
          name: originalName,
          size: uploadResult.data!.size ?? file.size ?? 0,
          type: file.type || file.mimeType || uploadResult.data!.type || '',
        });
      }

      // Keep legacy single-file columns in sync with the first file.
      const primary = uploaded[0];
      const baseRecord = {
        content: 'File submission',
        files: uploaded,
        file_path: primary.path,
        file_name: primary.name,
        file_size: primary.size,
        file_url: primary.url,
        file_type: primary.type,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
        is_late: isLate,
      };

      let submissionError = null;
      if (existingSubmission) {
        const { error } = await supabase
          .from('submissions')
          .update({
            ...baseRecord,
            attempt_number: (existingSubmission.attempt_number || 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSubmission.id);
        submissionError = error;
      } else {
        const { error } = await supabase
          .from('submissions')
          .insert({
            ...baseRecord,
            assignment_id: assignment.id,
            student_id: user.id,
            attempt_number: 1,
          });
        submissionError = error;
      }

      if (submissionError) {
        // Roll back the uploaded files if the record could not be saved.
        await supabase.storage
          .from(FILE_CONFIG.buckets.assignments)
          .remove(uploaded.map((u) => u.path));
        uploaded.length = 0;
        if (/column .*files.* does not exist/i.test(submissionError.message)) {
          throw new Error(
            'The database is missing support for multiple submission files. Apply SUBMISSION-MULTIPLE-FILES.sql in Supabase SQL Editor, then try again.'
          );
        }
        throw new Error(`Could not save submission record: ${submissionError.message}`);
      }

      showSuccess(existingSubmission ? 'Assignment resubmitted successfully!' : 'Assignment submitted successfully!');
      handleBack();
    } catch (error: any) {
      if (uploaded.length > 0) {
        await supabase.storage
          .from(FILE_CONFIG.buckets.assignments)
          .remove(uploaded.map((file) => file.path))
          .catch((cleanupError) => console.warn('Could not clean up partial upload:', cleanupError));
      }
      showSubmissionError('Failed to submit assignment', error);
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

  // Already-submitted files (new multi-file array, or the legacy single file).
  const existingFiles = existingSubmission
    ? (Array.isArray(existingSubmission.files) && existingSubmission.files.length > 0
        ? existingSubmission.files
        : (existingSubmission.file_path || existingSubmission.file_url)
          ? [{ path: existingSubmission.file_path, url: existingSubmission.file_url, name: existingSubmission.file_name, size: existingSubmission.file_size, type: existingSubmission.file_type }]
          : [])
    : [];

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
            {existingFiles.map((file: any, index: number) => (
              <TouchableOpacity
                key={`${file.path || file.name}-${index}`}
                style={styles.existingFile}
                onPress={() => openInViewer(existingFiles, index)}
              >
                {isImageFile(file) && file.url ? (
                  <Image source={{ uri: file.url }} style={styles.existingThumb} />
                ) : (
                  <View style={styles.fileIconBox}>
                    <Ionicons name="document" size={24} color={Colors.error} />
                  </View>
                )}
                <View style={styles.fileDetails}>
                  <Text style={styles.existingFileName} numberOfLines={1}>{file.name || `File ${index + 1}`}</Text>
                  <Text style={styles.existingFileDate}>
                    Submitted {new Date(existingSubmission.submitted_at).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
            ))}
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
          <Text style={styles.uploadHint}>PDF or photos accepted (Max 50MB each)</Text>

          {selectedFiles.map((file, index) => (
            <View key={`${file.name}-${index}`} style={styles.selectedFileCard}>
              <TouchableOpacity onPress={() => openInViewer(selectedFiles, index)}>
                {isImageFile(file) && file.previewUri ? (
                  <Image source={{ uri: file.previewUri }} style={styles.selectedThumb} />
                ) : (
                  <View style={styles.selectedFileIcon}>
                    <Ionicons name="document" size={28} color={Colors.error} />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.selectedFileInfo}>
                <Text style={styles.selectedFileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.selectedFileSize}>{formatFileSize(file.size)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveFile(index)} style={styles.removeButton}>
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.uploadArea} onPress={handlePickFiles} disabled={preparing}>
            <View style={styles.uploadIconCircle}>
              <Ionicons name={preparing ? 'hourglass-outline' : 'add'} size={32} color={Colors.primary} />
            </View>
            <Text style={styles.uploadText}>
              {preparing ? 'Preparing…' : selectedFiles.length > 0 ? 'Add more' : 'Add attachment'}
            </Text>
            <Text style={styles.uploadSubtext}>Tap to select one or more files</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cameraButton} onPress={handlePickImages} disabled={preparing}>
            <Ionicons name="images-outline" size={20} color={Colors.primary} />
            <Text style={styles.cameraButtonText}>Choose multiple photos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cameraButton} onPress={handleTakePhoto} disabled={preparing}>
            <Ionicons name="camera-outline" size={20} color={Colors.primary} />
            <Text style={styles.cameraButtonText}>Take Photo</Text>
          </TouchableOpacity>
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
            disabled={selectedFiles.length === 0 || submitting}
            style={styles.submitButton}
          />
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <MediaViewer
        visible={viewerFiles !== null}
        files={viewerFiles || []}
        initialIndex={viewerIndex}
        onClose={() => setViewerFiles(null)}
      />
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
    backgroundColor: Colors.background, borderRadius: 8, marginBottom: Spacing.sm,
  },
  existingThumb: { width: 40, height: 40, borderRadius: 8, marginRight: Spacing.md, backgroundColor: Colors.border.light },
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
    marginTop: Spacing.sm,
  },
  cameraButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm, paddingVertical: Spacing.md, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary + '10',
  },
  cameraButtonText: { fontSize: 15, fontWeight: '600', color: Colors.primary, marginLeft: Spacing.sm },
  uploadIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  uploadText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  uploadSubtext: { fontSize: 12, color: Colors.text.tertiary, marginTop: 4 },
  selectedFileCard: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.success,
    marginBottom: Spacing.sm,
  },
  selectedThumb: { width: 48, height: 48, borderRadius: 8, marginRight: Spacing.md, backgroundColor: Colors.border.light },
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
