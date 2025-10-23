import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { getCurrentUser } from '../lib/auth';
import { createAssignment, createMaterial } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import { uploadFileToSupabase, generateFilePath, validateFile } from '../lib/fileUpload';
import DragDropUpload from '../components/DragDropUpload';
import { notifyNewAssignmentToClass } from '../lib/notifications';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import DateTimePicker from '../components/DateTimePicker';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function CreateAssignment() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [maxScore, setMaxScore] = useState('100');
  const [assignmentType, setAssignmentType] = useState('assignment');
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      handleError(error, 'Failed to pick file');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllFiles = () => {
    setSelectedFiles([]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Assignment title is required');
      return;
    }

    // Since we're using school-based system, we don't need class selection anymore

    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setSubmitting(true);
    try {
      let filePath = null;
      let fileName = null;
      let fileSize = null;

      // Upload files if selected (for materials)
      const uploadedFiles: any[] = [];
      if (selectedFiles.length > 0 && assignmentType === 'material') {
        setUploading(true);
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          
          // Validate file first
          const validation = validateFile(file);
          if (!validation.isValid) {
            handleError(null, `${file.name}: ${validation.error}`);
            setUploading(false);
            return;
          }
          
          // Generate file path
          const filePathGenerated = generateFilePath(
            'materials',
            user.id,
            file.name,
            `school_${user.school_id}`
          );
          
          // Upload to Supabase
          const uploadResult = await uploadFileToSupabase(
            file,
            'materials',
            filePathGenerated
          );
          
          if (uploadResult.success) {
            uploadedFiles.push({
              path: uploadResult.data?.path,
              name: file.name,
              size: file.size,
              type: file.type,
            });
          } else {
            handleError(null, `Failed to upload ${file.name}: ${uploadResult.error}`);
            setUploading(false);
            return;
          }
        }
        setUploading(false);
      }

      // For now, store the first file in the main fields (backward compatibility)
      if (uploadedFiles.length > 0) {
        filePath = uploadedFiles[0].path;
        fileName = uploadedFiles[0].name;
        fileSize = uploadedFiles[0].size;
      }

      if (assignmentType === 'material') {
        // Create material in study_materials table
        const materialData = {
          title,
          description,
          uploaded_by: user.id,
          file_path: filePath,
          file_url: uploadedFiles[0]?.publicUrl,
          file_size: fileSize,
          material_type: fileName?.split('.').pop() || 'pdf',
        };

        const { error } = await createMaterial(materialData);
        if (error) {
          throw error;
        }
      } else {
        // Create assignment in assignments table
        const assignmentData = {
          title,
          description,
          instructions,
          teacher_id: user.id,
          assignment_type: assignmentType,
          school_id: user.school_id,
          class_id: null,
          max_score: parseInt(maxScore) || 100,
          due_date: dueDate?.toISOString(),
          file_path: filePath,
          file_name: fileName,
          file_size: fileSize,
        };

        const { error } = await createAssignment(assignmentData);
        if (error) {
          throw error;
        }
      }
      
      if (error) {
        handleError(error, `Failed to create ${assignmentType}`);
      } else {
        const successMessage = assignmentType === 'material' 
          ? 'Material shared with all students successfully'
          : 'Assignment created successfully';
        showSuccess(successMessage);
        
        // Send notification to all students in school
        // TODO: Implement school-wide notifications
        
        router.back();
      }
    } catch (error) {
      handleError(error, 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const assignmentTypes = [
    { value: 'assignment', label: 'Assignment' },
    { value: 'material', label: 'Material' },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Assignment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Input
          label="Assignment Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter assignment title"
        />



        {assignmentType === 'material' && (
          <View style={styles.materialScope}>
            <Ionicons name="school" size={20} color={Colors.primary} />
            <Text style={styles.materialScopeText}>
              This material will be shared with all students in your school
            </Text>
          </View>
        )}

        <Text style={styles.label}>Assignment Type</Text>
        <View style={styles.typeSelector}>
          {assignmentTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeButton,
                assignmentType === type.value && styles.typeButtonSelected,
              ]}
              onPress={() => setAssignmentType(type.value)}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  assignmentType === type.value && styles.typeButtonTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Enter assignment description"
          multiline
          numberOfLines={3}
        />

        <Input
          label="Instructions"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Enter detailed instructions"
          multiline
          numberOfLines={4}
        />

        {assignmentType !== 'material' && (
          <>
            <Input
              label="Max Score"
              value={maxScore}
              onChangeText={setMaxScore}
              placeholder="100"
              keyboardType="numeric"
            />

            <DateTimePicker
              label="Due Date & Time"
              value={dueDate}
              onChange={setDueDate}
              placeholder="Select due date and time"
            />
          </>
        )}

        {assignmentType === 'material' && (
          <>
            <View style={styles.materialInfo}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <Text style={styles.materialInfoText}>
                Materials are shared with all students immediately and don't have due dates.
              </Text>
            </View>

            <DragDropUpload
              onFilesSelected={(files) => setSelectedFiles(prev => [...prev, ...files].slice(0, 5))}
              acceptedTypes={['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
              maxFiles={5}
              maxSizeMB={10}
              title="Drop material files here or click to browse"
              subtitle="PDF, Images, Word documents up to 10MB each (max 5 files)"
              multiple={true}
            />
            
            {selectedFiles.length > 0 && (
              <View style={styles.selectedFilesContainer}>
                <View style={styles.filesHeader}>
                  <Text style={styles.filesTitle}>Selected Files ({selectedFiles.length}/5)</Text>
                  <TouchableOpacity onPress={removeAllFiles} style={styles.clearAllButton}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                
                {selectedFiles.map((file, index) => (
                  <View key={index} style={styles.selectedFileContainer}>
                    <View style={styles.fileInfo}>
                      <Ionicons 
                        name={file.type?.includes('image') ? 'image' : 'document'} 
                        size={20} 
                        color={Colors.success} 
                      />
                      <View style={styles.fileDetails}>
                        <Text style={styles.fileName}>{file.name}</Text>
                        <Text style={styles.fileSize}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.removeFileButton} 
                      onPress={() => removeFile(index)}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Button
          title={uploading ? 'Uploading...' : (assignmentType === 'material' ? 'Share Material' : 'Create Assignment')}
          onPress={handleSubmit}
          loading={submitting || uploading}
          disabled={submitting || uploading}
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

  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.xl,
  },
  typeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  typeButtonSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  typeButtonTextSelected: {
    color: Colors.text.primary,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.card.background,
    marginBottom: Spacing.xl,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  dateValue: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  submitButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  datePickerContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  materialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.info + '20',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  materialInfoText: {
    fontSize: 14,
    color: Colors.info,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  materialScope: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  materialScopeText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: Spacing.sm,
    flex: 1,
    fontWeight: '500',
  },
  fileUploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    marginBottom: Spacing.lg,
  },
  fileUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  fileUploadSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.success + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success,
    marginBottom: Spacing.lg,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  removeFileButton: {
    padding: Spacing.xs,
  },
});