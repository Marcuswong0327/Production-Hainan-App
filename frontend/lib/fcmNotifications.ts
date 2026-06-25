/**
 * FCM: request permission, get token, save to Supabase fcm_tokens.
 */

import { getMessaging, getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getFirebaseApp, isFirebaseConfigured } from './firebase';
import { supabase, isSupabaseConfigured } from './supabase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

/** Request notification permission. Returns true if granted. */
export function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then((p) => p === 'granted');
}

/** Get the current FCM token (requires permission, Firebase config, VAPID key, and a service worker). */
export async function getFCMToken(): Promise<string | null> {
  if (!isFirebaseConfigured() || !VAPID_KEY?.trim()) return null;
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported in this browser.');
    return null;
  }
  const app = getFirebaseApp();
  if (!app) return null;
  const messaging = getMessaging(app);
  try {
    // Ensure we have a registered service worker for FCM.
    // If firebase-messaging-sw.js is not yet registered, register it now.
    let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (e) {
    console.warn('FCM getToken failed:', e);
    return null;
  }
}

/** Save FCM token to Supabase fcm_tokens. Upserts by token so the same device updates updated_at. */
export async function saveFCMTokenToSupabase(userId: string, token: string, deviceName?: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  const { error } = await supabase.from('fcm_tokens').upsert(
    {
      user_id: userId,
      token,
      device_name: deviceName || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' }
  );
  if (error) {
    console.warn('Save FCM token failed:', error);
    return false;
  }
  return true;
}

/**
 * Full flow: request permission, get FCM token, save to Supabase.
 * Call when user is logged in; pass user.id from AuthContext.
 */
export async function setupFCMNotifications(userId: string, deviceName?: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !VAPID_KEY?.trim()) return false;
  if (!isSupabaseConfigured() || !supabase) return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  const token = await getFCMToken();
  if (!token) return false;
  return saveFCMTokenToSupabase(userId, token, deviceName);
}

/** Subscribe to foreground messages (optional). Returns unsubscribe function or null. */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): (() => void) | null {
  if (!isFirebaseConfigured()) return null;
  const app = getFirebaseApp();
  if (!app) return null;
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
