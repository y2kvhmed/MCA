import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface DragDropUploadProps {
  onFilesSelected: (files: any[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizeMB?: number;
  title?: string;
  subtitle?: string;
  multiple?: boolean;
  showPreview?: boolean;
  onUploadProgress?: (progress: number) => void;
  disabled?: boolean;
}

export default function DragDropUpload({
  onFilesSelected,
  acceptedTypes = ['application/pdf', 'image/*', 'application/msword', 'video/*', 'text/*'],
  maxFiles = 10,
  maxSizeMB = 50,
  title = 'Drop files here or click to browse',
  subtitle = 'PDF, Images, Videos, Documents up to 50MB each',
  multiple = true,
  showPreview = true,
  onUploadProgress,
  disabled = false,
}: DragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animateScale = (scale: number) => {
    Animated.spring(scaleAnim, {
      toValue: scale,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const animateOpacity = (opacity: number) => {
    Animated.timing(opacityAnim, {
      toValue: opacity,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleDragEnter = (e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
      animateScale(1.05);
      animateOpacity(0.8);
    }
  };

  const handleDragLeave = (e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      animateScale(1);
      animateOpacity(1);
    }
  };

  const handleDragOver = (e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleDrop = (e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      animateScale(1);
      animateOpacity(1);

      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    }
  };

  const processFiles = (files: any[]) => {
    const validFiles = files.filter((file) => {
      // Check file type
      const isValidType = acceptedTypes.some(type => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(baseType);
        }
        return file.type === type;
      });

      // Check file size
      const isValidSize = file.size <= maxSizeMB * 1024 * 1024;

      if (!isValidType) {
        console.warn(`File ${file.name} has unsupported type: ${file.type}`);
      }
      if (!isValidSize) {
        console.warn(`File ${file.name} is too large: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      return isValidType && isValidSize;
    });

    const filesToProcess = multiple ? validFiles.slice(0, maxFiles) : [validFiles[0]];
    const finalFiles = filesToProcess.filter(Boolean);
    
    if (showPreview) {
      setSelectedFiles(prev => [...prev, ...finalFiles]);
    }
    
    onFilesSelected(finalFiles);
    
    // Simulate upload progress
    if (onUploadProgress && finalFiles.length > 0) {
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 100);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: any): string => {
    if (!file.type) return 'document-outline';
    
    if (file.type.startsWith('image/')) return 'image-outline';
    if (file.type.startsWith('video/')) return 'videocam-outline';
    if (file.type.startsWith('audio/')) return 'musical-notes-outline';
    if (file.type.includes('pdf')) return 'document-text-outline';
    if (file.type.includes('word') || file.type.includes('document')) return 'document-outline';
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'grid-outline';
    if (file.type.includes('presentation') || file.type.includes('powerpoint')) return 'easel-outline';
    if (file.type.includes('zip') || file.type.includes('rar')) return 'archive-outline';
    
    return 'document-outline';
  };

  const handleBrowseFiles = async () => {
    try {
      setIsUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: acceptedTypes,
        copyToCacheDirectory: true,
        multiple,
      });

      if (!result.canceled) {
        const files = multiple ? result.assets : [result.assets[0]];
        processFiles(files);
      }
    } catch (error) {
      console.error('File picker error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const webProps = Platform.OS === 'web' ? {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } : {};

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          isDragOver && styles.dragOver,
          disabled && styles.disabled,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
        {...webProps}
      >
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={handleBrowseFiles}
          disabled={isUploading || disabled}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons
              name={isUploading ? "hourglass" : isDragOver ? "cloud-done" : "cloud-upload"}
              size={48}
              color={isDragOver ? Colors.success : disabled ? Colors.text.disabled : Colors.primary}
            />
          </View>
          
          <Text style={[styles.title, isDragOver && styles.dragOverText, disabled && styles.disabledText]}>
            {isUploading ? 'Processing...' : isDragOver ? 'Drop files here!' : title}
          </Text>
          
          <Text style={[styles.subtitle, disabled && styles.disabledText]}>{subtitle}</Text>
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{uploadProgress}%</Text>
            </View>
          )}
          
          <View style={styles.features}>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.featureText}>Up to {maxFiles} files</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              <Text style={styles.featureText}>Secure upload</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="flash" size={16} color={Colors.success} />
              <Text style={styles.featureText}>Fast processing</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {showPreview && selectedFiles.length > 0 && (
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>
              Selected Files ({selectedFiles.length})
            </Text>
            <TouchableOpacity onPress={clearAllFiles} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          
          {selectedFiles.map((file, index) => (
            <View key={`${file.name}-${index}`} style={styles.fileItem}>
              <Ionicons 
                name={getFileIcon(file) as any} 
                size={24} 
                color={Colors.primary} 
                style={styles.fileIcon}
              />
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileSize}>
                  {formatFileSize(file.size)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeFile(index)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  container: {
    marginBottom: Spacing.md,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: Colors.border.medium,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    backgroundColor: Colors.card.background,
    minHeight: 200,
    justifyContent: 'center',
  },
  dragOver: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '10',
  },
  disabled: {
    opacity: 0.6,
    borderColor: Colors.border.light,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  dragOverText: {
    color: Colors.success,
  },
  disabledText: {
    color: Colors.text.disabled,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  progressBar: {
    width: '80%',
    height: 6,
    backgroundColor: Colors.border.light,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
  },
  featureText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  previewContainer: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    backgroundColor: Colors.error + '10',
  },
  clearText: {
    fontSize: 12,
    color: Colors.error,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  fileIcon: {
    marginRight: Spacing.md,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  removeButton: {
    padding: Spacing.xs,
  },
});