import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AssignmentSubmissions() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'submitted' | 'missing'>('submitted');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      // Load assignment details with fallback
      let assignmentData: any = null;
      const { data, error } = await supabase
        .from('assignments')
        .select(`*, teacher:app_users(id, name), school:schools(id, name)`)
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

      // Load submissions with avatar_url
      let { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`*, student:app_users(id, name, email, avatar_url)`)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (submissionsError) {
        console.warn('Submissions join error, using fallback:', submissionsError.message);
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
            submissionsData = fbSubs.map(s => ({
              ...s,
              student: studentMap.get(s.student_id) || { name: 'Student' }
            }));
          } else {
            submissionsData = fbSubs;
          }
        }
      }
      setSubmissions(submissionsData || []);

      // Load all students in the school to show who's missing
      if (assignmentData?.school_id) {
        const { data: studentsData } = await supabase
          .from('app_users')
          .select('id, name, email, avatar_url')
          .eq('school_id', assignmentData.school_id)
          .eq('role', 'student')
          .eq('is_active', true);
        setAllStudents(studentsData || []);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const exportToCSV = () => {
    try {
      const csv = [
        ['Student Name', 'Email', 'Status', 'Submitted At', 'File Name'].join(','),
        ...allStudents.map((student: any) => {
          const submission = submissions.find(s => s.student_id === student.id);
          return [
            student.name || '',
            student.email || '',
            submission ? 'Submitted' : 'Missing',
            submission?.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '',
            submission?.file_name || '',
          ].map(v => `"${v}"`).join(',');
        })
      ].join('\n');

      if (typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${assignment.title}-submissions.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        showSuccess('Exported!');
      }
    } catch (error) {
      handleError(error, 'Failed to export');
    }
  };

  const openSubmissionFile = async (submission: any) => {
    try {
      console.log('Opening submission file:', submission);
      
      let filePath = submission.file_path || '';
      if (filePath.startsWith('http')) {
        const parts = filePath.split('/submissions/');
        if (parts.length > 1) {
          filePath = decodeURIComponent(parts[1]);
        }
      }
      if (filePath.startsWith('submissions/')) {
        filePath = filePath.replace(/^submissions\//, '');
      }

      // 1. Direct stored URL
      let fileUrl = submission.file_url || '';

      // 2. Or public storage URL from filePath
      if (!fileUrl && filePath) {
        const { data } = supabase.storage.from('submissions').getPublicUrl(filePath);
        if (data?.publicUrl) fileUrl = data.publicUrl;
      }

      // 3. Or signed URL from filePath
      if (!fileUrl && filePath) {
        try {
          const { data, error } = await supabase.storage
            .from('submissions')
            .createSignedUrl(filePath, 3600);
          if (!error && data?.signedUrl) {
            fileUrl = data.signedUrl;
          }
        } catch (signedError) {
          console.warn('Failed to get signed URL:', signedError);
        }
      }

      // If we have a direct URL, open it directly so browser's native PDF reader renders it
      if (fileUrl) {
        if (typeof window !== 'undefined') {
          window.open(fileUrl, '_blank');
        } else {
          await Linking.openURL(fileUrl);
        }
        return;
      }

      // Fallback on Web: download blob explicitly formatted as application/pdf
      if (typeof window !== 'undefined' && filePath) {
        try {
          const { data: blobData, error: blobErr } = await supabase.storage
            .from('submissions')
            .download(filePath);
          if (!blobErr && blobData) {
            const pdfBlob = new Blob([blobData], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');
            return;
          }
        } catch (e) {
          console.warn('Blob download attempt error:', e);
        }
      }

      handleError(null, 'Could not get file URL. The file may have been deleted or access was denied.');
    } catch (error) {
      console.error('Open file error:', error);
      handleError(error, 'Failed to open file');
    }
  };

  // Get students who haven't submitted
  const submittedStudentIds = submissions.map(s => s.student_id);
  const missingStudents = allStudents.filter(s => !submittedStudentIds.includes(s.id));

  const submittedCount = submissions.length;
  const missingCount = missingStudents.length;

  if (loading) return <LoadingSpinner />;
  if (!assignment) return <SafeAreaView style={styles.container}><Text>Assignment not found</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{assignment.title}</Text>
          <Text style={styles.headerSubtitle}>{allStudents.length} students total</Text>
        </View>
        <TouchableOpacity onPress={exportToCSV} style={styles.exportButton}>
          <Ionicons name="download-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </FadeInView>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: Colors.success }]}>{submittedCount}</Text>
          <Text style={styles.statLabel}>Submitted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: Colors.error }]}>{missingCount}</Text>
          <Text style={styles.statLabel}>Missing</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'submitted' && styles.tabActive]}
          onPress={() => setSelectedTab('submitted')}
        >
          <Text style={[styles.tabText, selectedTab === 'submitted' && styles.tabTextActive]}>
            Submitted ({submittedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'missing' && styles.tabActive]}
          onPress={() => setSelectedTab('missing')}
        >
          <Text style={[styles.tabText, selectedTab === 'missing' && styles.tabTextActive]}>
            Missing ({missingCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {selectedTab === 'submitted' ? (
          submissions.length === 0 ? (
            <EmptyState icon="document-outline" message="No submissions yet" />
          ) : (
            submissions.map((submission, index) => (
              <AnimatedCard key={submission.id} style={styles.submissionCard} delay={Math.min(index * 30, 200)}>
                <View style={styles.studentRow}>
                  {submission.student?.avatar_url ? (
                    <Image source={{ uri: submission.student.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: Colors.success }]}>
                      <Text style={styles.avatarText}>
                        {submission.student?.name?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{submission.student?.name || 'Unknown'}</Text>
                    <Text style={styles.submittedTime}>
                      {submission.submitted_at ? formatRelativeDate(submission.submitted_at) : 'Unknown date'}
                      {submission.is_late && <Text style={styles.lateTag}> • Late</Text>}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                    <Text style={[styles.statusText, { color: Colors.success }]}>Submitted</Text>
                  </View>
                </View>

                {submission.file_name && (
                  <TouchableOpacity style={styles.fileRow} onPress={() => openSubmissionFile(submission)}>
                    <View style={styles.fileIcon}>
                      <Ionicons name="document-text" size={20} color={Colors.error} />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{submission.file_name}</Text>
                    </View>
                    <Ionicons name="open-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                )}

                {submission.feedback && (
                  <View style={styles.feedbackPreview}>
                    <Ionicons name="chatbubble-outline" size={14} color={Colors.text.secondary} />
                    <Text style={styles.feedbackText} numberOfLines={2}>{submission.feedback}</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.viewDetailsButton}
                  onPress={() => router.push(`/grade-submission?submissionId=${submission.id}`)}
                >
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </AnimatedCard>
            ))
          )
        ) : (
          missingStudents.length === 0 ? (
            <EmptyState icon="checkmark-circle" message="All students have submitted!" />
          ) : (
            missingStudents.map((student, index) => (
              <AnimatedCard key={student.id} style={styles.submissionCard} delay={100 + (index * 50)}>
                <View style={styles.studentRow}>
                  {student.avatar_url ? (
                    <Image source={{ uri: student.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: Colors.error }]}>
                      <Text style={styles.avatarText}>
                        {student.name?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentEmail}>{student.email}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: Colors.error + '20' }]}>
                    <Text style={[styles.statusText, { color: Colors.error }]}>Missing</Text>
                  </View>
                </View>
              </AnimatedCard>
            ))
          )
        )}
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
  exportButton: { padding: Spacing.xs },
  headerContent: { flex: 1, marginLeft: Spacing.md },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text.primary },
  headerSubtitle: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.card.background,
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: Colors.text.secondary, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border.light, marginVertical: Spacing.xs },
  tabsContainer: {
    flexDirection: 'row', backgroundColor: Colors.card.background,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  tab: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, color: Colors.text.secondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary },
  content: { flex: 1, padding: Spacing.md },
  submissionCard: { marginBottom: Spacing.md, padding: Spacing.md },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 22, marginRight: Spacing.md, backgroundColor: Colors.border.medium },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  avatarText: { color: Colors.text.inverse, fontSize: 18, fontWeight: 'bold' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
  studentEmail: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  submittedTime: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  lateTag: { color: Colors.warning, fontWeight: '500' },
  statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 16 },
  statusText: { fontSize: 12, fontWeight: '600' },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.background, marginTop: Spacing.sm, borderRadius: 8, paddingHorizontal: Spacing.sm,
  },
  fileIcon: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.error + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm,
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, color: Colors.text.primary, fontWeight: '500' },
  feedbackPreview: { flexDirection: 'row', alignItems: 'flex-start', marginTop: Spacing.sm },
  feedbackText: { flex: 1, fontSize: 13, color: Colors.text.secondary, fontStyle: 'italic', marginLeft: Spacing.xs },
  viewDetailsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '15', borderRadius: 8,
  },
  viewDetailsText: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginRight: Spacing.xs },
});
