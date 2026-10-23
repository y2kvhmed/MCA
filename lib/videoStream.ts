import { Platform } from 'react-native';

/**
 * Extracts a Google Drive File ID from diverse link formats or raw ID.
 * Supports:
 * - https://drive.google.com/file/d/FILE_ID/view...
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - gdrive://FILE_ID
 * - Raw alphanumeric file ID (25-55 chars)
 */
export function extractGoogleDriveId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // Handle gdrive:// prefix
  if (trimmed.startsWith('gdrive://')) {
    const raw = trimmed.replace('gdrive://', '').trim();
    if (/^[a-zA-Z0-9_-]{25,55}$/.test(raw)) {
      return raw;
    }
  }

  // Handle raw ID
  if (/^[a-zA-Z0-9_-]{25,55}$/.test(trimmed)) {
    return trimmed;
  }

  // Match /file/d/ID
  const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{25,55})/);
  if (matchD && matchD[1]) return matchD[1];

  // Match id=ID query parameter
  const matchParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{25,55})/);
  if (matchParam && matchParam[1]) return matchParam[1];

  return null;
}

/**
 * Returns true if the given path or URL is hosted on Google Drive or is a Drive ID.
 */
export function isGoogleDriveSource(pathOrUrl: string): boolean {
  if (!pathOrUrl) return false;
  const trimmed = pathOrUrl.trim();
  if (trimmed.startsWith('gdrive://')) return true;
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) return true;
  return extractGoogleDriveId(trimmed) !== null;
}

/**
 * Constructs a secure streaming URL that proxies through the protected server relay.
 * Prevents direct exposure of Google Drive URLs and enforces token authentication.
 */
export function getSecureStreamUrl(options: {
  lessonId?: string;
  videoPath?: string;
  token?: string;
}): string {
  const { lessonId, videoPath, token } = options;
  const params = new URLSearchParams();

  if (lessonId) {
    params.set('lessonId', lessonId);
  } else if (videoPath) {
    const driveId = extractGoogleDriveId(videoPath);
    if (driveId) {
      params.set('fileId', driveId);
    } else {
      params.set('videoPath', videoPath);
    }
  }

  if (token) {
    params.set('token', token);
  }

  // For web, relative URL is optimal; for mobile native, use absolute domain
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const baseDomain = isWeb
    ? ''
    : (process.env.EXPO_PUBLIC_APP_URL || 'https://saddam-khatir.vercel.app');

  return `${baseDomain}/api/stream-video?${params.toString()}`;
}
