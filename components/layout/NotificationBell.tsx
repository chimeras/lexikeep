'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Trophy, GraduationCap, CheckCircle2, XCircle, Megaphone, MessageSquare, Shield, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/lib/notifications-data';
import type { Notification } from '@/types';

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch initial notifications and count
    const loadData = async () => {
      const { data } = await getUserNotifications(user.id);
      setNotifications(data);
      const { count } = await getUnreadCount(user.id);
      setUnreadCount(count);
    };

    void loadData();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          // Play a subtle sound or trigger animation
          const newNotif = payload.new as Notification;
          
          // Fetch sender info for new notification
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, role')
            .eq('id', newNotif.sender_id || '')
            .maybeSingle();

          const enrichedNotif: Notification = {
            ...newNotif,
            sender: senderProfile,
          };

          setNotifications((prev) => [enrichedNotif, ...prev].slice(0, 50));
          setUnreadCount((c) => c + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, is_read: updated.is_read } : n))
          );
          // Recalculate unread count
          void getUnreadCount(user.id).then(({ count }) => setUnreadCount(count ?? 0));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => setIsOpen((prev) => !prev);

  const handleMarkAsRead = async (id: string, link: string | null) => {
    setIsOpen(false);
    await markAsRead(id);
    if (link) {
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'badge':
        return <Trophy className="h-4 w-4 text-amber-500" />;
      case 'capsule':
        return <GraduationCap className="h-4 w-4 text-emerald-500" />;
      case 'moderation':
        return <Shield className="h-4 w-4 text-purple-500" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4 text-blue-500" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-pink-500" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 focus:outline-none"
        aria-label="View notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 z-50">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => void handleMarkAsRead(notif.id, notif.link)}
                  className={`flex cursor-pointer gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    !notif.is_read ? 'bg-blue-50/40 font-medium' : ''
                  }`}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 font-semibold truncate">
                      {notif.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                      {notif.body}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(notif.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
