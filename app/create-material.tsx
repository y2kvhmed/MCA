import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess, formatFileSize } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import * as DocumentPicker from 'expo-document-picker';

export default function CreateMaterial() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Schools list and selection
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: 'Physics',
  });

  useEffect(() => {
    loadUserAndSchools();
  }, []);

  const loadUserAndSchools = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      let availableSchools: any[] = [];

      if (currentUser.role === 'admin') {
        // Admin can select ANY school, or global (all schools)
        const { data: allSchools, error } = await supabase
          .from('schools')
          .select('id, name')
          .order('name');
        
        if (!error && allSchools) {
          availableSchools = allSchools;
        }
      } else {
        // Teacher: load schools assigned to this teacher from teacher_schools
        const { data: teacherSchools, error: tsError } = await supabase
          .from('teacher_schools')
          .select('school_id, schools(id, name)')
          .eq('teacher_id', currentUser.id);

        if (!tsError && teacherSchools && teacherSchools.length > 0) {
          availableSchools = teacherSchools
            .map((ts: any) => ts.schools)
            .filter(Boolean);
        } else if (currentUser.school_id) {
          // Fallback to teacher's direct school_id
          const { data: directSchool } = await supabase
            .from('schools')
            .select('id, name')
            .eq('id', currentUser.school_id)
            .single();
          if (directSchool) availableSchools = [directSchool];
        }

        // If still no schools found, fallback to all schools so teacher isn't blocked
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

  const pickFile = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'video/*',
          'audio/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];

        // Check file size (max 100MB)
        if (file.size && file.size > 100 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 100MB');
          return;
        }

        await handleFileUpload(file);
      }
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to pick file');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: any) => {
    if (!file) return;

    try {
      console.log('Starting file upload for material:', file);

      // On web, file.file contains the native File object
      let blob: Blob;
      if (Platform.OS === 'web' && file.file) {
        blob = file.file;
      } else {
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Failed to read file: ${response.statusText}`);
        }
        blob = await response.blob();
      }

      const fileExt = file.name ? file.name.split('.').pop() : 'pdf';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `user_${user?.id || 'admin'}/${fileName}`;

      console.log('Uploading to materials bucket:', filePath);

      const { data, error } = await supabase.storage
        .from('materials')
        .upload(filePath, blob, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath);

      setUploadedFile({
        name: file.name || fileName,
        size: file.size || blob.size,
        type: file.mimeType,
        url: publicUrl,
        path: filePath,
        bucket: 'materials',
      });

      showSuccess('File uploaded successfully!');
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Error', `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Required Field', 'Please enter a title for the material');
      return;
    }

    setSaving(true);
    try {
      const materialType = uploadedFile?.type?.includes('video')
        ? 'video'
        : uploadedFile?.type?.includes('image')
        ? 'image'
        : uploadedFile?.type?.includes('audio')
        ? 'audio'
        : 'document';

      const materialData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        subject: formData.subject || 'Physics',
        school_id: selectedSchoolId || null,
        uploaded_by: user.id,
        teacher_id: user.role === 'teacher' ? user.id : null,
        file_path: uploadedFile?.path || null,
        file_url: uploadedFile?.url || null,
        file_name: uploadedFile?.name || null,
        file_size: uploadedFile?.size || null,
        file_type: uploadedFile?.type || null,
        material_type: materialType,
        is_published: true,
      };

      console.log('Inserting material:', materialData);

      const { data, error } = await supabase
        .from('study_materials')
        .insert(materialData)
        .select()
        .single();

      if (error) {
        console.error('Save error from supabase:', error);
        throw error;
      }

      showSuccess('Material created and posted successfully!');
      handleBack();
    } catch (error) {
      console.error('Save error:', error);
      handleError(error, 'Failed to create material');
    } finally {
      setSaving(false);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/materials-list');
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
        <Text style={styles.headerTitle}>Add Material</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* School Selector */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>
            {isAdmin ? 'Select School (Admin):' : 'Select Assigned School:'}
          </Text>
          <Text style={styles.sectionSublabel}>
            {isAdmin 
              ? 'Choose which school receives this material, or select All Schools'
              : 'Choose which of your assigned schools can view this material'}
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
                  All Schools (Global)
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
          label="Title *"
          value={formData.title}
          onChangeText={(value) => setFormData(prev => ({ ...prev, title: value }))}
          placeholder="e.g., Electromagnetic Waves Chapter 3"
        />

        {/* Description */}
        <Input
          label="Description"
          value={formData.description}
          onChangeText={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder="Summary, notes, or instructions for students..."
          multiline
          numberOfLines={3}
        />
        {/* File Upload Section */}
        <View style={styles.uploadSection}>
          <Text style={styles.uploadLabel}>Material File (PDF, Video, Images, Docs)</Text>
          
          {uploadedFile ? (
            <View style={styles.uploadedFileCard}>
              <View style={styles.fileIconBox}>
                <Ionicons name="document-text" size={24} color={Colors.primary} />
              </View>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>{uploadedFile.name}</Text>
                <Text style={styles.fileSize}>{formatFileSize(uploadedFile.size)}</Text>
              </View>
              <TouchableOpacity onPress={removeFile} style={styles.removeFileBtn}>
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.dropZone} 
              onPress={pickFile}
              disabled={uploading}
            >
              <Ionicons 
                name={uploading ? "cloud-upload" : "cloud-upload-outline"} 
                size={40} 
                color={Colors.primary} 
              />
              <Text style={styles.dropZoneText}>
                {uploading ? 'Uploading File...' : 'Tap to Pick & Upload File'}
              </Text>
              <Text style={styles.dropZoneSubtext}>
                Supports PDF, Word, PowerPoint, MP4 videos, and images up to 100MB
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Button
          title={saving ? "Saving Material..." : "Post Material"}
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  sectionSublabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
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
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
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
    backgroundColor: Colors.primary + '15',
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
  submitBtn: {
    marginBottom: Spacing.xxxl,
  },
});