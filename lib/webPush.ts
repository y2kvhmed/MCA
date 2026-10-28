import { supabase } from './supabase';

// VAPID public key — safe to expose (paired with private key on server).
const VAPID_PUBLIC_KEY =
  'BMielYSm9OzuBzBkjpVsQqO2JMWrUncgpkGkEqUWfV-2oC8FcJlz9OTYAnaj5WBrDb58OULNLEyUnOCMlQ2MfsU';

/**
 * Convert base64 URL string to Uint8Array for PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Register the service worker at /sw.js.
 * Returns the registration or null on failure.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return reg;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Subscribe the current browser to web push and save the subscription to Supabase.
 * Called after the user logs in (on web only).
 */
export async function subscribeToWebPush(userId: string): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // iOS 16.4+ requires the app to be in standalone (Home Screen) mode for push.
  // Android Chrome works in any mode.
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  // On iOS Safari (non-standalone), Push API is not available even if the
  // objects exist. We still try — it will silently fail if unsupported.
  if (!isStandalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    // iOS regular Safari — push won't work. Only Home Screen mode supports it.
    // Still register the service worker so the user can be prompted to Add to Home Screen.
    await registerServiceWorker();
    return;
  }

  try {
    const reg = await registerServiceWorker();
    if (!reg) return;

    // Wait for the service worker to be active
    if (reg.active === null) {
      await navigator.serviceWorker.ready;
    }

    // Check existing subscription
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      // Request notification permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }

      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    // Save subscription to Supabase
    const sub = subscription.toJSON();
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh_key: sub.keys?.p256dh,
        auth_key: sub.keys?.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );
  } catch (error) {
    console.error('Web push subscription failed:', error);
  }
}

/**
 * Remove the current browser's push subscription from Supabase and the browser.
 */
export async function unsubscribeFromWebPush(userId: string): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
      }
    }
  } catch (error) {
    console.error('Web push unsubscribe failed:', error);
  }
}

/**
 * Get all push subscriptions for a list of user IDs (for server-side sending).
 * This is called by sendNotificationToUsers to gather web push targets.
 */
export async function getWebPushSubscriptions(
  userIds: string[]
): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }[]> {
  if (!userIds.length) return [];
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .in('user_id', userIds);

    if (error || !data) return [];

    return data.map((row: any) => ({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh_key, auth: row.auth_key },
    }));
  } catch (error) {
    console.error('Error fetching web push subscriptions:', error);
    return [];
  }
}
