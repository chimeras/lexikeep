'use client';

import { RefreshCcw, Send, ThumbsUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { createStreamPost, getStreamMutedUsers, getStreamPosts, setStreamUserMuted, toggleStreamLike } from '@/lib/stream-data';
import { supabase } from '@/lib/supabase';
import type { StreamMutedUser, StreamPost } from '@/types';
import InlineSpinner from '@/components/ui/InlineSpinner';

const PAGE_SIZE = 10;

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso);
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
  return `${Math.floor(diffSeconds / 86400)}d`;
};

interface ActivityStreamProps {
  compact?: boolean;
}

export default function ActivityStream({ compact = false }: ActivityStreamProps) {
  const { profile, user } = useAuth();
  const studentId = profile?.id ?? user?.id ?? null;
  const [posts, setPosts] = useState<StreamPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composer, setComposer] = useState('');
  const [mutedUsers, setMutedUsers] = useState<StreamMutedUser[]>([]);
  const [muteTargetId, setMuteTargetId] = useState<string | null>(null);

  const loadMutedUsers = async () => {
    if (!studentId) {
      setMutedUsers([]);
      return;
    }
    const result = await getStreamMutedUsers(studentId);
    setMutedUsers(result.data);
  };

  const loadInitial = async () => {
    setLoading(true);
    const result = await getStreamPosts({ offset: 0, limit: PAGE_SIZE });
    setPosts(result.data);
    setHasMore(result.data.length === PAGE_SIZE);
    setLoading(false);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const result = await getStreamPosts({ offset: posts.length, limit: PAGE_SIZE });
    setPosts((previous) => [...previous, ...result.data]);
    setHasMore(result.data.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const refreshTop = async () => {
    setRefreshing(true);
    const result = await getStreamPosts({ offset: 0, limit: Math.max(posts.length, PAGE_SIZE) });
    setPosts(result.data);
    setHasMore(result.data.length >= PAGE_SIZE);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadInitial();
    void loadMutedUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    const channel = supabase
      .channel('activity-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stream_posts' }, () => {
        void refreshTop();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_post_likes' }, () => {
        void refreshTop();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);

  const handlePost = async () => {
    if (!studentId || posting) return;
    setPosting(true);
    const { error } = await createStreamPost({ authorId: studentId, body: composer });
    if (!error) {
      setComposer('');
      await refreshTop();
    }
    setPosting(false);
  };

  const handleLikeToggle = async (post: StreamPost) => {
    if (!studentId) return;
    const liked = (post.likes ?? []).some((like) => like.user_id === studentId);
    const { error } = await toggleStreamLike({ postId: post.id, userId: studentId, liked });
    if (!error) {
      await refreshTop();
    }
  };

  const streamTitle = useMemo(() => (refreshing ? 'Refreshing stream...' : 'Live Student Stream'), [refreshing]);
  const mutedIds = useMemo(() => new Set(mutedUsers.map((user) => user.id)), [mutedUsers]);
  const getActivityLabel = (body: string) => {
    const text = body.toLowerCase();
    if (text.includes('level')) return 'Level Up';
    if (text.includes('expression')) return 'Expression';
    if (text.includes('vocabulary') || text.includes('word')) return 'Vocabulary';
    return 'Update';
  };
  const getDisplayBody = (username: string, body: string) => {
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return body.replace(new RegExp(`^${escaped}\\s+`, 'i'), '');
  };
  const getAuthorInitial = (name: string) => name.trim().charAt(0).toUpperCase() || 'S';
  const handleMuteToggle = async ({ targetId, muted }: { targetId: string; muted: boolean }) => {
    if (!studentId || muteTargetId) return;
    setMuteTargetId(targetId);
    const result = await setStreamUserMuted({
      userId: studentId,
      mutedUserId: targetId,
      muted,
    });
    if (!result.error) {
      await loadMutedUsers();
      await refreshTop();
    }
    setMuteTargetId(null);
  };

  return (
    <article className={`card-pop rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm ${compact ? 'p-3 md:p-4' : 'p-4'}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`${compact ? 'text-base md:text-lg' : 'text-lg'} font-bold text-slate-900`}>{streamTitle}</h2>
        <button
          type="button"
          onClick={() => void refreshTop()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw size={13} />
          Refresh
        </button>
      </div>

      <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-2.5' : 'p-3'}`}>
        <textarea
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
          maxLength={280}
          placeholder="Share an update with your class..."
          className={`w-full resize-none rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:border-blue-400 ${
            compact ? 'h-16' : 'h-20'
          }`}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-500">{composer.length}/280</p>
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={posting || composer.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {posting ? <InlineSpinner size={12} /> : <Send size={13} />}
            Post
          </button>
        </div>
      </div>

      {mutedUsers.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2.5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Muted users</p>
          <div className="flex flex-wrap gap-1.5">
            {mutedUsers.map((mutedUser) => (
              <button
                key={mutedUser.id}
                type="button"
                onClick={() => void handleMuteToggle({ targetId: mutedUser.id, muted: false })}
                disabled={muteTargetId === mutedUser.id}
                className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-60"
              >
                {muteTargetId === mutedUser.id ? 'Updating...' : `Unmute ${mutedUser.username}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Loading stream...</p>
      ) : posts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No posts yet. Be the first to post.</p>
      ) : (
        <div className={`mt-4 ${compact ? 'space-y-2.5' : 'space-y-3'}`}>
          {posts.map((post, index) => {
            const likedByMe = (post.likes ?? []).some((like) => like.user_id === studentId);
            const authorName = post.author?.username ?? 'Student';
            const activityLabel = getActivityLabel(post.body);
            const message = getDisplayBody(authorName, post.body);
            const isOwnPost = post.author_id === studentId;
            const isMuted = mutedIds.has(post.author_id);
            return (
              <div
                key={post.id}
                className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-2.5' : 'p-3'} ${
                  index % 2 === 0 ? 'shadow-[0_1px_0_0_rgba(14,165,233,0.12)]' : 'shadow-[0_1px_0_0_rgba(16,185,129,0.12)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-bold text-white">
                      {getAuthorInitial(authorName)}
                    </div>
                    <p className="truncate text-sm font-semibold text-slate-900">{authorName}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {activityLabel}
                    </span>
                  </div>
                  <p className="shrink-0 text-[11px] font-medium text-slate-500">{formatRelativeTime(post.created_at)}</p>
                </div>
                <p className={`mt-1.5 text-slate-800 ${compact ? 'text-[13px] leading-5' : 'text-sm'}`}>
                  {message}
                </p>

                <div className={`flex items-center justify-between gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
                  <button
                    type="button"
                    onClick={() => void handleLikeToggle(post)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                      likedByMe ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <ThumbsUp size={13} />
                    {(post.likes ?? []).length}
                  </button>
                  {!isOwnPost && (
                    <button
                      type="button"
                      onClick={() => void handleMuteToggle({ targetId: post.author_id, muted: !isMuted })}
                      disabled={muteTargetId === post.author_id}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-60"
                    >
                      {muteTargetId === post.author_id ? 'Updating...' : isMuted ? 'Unmute' : 'Mute'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </article>
  );
}
