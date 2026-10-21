import { supabase } from './supabase';

// Enhanced file upload service for Supabase
export class SupabaseFileUpload {
  
  // Upload file to specific bucket
  static async uploadFile(
    bucket: string,
    file: File | Blob,
    path: string,
    options?: {
      cacheControl?: string;
      contentType?: string;
      upsert?: boolean;
    }
  ) {
    try {
      console.log(`[Upload] Uploading file to ${bucket}/${path}`);
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: options?.cacheControl || '3600',
          contentType: options?.contentType || file.type,
          upsert: options?.upsert || false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      console.log('[Upload] File uploaded successfully:', data.path);
      return { data, error: null };
    } catch (error: any) {
      console.error('[Upload] Upload failed:', error);
      return { data: null, error: error?.message || 'Upload failed' };
    }
  }

  // Upload assignment submission
  static async uploadSubmission(
    studentId: string,
    assignmentId: string,
    file: File,
    fileName?: string
  ) {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const sanitizedFileName = fileName || file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${studentId}/${assignmentId}_${timestamp}.${fileExtension}`;

    const result = await this.uploadFile('submissions', file, path, {
      contentType: file.type
    });

    if (result.data) {
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('submissions')
        .getPublicUrl(path);

      return {
        ...result,
        publicUrl,
        fileName: sanitizedFileName,
        fileSize: file.size,
        fileType: file.type
      };
    }

    return result;
  }

  // Upload study material
  static async uploadStudyMaterial(
    teacherId: string,
    classId: string,
    file: File,
    materialType: 'document' | 'video' | 'audio' | 'image' = 'document'
  ) {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    let bucket = 'study-materials';
    if (materialType === 'video') bucket = 'videos';
    if (materialType === 'audio') bucket = 'audio';

    const path = `${teacherId}/${classId}/${timestamp}_${sanitizedFileName}`;

    const result = await this.uploadFile(bucket, file, path, {
      contentType: file.type
    });

    if (result.data) {
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return {
        ...result,
        publicUrl,
        fileName: sanitizedFileName,
        fileSize: file.size,
        fileType: file.type,
        contentType: materialType
      };
    }

    return result;
  }

  // Upload assignment file (by teacher)
  static async uploadAssignmentFile(
    teacherId: string,
    assignmentId: string,
    file: File
  ) {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${teacherId}/${assignmentId}_${timestamp}.${fileExtension}`;

    const result = await this.uploadFile('assignments', file, path, {
      contentType: file.type
    });

    if (result.data) {
      const { data: { publicUrl } } = supabase.storage
        .from('assignments')
        .getPublicUrl(path);

      return {
        ...result,
        publicUrl,
        fileName: sanitizedFileName,
        fileSize: file.size,
        fileType: file.type
      };
    }

    return result;
  }

  // Upload user avatar
  static async uploadAvatar(userId: string, file: File) {
    const fileExtension = file.name.split('.').pop();
    const path = `${userId}/avatar.${fileExtension}`;

    const result = await this.uploadFile('avatars', file, path, {
      contentType: file.type,
      upsert: true // Allow overwriting existing avatar
    });

    if (result.data) {
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      return {
        ...result,
        publicUrl,
        fileName: `avatar.${fileExtension}`,
        fileSize: file.size,
        fileType: file.type
      };
    }

    return result;
  }

  // Upload message attachment
  static async uploadMessageAttachment(
    senderId: string,
    messageId: string,
    file: File
  ) {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${senderId}/${messageId}_${timestamp}_${sanitizedFileName}`;

    const result = await this.uploadFile('message-attachments', file, path, {
      contentType: file.type
    });

    if (result.data) {
      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(path);

      return {
        ...result,
        publicUrl,
        fileName: sanitizedFileName,
        fileSize: file.size,
        fileType: file.type
      };
    }

    return result;
  }

  // Get signed URL for private files
  static async getSignedUrl(bucket: string, path: string, expiresIn: number = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error?.message || 'Failed to create signed URL' };
    }
  }

  // Delete file
  static async deleteFile(bucket: string, path: string) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error?.message || 'Failed to delete file' };
    }
  }

  // List files in bucket
  static async listFiles(bucket: string, folder?: string, limit?: number) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder || '', {
          limit: limit || 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error?.message || 'Failed to list files' };
    }
  }

  // Validate file before upload
  static validateFile(
    file: File,
    maxSize: number = 50 * 1024 * 1024, // 50MB default
    allowedTypes: string[] = []
  ): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`
      };
    }

    // Check file type if specified
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    return { valid: true };
  }

  // Get file info
  static async getFileInfo(bucket: string, path: string) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list('', {
          search: path
        });

      if (error) throw error;

      const fileInfo = data.find(file => file.name === path.split('/').pop());
      return { data: fileInfo, error: null };
    } catch (error: any) {
      return { data: null, error: error?.message || 'Failed to get file info' };
    }
  }

  // Generate thumbnail for images/videos (placeholder for future implementation)
  static async generateThumbnail(bucket: string, path: string) {
    // This would integrate with image processing service
    // For now, return the original file URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  }
}

// Helper functions for common file operations
export const FileUploadHelpers = {
  // Format file size for display
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Get file extension
  getFileExtension: (fileName: string): string => {
    return fileName.split('.').pop()?.toLowerCase() || '';
  },

  // Check if file is image
  isImage: (fileType: string): boolean => {
    return fileType.startsWith('image/');
  },

  // Check if file is video
  isVideo: (fileType: string): boolean => {
    return fileType.startsWith('video/');
  },

  // Check if file is audio
  isAudio: (fileType: string): boolean => {
    return fileType.startsWith('audio/');
  },

  // Check if file is document
  isDocument: (fileType: string): boolean => {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];
    return documentTypes.includes(fileType);
  },

  // Generate unique file name
  generateUniqueFileName: (originalName: string, prefix?: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    const baseName = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_');
    
    return `${prefix ? prefix + '_' : ''}${baseName}_${timestamp}_${random}.${extension}`;
  }
};

export default SupabaseFileUpload;