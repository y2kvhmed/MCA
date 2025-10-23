import { supabase } from './supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// File upload configuration
export const FILE_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain'
  ],
  buckets: {
    assignments: 'assignment-submissions',
    profiles: 'user-profiles',
    lessons: 'lesson-materials',
    general: 'general-files'
  }
};

// File validation
export function validateFile(file: any): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  if (file.size > FILE_CONFIG.maxSizeBytes) {
    return { 
      isValid: false, 
      error: `File size must be less than ${FILE_CONFIG.maxSizeBytes / (1024 * 1024)}MB` 
    };
  }

  if (!FILE_CONFIG.allowedTypes.includes(file.mimeType || file.type)) {
    return { 
      isValid: false, 
      error: 'File type not allowed. Please upload PDF, Word, or image files.' 
    };
  }

  return { isValid: true };
}

// Generate unique file path
export function generateFilePath(
  bucket: string, 
  userId: string, 
  originalName: string,
  prefix?: string
): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  const fileName = `${timestamp}_${randomId}_${sanitizedName}`;
  const path = prefix ? `${prefix}/${userId}/${fileName}` : `${userId}/${fileName}`;
  
  return path;
}

// Upload file to Supabase Storage
export async function uploadFileToSupabase(
  file: any,
  bucket: string,
  filePath: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    let fileData: ArrayBuffer;

    if (typeof window !== 'undefined') {
      // Web: file is already a File object
      fileData = await file.arrayBuffer();
    } else {
      // Mobile: read file using FileSystem
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });
      fileData = decode(base64);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileData, {
        contentType: file.mimeType || file.type,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return { 
      success: true, 
      data: {
        path: data.path,
        fullPath: data.fullPath,
        publicUrl: urlData.publicUrl
      }
    };
  } catch (error) {
    console.error('File upload error:', error);
    return { success: false, error: 'Failed to upload file' };
  }
}

// Submit assignment with file upload
export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  file: any,
  additionalData?: {
    comments?: string;
    attemptNumber?: number;
  }
): Promise<{ success: boolean; submissionId?: string; error?: string }> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Check if assignment exists and is still accepting submissions
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, due_date, allow_late_submission, max_attempts')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      return { success: false, error: 'Assignment not found' };
    }

    // Check if due date has passed
    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    const isLate = now > dueDate;

    if (isLate && !assignment.allow_late_submission) {
      return { success: false, error: 'Assignment submission deadline has passed' };
    }

    // Check existing submissions count
    const { data: existingSubmissions, error: submissionError } = await supabase
      .from('submissions')
      .select('id, attempt_number')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId);

    if (submissionError) {
      return { success: false, error: 'Failed to check existing submissions' };
    }

    const attemptNumber = (existingSubmissions?.length || 0) + 1;
    
    if (assignment.max_attempts && attemptNumber > assignment.max_attempts) {
      return { success: false, error: `Maximum ${assignment.max_attempts} attempts allowed` };
    }

    // Generate file path
    const filePath = generateFilePath(
      FILE_CONFIG.buckets.assignments,
      studentId,
      file.name,
      `assignment_${assignmentId}`
    );

    // Upload file to Supabase Storage
    const uploadResult = await uploadFileToSupabase(
      file,
      FILE_CONFIG.buckets.assignments,
      filePath
    );

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    // Calculate late submission details
    const lateByHours = isLate ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60)) : 0;

    // Create submission record
    const submissionData = {
      assignment_id: assignmentId,
      student_id: studentId,
      file_path: uploadResult.data!.path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.mimeType || file.type,
      file_url: uploadResult.data!.publicUrl,
      submitted_at: now.toISOString(),
      status: isLate ? 'late' : 'submitted',
      attempt_number: attemptNumber,
      is_late: isLate,
      late_by_hours: lateByHours,
      metadata: {
        comments: additionalData?.comments,
        upload_method: typeof window !== 'undefined' ? 'web' : 'mobile',
        original_filename: file.name,
        ...additionalData
      }
    };

    const { data: submission, error: insertError } = await supabase
      .from('submissions')
      .insert(submissionData)
      .select('id')
      .single();

    if (insertError) {
      // If submission creation fails, clean up uploaded file
      await supabase.storage
        .from(FILE_CONFIG.buckets.assignments)
        .remove([filePath]);
      
      return { success: false, error: 'Failed to create submission record' };
    }

    // Update assignment submission count
    await supabase.rpc('increment_submission_count', { 
      assignment_id: assignmentId 
    });

    // Create file metadata record
    await supabase.from('file_metadata').insert({
      file_path: uploadResult.data!.path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.mimeType || file.type,
      mime_type: file.mimeType || file.type,
      file_extension: file.name.split('.').pop(),
      uploaded_by: studentId,
      entity_type: 'submission',
      entity_id: submission.id,
      bucket_name: FILE_CONFIG.buckets.assignments,
      is_public: false
    });

    return { 
      success: true, 
      submissionId: submission.id 
    };

  } catch (error) {
    console.error('Assignment submission error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// Pick and validate file (cross-platform)
export async function pickAssignmentFile(): Promise<{ success: boolean; file?: any; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      // Web: Use HTML file input
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = FILE_CONFIG.allowedTypes.join(',');
        
        input.onchange = (event: any) => {
          const file = event.target.files[0];
          if (file) {
            const validation = validateFile(file);
            if (validation.isValid) {
              resolve({ success: true, file });
            } else {
              resolve({ success: false, error: validation.error });
            }
          } else {
            resolve({ success: false, error: 'No file selected' });
          }
        };
        
        input.click();
      });
    } else {
      // Mobile: Use DocumentPicker
      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_CONFIG.allowedTypes,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return { success: false, error: 'File selection cancelled' };
      }

      const file = result.assets[0];
      const validation = validateFile(file);
      
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      return { success: true, file };
    }
  } catch (error) {
    console.error('File picker error:', error);
    return { success: false, error: 'Failed to pick file' };
  }
}

// Download file from Supabase Storage
export async function downloadFile(
  bucket: string,
  filePath: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      return { success: false, error: error.message };
    }

    if (typeof window !== 'undefined') {
      // Web: Trigger download
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Mobile: Save to device (would need expo-file-system)
      console.log('Mobile download not implemented yet');
    }

    return { success: true };
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: 'Failed to download file' };
  }
}

// Get file public URL
export function getFilePublicUrl(bucket: string, filePath: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

// Delete file from storage
export async function deleteFile(
  bucket: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    return { success: false, error: 'Failed to delete file' };
  }
}

// Get submission with file details
export async function getSubmissionWithFile(submissionId: string) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(title, due_date, max_score),
        student:app_users!submissions_student_id_fkey(name, email),
        graded_by_user:app_users!submissions_graded_by_fkey(name)
      `)
      .eq('id', submissionId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Get submission error:', error);
    return { success: false, error: 'Failed to get submission' };
  }
}

// Update file metadata (track downloads, etc.)
export async function updateFileMetadata(
  filePath: string,
  updates: {
    downloadCount?: number;
    lastAccessedAt?: string;
    metadata?: any;
  }
) {
  try {
    const { error } = await supabase
      .from('file_metadata')
      .update(updates)
      .eq('file_path', filePath);

    if (error) {
      console.error('Update file metadata error:', error);
    }
  } catch (error) {
    console.error('Update file metadata error:', error);
  }
}