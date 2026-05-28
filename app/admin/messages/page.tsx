'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  getConversations,
  getMessages,
  sendMessage,
  markMessagesRead,
  getTeacherStudents,
  type Conversation,
} from '@/lib/messages-data';
import type { Message, Profile } from '@/types';
import { Send, User, MessageSquare, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function TeacherMessagesPage() {
  const { profile } = useAuth();
  const userId = profile?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [students, setStudents] = useState<Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Load initial conversations and student list
  useEffect(() => {
    if (!userId) return;

    const initData = async () => {
      setLoading(true);
      const [convsRes, studentsRes] = await Promise.all([
        getConversations(userId),
        getTeacherStudents(userId),
      ]);
      setConversations(convsRes.data || []);
      setStudents(studentsRes.data || []);
      setLoading(false);
    };

    void initData();

    // Subscribe to messages table
    const channel = supabase
      .channel(`teacher-messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === userId || newMsg.recipient_id === userId) {
            const { data } = await getConversations(userId);
            setConversations(data || []);

            if (
              selectedPartner &&
              ((newMsg.sender_id === userId && newMsg.recipient_id === selectedPartner.id) ||
                (newMsg.sender_id === selectedPartner.id && newMsg.recipient_id === userId))
            ) {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, role')
                .eq('id', newMsg.sender_id)
                .maybeSingle();

              const enrichedMsg: Message = {
                ...newMsg,
                sender: senderProfile,
              };

              setMessages((prev) => [...prev, enrichedMsg]);

              if (newMsg.recipient_id === userId) {
                await markMessagesRead(userId, selectedPartner.id);
                setConversations((prev) =>
                  prev.map((c) =>
                    c.partner.id === selectedPartner.id ? { ...c, unreadCount: 0 } : c
                  )
                );
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, selectedPartner]);

  // Load messages when selecting partner
  useEffect(() => {
    if (!userId || !selectedPartner) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      const { data } = await getMessages(userId, selectedPartner.id);
      setMessages(data || []);
      setLoadingMessages(false);

      await markMessagesRead(userId, selectedPartner.id);
      setConversations((prev) =>
        prev.map((c) =>
          c.partner.id === selectedPartner.id ? { ...c, unreadCount: 0 } : c
        )
      );
    };

    void loadMessages();
  }, [userId, selectedPartner]);

  const handleSelectPartner = (partner: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>) => {
    setSelectedPartner(partner);
    setMobileShowChat(true);
    setShowNewChatModal(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedPartner || !inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');

    const { data, error } = await sendMessage({
      senderId: userId,
      recipientId: selectedPartner.id,
      body: textToSend,
    });

    if (error) {
      console.error('Error sending message:', error);
    } else if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setConversations((prev) => {
        const existing = prev.find((c) => c.partner.id === selectedPartner.id);
        if (existing) {
          return [
            {
              ...existing,
              lastMessage: data,
            },
            ...prev.filter((c) => c.partner.id !== selectedPartner.id),
          ];
        }
        return prev;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 pt-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-900 border-t-transparent mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl gap-4 px-4 pt-20 pb-4 md:px-6">
      {/* Sidebar / Conversation List */}
      <div
        className={`w-full md:w-80 shrink-0 flex flex-col border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
          <h1 className="font-bold text-lg text-slate-800">Messages</h1>
          <button
            type="button"
            onClick={() => setShowNewChatModal(true)}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black transition-colors"
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              No messages yet
            </div>
          ) : (
            conversations.map((c) => {
              const active = selectedPartner?.id === c.partner.id;
              return (
                <button
                  key={c.partner.id}
                  onClick={() => handleSelectPartner(c.partner)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    active
                      ? 'bg-slate-100 text-slate-800'
                      : 'hover:bg-slate-50 text-gray-700'
                  }`}
                >
                  <div className="relative shrink-0">
                    {c.partner.avatar_url ? (
                      <Image
                        src={c.partner.avatar_url}
                        alt={c.partner.username}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <User size={20} />
                      </div>
                    )}
                    {c.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate">{c.partner.username}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(c.lastMessage.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${c.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {c.lastMessage.body}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Message Panel */}
      <div
        className={`flex-1 flex flex-col border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm ${
          !mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedPartner ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setMobileShowChat(false)}
                className="p-1 text-gray-500 hover:bg-slate-100 rounded-lg md:hidden"
              >
                <ArrowLeft size={20} />
              </button>
              {selectedPartner.avatar_url ? (
                <Image
                  src={selectedPartner.avatar_url}
                  alt={selectedPartner.username}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <User size={18} />
                </div>
              )}
              <div>
                <h2 className="font-semibold text-slate-800 text-sm leading-tight">
                  {selectedPartner.username}
                </h2>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  {selectedPartner.role}
                </span>
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-950 border-t-transparent"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-400">
                  <MessageSquare className="h-8 w-8 text-gray-300 mb-2" />
                  No messages yet. Send a message to start!
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === userId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                          isOwn
                            ? 'bg-gray-900 text-white rounded-br-none'
                            : 'bg-white text-gray-800 border border-slate-100 rounded-bl-none'
                        }`}
                      >
                        <p className="break-words leading-relaxed">{msg.body}</p>
                        <span
                          className={`block text-[9px] text-right mt-1 ${
                            isOwn ? 'text-slate-300' : 'text-gray-400'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-3 border-t border-slate-100 flex gap-2 shrink-0 bg-white">
              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                maxLength={500}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-950"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-800 mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Direct Messages</h3>
            <p className="text-sm text-gray-400 max-w-sm mt-1">
              Select a conversation from the sidebar or start a chat with one of your students.
            </p>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors shadow-sm"
            >
              Select Student
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Start New Chat</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {students.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  No students found in your classes.
                </div>
              ) : (
                students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectPartner(student)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left text-gray-700"
                  >
                    {student.avatar_url ? (
                      <Image
                        src={student.avatar_url}
                        alt={student.username}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <User size={18} />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm">{student.username}</p>
                      <span className="text-[10px] text-gray-400">Student</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
