import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess, formatFileSize } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AddRecording() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationStatus, setDurationStatus] = useState<string>('');

  // Uploaded video state
  const [uploadedVideo, setUploadedVideo] = useState<{
    name: string;
    size: number;
    path: string;
    url: string;
  } | null>(null);

  // Schools list and selection
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      let availableSchools: any[] = [];

      if (currentUser.role === 'admin') {
        const { data: allSchools } = await supabase
          .from('schools')
          .select('id, name')
          .order('name');
        if (allSchools) availableSchools = allSchools;
      } else {
        // Teacher: load schools from teacher_schools
        const { data: teacherSchools } = await supabase
          .from('teacher_schools')
          .select('school_id, schools(id, name)')
          .eq('teacher_id', currentUser.id);

        if (teacherSchools && teacherSchools.length > 0) {
          availableSchools = teacherSchools
            .map((ts: any) => ts.schools)
            .filter(Boolean);
        } else if (currentUser.school_id) {
          const { data: directSchool } = await supabase
            .from('schools')
            .select('id, name')
            .eq('id', currentUser.school_id)
            .single();
          if (directSchool) availableSchools = [directSchool];
        }

        if (availableSchools.length === 0) {
          const { data: fallbackSchools } = await supabase
            .from('schools')
            .select('id, name')
            .order('name');
          if (fallbackSchools) availableSchools = fallbackSchools;
        }
      }

      setSchools(availableSchools);
      if (availableSchools.length > 0) {
        setSelectedSchoolId(availableSchools[0].id);
      }
    } catch (error) {
      handleError(error, 'Failed to load user or schools');
    } finally {
      setLoading(false);
    }
  };

  // Auto-detect video/audio duration using HTML5 media element
  const detectDuration = (fileOrBlob: File | Blob): Promise<number> => {
    return new Promise((resolve) => {
      try {
        if (typeof document !== 'undefined') {
          const video = document.createElement('video');
          video.preload = 'metadata';
          const blobUrl = URL.createObjectURL(fileOrBlob);

          video.onloadedmetadata = () => {
            URL.revokeObjectURL(blobUrl);
            const totalSeconds = video.duration;
            if (isFinite(totalSeconds) && totalSeconds > 0) {
              const mins = Math.max(1, Math.round(totalSeconds / 60));
              resolve(mins);
            } else {
              resolve(1);
            }
          };

          video.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(0);
          };

          video.src = blobUrl;
        } else {
          resolve(0);
        }
      } catch {
        resolve(0);
      }
    });
  };

  const pickVideoFile = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*', 'audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];

        // Read blob
        let blob: Blob;
        if (Platform.OS === 'web' && file.file) {
          blob = file.file;
        } else {
          const response = await fetch(file.uri);
          blob = await response.blob();
        }

        // Auto-detect duration
        setDurationStatus('Detecting video duration...');
        const detectedMins = await detectDuration(blob);
        if (detectedMins > 0) {
          setDurationMinutes(detectedMins);
          setDurationStatus(`${detectedMins} minute${detectedMins > 1 ? 's' : ''} (auto-detected)`);
        } else {
          setDurationMinutes(5); // Default sensible duration
          setDurationStatus('5 minutes (estimated)');
        }

        // Upload to recordings / videos bucket
        const fileExt = file.name ? file.name.split('.').pop() : 'mp4';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `recordings/${selectedSchoolId || 'global'}/${fileName}`;

        console.log('Uploading video to recordings bucket:', filePath);

        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(filePath, blob, {
            contentType: file.mimeType || 'video/mp4',
            upsert: false,
          });

        if (uploadError) {
          console.warn('Recordings bucket upload failed, trying videos bucket:', uploadError);
          const { error: videoBucketError } = await supabase.storage
            .from('videos')
            .upload(filePath, blob, {
              contentType: file.mimeType || 'video/mp4',
              upsert: false,
            });
          if (videoBucketError) throw videoBucketError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('recordings')
          .getPublicUrl(filePath);

        setUploadedVideo({
          name: file.name || fileName,
          size: file.size || blob.size,
          path: filePath,
          url: publicUrl,
        });

        showSuccess('Video uploaded successfully!');
      }
    } catch (error: any) {
      console.error('Video upload error:', error);
      Alert.alert('Upload Error', error?.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a title for the recording');
      return;
    }

    if (!uploadedVideo) {
      Alert.alert('Video Required', 'Please pick and upload a video file for this recording');
      return;
    }

    setSaving(true);
    try {
      // Validate user ID is a valid UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id);
      if (!isUUID) {
        Alert.alert('Session Error', 'Your session contains an invalid user ID. Please log out and sign in with a real account.');
        setSaving(false);
        return;
      }

      const finalVideoUrl = uploadedVideo.url;
      const finalVideoPath = uploadedVideo.path || null;
      const finalDuration = durationMinutes || 10;

      const recordingData = {
        title: title.trim(),
        description: description.trim() || null,
        teacher_id: user.id,
        school_id: selectedSchoolId || null,
        video_url: finalVideoUrl,
        video_path: finalVideoPath,
        video_name: uploadedVideo?.name || null,
        video_size: uploadedVideo?.size || null,
        duration_minutes: finalDuration,
        duration: finalDuration * 60,
        is_published: true,
      };

      console.log('Inserting lesson recording:', recordingData);

      const { data, error } = await supabase
        .from('lessons')
        .insert(recordingData)
        .select()
        .single();

      if (error) {
        console.error('Insert lesson error:', error);
        throw error;
      }

      showSuccess('Recording added successfully!');
      handleBack();
    } catch (error: any) {
      console.error('Save recording error:', error);
      handleError(error, 'Failed to save recording');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/recordings');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Recording</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* School Selector */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>
            {isAdmin ? 'Target School (Admin):' : 'Select Assigned School:'}
          </Text>
          <View style={styles.schoolsGrid}>
            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.schoolChip,
                  selectedSchoolId === null && styles.schoolChipActive,
                ]}
                onPress={() => setSelectedSchoolId(null)}
              >
                <Ionicons 
                  name="globe-outline" 
                  size={16} 
                  color={selectedSchoolId === null ? Colors.text.inverse : Colors.primary} 
                />
                <Text style={[
                  styles.schoolChipText,
                  selectedSchoolId === null && styles.schoolChipTextActive,
                ]}>
                  All Schools
                </Text>
              </TouchableOpacity>
            )}

            {schools.map((school) => {
              const isSelected = selectedSchoolId === school.id;
              return (
                <TouchableOpacity
                  key={school.id}
                  style={[styles.schoolChip, isSelected && styles.schoolChipActive]}
                  onPress={() => setSelectedSchoolId(school.id)}
                >
                  <Ionicons 
                    name="school-outline" 
                    size={16} 
                    color={isSelected ? Colors.text.inverse : Colors.primary} 
                  />
                  <Text style={[
                    styles.schoolChipText,
                    isSelected && styles.schoolChipTextActive,
                  ]}>
                    {school.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Title */}
        <Input
          label="Recording Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Lesson 4: Newton's Laws Explained"
        />

        {/* Description */}
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Notes or chapter details for students..."
          multiline
          numberOfLines={3}
        />

        {/* Video Upload Section */}
        <View style={styles.uploadSection}>
          <Text style={styles.uploadLabel}>Video File or Recording</Text>

          {uploadedVideo ? (
            <View style={styles.uploadedFileCard}>
              <View style={styles.fileIconBox}>
                <Ionicons name="videocam" size={26} color={Colors.warning} />
              </View>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>{uploadedVideo.name}</Text>
                <Text style={styles.fileSize}>{formatFileSize(uploadedVideo.size)}</Text>
              </View>
              <TouchableOpacity onPress={() => setUploadedVideo(null)} style={styles.removeFileBtn}>
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.dropZone} 
              onPress={pickVideoFile}
              disabled={uploading}
            >
              <Ionicons 
                name={uploading ? "cloud-upload" : "videocam-outline"} 
                size={40} 
                color={Colors.warning} 
              />
              <Text style={styles.dropZoneText}>
                {uploading ? 'Uploading Video...' : 'Pick & Upload Video File'}
              </Text>
              <Text style={styles.dropZoneSubtext}>
                MP4, WebM, or MOV video files supported
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Button
          title={saving ? "Saving Recording..." : "Post Recording"}
          onPress={handleSave}
          loading={saving}
          disabled={saving || uploading}
          style={styles.submitBtn}
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
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
  sectionBox: {
    backgroundColor: Colors.card.background,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  schoolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  schoolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.background,
  },
  schoolChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolChipText: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  schoolChipTextActive: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  uploadSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: Colors.border.medium,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card.background,
  },
  dropZoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  dropZoneSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  uploadedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 10,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.warning + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  removeFileBtn: {
    padding: Spacing.xs,
  },
  urlDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border.light,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.tertiary,
    marginHorizontal: Spacing.md,
    letterSpacing: 1,
  },
  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.success + '15',
    padding: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.xs,
  },
  durationCardText: {
    fontSize: 13,
    color: Colors.success,
  },
  submitBtn: {
    marginBottom: Spacing.xxxl,
  },
});
