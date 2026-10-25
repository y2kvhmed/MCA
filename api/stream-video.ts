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

// Supabase configuration for server-side auth token validation
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nykfwiljylzxkmlccpve.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55a2Z3aWxqeWx6eGttbGNjcHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NzczMzIsImV4cCI6MjEwNzE1MzMzMn0.0KlcJi4UIMgDDH59zf4R6WjFxOKtgRcMu75CDDodQZM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// In-memory stream URL cache to allow instant seeking without re-resolving Google tokens
interface CacheEntry {
  url: string;
  expiresAt: number;
}
const streamUrlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
 * Resolves a direct Google Drive CDN stream URL.
 * Handles large files (> 100MB) by resolving virus scan confirmation tokens.
 */
async function resolveDriveStreamUrl(fileId: string): Promise<string> {
  const cached = streamUrlCache.get(fileId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': '*/*',
  };

  const initialUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  let res1 = await fetch(initialUrl, {
    method: 'GET',
    headers: fetchHeaders,
    redirect: 'manual',
  });

  // Direct redirect (common for small-to-medium files)
  if (res1.status >= 301 && res1.status <= 308) {
    const loc = res1.headers.get('location');
    if (loc) {
      const target = loc.startsWith('http') ? loc : new URL(loc, initialUrl).toString();
      streamUrlCache.set(fileId, { url: target, expiresAt: Date.now() + CACHE_TTL_MS });
      return target;
    }
  }

  // Fallback to drive.google.com/uc if usercontent returns 404
  if (res1.status === 404) {
    const ucUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const ucRes = await fetch(ucUrl, {
      method: 'GET',
      headers: fetchHeaders,
      redirect: 'manual',
    });
    if (ucRes.status >= 301 && ucRes.status <= 308) {
      const loc = ucRes.headers.get('location');
      if (loc) {
        const target = loc.startsWith('http') ? loc : new URL(loc, ucUrl).toString();
        streamUrlCache.set(fileId, { url: target, expiresAt: Date.now() + CACHE_TTL_MS });
        return target;
      }
    }
  }

  const contentType = res1.headers.get('content-type') || '';

  // Direct media stream returned
  if (contentType.includes('video/') || contentType.includes('application/octet-stream')) {
    streamUrlCache.set(fileId, { url: initialUrl, expiresAt: Date.now() + CACHE_TTL_MS });
    return initialUrl;
  }

  // HTML response indicates virus scan warning for large files (> 100MB)
  if (contentType.includes('text/html')) {
    const html = await res1.text();

    const formMatch = html.match(/<form[^>]+action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
    const actionUrl = formMatch ? formMatch[1].replace(/&amp;/g, '&') : 'https://drive.usercontent.google.com/download';

    const uuidMatch = 
      html.match(/name="uuid"\s+value="([^"]+)"/i) || 
      html.match(/value="([^"]+)"\s+name="uuid"/i) ||
      html.match(/uuid=([a-f0-9\-]+)/i);

    if (uuidMatch) {
      const uuid = uuidMatch[1];
      const confirmedUrl = new URL(actionUrl);
      confirmedUrl.searchParams.set('id', fileId);
      confirmedUrl.searchParams.set('export', 'download');
      confirmedUrl.searchParams.set('confirm', 't');
      confirmedUrl.searchParams.set('uuid', uuid);
      const finalUrl = confirmedUrl.toString();
      streamUrlCache.set(fileId, { url: finalUrl, expiresAt: Date.now() + CACHE_TTL_MS });
      return finalUrl;
    }

    const linkMatch = html.match(/href="([^"]*confirm=([^&"]+)[^"]*)"/i);
    if (linkMatch) {
      const finalUrl = linkMatch[1].replace(/&amp;/g, '&');
      streamUrlCache.set(fileId, { url: finalUrl, expiresAt: Date.now() + CACHE_TTL_MS });
      return finalUrl;
    }

    if (html.includes('Quota exceeded') || html.includes('Too many users')) {
      throw new Error('Google Drive quota limit reached for this file. Please try again shortly or re-upload the lesson.');
    }
  }

  streamUrlCache.set(fileId, { url: initialUrl, expiresAt: Date.now() + CACHE_TTL_MS });
  return initialUrl;
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

    // 4. Handle Google Drive Streaming Relay
    if (targetDriveId) {
      try {
        const streamUrl = await resolveDriveStreamUrl(targetDriveId);

        // Redirect directly to the authenticated Google CDN stream
        // Eliminates 300s serverless function timeout and locked stream errors
        res.writeHead(302, {
          'Location': streamUrl,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
        });
        res.end();
        return;
      } catch (driveErr: any) {
        console.error('Google Drive stream resolution error:', driveErr);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Video stream resolution failed',
          message: driveErr?.message || 'Could not stream file from Google Drive',
        }));
        return;
      }
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
