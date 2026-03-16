/**
 * PWA Web Push: request permission, subscribe with VAPID public key, save to Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Register the service worker (call once on app load). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (e) {
    console.warn('Service worker registration failed:', e);
    return null;
  }
}

/** Request notification permission. Returns true if granted. */
export function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then((p) => p === 'granted');
}

/** Subscribe to push (requires VAPID public key and a registered service worker). */
export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY?.trim()) {
    console.warn('VITE_VAPID_PUBLIC_KEY is not set; push subscription skipped.');
    return null;
  }
  try {
    // Cast to the expected BufferSource type for older lib.dom typings
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    return sub;
  } catch (e) {
    console.warn('Push subscribe failed:', e);
    return null;
  }
}

/** Save subscription to Supabase push_subscriptions. */
export async function saveSubscriptionToSupabase(
  subscription: PushSubscription,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const keys = json.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return false;
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.warn('Save push subscription failed:', error);
    return false;
  }
  return true;
}

/**
 * Full flow: ensure SW ready, request permission, subscribe, save.
 * Call when user is logged in; pass user.id from AuthContext.
 */
export async function setupPushNotifications(userId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY?.trim()) return false;
  if (!isSupabaseConfigured() || !supabase) return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  const sub = await subscribeToPush(reg);
  if (!sub) return false;
  return saveSubscriptionToSupabase(sub, userId);
}
