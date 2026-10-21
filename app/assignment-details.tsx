import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDueDate, formatRelativeDate, formatFileSize, handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AssignmentDetails() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null); // For student
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]); // For teacher/admin
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load assignment details with fallback
      let assignmentData: any = null;
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          class:classes(id, name),
          teacher:app_users(id, name)
        `)
        .eq('id', assignmentId)
        .single();

      if (error) {
        console.warn('Assignment join query error, using fallback:', error.message);
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

      if (currentUser?.role === 'student') {
        // Load student's own submission
        const { data: submissionData, error: submissionError } = await supabase
          .from('submissions')
          .select('*')
          .eq('assignment_id', assignmentId)
          .eq('student_id', currentUser.id)
          .maybeSingle();

        if (submissionError && submissionError.code !== 'PGRST116') {
          console.warn('Student submission check error:', submissionError);
        }

        if (submissionData) {
          setSubmission(submissionData);
          if (submissionData.file_url) {
            setDownloadUrl(submissionData.file_url);
          } else if (submissionData.file_path) {
            const { data: pubData } = supabase.storage.from('submissions').getPublicUrl(submissionData.file_path);
            setDownloadUrl(pubData?.publicUrl || null);
          }
        }
      } else {
        // For teacher or admin: load all submissions with student details and avatar_url
        let { data: subsData, error: subsError } = await supabase
          .from('submissions')
          .select(`
            *,
            student:app_users(id, name, email, avatar_url)
          `)
          .eq('assignment_id', assignmentId)
          .order('submitted_at', { ascending: false });

        if (subsError) {
          console.warn('Teacher submissions join error, trying fallback:', subsError.message);
          const { data: fbSubs } = await supabase
            .from('submissions')
            .select('*')
            .eq('assignment_id', assignmentId)
            .order('submitted_at', { ascending: false });
          if (fbSubs) {
            const studentIds = fbSubs.map(s => s.student_id).filter(Boolean);
            if (studentIds.length > 0) {
              const { data: students } = await supabase
                .from('app_users')
                .select('id, name, email, avatar_url')
                .in('id', studentIds);
              const studentMap = new Map((students || []).map(st => [st.id, st]));
              subsData = fbSubs.map(s => ({
                ...s,
                student: studentMap.get(s.student_id) || { name: 'Student' }
              }));
            } else {
              subsData = fbSubs;
            }
          }
        }
        setAllSubmissions(subsData || []);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load assignment details');
    } finally {
      setLoading(false);
    }
  };

  const openPdfFile = async (filePath: string | null, fileUrl?: string | null) => {
    try {
      let targetUrl = fileUrl;
      if (!targetUrl && filePath) {
        const { data } = supabase.storage.from('submissions').getPublicUrl(filePath);
        targetUrl = data?.publicUrl;
      }
      if (!targetUrl && filePath) {
        const { data } = await supabase.storage.from('submissions').createSignedUrl(filePath, 3600);
        targetUrl = data?.signedUrl;
      }

      if (!targetUrl) {
        Alert.alert('File Error', 'Could not retrieve file URL.');
        return;
      }

      if (typeof window !== 'undefined') {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        await Linking.openURL(targetUrl);
      }
    } catch (err) {
      console.error('Open file error:', err);
      handleError(err, 'Failed to open PDF');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(user?.role === 'student' ? '/(tabs)/student-dashboard' : '/(tabs)/teacher-dashboard');
    }
  };

  const executeDeleteAssignment = async () => {
    try {
      // First defensively delete comments if any exist
      try {
        await supabase.from('assignment_comments').delete().eq('assignment_id', assignment.id);
      } catch (cErr) {
        console.warn('Comments delete warning:', cErr);
      }

      // Then delete submissions
      await supabase.from('submissions').delete().eq('assignment_id', assignment.id);

      // Finally delete assignment
      const { error } = await supabase.from('assignments').delete().eq('id', assignment.id);
      if (error) throw error;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.alert('Assignment deleted successfully.');
      } else {
        Alert.alert('Success', 'Assignment deleted successfully.');
      }
      handleBack();
    } catch (err: any) {
      console.error('Delete error:', err);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.alert(err.message || 'Failed to delete assignment');
      } else {
        Alert.alert('Error', err.message || 'Failed to delete assignment');
      }
    }
  };

  const handleDeleteAssignment = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Are you sure you want to delete this assignment and all associated submissions?');
      if (confirmed) {
        executeDeleteAssignment();
      }
      return;
    }

    Alert.alert(
      'Delete Assignment',
      'Are you sure you want to delete this assignment and all associated submissions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: executeDeleteAssignment
        }
      ]
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assignment Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOverdue = assignment.due_date && new Date() > new Date(assignment.due_date);
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignment Details</Text>
        <View style={{ width: 32 }} />
      </FadeInView>

      <ScrollView style={styles.content}>
        {/* Assignment Info */}
        <AnimatedCard style={styles.assignmentCard} delay={100}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <Text style={styles.className}>{assignment.class?.name || 'Physics Assignment'}</Text>
          
          <View style={styles.assignmentMeta}>
            {assignment.due_date && (
              <View style={styles.metaItem}>
                <Ionicons 
                  name="calendar" 
                  size={16} 
                  color={isOverdue ? Colors.error : Colors.text.secondary} 
                />
                <Text style={[
                  styles.metaText,
                  isOverdue && styles.overdueText
                ]}>
                  {formatDueDate(assignment.due_date)}
                </Text>
              </View>
            )}
            
            <View style={styles.metaItem}>
              <Ionicons name="person" size={16} color={Colors.text.secondary} />
              <Text style={styles.metaText}>Teacher: {assignment.teacher?.name || 'Teacher'}</Text>
            </View>
          </View>

          {assignment.description ? (
            <View style={styles.descContainer}>
              <Text style={styles.descText}>{assignment.description}</Text>
            </View>
          ) : null}

          {assignment.instructions && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <Text style={styles.instructions}>{assignment.instructions}</Text>
            </View>
          )}
        </AnimatedCard>

        {/* TEACHER / ADMIN VIEW: Direct Submissions Section */}
        {isTeacherOrAdmin ? (
          <AnimatedCard style={styles.statusCard} delay={200}>
            <View style={styles.teacherSubmissionsHeader}>
              <View>
                <Text style={styles.sectionTitle}>Student Submissions</Text>
                <Text style={styles.subTitleText}>
                  {allSubmissions.length} student{allSubmissions.length === 1 ? '' : 's'} submitted
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewAllSubsBtn}
                onPress={() => router.push(`/assignment-submissions?assignmentId=${assignment.id}`)}
              >
                <Text style={styles.viewAllSubsText}>Full Sheet</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {allSubmissions.length === 0 ? (
              <View style={styles.noSubmissionContainer}>
                <Ionicons name="document-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.noSubmissionText}>No submissions received yet</Text>
                <Text style={styles.noSubmissionSubtext}>
                  Submissions will appear here as soon as students submit their work.
                </Text>
              </View>
            ) : (
              <View style={styles.submissionsList}>
                {allSubmissions.map((sub) => {
                  const hasPfp = !!sub.student?.avatar_url;
                  return (
                    <View key={sub.id} style={styles.submissionRowCard}>
                      <View style={styles.studentInfoRow}>
                        {hasPfp ? (
                          <Image
                            source={{ uri: sub.student.avatar_url }}
                            style={styles.studentPfp}
                          />
                        ) : (
                          <View style={styles.studentPfpFallback}>
                            <Text style={styles.studentPfpInitial}>
                              {sub.student?.name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.studentMetaCol}>
                          <Text style={styles.studentNameText}>{sub.student?.name || 'Student'}</Text>
                          <Text style={styles.subTimeText}>
                            Submitted {formatRelativeDate(sub.submitted_at)}
                            {sub.is_late && <Text style={styles.lateTag}> • Late</Text>}
                          </Text>
                        </View>
                      </View>

                      {/* File attachment button */}
                      {(sub.file_name || sub.file_path || sub.file_url) && (
                        <TouchableOpacity
                          style={styles.openPdfBtn}
                          onPress={() => openPdfFile(sub.file_path, sub.file_url)}
                        >
                          <Ionicons name="document-text" size={18} color={Colors.error} />
                          <Text style={styles.openPdfBtnText} numberOfLines={1}>
                            {sub.file_name || 'Open PDF'}
                          </Text>
                          <Ionicons name="open-outline" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                      )}

                      <View style={styles.subRowActions}>
                        <TouchableOpacity
                          style={styles.gradeDetailsBtn}
                          onPress={() => router.push(`/grade-submission?submissionId=${sub.id}`)}
                        >
                          <Text style={styles.gradeDetailsBtnText}>
                            {sub.grade !== null ? `Grade: ${sub.grade}` : 'Grade Submission'}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </AnimatedCard>
        ) : (
          /* STUDENT VIEW: Submission Status */
          <AnimatedCard style={styles.statusCard} delay={200}>
            <Text style={styles.sectionTitle}>My Submission Status</Text>
            
            {!submission ? (
              <View style={styles.noSubmissionContainer}>
                <Ionicons name="document-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.noSubmissionText}>No submission yet</Text>
                <Text style={styles.noSubmissionSubtext}>
                  {isOverdue ? 'This assignment is overdue' : 'Submit your work before the due date'}
                </Text>
              </View>
            ) : (
              <View style={styles.submissionContainer}>
                <View style={styles.submissionHeader}>
                  <View style={styles.submissionIcon}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  </View>
                  <View style={styles.submissionInfo}>
                    <Text style={styles.submissionTitle}>Submitted</Text>
                    <Text style={styles.submissionDate}>
                      {formatRelativeDate(submission.submitted_at)}
                    </Text>
                    {submission.is_late && (
                      <Text style={styles.lateText}>Late Submission</Text>
                    )}
                  </View>
                </View>

                {/* File Info */}
                {(submission.file_name || submission.file_path || submission.file_url) && (
                  <TouchableOpacity
                    style={styles.fileContainer}
                    onPress={() => openPdfFile(submission.file_path, submission.file_url || downloadUrl)}
                  >
                    <Ionicons name="document-text" size={22} color={Colors.error} />
                    <View style={styles.fileDetails}>
                      <Text style={styles.fileName}>{submission.file_name || 'Assignment PDF'}</Text>
                      {submission.file_size ? (
                        <Text style={styles.fileSize}>{formatFileSize(submission.file_size)}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="open-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                )}

                {/* Grade Section */}
                <View style={styles.gradeBoxContainer}>
                  <View style={styles.gradeBoxHeader}>
                    <Ionicons 
                      name={submission.grade !== null && submission.grade !== undefined ? "ribbon-outline" : "time-outline"} 
                      size={20} 
                      color={submission.grade !== null && submission.grade !== undefined ? Colors.success : Colors.primary} 
                    />
                    <Text style={styles.gradeBoxTitle}>Grade</Text>
                    <View style={[
                      styles.gradeStatusTag, 
                      { backgroundColor: (submission.grade !== null && submission.grade !== undefined ? Colors.success : Colors.info) + '20' }
                    ]}>
                      <Text style={[
                        styles.gradeStatusTagText, 
                        { color: submission.grade !== null && submission.grade !== undefined ? Colors.success : Colors.info }
                      ]}>
                        {submission.grade !== null && submission.grade !== undefined ? 'GRADED' : 'NOT GRADED'}
                      </Text>
                    </View>
                  </View>
                  
                  {submission.grade !== null && submission.grade !== undefined && !isNaN(Number(submission.grade)) ? (
                    <View style={styles.gradeDisplayRow}>
                      <Text style={styles.gradeDisplayBig}>
                        {submission.grade}
                        <Text style={styles.gradeDisplayMax}> / {assignment.max_score || 100}</Text>
                      </Text>
                      {assignment.max_score ? (
                        <Text style={styles.gradePercentageText}>
                          ({Math.round((Number(submission.grade) / Number(assignment.max_score)) * 100)}%)
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.notGradedExplainer}>
                      Not graded yet or assignment does not require a grade.
                    </Text>
                  )}
                </View>

                {/* Teacher Feedback / Comment */}
                {submission.feedback ? (
                  <View style={styles.feedbackContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="chatbubble-ellipses" size={16} color={Colors.primary} />
                      <Text style={styles.feedbackTitle}>Teacher Comment:</Text>
                    </View>
                    <Text style={styles.feedbackText}>{submission.feedback}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </AnimatedCard>
        )}

        {/* Action Buttons */}
        <AnimatedCard style={styles.actionsCard} delay={300}>
          {user?.role === 'student' ? (
            !submission ? (
              <Button
                title={isOverdue ? "Submit Late" : "Submit Assignment"}
                onPress={() => router.push(`/submit-assignment?assignmentId=${assignment.id}`)}
                style={styles.actionButton}
              />
            ) : (
              <View style={styles.actionButtons}>
                <Button
                  title="Resubmit"
                  onPress={() => router.push(`/submit-assignment?assignmentId=${assignment.id}`)}
                  variant="outline"
                  style={styles.resubmitButton}
                />
                <Button
                  title="View Submitted PDF"
                  onPress={() => openPdfFile(submission.file_path, submission.file_url || downloadUrl)}
                  variant="secondary"
                  style={styles.downloadActionButton}
                />
              </View>
            )
          ) : (
            <View style={styles.actionButtons}>
              <Button
                title="Edit Assignment"
                onPress={() => router.push(`/edit-assignment?assignmentId=${assignment.id}`)}
                variant="outline"
                style={[styles.actionButton, { flex: 1, marginRight: 8 }]}
              />
              <Button
                title="Delete Assignment"
                onPress={handleDeleteAssignment}
                variant="secondary"
                style={[styles.actionButton, { flex: 1, backgroundColor: '#EF4444' }]}
              />
            </View>
          )}
        </AnimatedCard>
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
  backBtn: {
    padding: Spacing.xs,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  className: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  assignmentMeta: {
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  metaText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  overdueText: {
    color: Colors.error,
    fontWeight: '600',
  },
  descContainer: {
    marginBottom: Spacing.md,
  },
  descText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  instructionsContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
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
  statusCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  subTitleText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  teacherSubmissionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  viewAllSubsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.primary + '15',
    borderRadius: 6,
  },
  viewAllSubsText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  submissionsList: {
    gap: Spacing.md,
  },
  submissionRowCard: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  studentPfp: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: Spacing.md,
    backgroundColor: Colors.border.medium,
  },
  studentPfpFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  studentPfpInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  studentMetaCol: {
    flex: 1,
  },
  studentNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  subTimeText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  lateTag: {
    color: Colors.error,
    fontWeight: '600',
  },
  openPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  openPdfBtnText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  subRowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  gradeDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gradeDetailsBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  noSubmissionContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noSubmissionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  noSubmissionSubtext: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  submissionContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  submissionIcon: {
    marginRight: Spacing.md,
  },
  submissionInfo: {
    flex: 1,
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  submissionDate: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  lateText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.background,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: Spacing.md,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  feedbackContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  feedbackText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  actionsCard: {
    marginBottom: Spacing.xl,
  },
  actionButton: {
    width: '100%',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  resubmitButton: {
    flex: 1,
  },
  downloadActionButton: {
    flex: 1,
  },
  gradeBoxContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  gradeBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  gradeBoxTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  gradeStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gradeStatusTagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  gradeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  gradeDisplayBig: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.success,
  },
  gradeDisplayMax: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  gradePercentageText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  notGradedExplainer: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
});