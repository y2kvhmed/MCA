import { supabase } from './supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File as LocalFile } from 'expo-file-system';

// File upload configuration
export const FILE_CONFIG = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB for assignments and student work
  maxMaterialSizeBytes: 100 * 1024 * 1024, // 100MB for study materials
  maxVideoSizeBytes: 1024 * 1024 * 1024, // 1GB for video recordings
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'text/plain',
  ],
  allowedExtensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'txt'],
  // Student submissions: PDF or photos only.
  submissionTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ],
  submissionExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],
  buckets: {
    assignments: 'submissions',
    profiles: 'user-profiles',
    lessons: 'lesson-materials',
    general: 'general-files'
  }
};

// File validation
export function validateFile(
  file: any,
  allowedTypes: string[] = FILE_CONFIG.allowedTypes,
  allowedExtensions: string[] = FILE_CONFIG.allowedExtensions
): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  const size = Number(file.size ?? file.fileSize);
  if (Number.isFinite(size) && size > FILE_CONFIG.maxSizeBytes) {
    return { 
      isValid: false, 
      error: `File size must be less than ${FILE_CONFIG.maxSizeBytes / (1024 * 1024)}MB` 
    };
  }

  const name = file.name || file.fileName || file.uploadSource?.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  const rawType = file.mimeType || file.type || file.uploadSource?.type || '';
  const isMimeAllowed = allowedTypes.includes(rawType);
  const isExtAllowed = ext && allowedExtensions.includes(ext);

  if (!isMimeAllowed && !isExtAllowed) {
    return { 
      isValid: false, 
      error: `File type not allowed (name: "${name}", type: "${rawType}"). Allowed: ${allowedExtensions.join(', ')}.` 
    };
  }

  return { isValid: true };
}

// True when the file is an image (by mime type or extension).
export function isImageFile(file: any): boolean {
  const type = file?.type || file?.mimeType || file?.uploadSource?.type || '';
  const name = file?.name || file?.fileName || file?.uploadSource?.name || '';
  return type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(name);
}

function normalizeSubmissionAsset(asset: any): any {
  const source = asset?.uploadSource || asset;
  const uri = asset?.uri || source?.uri;
  const uriName = typeof uri === 'string' ? uri.split(/[?#]/)[0].split('/').pop() : '';
  const initialName = source?.name || asset?.name || asset?.fileName || uriName;
  const initialExtension = initialName?.split('.').pop()?.toLowerCase();
  const inferredTypeByExtension: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  const type =
    source?.type ||
    asset?.type ||
    asset?.mimeType ||
    inferredTypeByExtension[initialExtension || ''] ||
    '';
  const inferredExtension =
    type === 'image/jpeg' ? 'jpg' :
    type.startsWith('image/') ? type.split('/')[1] :
    type === 'application/pdf' ? 'pdf' : 'bin';
  const name =
    initialName ||
    `submission-${Date.now()}.${inferredExtension}`;
  const rawSize = source?.size ?? asset?.size ?? asset?.fileSize;
  const size = Number.isFinite(Number(rawSize)) ? Number(rawSize) : undefined;

  // Keep native File/Blob instances intact; spreading one drops its byte methods.
  if (
    typeof Blob !== 'undefined' &&
    source instanceof Blob &&
    typeof source.arrayBuffer === 'function'
  ) {
    return {
      uploadSource: source,
      name,
      type,
      mimeType: type,
      size,
      uri,
    };
  }

  return {
    ...asset,
    uploadSource: source,
    name,
    type,
    mimeType: type,
    size,
    uri,
  };
}

async function readSubmissionFile(file: any): Promise<ArrayBuffer> {
  const source = file?.uploadSource || file?.file || file;
  if (source && typeof source.arrayBuffer === 'function') {
    return source.arrayBuffer();
  }

  const uri = source?.uri || file?.uri;
  if (!uri) {
    throw new Error(`The selected file "${file?.name || 'file'}" has no readable URI.`);
  }

  if (typeof window !== 'undefined') {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Could not read the selected file (${response.status}). Please select it again.`);
    }
    return response.arrayBuffer();
  }

  return new LocalFile(uri).arrayBuffer();
}

// Downscale + re-encode a picked photo before upload to keep uploads small.
// Web only (canvas based); a no-op elsewhere or on any failure.
export async function compressImageFile(file: any, maxDimension = 1600, quality = 0.7): Promise<any> {
  try {
    if (typeof window === 'undefined' || !isImageFile(file)) return file;
    if (typeof createImageBitmap !== 'function') return file;

    const bitmap = await createImageBitmap(file);
    const largest = Math.max(bitmap.width, bitmap.height);
    if (largest <= maxDimension) {
      bitmap.close?.();
      return file;
    }

    const scale = maxDimension / largest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) return file;

    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
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
    const fileData = await readSubmissionFile(file);
    if (fileData.byteLength > FILE_CONFIG.maxSizeBytes) {
      return {
        success: false,
        error: `File exceeds the ${FILE_CONFIG.maxSizeBytes / (1024 * 1024)}MB per-file limit.`,
      };
    }

    const name = file?.name || file?.fileName || file?.uploadSource?.name || 'submission';
    const contentType =
      file?.mimeType || file?.type || file?.uploadSource?.type || 'application/octet-stream';

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileData, {
        contentType,
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
        publicUrl: urlData.publicUrl,
        size: fileData.byteLength,
        name,
        type: contentType,
      }
    };
  } catch (error) {
    console.error('File upload error:', error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown file read or storage error';
    return { success: false, error: detail };
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

// Pick and validate files for a submission (multi-select, PDF or photos)
export async function pickAssignmentFiles(): Promise<{ success: boolean; files?: any[]; error?: string }> {
  const types = FILE_CONFIG.submissionTypes;
  const extensions = FILE_CONFIG.submissionExtensions;
  try {
    if (typeof window !== 'undefined') {
      // Web: Use HTML file input
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = types.join(',');
        // Some mobile browsers (Android Chrome / iOS Safari) ignore `click()` on an input
        // that is not attached to the document, so keep it in the DOM but off-screen.
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';

        const finish = (result: { success: boolean; files?: any[]; error?: string }) => {
          if (input.parentNode) input.parentNode.removeChild(input);
          resolve(result);
        };

        input.onchange = (event: any) => {
          const picked: any[] = Array.from(event.target.files || []).map(normalizeSubmissionAsset);
          if (picked.length === 0) {
            finish({ success: false, error: 'No file was selected' });
            return;
          }
          for (const file of picked) {
            const validation = validateFile(file, types, extensions);
            if (!validation.isValid) {
              finish({ success: false, error: validation.error });
              return;
            }
          }
          finish({ success: true, files: picked });
        };

        // Safari 16.4+ / Chrome 113+ fire `cancel` when the picker is dismissed.
        // Older browsers simply never fire anything, which is harmless.
        input.addEventListener('cancel', () => {
          finish({ success: false, error: 'No file was selected' });
        });

        document.body.appendChild(input);
        input.click();
      });
    } else {
      // Mobile: Use DocumentPicker
      const result = await DocumentPicker.getDocumentAsync({
        type: types,
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        return { success: false, error: 'File selection cancelled' };
      }

      const files = (result.assets || []).filter(Boolean).map(normalizeSubmissionAsset);
      if (files.length === 0) {
        return { success: false, error: 'Picker returned no file asset' };
      }
      for (const file of files) {
        const validation = validateFile(file, types, extensions);
        if (!validation.isValid) {
          return { success: false, error: validation.error };
        }
      }

      return { success: true, files };
    }
  } catch (error: any) {
    console.error('File picker error:', error);
    return { success: false, error: `Failed to pick file: ${error?.message || String(error)}` };
  }
}

export async function pickAssignmentImages(): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';

        const finish = (result: { success: boolean; files?: any[]; error?: string }) => {
          input.parentNode?.removeChild(input);
          resolve(result);
        };

        input.onchange = (event: any) => {
          const files = Array.from(event.target.files || []).map(normalizeSubmissionAsset);
          if (!files.length) {
            finish({ success: false, error: 'No photos were selected' });
            return;
          }
          for (const file of files) {
            const validation = validateFile(
              file,
              FILE_CONFIG.submissionTypes,
              FILE_CONFIG.submissionExtensions
            );
            if (!validation.isValid) {
              finish({ success: false, error: validation.error });
              return;
            }
          }
          finish({ success: true, files });
        };

        input.addEventListener('cancel', () =>
          finish({ success: false, error: 'Photo selection cancelled' })
        );
        document.body.appendChild(input);
        input.click();
      });
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { success: false, error: 'Photo library permission denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 1,
    });

    if (result.canceled) {
      return { success: false, error: 'Photo selection cancelled' };
    }

    const files = (result.assets || []).map(normalizeSubmissionAsset);
    if (!files.length) {
      return { success: false, error: 'Photo picker returned no images' };
    }

    for (const file of files) {
      const validation = validateFile(
        file,
        FILE_CONFIG.submissionTypes,
        FILE_CONFIG.submissionExtensions
      );
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }
    }

    return { success: true, files };
  } catch (error: any) {
    console.error('Photo picker error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not select photos.',
    };
  }
}

// Capture a single photo with the camera (web uses the `capture` input attribute).
export async function captureAssignmentPhoto(): Promise<{ success: boolean; file?: any; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';

        const finish = (result: { success: boolean; file?: any; error?: string }) => {
          if (input.parentNode) input.parentNode.removeChild(input);
          resolve(result);
        };

        input.onchange = (event: any) => {
          const file = event.target.files && event.target.files[0];
          if (!file) {
            finish({ success: false, error: 'No photo captured' });
            return;
          }
          const validation = validateFile(file, FILE_CONFIG.submissionTypes, FILE_CONFIG.submissionExtensions);
          if (!validation.isValid) {
            finish({ success: false, error: validation.error });
            return;
          }
          finish({ success: true, file });
        };

        input.addEventListener('cancel', () => finish({ success: false, error: 'Photo capture cancelled' }));

        document.body.appendChild(input);
        input.click();
      });
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { success: false, error: 'Camera permission denied' };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled) {
      return { success: false, error: 'Photo capture cancelled' };
    }

    const asset = result.assets?.[0];
    if (!asset) {
      return { success: false, error: 'Camera returned no photo' };
    }

    const file = {
      uri: asset.uri,
      name: asset.fileName || `photo-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
      size: asset.fileSize || 0,
    };

    const validation = validateFile(file, FILE_CONFIG.submissionTypes, FILE_CONFIG.submissionExtensions);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    return { success: true, file };
  } catch (error: any) {
    console.error('Camera error:', error);
    return { success: false, error: `Failed to capture photo: ${error?.message || String(error)}` };
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
