import { syncStudentBadges } from '@/lib/badges-service';
import { syncStudentReviewStreak } from '@/lib/review-streak';
import { awardStudentPoints } from '@/lib/student-data';
import { supabase } from '@/lib/supabase';
import type { ReviewItem } from '@/types';

export type ReviewRating = 'easy' | 'hard';

const REVIEW_POINTS: Record<ReviewRating, number> = {
  easy: 6,
  hard: 2,
};

const toIsoAfterDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export const getDueReviewItems = async (studentId: string, limit = 20) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('review_items')
    .select('*')
    .eq('student_id', studentId)
    .lte('due_at', nowIso)
    .order('due_at', { ascending: true })
    .limit(limit);
  return { data: ((data as ReviewItem[] | null) ?? []), error };
};

export const getDueReviewCount = async (studentId: string) => {
  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from('review_items')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .lte('due_at', nowIso);
  return { count: count ?? 0, error };
};

export const getReviewsCompletedTodayCount = async (studentId: string) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const { count, error } = await supabase
    .from('review_items')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('last_reviewed_at', todayStart);
  return { count: count ?? 0, error };
};

const nextSchedule = (item: ReviewItem, rating: ReviewRating) => {
  if (rating === 'hard') {
    return {
      repetitions: 0,
      interval_days: 1,
      ease_factor: Math.max(1.3, Number(item.ease_factor) - 0.2),
      status: 'learning' as const,
    };
  }

  const repetitions = item.repetitions + 1;
  const ease = Math.min(3.5, Number(item.ease_factor) + 0.1);
  const nextInterval =
    repetitions <= 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round(item.interval_days * ease));
  const status = repetitions >= 5 ? ('mastered' as const) : ('learning' as const);

  return {
    repetitions,
    interval_days: nextInterval,
    ease_factor: ease,
    status,
  };
};

export const submitReviewRating = async (studentId: string, item: ReviewItem, rating: ReviewRating) => {
  const schedule = nextSchedule(item, rating);
  const nowIso = new Date().toISOString();
  const nextDue = toIsoAfterDays(schedule.interval_days);

  const { data, error } = await supabase
    .from('review_items')
    .update({
      repetitions: schedule.repetitions,
      interval_days: schedule.interval_days,
      ease_factor: schedule.ease_factor,
      status: schedule.status,
      due_at: nextDue,
      last_reviewed_at: nowIso,
    })
    .eq('id', item.id)
    .eq('student_id', studentId)
    .select()
    .single();

  if (error) {
    return { data: null, unlockedBadges: [], error };
  }

  await awardStudentPoints(studentId, REVIEW_POINTS[rating]);
  await syncStudentReviewStreak(studentId);
  const badgeResult = await syncStudentBadges(studentId);

  return {
    data: (data as ReviewItem) ?? null,
    unlockedBadges: badgeResult.unlockedBadges,
    error: null,
  };
};
