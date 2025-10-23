import { supabase } from './supabase';
import { handleError } from './utils';
import { getLessonById, updateLesson, softDeleteLesson } from './database';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface Recording {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  video_path?: string;
  duration_minutes?: number;
  school_id: string;
  teacher_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  last_edited_by?: string;
  edit_count?: number;
  
  // Relations
  school?: any;
  teacher?: any;
}

export interface RecordingFormData {
  title: string;
  description: string;
  video_path?: string;
  video_file?: any;
  duration_minutes?: number;
  tags?: string[];
  visibility?: 'public' | 'school' | 'private';
}

export interface VideoUploadResult {
  success: boolean;
  videoPath?: string;
  error?: string;
}

export interface RecordingDependency {
  type: 'assignment' | 'lesson_plan' | 'material';
  id: string;
  title: string;
}

// Upload video to Supabase storage
export async function uploadVideoToSupabase(
  videoUri: string,
  fileName: string,
  schoolId: string
): Promise<VideoUploadResult> {
  try {
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop() || 'mp4';
    const uniqueFileName = `${schoolId}/${timestamp}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.${fileExtension}`;
    
    let videoData: any;
    
    if (Platform.OS === 'web') {
      const response = await fetch(videoUri);
      videoData = await response.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      videoData = bytes.buffer;
    }
    
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(uniqueFileName, videoData, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'video/mp4'
      });

    if (error) {
      console.error('Video upload error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      videoPath: data.path 
    };
  } catch (error) {
    console.error('Video upload exception:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

// Upload image to Supabase storage
export async function uploadImageToSupabase(
  imageUri: string,
  fileName: string,
  schoolId: string
): Promise<VideoUploadResult> {
  try {
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${schoolId}/images/${timestamp}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.${fileExtension}`;
    
    let imageData: any;
    
    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      imageData = await response.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageData = bytes.buffer;
    }
    
    const { data, error } = await supabase.storage
      .from('submissions')
      .upload(uniqueFileName, imageData, {
        cacheControl: '3600',
        upsert: false,
        contentType: `image/${fileExtension}`
      });

    if (error) {
      console.error('Image upload error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      videoPath: data.path 
    };
  } catch (error) {
    console.error('Image upload exception:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

// Upload file to Supabase storage
export async function uploadFileToSupabase(
  fileUri: string,
  fileName: string,
  schoolId: string,
  contentType: string = 'application/octet-stream'
): Promise<VideoUploadResult> {
  try {
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop() || 'file';
    const uniqueFileName = `${schoolId}/files/${timestamp}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.${fileExtension}`;
    
    let fileData: any;
    
    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      fileData = await response.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes.buffer;
    }
    
    const { data, error } = await supabase.storage
      .from('submissions')
      .upload(uniqueFileName, fileData, {
        cacheControl: '3600',
        upsert: false,
        contentType
      });

    if (error) {
      console.error('File upload error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      videoPath: data.path 
    };
  } catch (error) {
    console.error('File upload exception:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

// Get secure signed URL for video
export async function getSecureVideoUrl(videoPath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(videoPath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting video URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error getting video URL:', error);
    return null;
  }
}

// Get secure signed URL for files
export async function getSecureFileUrl(filePath: string, bucket: string = 'submissions'): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting file URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error getting file URL:', error);
    return null;
  }
}

// Delete video from Supabase storage
export async function deleteVideoFromSupabase(videoPath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('videos')
      .remove([videoPath]);

    if (error) {
      console.error('Video deletion error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Video deletion exception:', error);
    return false;
  }
}

// Delete file from Supabase storage
export async function deleteFileFromSupabase(filePath: string, bucket: string = 'submissions'): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('File deletion error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('File deletion exception:', error);
    return false;
  }
}

// Get recording by ID with full details
export async function getRecordingById(recordingId: string) {
  try {
    return await getLessonById(recordingId);
  } catch (error) {
    console.error('Get recording error:', error);
    return { data: null, error };
  }
}

// Update recording
export async function updateRecording(
  recordingId: string, 
  formData: RecordingFormData, 
  userId: string
) {
  try {
    // First, get current data for audit log
    const { data: currentData } = await getRecordingById(recordingId);
    
    const updateData = {
      title: formData.title,
      description: formData.description,
      video_path: formData.video_path,
      duration_minutes: formData.duration_minutes,
      last_edited_by: userId,
    };

    const { data, error } = await updateLesson(recordingId, updateData);

    if (error) throw error;

    // Log the update action
    await logRecordingAction(recordingId, userId, 'update', currentData, updateData);

    return { data, error: null };
  } catch (error) {
    console.error('Update recording error:', error);
    return { data: null, error };
  }
}

// Soft delete recording
export async function deleteRecording(recordingId: string, userId: string) {
  try {
    // First, get current data for audit log
    const { data: currentData } = await getRecordingById(recordingId);
    
    // Check for dependencies
    const dependencies = await getRecordingDependencies(recordingId);
    
    const { data, error } = await softDeleteLesson(recordingId, userId);

    if (error) throw error;

    // Log the delete action
    await logRecordingAction(recordingId, userId, 'delete', currentData, { deleted_at: new Date().toISOString() });

    return { data, error: null, dependencies: dependencies.data || [] };
  } catch (error) {
    console.error('Delete recording error:', error);
    return { data: null, error, dependencies: [] };
  }
}

// Get recording dependencies (assignments that reference this recording)
export async function getRecordingDependencies(recordingId: string) {
  try {
    const dependencies: RecordingDependency[] = [];

    // Check assignments that reference this recording in video_path
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, title')
      .ilike('video_path', `%${recordingId}%`);

    if (assignments) {
      dependencies.push(...assignments.map(a => ({
        type: 'assignment' as const,
        id: a.id,
        title: a.title,
      })));
    }

    // Check study_materials that reference this recording
    const { data: studyMaterials } = await supabase
      .from('study_materials')
      .select('id, title')
      .or(`file_url.ilike.%${recordingId}%,description.ilike.%${recordingId}%`);

    if (studyMaterials) {
      dependencies.push(...studyMaterials.map(m => ({
        type: 'material' as const,
        id: m.id,
        title: m.title,
      })));
    }

    return { data: dependencies, error: null };
  } catch (error) {
    console.error('Get dependencies error:', error);
    return { data: [], error };
  }
}

// Log recording management actions for audit trail
async function logRecordingAction(
  recordingId: string,
  userId: string,
  action: string,
  oldValues: any,
  newValues: any
) {
  try {
    // Only log if the audit table exists (after migration)
    const { error } = await supabase
      .from('recording_audit_log')
      .insert({
        recording_id: recordingId,
        user_id: userId,
        action,
        old_values: oldValues,
        new_values: newValues,
      });
    
    if (error) {
      console.warn('Audit log warning (table may not exist yet):', error.message);
    }
  } catch (error) {
    console.warn('Audit log error (table may not exist yet):', error);
    // Don't throw - audit logging shouldn't break the main operation
  }
}

// Validate recording form data
export function validateRecordingForm(formData: RecordingFormData): string[] {
  const errors: string[] = [];

  if (!formData.title || formData.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (formData.title && formData.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if (formData.description && formData.description.length > 2000) {
    errors.push('Description must be less than 2000 characters');
  }

  if (formData.video_path && formData.video_path.length > 500) {
    errors.push('Video path is too long');
  }

  if (formData.duration_minutes && (formData.duration_minutes < 1 || formData.duration_minutes > 600)) {
    errors.push('Duration must be between 1 and 600 minutes');
  }

  return errors;
}

// Check if video path is valid
function isValidVideoPath(path: string): boolean {
  return path && path.length > 0 && path.length < 500;
}

// Check if user can edit recording
export function canEditRecording(recording: any, user: any): boolean {
  if (!user || !recording) return false;
  
  // Admins can edit any recording
  if (user.role === 'admin') return true;
  
  // Teachers can edit recordings from their school or recordings they created
  if (user.role === 'teacher') {
    return user.school_id === recording.school_id || user.id === recording.teacher_id;
  }
  
  return false;
}

// Check if user can delete recording
export function canDeleteRecording(recording: any, user: any): boolean {
  if (!user || !recording) return false;
  
  // Admins can delete any recording
  if (user.role === 'admin') return true;
  
  // Teachers can delete recordings from their school or recordings they created
  if (user.role === 'teacher') {
    return user.school_id === recording.school_id || user.id === recording.teacher_id;
  }
  
  return false;
}