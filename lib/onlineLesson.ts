import { Platform, Linking } from 'react-native';
import { supabase } from './supabase';

// This is the single place the lesson link is defined — the app opens it directly
// (see openOnlineLesson) so browsers never block it as a popup.
export const ONLINE_LESSON_URL =
  'https://us06web.zoom.us/j/7507412644?pwd=a0ZUbVRpNk5wRU1BMm1aQnJhL2tOQT09';

function apiUrl(path: string): string {
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const base = isWeb ? '' : (process.env.EXPO_PUBLIC_APP_URL || 'https://saddam-khatir.vercel.app');
  return `${base}${path}`;
}

/**
 * Opens the lesson room. Called synchronously from the button press so mobile and
 * browser popup rules treat it as a direct user action instead of blocking it.
 */
export async function openOnlineLesson(url?: string): Promise<void> {
  const target = url || ONLINE_LESSON_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }
  await Linking.openURL(target);
}

/**
 * Records the signed-in student as present on today's online sheet for their school.
 * The database does the work server-side because students have no write access to
 * attendance under RLS.
 */
export async function markOnlineAttendance(): Promise<{
  recorded: boolean;
  alreadyMarked: boolean;
  message: string;
}> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('You are not signed in. Please log in again.');
  }

  const res = await fetch(apiUrl('/api/mark-online-attendance'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(body?.message || body?.error || 'Could not record your attendance.');
  }

  return {
    recorded: !!body?.recorded,
    alreadyMarked: !!body?.alreadyMarked,
    message: body?.message || '',
  };
}
