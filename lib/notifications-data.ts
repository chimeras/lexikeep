import { supabase } from '@/lib/supabase';
import type { Notification, NotificationType } from '@/types';

export const getUserNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, sender:profiles!sender_id(id, username, avatar_url, role)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return { data: (data as Notification[] | null) ?? [], error };
};

export const getUnreadCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  return { count: count ?? 0, error };
};

export const markAsRead = async (notificationId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .select()
    .single();
  return { data: data as Notification | null, error };
};

export const markAllAsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  return { error };
};

export const createNotification = async ({
  recipientId,
  senderId = null,
  type,
  title,
  body,
  link = null,
}: {
  recipientId: string;
  senderId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}) => {
  const { error } = await supabase
    .from('notifications')
    .insert({
      recipient_id: recipientId,
      sender_id: senderId,
      type,
      title,
      body,
      link,
    });
  return { data: null, error };
};

export const sendBulkClassNotification = async ({
  classId,
  senderId = null,
  type,
  title,
  body,
  link = null,
}: {
  classId: string;
  senderId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}) => {
  const { data: members, error: membersError } = await supabase
    .from('class_memberships')
    .select('student_id')
    .eq('class_id', classId);

  if (membersError) {
    return { error: membersError };
  }
  if (!members || members.length === 0) {
    return { error: null };
  }

  const rows = members.map((m) => ({
    recipient_id: m.student_id,
    sender_id: senderId,
    type,
    title,
    body,
    link,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  return { error };
};

export const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
  return { error };
};
