import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from './Input';
import Button from './Button';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { RecordingFormData, validateRecordingForm } from '../lib/recordingService';
import { useToast } from '../contexts/ToastContext';

interface RecordingEditFormProps {
  initialData?: Partial<RecordingFormData>;
  onSave: (data: RecordingFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEditing?: boolean;
}

export default function RecordingEditForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
  isEditing = false,
}: RecordingEditFormProps) {
  const { showError, showWarning } = useToast();
  const [formData, setFormData] = useState<RecordingFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    video_url: initialData?.video_url || '',
    duration_minutes: initialData?.duration_minutes || undefined,
    tags: initialData?.tags || [],
    visibility: initialData?.visibility || 'school',
  });
  
  const [errors, setErrors] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    // Check for unsaved changes
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData || {});
    setHasUnsavedChanges(hasChanges);
  }, [formData, initialData]);

  const handleInputChange = (field: keyof RecordingFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSave = async () => {
    // Validate form
    const validationErrors = validateRecordingForm(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      showError('Please fix the form errors before saving');
      return;
    }

    try {
      await onSave(formData);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to cancel?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard Changes', style: 'destructive', onPress: onCancel },
        ]
      );
    } else {
      onCancel();
    }
  };

  const extractVideoId = (url: string): string => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  };

  const videoId = formData.video_url ? extractVideoId(formData.video_url) : '';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons 
            name={isEditing ? "create" : "add-circle"} 
            size={24} 
            color={Colors.primary} 
          />
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Recording' : 'Add Recording'}
          </Text>
        </View>

        {/* Error Messages */}
        {errors.length > 0 && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <View style={styles.errorMessages}>
              {errors.map((error, index) => (
                <Text key={index} style={styles.errorText}>• {error}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Title Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Title *</Text>
          <Input
            value={formData.title}
            onChangeText={(value) => handleInputChange('title', value)}
            placeholder="Enter recording title"
            maxLength={200}
            style={styles.input}
          />
          <Text style={styles.characterCount}>
            {formData.title.length}/200 characters
          </Text>
        </View>

        {/* Description Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description</Text>
          <Input
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder="Enter recording description"
            multiline
            numberOfLines={4}
            maxLength={2000}
            style={[styles.input, styles.textArea]}
          />
          <Text style={styles.characterCount}>
            {formData.description.length}/2000 characters
          </Text>
        </View>

        {/* Video URL Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>YouTube URL</Text>
          <Input
            value={formData.video_url}
            onChangeText={(value) => handleInputChange('video_url', value)}
            placeholder="https://www.youtube.com/watch?v=..."
            keyboardType="url"
            autoCapitalize="none"
            style={styles.input}
          />
          
          {/* Video Preview */}
          {videoId && (
            <View style={styles.videoPreview}>
              <Text style={styles.previewLabel}>Preview:</Text>
              <View style={styles.thumbnailContainer}>
                <Text style={styles.videoIdText}>Video ID: {videoId}</Text>
                <Ionicons name="videocam" size={24} color={Colors.primary} />
              </View>
            </View>
          )}
        </View>

        {/* Duration Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Duration (minutes)</Text>
          <Input
            value={formData.duration_minutes?.toString() || ''}
            onChangeText={(value) => {
              const numValue = parseInt(value) || undefined;
              handleInputChange('duration_minutes', numValue);
            }}
            placeholder="Enter duration in minutes"
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Cancel"
            onPress={handleCancel}
            variant="outline"
            style={styles.cancelButton}
            disabled={isLoading}
          />
          <Button
            title={isEditing ? 'Save Changes' : 'Create Recording'}
            onPress={handleSave}
            loading={isLoading}
            style={styles.saveButton}
            disabled={!formData.title.trim()}
          />
        </View>

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <View style={styles.unsavedIndicator}>
            <Ionicons name="warning" size={16} color={Colors.warning} />
            <Text style={styles.unsavedText}>You have unsaved changes</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  form: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.error + '10',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorMessages: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  input: {
    marginBottom: Spacing.xs,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  videoPreview: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  thumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoIdText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
  unsavedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.sm,
    backgroundColor: Colors.warning + '10',
    borderRadius: 8,
  },
  unsavedText: {
    fontSize: 12,
    color: Colors.warning,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
});