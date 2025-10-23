import { supabase } from './supabase';
import { Platform } from 'react-native';

// Conditionally import FileSystem only for native platforms
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system');
}

const SUBMISSIONS_BUCKET = 'submissions';
const RECORDINGS_BUCKET = 'recordings';
const ASSETS_BUCKET = 'assets';

// File size limits (in bytes)
const MAX_SUBMISSION_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RECORDING_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_ASSET_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
    path: string;
    url?: string;
    error?: string;
}

// Validate PDF file
export function validatePDF(fileUri: string): boolean {
    return fileUri.toLowerCase().endsWith('.pdf');
}

// Validate file size
export async function validateFileSize(fileUri: string, maxSize: number): Promise<boolean> {
    if (Platform.OS === 'web') {
        // For web, we'll validate size during upload
        return true;
    }
    
    try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) return false;
        return fileInfo.size <= maxSize;
    } catch (error) {
        console.error('File size validation error:', error);
        return false;
    }
}

// Upload submission file
export async function uploadSubmission(
    fileUri: string,
    fileName: string,
    groupId: string,
    assignmentId: string,
    studentId: string
): Promise<UploadResult> {
    try {
        // Validate PDF
        if (!validatePDF(fileName)) {
            return { path: '', error: 'Only PDF files are allowed' };
        }

        // Validate size
        const isValidSize = await validateFileSize(fileUri, MAX_SUBMISSION_SIZE);
        if (!isValidSize) {
            return { path: '', error: 'File size exceeds 10MB limit' };
        }

        // Generate unique file path
        const timestamp = Date.now();
        const filePath = `${groupId}/${assignmentId}/${studentId}/${timestamp}_${fileName}`;

        // Read file as base64
        const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to blob
        const blob = base64ToBlob(fileBase64, 'application/pdf');

        // Upload to Supabase
        const { data, error } = await supabase.storage
            .from(SUBMISSIONS_BUCKET)
            .upload(filePath, blob, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (error) {
            console.error('Upload error:', error);
            return { path: '', error: 'Failed to upload file' };
        }

        return { path: data.path };
    } catch (error) {
        console.error('Upload submission error:', error);
        return { path: '', error: 'Upload failed' };
    }
}


// Upload video lesson
export async function uploadLesson(
    fileUri: string,
    fileName: string,
    groupId: string,
    lessonId: string,
    schoolId?: string
): Promise<UploadResult> {
    try {
        // Validate size
        const isValidSize = await validateFileSize(fileUri, MAX_RECORDING_SIZE);
        if (!isValidSize) {
            return { path: '', error: 'File size exceeds 100MB limit' };
        }

        // Generate file path
        const timestamp = Date.now();
        const filePath = schoolId
            ? `${schoolId}/${groupId}/${lessonId}/${timestamp}_${fileName}`
            : `${groupId}/${lessonId}/${timestamp}_${fileName}`;

        // Read file
        const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        const blob = base64ToBlob(fileBase64, 'video/mp4');

        // Upload
        const { data, error } = await supabase.storage
            .from(RECORDINGS_BUCKET)
            .upload(filePath, blob, {
                contentType: 'video/mp4',
                upsert: false,
            });

        if (error) {
            console.error('Upload error:', error);
            return { path: '', error: 'Failed to upload video' };
        }

        return { path: data.path };
    } catch (error) {
        console.error('Upload lesson error:', error);
        return { path: '', error: 'Upload failed' };
    }
}

// Get signed URL for private file
export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);

        if (error) {
            console.error('Signed URL error:', error);
            return null;
        }

        return data.signedUrl;
    } catch (error) {
        console.error('Get signed URL error:', error);
        return null;
    }
}

// Get public URL
export function getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

// Delete file
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
    try {
        const { error } = await supabase.storage.from(bucket).remove([path]);

        if (error) {
            console.error('Delete file error:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Delete file error:', error);
        return false;
    }
}

// Helper: Convert base64 to Blob
function base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);

        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
}

// Download file
export async function downloadFile(bucket: string, path: string, localUri: string): Promise<boolean> {
    try {
        const signedUrl = await getSignedUrl(bucket, path);
        if (!signedUrl) return false;

        const downloadResult = await FileSystem.downloadAsync(signedUrl, localUri);

        return downloadResult.status === 200;
    } catch (error) {
        console.error('Download file error:', error);
        return false;
    }
}
