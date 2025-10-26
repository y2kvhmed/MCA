import { supabase } from './supabase';

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

// Simple file upload that works
export const uploadFile = async (
  file: File,
  bucket: string,
  folder?: string
): Promise<UploadResult> => {
  try {
    console.log('Starting file upload:', { fileName: file.name, bucket, size: file.size });
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    console.log('Uploading to path:', filePath);

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('Generated public URL:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      path: filePath
    };
  } catch (error) {
    console.error('File upload exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

// Upload material file
export const uploadMaterial = async (file: File, userId: string): Promise<UploadResult> => {
  return uploadFile(file, 'materials', `user_${userId}`);
};

// Upload recording file
export const uploadRecording = async (file: File, userId: string): Promise<UploadResult> => {
  return uploadFile(file, 'recordings', `user_${userId}`);
};

// Upload submission file
export const uploadSubmission = async (file: File, studentId: string, assignmentId: string): Promise<UploadResult> => {
  return uploadFile(file, 'submissions', `assignment_${assignmentId}/student_${studentId}`);
};

// Delete file
export const deleteFile = async (bucket: string, path: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('File delete exception:', error);
    return false;
  }
};

// Get file URL
export const getFileUrl = (bucket: string, path: string): string => {
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return publicUrl;
};

// Validate file
export const validateFile = (file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/avi',
    'video/mov'
  ];

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not supported' };
  }

  return { valid: true };
};