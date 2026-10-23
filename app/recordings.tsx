import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getLessonsForStudent, getAllLessons, getLessonsBySchool, deleteLesson } from '../lib/database';
import { 
  getRecordingDependencies, 
  canEditRecording, 
  canDeleteRecording 
} from '../lib/recordingService';
import { formatRelativeDate, handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import SecureVideoPlayer from '../components/SecureVideoPlayer';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import RecordingDeleteDialog from '../components/RecordingDeleteDialog';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function Recordings() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [user, setUser] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    recording: any | null;
    dependencies: any[];
  }>({
    visible: false,
    recording: null,
    dependencies: [],
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Load recordings/lessons based on user role and school with strict isolation
      let lessonsData: any[] = [];
      try {
        if (currentUser.role === 'admin') {
          // Admin can see all lessons
          const result = await getAllLessons();
          lessonsData = result.data || [];
        } else if (currentUser.role === 'teacher') {
          const { getTeacherSchools } = await import('../lib/database');
          const { data: teacherSchools } = await getTeacherSchools(currentUser.id);
          const schoolIds = (teacherSchools || []).map((s: any) => s.id);
          if (currentUser.school_id && !schoolIds.includes(currentUser.school_id)) {
            schoolIds.push(currentUser.school_id);
          }
          if (schoolIds.length > 0) {
            const { data, error } = await supabase
              .from('lessons')
              .select(`
                *,
                school:schools(id, name),
                teacher:app_users!lessons_teacher_id_fkey(id, name)
              `)
              .in('school_id', schoolIds)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });
            lessonsData = data || [];
          } else {
            lessonsData = [];
          }
        } else if (currentUser.role === 'student') {
          if (currentUser.school_id) {
            const { data, error } = await supabase
              .from('lessons')
              .select(`
                *,
                school:schools(id, name),
                teacher:app_users!lessons_teacher_id_fkey(id, name)
              `)
              .eq('school_id', currentUser.school_id)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });
            lessonsData = data || [];
          } else {
            lessonsData = [];
          }
        }
        
        // Filter for video lessons only (check both video_url and video_path)
        const videoLessons = (lessonsData || []).filter((lesson: any) => 
          (lesson.video_url && lesson.video_url.trim() !== '') || 
          (lesson.video_path && lesson.video_path.trim() !== '')
        );
        setRecordings(videoLessons);
        
        console.log(`Loaded ${videoLessons.length} recordings from ${lessonsData.length} total lessons`);
      } catch (lessonsError) {
        console.error('Error loading lessons:', lessonsError);
        setRecordings([]);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load recordings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };



  const handleEditRecording = (recordingId: string) => {

    router.push(`/edit-recording?recordingId=${recordingId}`);
  };

  const handleDeleteClick = async (recording: any) => {
    // For now, just show the delete dialog without dependency checking
    // Dependencies can be added later once the basic functionality works
    setDeleteDialog({
      visible: true,
      recording,
      dependencies: [],
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.recording || !user) {

      return;
    }

    setDeleting(true);
    try {

      const { error } = await deleteLesson(deleteDialog.recording.id);
      
      if (error) {

        throw error;
      }


      showSuccess(`Recording "${deleteDialog.recording.title}" deleted successfully`);
      setDeleteDialog({ visible: false, recording: null, dependencies: [] });
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      handleError(error, 'Failed to delete recording');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ visible: false, recording: null, dependencies: [] });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.push('/');
          }
        }}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Physics Recordings</Text>
        {user && (user.role === 'teacher' || user.role === 'admin') && (
          <TouchableOpacity 
            onPress={() => router.push('/add-recording')}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {!user || (user.role !== 'teacher' && user.role !== 'admin') && (
          <View style={{ width: 24 }} />
        )}
      </FadeInView>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {recordings.length === 0 ? (
          <View>
            <EmptyState
              icon="videocam"
              message={
                user && (user.role === 'teacher' || user.role === 'admin')
                  ? "No recordings yet. Create your first recording to get started!"
                  : "No recordings available. Check back later for new physics lessons and recordings."
              }
            />
            {user && (user.role === 'teacher' || user.role === 'admin') && (
              <View style={styles.emptyActions}>
                <TouchableOpacity 
                  style={styles.createButton}
                  onPress={() => router.push('/add-recording')}
                >
                  <Ionicons name="add-circle" size={24} color={Colors.text.inverse} />
                  <Text style={styles.createButtonText}>Create First Recording</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <>
            {recordings.map((recording, index) => (
              <AnimatedCard key={recording.id} delay={Math.min(50 * (index + 1), 300)} style={styles.recordingCard}>
                <View style={styles.recordingHeader}>
                  <View style={styles.recordingInfo}>
                    <Text style={styles.recordingTitle}>{recording.title}</Text>
                    {recording.school && (
                      <Text style={styles.recordingClass}>{recording.school.name}</Text>
                    )}
                  </View>
                  
                  {/* Management Actions */}
                  {user && (canEditRecording(recording, user) || canDeleteRecording(recording, user)) && (
                    <View style={styles.adminActions}>
                      {canEditRecording(recording, user) && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: Colors.info + '20' }]}
                          onPress={() => handleEditRecording(recording.id)}
                        >
                          <Ionicons name="create" size={16} color={Colors.info} />
                        </TouchableOpacity>
                      )}
                      
                      {canDeleteRecording(recording, user) && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: Colors.error + '20' }]}
                          onPress={() => handleDeleteClick(recording)}
                        >
                          <Ionicons name="trash" size={16} color={Colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {recording.description && (
                  <Text style={styles.recordingDescription}>{recording.description}</Text>
                )}

                {/* Video Player */}
                {(recording.video_url || recording.video_path) && (
                  <View style={styles.videoContainer}>
                    <SecureVideoPlayer 
                      videoPath={recording.video_path || recording.video_url}
                      lessonId={recording.id}
                      title={recording.title}
                    />
                  </View>
                )}
              </AnimatedCard>
            ))}
          </>
        )}
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <RecordingDeleteDialog
        visible={deleteDialog.visible}
        recording={deleteDialog.recording}
        dependencies={deleteDialog.dependencies}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deleting}
      />
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
  addButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  recordingCard: {
    marginBottom: Spacing.lg,
  },
  recordingHeader: {
    marginBottom: Spacing.md,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  recordingClass: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  recordingTeacher: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  recordingMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  recordingDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  adminActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyActions: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
    elevation: 3,
  },
  createButtonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  videoContainer: {
    marginTop: Spacing.md,
    borderRadius: 8,
    overflow: 'hidden',
  },
});