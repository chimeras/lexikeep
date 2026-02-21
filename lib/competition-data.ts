import { supabase } from '@/lib/supabase';

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  words: number;
  expressions: number;
  streak: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  currentUserPosition: number | null;
  currentUserPoints: number;
}

export const getCompetitionLeaderboard = async (currentUserId?: string): Promise<LeaderboardResult> => {
  const { data: topProfiles, error } = await supabase
    .from('profiles')
    .select('id,username,avatar_url,points,streak')
    .order('points', { ascending: false })
    .limit(10);

  if (error || !topProfiles) {
    return {
      entries: [],
      currentUserPosition: null,
      currentUserPoints: 0,
    };
  }

  const entries = await Promise.all(
    topProfiles.map(async (profile) => {
      const [wordsRes, expressionsRes] = await Promise.all([
        supabase.from('vocabulary').select('*', { count: 'exact', head: true }).eq('student_id', profile.id),
        supabase.from('expressions').select('*', { count: 'exact', head: true }).eq('student_id', profile.id),
      ]);

      return {
        id: profile.id,
        username: profile.username ?? 'Student',
        avatar_url: profile.avatar_url ?? null,
        points: profile.points ?? 0,
        words: wordsRes.count ?? 0,
        expressions: expressionsRes.count ?? 0,
        streak: profile.streak ?? 0,
      } satisfies LeaderboardEntry;
    }),
  );

  if (!currentUserId) {
    return {
      entries,
      currentUserPosition: null,
      currentUserPoints: 0,
    };
  }

  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', currentUserId)
    .maybeSingle();

  const currentUserPoints = currentUserProfile?.points ?? 0;
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('points', currentUserPoints);

  return {
    entries,
    currentUserPosition: count !== null ? count + 1 : null,
    currentUserPoints,
  };
};
