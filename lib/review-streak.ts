import { supabase } from '@/lib/supabase';

const toDateKeyUtc = (isoValue: string) => isoValue.slice(0, 10);

const previousDateKeyUtc = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const computeConsecutiveStreak = (dateKeys: Set<string>) => {
  let streak = 0;
  let cursor = new Date().toISOString().slice(0, 10);

  while (dateKeys.has(cursor)) {
    streak += 1;
    cursor = previousDateKeyUtc(cursor);
  }

  return streak;
};

export const getStudentReviewStreak = async (studentId: string) => {
  const { data, error } = await supabase
    .from('review_items')
    .select('last_reviewed_at')
    .eq('student_id', studentId)
    .not('last_reviewed_at', 'is', null)
    .order('last_reviewed_at', { ascending: false })
    .limit(365);

  if (error) {
    if (error.code === '42P01') {
      return 0;
    }
    return 0;
  }

  const dateKeys = new Set(
    (((data as Array<{ last_reviewed_at: string | null }> | null) ?? [])
      .map((row) => row.last_reviewed_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => toDateKeyUtc(value))),
  );

  return computeConsecutiveStreak(dateKeys);
};

export const syncStudentReviewStreak = async (studentId: string) => {
  const streak = await getStudentReviewStreak(studentId);
  const { error } = await supabase.from('profiles').update({ streak }).eq('id', studentId);
  return { streak, error };
};
