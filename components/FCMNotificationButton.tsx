import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { isFirebaseConfigured } from '../lib/firebase';
import { setupFCMNotifications, requestNotificationPermission } from '../lib/fcmNotifications';

interface FCMNotificationButtonProps {
  userId: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  label?: string;
}

/**
 * Button to request notification permission, get FCM token, and save to Supabase.
 * Only rendered when Firebase is configured. Shows loading/success/error state.
 */
export function FCMNotificationButton({
  userId,
  variant = 'outline',
  size = 'sm',
  className = '',
  label = 'Enable push notifications',
}: FCMNotificationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isFirebaseConfigured()) return null;

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const ok = await setupFCMNotifications(userId);
      if (ok) setDone(true);
      else {
        const permission = await requestNotificationPermission().then(() => Notification.permission);
        if (permission === 'denied') setError('Notifications blocked');
        else setError('Could not enable notifications');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <Bell className="w-4 h-4 mr-2 text-green-600" />
        Notifications enabled
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          'Enabling…'
        ) : (
          <>
            <Bell className="w-4 h-4 mr-2" />
            {label}
          </>
        )}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
