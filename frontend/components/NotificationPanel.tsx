import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'event' | 'donation' | 'loan' | 'system';
  fromSupabase?: boolean;
}

export function NotificationPanel({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    const list: Notification[] = [];
    if (userId && isSupabaseConfigured() && supabase) {
      const { data } = await supabase
        .from('user_notifications')
        .select('id, title, message, read, type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data?.length) {
        data.forEach((row: { id: string; title: string; message: string; read: boolean; type: string; created_at: string }) => {
          list.push({
            id: row.id,
            title: row.title,
            message: row.message,
            timestamp: row.created_at,
            read: row.read,
            type: (row.type as Notification['type']) || 'system',
            fromSupabase: true,
          });
        });
      }
    }
    const saved = localStorage.getItem('myHainanNotifications');
    if (saved && userId) {
      const all = JSON.parse(saved);
      const local = all.filter((n: any) => n.userId === userId).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp,
        read: n.read,
        type: n.type,
        fromSupabase: false,
      }));
      const seen = new Set(list.map(n => n.id));
      local.forEach((n: Notification) => {
        if (!seen.has(n.id)) {
          list.push(n);
          seen.add(n.id);
        }
      });
    }
    if (list.length === 0 && userId && !saved) {
      list.push({
        id: '1',
        title: 'Welcome to 海南会馆!',
        message: 'Explore events and start earning points.',
        timestamp: new Date().toISOString(),
        read: false,
        type: 'system',
      });
    }
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();
    if (!userId) return;
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowPanel(false);
      }
    };

    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPanel]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    const item = notifications.find(n => n.id === id);
    const updated = notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);

    if (item?.fromSupabase && isSupabaseConfigured() && supabase) {
      await supabase.from('user_notifications').update({ read: true }).eq('id', id).eq('user_id', userId!);
    }
    const allNotifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
    const updatedAll = allNotifications.map((n: any) =>
      n.id === id ? { ...n, read: true } : n
    );
    localStorage.setItem('myHainanNotifications', JSON.stringify(updatedAll));
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (userId && isSupabaseConfigured() && supabase) {
      await supabase.from('user_notifications').update({ read: true }).eq('user_id', userId);
    }
    const allNotifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
    const updatedAll = allNotifications.map((n: any) =>
      n.userId === userId ? { ...n, read: true } : n
    );
    localStorage.setItem('myHainanNotifications', JSON.stringify(updatedAll));
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now.getTime() - then.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setShowPanel(!showPanel)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {showPanel && (
        <div className="absolute right-0 top-12 w-96 max-h-[500px] bg-white shadow-2xl rounded-lg border overflow-hidden z-50">
          <div className="border-b px-4 py-3 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
                Mark all read
              </Button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50' : ''
                      }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!notification.read ? 'bg-red-500' : 'bg-gray-300'
                        }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                            {notification.title}
                          </h4>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {getTimeAgo(notification.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {notification.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to add a notification (can be called from anywhere)
export function addNotification(
  userId: string,
  title: string,
  message: string,
  type: 'event' | 'donation' | 'loan' | 'system'
) {
  const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
  const newNotification = {
    id: Date.now().toString(),
    userId,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    type,
  };
  notifications.push(newNotification);
  localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));
}
