-- ============================================================
-- LexiKeep: Notifications & Messaging Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- =====================
-- 1. NOTIFICATIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'system'
    CHECK (type IN ('announcement','moderation','badge','capsule','message','system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Students/teachers can read their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = recipient_id);

-- Teachers can insert notifications for anyone (announcements, moderation results)
-- Students can insert notifications (for badge unlocks, etc. via client)
-- We use a permissive insert policy — the app logic controls who can send what
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- =====================
-- 2. MESSAGES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (sender_id != recipient_id)
);

-- Indexes for conversation lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recipient
  ON messages(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can insert messages where they are the sender
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (mark as read)
CREATE POLICY "Recipients can update messages"
  ON messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);


-- =====================
-- 3. ENABLE SUPABASE REALTIME
-- =====================
-- Enable realtime for notifications (live bell updates)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime for messages (live chat updates)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- =====================
 -- 4. GRANT PERMISSIONS
 -- =====================
 GRANT ALL ON TABLE notifications TO postgres, service_role, authenticated, anon;
 GRANT ALL ON TABLE messages TO postgres, service_role, authenticated, anon;
