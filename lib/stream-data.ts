import { supabase } from '@/lib/supabase';
import type { StreamMutedUser, StreamPost } from '@/types';

const STREAM_PAGE_SIZE = 10;

type StreamPostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author:
    | Array<{ id: string; username: string; avatar_url: string | null }>
    | { id: string; username: string; avatar_url: string | null }
    | null;
  likes: Array<{ id: string; post_id: string; user_id: string; created_at: string }> | null;
  comments:
    | Array<{
        id: string;
        post_id: string;
        user_id: string;
        comment: string;
        created_at: string;
        author:
          | Array<{ id: string; username: string; avatar_url: string | null }>
          | { id: string; username: string; avatar_url: string | null }
          | null;
      }>
    | null;
};

const normalizeAuthor = (
  author:
    | Array<{ id: string; username: string; avatar_url: string | null }>
    | { id: string; username: string; avatar_url: string | null }
    | null
) => {
  if (!author) return null;
  return Array.isArray(author) ? (author[0] ?? null) : author;
};

const mapStreamPost = (row: StreamPostRow): StreamPost => ({
  id: row.id,
  author_id: row.author_id,
  body: row.body,
  created_at: row.created_at,
  author: normalizeAuthor(row.author),
  likes: row.likes ?? [],
  comments: (row.comments ?? [])
    .map((comment) => ({
      ...comment,
      author: normalizeAuthor(comment.author),
    }))
    .sort((left, right) => left.created_at.localeCompare(right.created_at)),
});

export const getStreamPosts = async ({ offset = 0, limit = STREAM_PAGE_SIZE }: { offset?: number; limit?: number } = {}) => {
  const { data, error } = await supabase
    .from('stream_posts')
    .select(
      `
      id,
      author_id,
      body,
      created_at,
      author:profiles(id,username,avatar_url),
      likes:stream_post_likes(id,post_id,user_id,created_at),
      comments:stream_post_comments(
        id,
        post_id,
        user_id,
        comment,
        created_at,
        author:profiles(id,username,avatar_url)
      )
    `,
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    return { data: [] as StreamPost[], error };
  }

  return { data: (data as StreamPostRow[]).map(mapStreamPost), error: null };
};

export const createStreamPost = async ({ authorId, body }: { authorId: string; body: string }) => {
  const trimmed = body.trim();
  if (!trimmed) {
    return { error: { message: 'Post cannot be empty.' } };
  }
  const { error } = await supabase.from('stream_posts').insert({
    author_id: authorId,
    body: trimmed.slice(0, 280),
  });
  return { error };
};

export const createSystemStreamPost = async ({
  authorId,
  body,
}: {
  authorId: string;
  body: string;
}) => {
  const trimmed = body.trim();
  if (!trimmed) {
    return { error: { message: 'Post cannot be empty.' } };
  }
  const { error } = await supabase.from('stream_posts').insert({
    author_id: authorId,
    body: trimmed.slice(0, 280),
  });
  return { error };
};

export const toggleStreamLike = async ({
  postId,
  userId,
  liked,
}: {
  postId: string;
  userId: string;
  liked: boolean;
}) => {
  if (liked) {
    const { error } = await supabase
      .from('stream_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    return { error };
  }

  const { error } = await supabase.from('stream_post_likes').insert({
    post_id: postId,
    user_id: userId,
  });
  return { error };
};

export const createStreamComment = async ({
  postId,
  userId,
  comment,
}: {
  postId: string;
  userId: string;
  comment: string;
}) => {
  const trimmed = comment.trim();
  if (!trimmed) {
    return { error: { message: 'Comment cannot be empty.' } };
  }
  const { error } = await supabase.from('stream_post_comments').insert({
    post_id: postId,
    user_id: userId,
    comment: trimmed.slice(0, 280),
  });
  return { error };
};

type StreamMuteRow = {
  muted_user_id: string;
  muted_user:
    | Array<{ id: string; username: string | null; avatar_url: string | null }>
    | { id: string; username: string | null; avatar_url: string | null }
    | null;
};

export const getStreamMutedUsers = async (userId: string) => {
  const { data, error } = await supabase
    .from('stream_user_mutes')
    .select('muted_user_id, muted_user:profiles!stream_user_mutes_muted_user_id_fkey(id,username,avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: [] as StreamMutedUser[], error };
  }

  const mapped = (data as StreamMuteRow[]).map((row) => {
    const profile = Array.isArray(row.muted_user) ? (row.muted_user[0] ?? null) : row.muted_user;
    return {
      id: row.muted_user_id,
      username: profile?.username?.trim() || 'Student',
    };
  });

  return { data: mapped, error: null };
};

export const setStreamUserMuted = async ({
  userId,
  mutedUserId,
  muted,
}: {
  userId: string;
  mutedUserId: string;
  muted: boolean;
}) => {
  if (userId === mutedUserId) {
    return { error: { message: 'You cannot mute yourself.' } };
  }

  if (muted) {
    const { error } = await supabase.from('stream_user_mutes').insert({
      user_id: userId,
      muted_user_id: mutedUserId,
    });
    return { error };
  }

  const { error } = await supabase
    .from('stream_user_mutes')
    .delete()
    .eq('user_id', userId)
    .eq('muted_user_id', mutedUserId);
  return { error };
};

export const publishJoinPostIfMissing = async ({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) => {
  const joinText = `Just joined LexiKeep. Hi everyone, I am ${username}!`;
  const { data: existing } = await supabase
    .from('stream_posts')
    .select('id')
    .eq('author_id', userId)
    .eq('body', joinText)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { error: null };
  }

  const { error } = await supabase.from('stream_posts').insert({
    author_id: userId,
    body: joinText,
  });
  return { error };
};
