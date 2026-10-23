import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
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
 * Parses Google Drive virus scan warning form for large files (> 100MB)
 */
function extractConfirmForm(html: string): { actionUrl: string; params: Record<string, string> } | null {
  const formMatch = html.match(/<form[^>]+action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
  if (!formMatch) {
    const linkMatch = html.match(/href="([^"]*confirm=([^&"]+)[^"]*)"/i);
    if (linkMatch) {
      return { actionUrl: linkMatch[1].replace(/&amp;/g, '&'), params: {} };
    }
    return null;
  }

  const actionUrl = formMatch[1].replace(/&amp;/g, '&');
  const formContent = formMatch[2];
  const params: Record<string, string> = {};

  const inputRegex1 = /<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi;
  let m1;
  while ((m1 = inputRegex1.exec(formContent)) !== null) {
    params[m1[1]] = m1[2];
  }

  const inputRegex2 = /<input[^>]+value="([^"]*)"[^>]+name="([^"]+)"/gi;
  let m2;
  while ((m2 = inputRegex2.exec(formContent)) !== null) {
    params[m2[2]] = m2[1];
  }

  return { actionUrl, params };
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
    // 1. Authenticate Request
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
    const token = queryToken || bearerToken;

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Authentication token is required' }));
      return;
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }));
      return;
    }

    // 2. Identify Video Target
    const lessonId = typeof req.query.lessonId === 'string' ? req.query.lessonId : undefined;
    const rawFileId = typeof req.query.fileId === 'string' ? req.query.fileId : undefined;
    const rawVideoPath = typeof req.query.videoPath === 'string' ? req.query.videoPath : undefined;

    let targetVideoPath = rawVideoPath || '';
    let targetDriveId: string | null = rawFileId ? extractGoogleDriveId(rawFileId) : null;

    if (lessonId) {
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('id, video_url, video_path')
        .eq('id', lessonId)
        .single();

      if (lessonError || !lesson) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Recording not found' }));
        return;
      }

      const possibleSource = lesson.video_path || lesson.video_url || '';
      targetDriveId = extractGoogleDriveId(possibleSource);
      targetVideoPath = possibleSource;
    }

    if (!targetDriveId && targetVideoPath) {
      targetDriveId = extractGoogleDriveId(targetVideoPath);
    }

    if (!targetDriveId && !targetVideoPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing video target or file identifier' }));
      return;
    }

    // 3. Handle Google Drive Streaming Relay
    if (targetDriveId) {
      const rangeHeader = req.headers.range;
      let targetUrl = `https://drive.usercontent.google.com/download?id=${targetDriveId}&export=download&confirm=t`;

      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
      };

      if (rangeHeader) {
        fetchHeaders['Range'] = rangeHeader;
      }

      let upstreamRes = await fetch(targetUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: fetchHeaders,
        redirect: 'manual',
      });

      const cookies: string[] = [];
      const c1 = upstreamRes.headers.get('set-cookie');
      if (c1) cookies.push(c1);

      // Follow redirect hops (Google Drive typically issues 302/303 to direct CDN node)
      let hops = 0;
      while (
        (upstreamRes.status === 301 || upstreamRes.status === 302 || upstreamRes.status === 303 || upstreamRes.status === 307) &&
        hops < 5
      ) {
        hops++;
        const location = upstreamRes.headers.get('location');
        if (!location) break;

        targetUrl = location.startsWith('http') ? location : new URL(location, targetUrl).toString();

        const hopHeaders: Record<string, string> = {
          ...fetchHeaders,
          ...(cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {}),
        };

        upstreamRes = await fetch(targetUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: hopHeaders,
          redirect: 'manual',
        });

        const hopCookie = upstreamRes.headers.get('set-cookie');
        if (hopCookie) cookies.push(hopCookie);
      }

      // If Google returned HTML virus scan warning page, parse confirmation form
      const contentType = upstreamRes.headers.get('content-type') || '';
      if (upstreamRes.status === 200 && contentType.includes('text/html')) {
        const html = await upstreamRes.text();
        const parsedForm = extractConfirmForm(html);

        if (parsedForm) {
          const formUrl = new URL(parsedForm.actionUrl);
          for (const [k, v] of Object.entries(parsedForm.params)) {
            formUrl.searchParams.set(k, v);
          }
          if (!formUrl.searchParams.has('confirm')) {
            formUrl.searchParams.set('confirm', 't');
          }

          let secondRes = await fetch(formUrl.toString(), {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: {
              ...fetchHeaders,
              ...(cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {}),
            },
            redirect: 'manual',
          });

          // Follow second redirect to video CDN
          let hops2 = 0;
          while (
            (secondRes.status === 301 || secondRes.status === 302 || secondRes.status === 303 || secondRes.status === 307) &&
            hops2 < 5
          ) {
            hops2++;
            const loc2 = secondRes.headers.get('location');
            if (!loc2) break;
            const finalUrl = loc2.startsWith('http') ? loc2 : new URL(loc2, formUrl.toString()).toString();

            secondRes = await fetch(finalUrl, {
              method: req.method === 'HEAD' ? 'HEAD' : 'GET',
              headers: {
                ...fetchHeaders,
                ...(cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {}),
              },
              redirect: 'manual',
            });
          }

          upstreamRes = secondRes;
        }
      }

      // Check if upstream successfully resolved video bytes or partial content
      const statusCode = upstreamRes.status === 206 ? 206 : (upstreamRes.status === 200 ? 200 : upstreamRes.status);

      const responseHeaders: Record<string, string> = {
        'Content-Type': upstreamRes.headers.get('content-type') || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      };

      const contentLength = upstreamRes.headers.get('content-length');
      if (contentLength) responseHeaders['Content-Length'] = contentLength;

      const contentRange = upstreamRes.headers.get('content-range');
      if (contentRange) responseHeaders['Content-Range'] = contentRange;

      res.writeHead(statusCode, responseHeaders);

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      if (upstreamRes.body) {
        const nodeReadable = Readable.fromWeb(upstreamRes.body as any);

        req.on('close', () => {
          try {
            nodeReadable.destroy();
          } catch {
            // Ignore stream termination errors
          }
        });

        nodeReadable.pipe(res);
      } else {
        res.end();
      }
      return;
    }

    // 4. Fallback for Supabase storage or external URLs
    res.writeHead(302, { Location: targetVideoPath });
    res.end();
  } catch (error: any) {
    console.error('Video relay error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to stream video', message: error?.message }));
    }
  }
}
