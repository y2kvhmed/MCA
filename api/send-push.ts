import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

// VAPID keys — generated once, public key is safe to expose.
// Move these to Vercel env vars (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) for production.
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BMielYSm9OzuBzBkjpVsQqO2JMWrUncgpkGkEqUWfV-2oC8FcJlz9OTYAnaj5WBrDb58OULNLEyUnOCMlQ2MfsU';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'LAGyiOim0zSfuQCEyLvIPekk7ncrkHFUHi4ph3dFyc8';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@physics-learning.app';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface SendRequestBody {
  subscriptions: PushSubscription[];
  title: string;
  body: string;
  data?: Record<string, any>;
  url?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscriptions, title, body, data, url } = req.body as SendRequestBody;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(400).json({ error: 'No subscriptions provided' });
    }

    const payload = JSON.stringify({
      title: title || 'Notification',
      body: body || '',
      data: { ...(data || {}), url: url || '/' },
    });

    const results: { endpoint: string; success: boolean; error?: string }[] = [];

    // Send to each subscription. web-push handles FCM/APNs delivery.
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload
          );
          results.push({ endpoint: sub.endpoint, success: true });
        } catch (err: any) {
          // 410 Gone / 404 = subscription expired, should be removed
          const statusCode = err?.statusCode || 0;
          results.push({
            endpoint: sub.endpoint,
            success: false,
            error: statusCode === 410 || statusCode === 404 ? 'expired' : err?.message,
          });
        }
      })
    );

    const succeeded = results.filter((r) => r.success).length;
    const expired = results.filter((r) => r.error === 'expired').map((r) => r.endpoint);

    return res.status(200).json({
      sent: succeeded,
      total: subscriptions.length,
      expiredEndpoints: expired,
    });
  } catch (error: any) {
    console.error('send-push error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to send push' });
  }
}
