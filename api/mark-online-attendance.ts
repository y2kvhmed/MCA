import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// Extend Node HTTP types to match Vercel Serverless Function signatures
interface VercelApiRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  body?: any;
}

interface VercelApiResponse extends ServerResponse {
  status: (code: number) => VercelApiResponse;
  json: (body: any) => void;
  send: (body: any) => void;
}

// The Zoom room link lives in lib/onlineLesson.ts (the app opens it directly so the
// browser cannot treat it as a popup). This endpoint only records the attendance.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nykfwiljylzxkmlccpve.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55a2Z3aWxqeWx6eGttbGNjcHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NzczMzIsImV4cCI6MjEwNzE1MzMzMn0.0KlcJi4UIMgDDH59zf4R6WjFxOKtgRcMu75CDDodQZM';

// Writing attendance is a staff-only operation under RLS, so this endpoint runs with
// the service-role key. It must never be exposed to the client.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Used only to validate the caller's access token.
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TIME_ZONE = 'Africa/Cairo';

/** Today's date (YYYY-MM-DD) in the app's timezone, so late-night joins land on the right day. */
function todayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

/** Current wall-clock time (HH:MM:SS, 24h) in the app's timezone. */
function nowKey(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

/** Postgres TIME comes back as HH:MM:SS; pad it so string comparison is valid. */
function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length < 2) return null;
  const [h, m, s] = parts;
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${(s || '00').padStart(2, '0')}`;
}

function json(res: VercelApiResponse, code: number, body: any) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    if (!SERVICE_ROLE_KEY) {
      json(res, 503, {
        error: 'Not configured',
        message: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server, so online attendance cannot be recorded.',
      });
      return;
    }

    // Identify the caller from their real Supabase session — never from client input.
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      json(res, 401, { error: 'Unauthorized', message: 'Missing access token. Please log in again.' });
      return;
    }

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const studentId = authData?.user?.id;
    if (authError || !studentId) {
      json(res, 401, { error: 'Unauthorized', message: 'Your session has expired. Please log in again.' });
      return;
    }

    const { data: profile } = await admin
      .from('app_users')
      .select('id, role, school_id, is_active')
      .eq('id', studentId)
      .single();

    if (!profile) {
      json(res, 404, { error: 'Not found', message: 'No profile found for this account.' });
      return;
    }
    if (profile.role !== 'student') {
      json(res, 403, { error: 'Forbidden', message: 'Only students can use the Join Online Lesson button.' });
      return;
    }
    if (profile.is_active === false) {
      json(res, 403, { error: 'Forbidden', message: 'This account is deactivated.' });
      return;
    }
    if (!profile.school_id) {
      json(res, 400, { error: 'Bad request', message: 'Your account is not linked to a school.' });
      return;
    }

    const date = todayKey();
    const schoolId = profile.school_id;

    // The teacher owns the lesson window: find the online sheet they opened for this
    // school today. If there is none, no lesson is running — do not create anything
    // and do not mark the student, so a stray press cannot invent a sheet.
    const { data: sheet } = await admin
      .from('attendance_sheets')
      .select('id, start_time, end_time')
      .eq('school_id', schoolId)
      .eq('date', date)
      .eq('session_type', 'online')
      .maybeSingle();

    if (!sheet) {
      json(res, 200, {
        ok: true,
        recorded: false,
        reason: 'no_lesson',
        message: 'No online lesson is open for your school right now.',
      });
      return;
    }

    const start = normalizeTime(sheet.start_time);
    const end = normalizeTime(sheet.end_time);
    const now = nowKey();

    if (start && now < start) {
      json(res, 200, {
        ok: true,
        recorded: false,
        reason: 'not_started',
        message: `The online lesson starts at ${start.slice(0, 5)}.`,
      });
      return;
    }

    if (end && now > end) {
      json(res, 200, {
        ok: true,
        recorded: false,
        reason: 'ended',
        message: 'The online lesson has already ended.',
      });
      return;
    }

    const { data: current } = await admin
      .from('attendance_records')
      .select('status')
      .eq('sheet_id', sheet.id)
      .eq('student_id', studentId)
      .maybeSingle();

    const alreadyMarked = current?.status === 'present';

    const { error: markError } = await admin
      .from('attendance_records')
      .upsert(
        { sheet_id: sheet.id, student_id: studentId, status: 'present' },
        { onConflict: 'sheet_id,student_id' }
      );

    if (markError) {
      json(res, 500, { error: 'Failed to mark attendance', message: markError.message });
      return;
    }

    json(res, 200, { ok: true, recorded: true, date, alreadyMarked });
  } catch (error: any) {
    console.error('Online attendance error:', error);
    json(res, 500, { error: 'Failed', message: error?.message || 'Unexpected server error.' });
  }
}
