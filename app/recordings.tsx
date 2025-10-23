import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getLessonsForStudent, getAllLessons, getLessonsBySchool, deleteLesson } from '../lib/database';
import { 
  getRecordingDependencies, 
  canEditRecording, 
  canDeleteRecording 
} from '../lib/recordingService';
import { formatRelativeDate, handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import NativeVideoPlayer from '../components/NativeVideoPlayer';
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

      // Load recordings/lessons based on user role and school
      let lessonsData;
      if (currentUser.role === 'admin') {
        // Admin can see all lessons
        const result = await getAllLessons();
        lessonsData = result.data;
      } else if (currentUser.role === 'teacher') {
        // Teachers see lessons from their school
        if (currentUser.school_id) {
          const result = await getLessonsBySchool(currentUser.school_id);
          lessonsData = result.data;
        } else {
          // If teacher has no school, show empty
          lessonsData = [];
        }
      } else {
        // Students see lessons from their school
        const result = await getLessonsForStudent(currentUser.id);
        lessonsData = result.data;
      }
      
      if (lessonsData) {
        // Filter for video lessons only
        const videoLessons = lessonsData.filter((lesson: any) => 
          lesson.video_url || lesson.video_path
        );
        setRecordings(videoLessons);
      } else {
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
    console.log('Navigating to edit recording:', recordingId);
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
      console.error('Missing recording or user data');
      return;
    }

    setDeleting(true);
    try {
      console.log('Attempting to delete recording:', deleteDialog.recording.id);
      const { error } = await deleteLesson(deleteDialog.recording.id);
      
      if (error) {
        console.error('Delete recording error:', error);
        throw error;
      }

      console.log('Recording deleted successfully');
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
        <TouchableOpacity onPress={() => router.back()}>
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
            <FadeInView style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="videocam" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{recordings.length}</Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time" size={24} color={Colors.info} />
                <Text style={styles.statValue}>
                  {recordings.reduce((total, r) => total + (r.duration_minutes || 0), 0)}
                </Text>
                <Text style={styles.statLabel}>Total Minutes</Text>
              </View>
              {user && (user.role === 'teacher' || user.role === 'admin') && (
                <View style={styles.statItem}>
                  <Ionicons name="settings" size={24} color={Colors.success} />
                  <Text style={styles.statValue}>✓</Text>
                  <Text style={styles.statLabel}>Can Manage</Text>
                </View>
              )}
            </FadeInView>

            {recordings.map((recording, index) => (
              <AnimatedCard key={recording.id} delay={100 * (index + 1)} style={styles.recordingCard}>
                <View style={styles.recordingHeader}>
                  <View style={styles.recordingInfo}>
                    <Text style={styles.recordingTitle}>{recording.title}</Text>
                    {recording.school && (
                      <Text style={styles.recordingClass}>{recording.school.name}</Text>
                    )}
                    {recording.teacher && (
                      <Text style={styles.recordingTeacher}>by {recording.teacher.name}</Text>
                    )}
                    <View style={styles.recordingMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar" size={14} color={Colors.text.secondary} />
                        <Text style={styles.metaText}>
                          {formatRelativeDate(recording.created_at)}
                        </Text>
                      </View>
                      {recording.duration_minutes && (
                        <View style={styles.metaItem}>
                          <Ionicons name="time" size={14} color={Colors.text.secondary} />
                          <Text style={styles.metaText}>{recording.duration_minutes} min</Text>
                        </View>
                      )}
                    </View>
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
                    <NativeVideoPlayer 
                      videoPath={recording.video_path || recording.video_url}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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