import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getSchools, createLesson } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import NativeVideoPlayer from '../components/NativeVideoPlayer';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AddRecording() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<any>(null);
  const [duration, setDuration] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // Load schools
      const { data: schoolsData } = await getSchools();
      if (schoolsData) setSchools(schoolsData);
      

    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (file: any) => {
    setVideoFile(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      handleError(null, 'Recording title is required');
      return;
    }

    if (!videoFile) {
      handleError(null, 'Video file is required');
      return;
    }

    if (selectedSchool !== 'all' && !selectedSchool) {
      handleError(null, 'Please select a school for school-specific recording');
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Upload video file to Supabase storage
      // For now, we'll use a placeholder path
      const videoPath = `videos/${Date.now()}_${videoFile.name}`;
      
      const lessonData = {
        title: title.trim(),
        description: description.trim() || undefined,
        video_path: videoPath,
        duration_minutes: duration ? parseInt(duration) : undefined,
        lesson_type: 'video',
        teacher_id: user.id,
        class_id: null, // We're not using classes anymore
        school_id: selectedSchool === 'all' ? null : selectedSchool,
        is_published: true,
      };

      const { error } = await createLesson(lessonData);
      
      if (error) {
        handleError(error, 'Failed to add recording');
      } else {
        showSuccess(
          selectedSchool === 'all' 
            ? 'Recording added for all schools' 
            : 'Recording added successfully'
        );
        router.back();
      }
    } catch (error) {
      handleError(error, 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };



  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Recording</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Input
          label="Recording Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter recording title"
        />

        <Text style={styles.sectionTitle}>Add New Recording</Text>
        
        <Text style={styles.description}>
          Upload video files directly to secure storage. Videos will be accessible only to students in your school.
        </Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Video File *</Text>
          <TouchableOpacity
            style={styles.fileSelector}
            onPress={() => {
              // TODO: Implement file picker
              Alert.alert('File Upload', 'Video file upload will be implemented with proper file picker');
            }}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={Colors.primary} />
            <Text style={styles.fileSelectorText}>
              {videoFile ? videoFile.name : 'Select Video File'}
            </Text>
          </TouchableOpacity>
        </View>

        {videoFile && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Selected File:</Text>
            <Text style={styles.fileName}>{videoFile.name}</Text>
          </View>
        )}

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description of the recording"
          multiline
          numberOfLines={3}
        />

        <Input
          label="Duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          placeholder="45"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Availability *</Text>
        <View style={styles.availabilitySelector}>
          <TouchableOpacity
            style={[
              styles.availabilityButton,
              selectedSchool === 'all' && styles.availabilityButtonSelected,
            ]}
            onPress={() => {
              setSelectedSchool('all');
            }}
          >
            <Text
              style={[
                styles.availabilityButtonText,
                selectedSchool === 'all' && styles.availabilityButtonTextSelected,
              ]}
            >
              All Schools
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.availabilityButton,
              selectedSchool !== 'all' && styles.availabilityButtonSelected,
            ]}
            onPress={() => setSelectedSchool('')}
          >
            <Text
              style={[
                styles.availabilityButtonText,
                selectedSchool !== 'all' && styles.availabilityButtonTextSelected,
              ]}
            >
              Specific School
            </Text>
          </TouchableOpacity>
        </View>

        {selectedSchool !== 'all' && (
          <>
            <Text style={styles.label}>Select School *</Text>
            <View style={styles.schoolSelector}>
              {schools.map((school) => (
                <TouchableOpacity
                  key={school.id}
                  style={[
                    styles.schoolButton,
                    selectedSchool === school.id && styles.schoolButtonSelected,
                  ]}
                  onPress={() => setSelectedSchool(school.id)}
                >
                  <Text
                    style={[
                      styles.schoolButtonText,
                      selectedSchool === school.id && styles.schoolButtonTextSelected,
                    ]}
                  >
                    {school.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedSchool && selectedSchool !== 'all' && (
              <View style={styles.schoolSelectedContainer}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.schoolSelectedText}>
                  Recording will be available to all students in this school
                </Text>
              </View>
            )}
          </>
        )}

        <Button
          title="Add Recording"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  availabilitySelector: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  availabilityButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    alignItems: 'center',
  },
  availabilityButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  availabilityButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  availabilityButtonTextSelected: {
    color: Colors.text.inverse,
  },
  schoolSelector: {
    marginBottom: Spacing.xl,
  },
  schoolButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    marginBottom: Spacing.sm,
  },
  schoolButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  schoolButtonTextSelected: {
    color: Colors.text.inverse,
  },
  classSelector: {
    marginBottom: Spacing.xl,
  },
  classButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    marginBottom: Spacing.sm,
  },
  classButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  classButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  classButtonTextSelected: {
    color: Colors.text.inverse,
  },
  submitButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  previewContainer: {
    marginBottom: Spacing.lg,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  schoolSelectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.success + '20',
    borderRadius: 8,
    marginBottom: Spacing.xl,
  },
  schoolSelectedText: {
    fontSize: 14,
    color: Colors.success,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  fileSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    borderStyle: 'dashed',
  },
  fileSelectorText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  fileName: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
});