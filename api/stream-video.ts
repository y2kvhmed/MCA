import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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

// Supabase configuration for server-side auth token validation
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nykfwiljylzxkmlccpve.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55a2Z3aWxqeWx6eGttbGNjcHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NzczMzIsImV4cCI6MjEwNzE1MzMzMn0.0KlcJi4UIMgDDH59zf4R6WjFxOKtgRcMu75CDDodQZM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Google Drive only hands out real media bytes for a *bounded* byte range. Verified against a
// 1.8 GB lesson file:
//   Range: bytes=0-8388607  + confirm=t  ->  206 video/mp4 (Accept-Ranges, Content-Range, CORS)
//   Range: bytes=0-         + confirm=t  ->  200 text/html (the "virus scan warning" page)
// Browsers always ask for the open-ended form, so the player can never be pointed straight at
// Drive (a 302 redirect made it render that HTML warning page, i.e. "playback failed"), and the
// relay must clamp whatever range it forwards. Clamping also keeps every invocation small, which
// is what stops the 300s function timeout this relay used to hit on multi-gigabyte files.
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per request

/**
 * Extracts Google Drive ID from URLs or raw IDs
 */
function extractGoogleDriveId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  if (trimmed.startsWith('gdrive://')) {
    const raw = trimmed.replace('gdrive://', '').trim();
    if (/^[a-zA-Z0-9_-]{25,55}$/.test(raw)) return raw;
  }

  if (/^[a-zA-Z0-9_-]{25,55}$/.test(trimmed)) {
    return trimmed;
  }

  const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{25,55})/);
  if (matchD && matchD[1]) return matchD[1];

  const matchParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{25,55})/);
  if (matchParam && matchParam[1]) return matchParam[1];

  return null;
}

/**
 * Turns whatever Range the player sent into a Range we can safely ask Google for.
 * Every non-suffix range is capped at CHUNK_SIZE so one invocation can never pull a whole
 * multi-gigabyte file. Suffix ranges (bytes=-500) are already bounded and pass through.
 */
function buildUpstreamRange(rangeHeader?: string): string {
  if (rangeHeader) {
    if (/^bytes=-\d+$/.test(rangeHeader)) {
      return rangeHeader;
    }

    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
    if (match) {
      const start = parseInt(match[1], 10);
      const requestedEnd = match[2] ? parseInt(match[2], 10) : Number.MAX_SAFE_INTEGER;
      const end = Math.min(requestedEnd, start + CHUNK_SIZE - 1);
      return `bytes=${start}-${end}`;
    }
  }

  return `bytes=0-${CHUNK_SIZE - 1}`;
}

/**
 * Re-emits at most `maxBytes` from an upstream body. Google normally honours the clamped range,
 * but this guarantees a single invocation can never stream more than one chunk if it does not.
 */
async function* limitedStream(body: any, maxBytes: number): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  let sent = 0;
  try {
    while (sent < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;

      const room = maxBytes - sent;
      if (value.byteLength > room) {
        yield value.subarray(0, room);
        sent = maxBytes;
        break;
      }

      sent += value.byteLength;
      yield value;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * Streams one bounded chunk of a Google Drive file straight to the client.
 * The player never sees a Google URL, and seeking works because the browser keeps issuing new
 * Range requests that this handler re-anchors to chunk boundaries.
 */
async function proxyDriveStream(
  req: VercelApiRequest,
  res: VercelApiResponse,
  fileId: string
): Promise<void> {
  const upstreamRange = buildUpstreamRange(req.headers.range as string | undefined);

  // Stop pulling from Google the moment the player closes or abandons this chunk (e.g. seeking).
  const controller = new AbortController();
  const abortUpstream = () => controller.abort();
  res.on('close', abortUpstream);

  try {
    // `confirm=t` is what makes Drive answer with real bytes instead of the warning page.
    const upstream = await fetch(
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': '*/*',
          'Range': upstreamRange,
        },
      }
    );

    const contentType = upstream.headers.get('content-type') || '';
    const contentRange = upstream.headers.get('content-range') || '';
    const parsed = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(contentRange);

    // Only a bounded 206 carries playable bytes. Anything else (the HTML interstitial, a full-file
    // 200, an error, a quota refusal) must never be piped to the player.
    if (upstream.status !== 206 || !parsed || !upstream.body || contentType.includes('text/html')) {
      await upstream.body?.cancel().catch(() => {});
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Video stream resolution failed',
        message: 'Google Drive did not return video data for this file. Make sure the file is shared as "Anyone with the link" and that its download quota has not been exceeded.',
      }));
      return;
    }

    const start = parseInt(parsed[1], 10);
    const end = Math.min(parseInt(parsed[2], 10), start + CHUNK_SIZE - 1);
    const total = parsed[3] === '*' ? null : parseInt(parsed[3], 10);
    const length = end - start + 1;

    res.writeHead(206, {
      'Content-Type': contentType || 'video/mp4',
      'Content-Length': String(length),
      'Content-Range': total === null ? `bytes ${start}-${end}/*` : `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=0, no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
    });

    if (req.method === 'HEAD') {
      await upstream.body.cancel().catch(() => {});
      res.end();
      return;
    }

    try {
      await pipeline(Readable.from(limitedStream(upstream.body, length)), res);
    } catch (streamErr: any) {
      // The player paused, closed or seeked away — the upstream socket is torn down by pipeline.
      if (streamErr?.code !== 'ERR_STREAM_PREMATURE_CLOSE' && streamErr?.name !== 'AbortError') {
        console.error('Drive stream pipe error:', streamErr);
      }
    }
  } finally {
    res.off('close', abortUpstream);
  }
}

export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 1. Anti-Hotlinking / Origin Validation
    const referer = (req.headers.referer || req.headers.referrer || '') as string;
    const host = (req.headers.host || '') as string;

    if (referer) {
      try {
        const refUrl = new URL(referer);
        const isAllowed =
          refUrl.hostname.includes('vercel.app') ||
          refUrl.hostname.includes('localhost') ||
          refUrl.hostname.includes('127.0.0.1') ||
          refUrl.hostname === host;

        if (!isAllowed) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden: External embedding is not permitted' }));
          return;
        }
      } catch {
        // Continue if referer URL cannot be parsed
      }
    }

    // 2. Validate User Status if userId is supplied
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    if (userId) {
      const { data: userRecord } = await supabase
        .from('app_users')
        .select('id, is_active')
        .eq('id', userId)
        .single();

      if (userRecord && userRecord.is_active === false) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: User account is inactive' }));
        return;
      }
    }

    // 3. Identify Video Target
    const rawFileId = typeof req.query.fileId === 'string' ? req.query.fileId : undefined;
    const rawVideoPath = typeof req.query.videoPath === 'string' ? req.query.videoPath : undefined;
    const lessonId = typeof req.query.lessonId === 'string' ? req.query.lessonId : undefined;

    let targetVideoPath = rawVideoPath || '';
    let targetDriveId: string | null = rawFileId ? extractGoogleDriveId(rawFileId) : null;

    // If fileId was not passed directly, check videoPath
    if (!targetDriveId && targetVideoPath) {
      targetDriveId = extractGoogleDriveId(targetVideoPath);
    }

    // If still not resolved, query lessons table from Supabase
    if (!targetDriveId && lessonId) {
      const { data: lesson } = await supabase
        .from('lessons')
        .select('id, video_url, video_path')
        .eq('id', lessonId)
        .single();

      if (lesson) {
        const possibleSource = lesson.video_path || lesson.video_url || '';
        targetDriveId = extractGoogleDriveId(possibleSource);
        targetVideoPath = possibleSource;
      }
    }

    if (!targetDriveId && !targetVideoPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing video target or file identifier' }));
      return;
    }

    // 4. Google Drive streaming relay (proxied, bounded range-aware)
    if (targetDriveId) {
      try {
        await proxyDriveStream(req, res, targetDriveId);
      } catch (driveErr: any) {
        console.error('Google Drive stream error:', driveErr);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Video stream resolution failed',
            message: driveErr?.message || 'Could not stream file from Google Drive',
          }));
        }
      }
      return;
    }

    // 5. Fallback for Supabase storage or external URLs
    res.writeHead(302, {
      'Location': targetVideoPath,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });
    res.end();
  } catch (error: any) {
    console.error('Video relay error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to stream video', message: error?.message }));
    }
  }
}
