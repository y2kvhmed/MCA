import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getCurrentUser } from '../lib/auth';
import { getLessonById, updateLesson } from '../lib/database';
import { 
  canEditRecording,
  RecordingFormData 
} from '../lib/recordingService';
import { handleError } from '../lib/utils';
import RecordingEditForm from '../components/RecordingEditForm';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';

export default function EditRecording() {
  const router = useRouter();
  const { recordingId } = useLocalSearchParams<{ recordingId: string }>();
  const { showSuccess, showError } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [recording, setRecording] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [recordingId]);

  const loadData = async () => {
    try {
      if (!recordingId) {
        showError('Recording ID is required');
        router.back();
        return;
      }

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        showError('Please log in to edit recordings');
        router.push('/login');
        return;
      }

      setUser(currentUser);

      // Get recording data
      const { data: recordingData, error } = await getLessonById(recordingId);
      
      if (error || !recordingData) {
        showError('Recording not found or you do not have permission to edit it');
        router.back();
        return;
      }

      // Check permissions
      if (!canEditRecording(recordingData, currentUser)) {
        showError('You do not have permission to edit this recording');
        router.back();
        return;
      }

      setRecording(recordingData);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load recording data');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: RecordingFormData) => {
    if (!recordingId || !user) {
      console.error('Missing recordingId or user data');
      return;
    }

    console.log('Attempting to save recording:', recordingId, formData);
    setSaving(true);
    try {
      const updateData = {
        title: formData.title,
        description: formData.description,
        video_url: formData.video_url,
        duration_minutes: formData.duration_minutes,
        last_edited_by: user.id,
      };

      const { data, error } = await updateLesson(recordingId, updateData);
      
      if (error) {
        console.error('Update recording error:', error);
        throw error;
      }

      console.log('Recording updated successfully');
      showSuccess('Recording updated successfully');
      router.back();
    } catch (error) {
      console.error('Save error:', error);
      handleError(error, 'Failed to update recording');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!recording) {
    return null;
  }

  const initialData: RecordingFormData = {
    title: recording.title || '',
    description: recording.description || '',
    video_url: recording.video_url || '',
    duration_minutes: recording.duration_minutes,
    tags: [], // Add tags support later
    visibility: 'school', // Add visibility support later
  };

  return (
    <SafeAreaView style={styles.container}>
      <RecordingEditForm
        initialData={initialData}
        onSave={handleSave}
        onCancel={handleCancel}
        isLoading={saving}
        isEditing={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});