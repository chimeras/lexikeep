'use client';

import { Brain, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getDueReviewItems, submitReviewRating } from '@/lib/review-data';
import type { ReviewItem, StudentBadge } from '@/types';

export default function ReviewPage() {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [badgeMessage, setBadgeMessage] = useState<string | null>(null);
  const current = useMemo(() => queue[0] ?? null, [queue]);

  const loadQueue = async () => {
    if (!profile?.id) {
      setQueue([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await getDueReviewItems(profile.id, 30);
    setQueue(data);
    setLoading(false);
  };

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    setIsFlipped(false);
  }, [current?.id]);

  const onRate = async (rating: 'easy' | 'hard') => {
    if (!profile?.id || !current || submitting) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    setBadgeMessage(null);

    const { error, unlockedBadges } = await submitReviewRating(profile.id, current, rating);
    if (error) {
      setFeedback(error.message);
      setSubmitting(false);
      return;
    }

    setQueue((prev) => prev.slice(1));
    setFeedback(rating === 'easy' ? '+6 points. Nice recall.' : '+2 points. Keep practicing.');
    if (unlockedBadges.length > 0) {
      const names = unlockedBadges.map((badge: StudentBadge) => badge.name).join(', ');
      setBadgeMessage(`Badge unlocked: ${names}`);
    }
    await refreshProfile();
    setSubmitting(false);
  };

  return (
    <section className="mx-auto grid max-w-3xl gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">
          <Brain size={14} />
          Review Sprint
        </div>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Spaced Repetition Queue</h1>
        <p className="mt-1 text-sm text-indigo-50">
          Clear due cards to strengthen memory and earn bonus points.
        </p>
        <p className="mt-4 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
          Due now: {queue.length}
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm">Loading your review queue...</div>
      ) : !current ? (
        <div className="rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-emerald-600" size={28} />
          <h2 className="mt-2 text-xl font-bold text-slate-900">All caught up</h2>
          <p className="mt-1 text-sm text-slate-600">No cards are due right now. Add new terms to keep momentum.</p>
          <Link
            href="/vocabulary#collector"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Sparkles size={16} />
            Add New Vocabulary
          </Link>
        </div>
      ) : (
        <article className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-100 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {current.source_type === 'vocabulary' ? 'Word' : 'Expression'}
            </span>
            <span className="text-xs font-semibold text-slate-500">Card {1} of {queue.length}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsFlipped((prev) => !prev)}
            className="flashcard-3d mt-1 w-full text-left"
          >
            <div className={`flashcard-3d-inner ${isFlipped ? 'is-flipped' : ''}`}>
              <div className="flashcard-face min-h-56 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-5 hover:border-indigo-300">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Front (Prompt)</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">{current.prompt}</p>
                {current.context_hint && (
                  <p className="mt-3 rounded-lg bg-white/80 p-3 text-sm italic text-slate-600">
                    {current.context_hint}
                  </p>
                )}
                <p className="mt-3 text-xs font-semibold text-indigo-700">Tap to flip and reveal answer</p>
              </div>

              <div className="flashcard-face flashcard-back min-h-56 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Back (Answer)</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{current.answer}</p>
                <p className="mt-3 text-xs font-semibold text-cyan-700">Tap again to hide</p>
              </div>
            </div>
          </button>

          {feedback && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm font-medium text-emerald-700">{feedback}</p>}
          {badgeMessage && <p className="mt-2 rounded-lg bg-violet-50 p-2 text-sm font-medium text-violet-700">{badgeMessage}</p>}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void onRate('hard')}
              disabled={submitting || !isFlipped}
              className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              <RotateCcw size={16} />
              Need Practice (+2)
            </button>
            <button
              type="button"
              onClick={() => void onRate('easy')}
              disabled={submitting || !isFlipped}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white hover:from-blue-700 hover:to-cyan-600 disabled:opacity-60"
            >
              I Got It (+6)
            </button>
          </div>
          {!isFlipped && (
            <p className="mt-2 text-center text-xs font-medium text-slate-500">
              Flip the card first, then rate your recall.
            </p>
          )}
        </article>
      )}
    </section>
  );
}
