import { supabase } from '@/lib/supabase';
import { getStudentMetrics, type StudentMetrics } from '@/lib/student-data';
import type { DailyChallenge, Quest } from '@/types';

export interface QuestProgress {
  id: string;
  title: string;
  description: string;
  reward_points: number;
  target_value: number;
  current_value: number;
  completion_percent: number;
  is_completed: boolean;
}

const defaultDailyChallenge: Omit<DailyChallenge, 'id' | 'challenge_date' | 'created_by'> = {
  title: 'Context Builder',
  description: 'Write one original sentence using a new vocabulary word.',
  challenge_type: 'words',
  target_value: 1,
  reward_points: 20,
  is_active: true,
};

const defaultWeeklyQuests: Array<Omit<Quest, 'id' | 'start_date' | 'end_date' | 'created_by'>> = [
  {
    title: 'Word Hunter',
    description: 'Collect 5 new vocabulary words this week.',
    target_type: 'words',
    target_value: 5,
    reward_points: 40,
    is_active: true,
  },
  {
    title: 'Expression Explorer',
    description: 'Add 3 expressions with usage examples.',
    target_type: 'expressions',
    target_value: 3,
    reward_points: 40,
    is_active: true,
  },
  {
    title: 'Consistency Sprint',
    description: 'Reach a 3-day learning streak.',
    target_type: 'streak',
    target_value: 3,
    reward_points: 50,
    is_active: true,
  },
];

const metricValue = (metrics: StudentMetrics, targetType: string) => {
  if (targetType === 'words') {
    return metrics.wordsCollected;
  }
  if (targetType === 'expressions') {
    return metrics.expressionsCollected;
  }
  if (targetType === 'streak') {
    return metrics.streak;
  }
  return metrics.points;
};

export const getTodayDailyChallenge = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('challenge_date', today)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return {
      id: 'fallback-daily',
      challenge_date: today,
      created_by: null,
      ...defaultDailyChallenge,
    } satisfies DailyChallenge;
  }

  return data as DailyChallenge;
};

export const getWeeklyQuestProgress = async (studentId: string, metrics?: StudentMetrics): Promise<QuestProgress[]> => {
  const today = new Date().toISOString().slice(0, 10);
  const [metricsData, questResult] = await Promise.all([
    metrics ? Promise.resolve(metrics) : getStudentMetrics(studentId),
    supabase
      .from('quests')
      .select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('created_at', { ascending: true }),
  ]);

  const quests = ((questResult.data as Quest[] | null) ?? []).length > 0
    ? ((questResult.data as Quest[] | null) ?? [])
    : defaultWeeklyQuests.map((quest, index) => ({
        id: `fallback-quest-${index + 1}`,
        start_date: null,
        end_date: null,
        created_by: null,
        ...quest,
      }));

  return quests.map((quest) => {
    const currentValue = metricValue(metricsData, quest.target_type);
    const completionPercent = Math.min(100, Math.round((currentValue / Math.max(quest.target_value, 1)) * 100));
    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      reward_points: quest.reward_points,
      target_value: quest.target_value,
      current_value: currentValue,
      completion_percent: completionPercent,
      is_completed: currentValue >= quest.target_value,
    };
  });
};

export const getTeacherDailyChallenges = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('created_by', teacherId)
    .order('challenge_date', { ascending: false });
  return { data: (data as DailyChallenge[] | null) ?? [], error };
};

interface DailyChallengeInput {
  teacherId: string;
  title: string;
  description: string;
  challengeDate: string;
  challengeType: 'words' | 'expressions' | 'points' | 'streak';
  targetValue: number;
  rewardPoints: number;
  isActive: boolean;
}

export const createDailyChallenge = async ({
  teacherId,
  title,
  description,
  challengeDate,
  challengeType,
  targetValue,
  rewardPoints,
  isActive,
}: DailyChallengeInput) => {
  const { data, error } = await supabase
    .from('daily_challenges')
    .insert({
      title,
      description,
      challenge_date: challengeDate,
      challenge_type: challengeType,
      target_value: targetValue,
      reward_points: rewardPoints,
      is_active: isActive,
      created_by: teacherId,
    })
    .select()
    .single();
  return { data: (data as DailyChallenge | null) ?? null, error };
};

interface DailyChallengeUpdateInput extends DailyChallengeInput {
  id: string;
}

export const updateDailyChallenge = async ({
  id,
  teacherId,
  title,
  description,
  challengeDate,
  challengeType,
  targetValue,
  rewardPoints,
  isActive,
}: DailyChallengeUpdateInput) => {
  const { data, error } = await supabase
    .from('daily_challenges')
    .update({
      title,
      description,
      challenge_date: challengeDate,
      challenge_type: challengeType,
      target_value: targetValue,
      reward_points: rewardPoints,
      is_active: isActive,
    })
    .eq('id', id)
    .eq('created_by', teacherId)
    .select()
    .single();
  return { data: (data as DailyChallenge | null) ?? null, error };
};

export const deleteDailyChallenge = async (id: string, teacherId: string) => {
  const { error } = await supabase.from('daily_challenges').delete().eq('id', id).eq('created_by', teacherId);
  return { error };
};

export const getTeacherQuests = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  return { data: (data as Quest[] | null) ?? [], error };
};

interface QuestInput {
  teacherId: string;
  title: string;
  description: string;
  targetType: 'words' | 'expressions' | 'points' | 'streak';
  targetValue: number;
  rewardPoints: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

export const createQuest = async ({
  teacherId,
  title,
  description,
  targetType,
  targetValue,
  rewardPoints,
  startDate,
  endDate,
  isActive,
}: QuestInput) => {
  const { data, error } = await supabase
    .from('quests')
    .insert({
      title,
      description,
      target_type: targetType,
      target_value: targetValue,
      reward_points: rewardPoints,
      start_date: startDate || null,
      end_date: endDate || null,
      is_active: isActive,
      created_by: teacherId,
    })
    .select()
    .single();
  return { data: (data as Quest | null) ?? null, error };
};

interface QuestUpdateInput extends QuestInput {
  id: string;
}

export const updateQuest = async ({
  id,
  teacherId,
  title,
  description,
  targetType,
  targetValue,
  rewardPoints,
  startDate,
  endDate,
  isActive,
}: QuestUpdateInput) => {
  const { data, error } = await supabase
    .from('quests')
    .update({
      title,
      description,
      target_type: targetType,
      target_value: targetValue,
      reward_points: rewardPoints,
      start_date: startDate || null,
      end_date: endDate || null,
      is_active: isActive,
    })
    .eq('id', id)
    .eq('created_by', teacherId)
    .select()
    .single();
  return { data: (data as Quest | null) ?? null, error };
};

export const deleteQuest = async (id: string, teacherId: string) => {
  const { error } = await supabase.from('quests').delete().eq('id', id).eq('created_by', teacherId);
  return { error };
};
