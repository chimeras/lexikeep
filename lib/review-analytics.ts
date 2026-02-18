import { supabase } from '@/lib/supabase';

export interface ReviewAnalytics {
  dueNow: number;
  completedToday: number;
  masteredCount: number;
  totalReviewItems: number;
  activeStudentsToday: number;
}

const emptyAnalytics: ReviewAnalytics = {
  dueNow: 0,
  completedToday: 0,
  masteredCount: 0,
  totalReviewItems: 0,
  activeStudentsToday: 0,
};

const startOfTodayIso = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
};

export const getReviewAnalytics = async (): Promise<ReviewAnalytics> => {
  const nowIso = new Date().toISOString();
  const todayIso = startOfTodayIso();

  const [dueRes, completedTodayRes, masteredRes, totalRes, activeRowsRes] = await Promise.all([
    supabase.from('review_items').select('*', { count: 'exact', head: true }).lte('due_at', nowIso),
    supabase.from('review_items').select('*', { count: 'exact', head: true }).gte('last_reviewed_at', todayIso),
    supabase.from('review_items').select('*', { count: 'exact', head: true }).eq('status', 'mastered'),
    supabase.from('review_items').select('*', { count: 'exact', head: true }),
    supabase.from('review_items').select('student_id').gte('last_reviewed_at', todayIso),
  ]);

  const possibleMissingTable = [dueRes.error, completedTodayRes.error, masteredRes.error, totalRes.error, activeRowsRes.error]
    .filter(Boolean)
    .some((error) => error?.code === '42P01' || (error?.message ?? '').toLowerCase().includes('does not exist'));

  if (possibleMissingTable) {
    return emptyAnalytics;
  }

  const activeStudentIds = new Set(
    (((activeRowsRes.data as Array<{ student_id: string }> | null) ?? []).map((row) => row.student_id)),
  );

  return {
    dueNow: dueRes.count ?? 0,
    completedToday: completedTodayRes.count ?? 0,
    masteredCount: masteredRes.count ?? 0,
    totalReviewItems: totalRes.count ?? 0,
    activeStudentsToday: activeStudentIds.size,
  };
};
