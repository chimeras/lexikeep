import { supabase } from '@/lib/supabase';
import type { Message, Profile } from '@/types';
import { createNotification } from './notifications-data';

export interface Conversation {
  partner: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>;
  lastMessage: Message;
  unreadCount: number;
}

const formatMessage = (msg: any): Message => {
  return {
    id: msg.id,
    sender_id: msg.sender_id,
    recipient_id: msg.recipient_id,
    body: msg.body,
    is_read: msg.is_read,
    created_at: msg.created_at,
    sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender || null,
    recipient: Array.isArray(msg.recipient) ? msg.recipient[0] : msg.recipient || null,
  };
};

export const getConversations = async (userId: string): Promise<{ data: Conversation[]; error: any }> => {
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      recipient_id,
      body,
      is_read,
      created_at,
      sender:profiles!sender_id(id, username, avatar_url, role),
      recipient:profiles!recipient_id(id, username, avatar_url, role)
    `)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error };
  }

  const conversationMap = new Map<string, Conversation>();

  for (const msg of (messages as any[] || [])) {
    const formatted = formatMessage(msg);
    const isSender = formatted.sender_id === userId;
    const partner = isSender ? formatted.recipient : formatted.sender;
    if (!partner) continue;

    const partnerId = partner.id;
    const existing = conversationMap.get(partnerId);

    const isUnread = !formatted.is_read && formatted.recipient_id === userId;

    if (!existing) {
      conversationMap.set(partnerId, {
        partner,
        lastMessage: formatted,
        unreadCount: isUnread ? 1 : 0,
      });
    } else {
      if (isUnread) {
        existing.unreadCount += 1;
      }
    }
  }

  const conversations = Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  );

  return { data: conversations, error: null };
};

export const getMessages = async (userId: string, partnerId: string) => {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      recipient_id,
      body,
      is_read,
      created_at,
      sender:profiles!sender_id(id, username, avatar_url, role),
      recipient:profiles!recipient_id(id, username, avatar_url, role)
    `)
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return { data: [], error };
  }

  return { data: (data as any[]).map(formatMessage), error: null };
};

export const sendMessage = async ({
  senderId,
  recipientId,
  body,
}: {
  senderId: string;
  recipientId: string;
  body: string;
}) => {
  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      body: body.trim(),
    })
    .select(`
      id,
      sender_id,
      recipient_id,
      body,
      is_read,
      created_at,
      sender:profiles!sender_id(id, username, avatar_url, role),
      recipient:profiles!recipient_id(id, username, avatar_url, role)
    `)
    .single();

  if (msgError || !msg) {
    return { data: null, error: msgError };
  }

  const formatted = formatMessage(msg);
  const senderUsername = formatted.sender?.username || 'Someone';
  const { error: notifError } = await createNotification({
    recipientId,
    senderId,
    type: 'message',
    title: `New message from ${senderUsername}`,
    body: body.length > 60 ? `${body.slice(0, 57)}...` : body,
    link: '/inbox',
  });

  if (notifError) {
    console.error('Failed to create message notification:', notifError);
  }

  return { data: formatted, error: null };
};

export const markMessagesRead = async (userId: string, partnerId: string) => {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('sender_id', partnerId)
    .eq('is_read', false);
  return { error };
};

export const getUnreadMessageCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  return { count: count ?? 0, error };
};

export const getStudentTeachers = async (studentId: string) => {
  const { data, error } = await supabase
    .from('class_memberships')
    .select(`
      class_id,
      class:classes (
        id,
        name,
        teacher:profiles (
          id,
          username,
          avatar_url,
          role
        )
      )
    `)
    .eq('student_id', studentId);

  if (error || !data) {
    return { data: [], error };
  }

  const teachersMap = new Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>>();
  for (const item of (data as any[])) {
    const teacher = item.class?.teacher;
    if (teacher) {
      teachersMap.set(teacher.id, teacher);
    }
  }

  return { data: Array.from(teachersMap.values()), error: null };
};

export const getTeacherStudents = async (teacherId: string) => {
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('teacher_id', teacherId);

  if (classError || !classes || classes.length === 0) {
    return { data: [], error: classError };
  }

  const classIds = classes.map((c) => c.id);

  const { data: memberships, error: memError } = await supabase
    .from('class_memberships')
    .select(`
      student:profiles (
        id,
        username,
        avatar_url,
        role
      )
    `)
    .in('class_id', classIds);

  if (memError || !memberships) {
    return { data: [], error: memError };
  }

  const studentsMap = new Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>>();
  for (const item of (memberships as any[])) {
    const student = item.student;
    if (student) {
      studentsMap.set(student.id, student);
    }
  }

  return { data: Array.from(studentsMap.values()), error: null };
};
