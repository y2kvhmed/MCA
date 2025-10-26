import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
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
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: 'Physics',
    grade_level: '',
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);
    } catch (error) {
      handleError(error, 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'video/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        
        // Check file size (max 50MB)
        if (file.size && file.size > 50 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 50MB');
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
      
      // Read file as blob for React Native
      const response = await fetch(file.uri);
      if (!response.ok) {
        throw new Error(`Failed to read file: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `user_${user.id}/${fileName}`;

      console.log('Uploading to materials bucket:', filePath);

      // Upload to materials bucket
      const { data, error } = await supabase.storage
        .from('materials')
        .upload(filePath, blob, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath);

      console.log('Generated public URL:', publicUrl);

      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.mimeType,
        url: publicUrl,
        path: filePath,
        bucket: 'materials'
      });

      showSuccess('File uploaded successfully!');
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Error', `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!user?.school_id) {
      Alert.alert('Error', 'No school assigned to user');
      return;
    }

    setSaving(true);
    try {
      const materialData = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        grade_level: formData.grade_level || null,
        school_id: user.school_id,
        uploaded_by: user.id,
        file_path: uploadedFile?.path || null,
        file_url: uploadedFile?.url || null,
        file_name: uploadedFile?.name || null,
        file_size: uploadedFile?.size || null,
        material_type: uploadedFile?.type?.includes('video') ? 'video' : 
                      uploadedFile?.type?.includes('image') ? 'image' : 'document',
        is_published: true,
        is_downloadable: true,
      };

      const { data, error } = await supabase
        .from('study_materials')
        .insert(materialData)
        .select()
        .single();

      if (error) throw error;

      showSuccess('Material created successfully!');
      router.back();
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Material</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Input
          label="Title *"
          value={formData.title}
          onChangeText={(value) => setFormData(prev => ({ ...prev, title: value }))}
          placeholder="Enter material title"
        />

        <Input
          label="Description"
          value={formData.description}
          onChangeText={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder="Enter material description"
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />

        <Input
          label="Grade Level"
          value={formData.grade_level}
          onChangeText={(value) => setFormData(prev => ({ ...prev, grade_level: value }))}
          placeholder="e.g., Grade 9, Grade 10"
        />

        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Upload File</Text>
          
          {!uploadedFile ? (
            <TouchableOpacity 
              style={styles.uploadButton} 
              onPress={pickFile}
              disabled={uploading}
            >
              <Ionicons 
                name={uploading ? "hourglass" : "cloud-upload"} 
                size={32} 
                color={Colors.primary} 
              />
              <Text style={styles.uploadText}>
                {uploading ? 'Uploading...' : 'Tap to select file'}
              </Text>
              <Text style={styles.uploadSubtext}>
                PDF, Images, Videos, Documents up to 50MB
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.uploadedFile}>
              <View style={styles.fileInfo}>
                <Ionicons name="document" size={24} color={Colors.primary} />
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName}>{uploadedFile.name}</Text>
                  <Text style={styles.fileSize}>{formatFileSize(uploadedFile.size)}</Text>
                </View>
                <TouchableOpacity onPress={removeFile} style={styles.removeButton}>
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
              <View style={styles.uploadSuccess}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.successText}>File uploaded successfully!</Text>
              </View>
            </View>
          )}
        </View>

        <Button
          title="Create Material"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  uploadSection: {
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  uploadButton: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  uploadSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  uploadedFile: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  fileDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  uploadSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    fontSize: 14,
    color: Colors.success,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
});