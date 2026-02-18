import { calculateBoostedPoints, getActiveBoost } from '@/lib/boosts-data';
import { getStudentReviewStreak } from '@/lib/review-streak';
import { supabase } from '@/lib/supabase';
import type { DailyChallenge, Expression, Profile, Vocabulary } from '@/types';

export interface StudentMetrics {
  points: number;
  streak: number;
  wordsCollected: number;
  expressionsCollected: number;
}

export const incrementStudentPoints = async (studentId: string, delta: number) => {
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', studentId)
    .maybeSingle();

  if (readError) {
    return { error: readError };
  }

  const nextPoints = (profile?.points ?? 0) + delta;
  const { error: updateError } = await supabase.from('profiles').update({ points: nextPoints }).eq('id', studentId);
  return { error: updateError };
};

export const awardStudentPoints = async (studentId: string, basePoints: number) => {
  const boostResult = await getActiveBoost();
  const awardedPoints = calculateBoostedPoints(basePoints, boostResult.data);
  const result = await incrementStudentPoints(studentId, awardedPoints);
  return { ...result, awardedPoints, boost: boostResult.data };
};

const normalizeForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildDailyHookCandidates = (challenge: Pick<DailyChallenge, 'title' | 'description'>) => {
  const candidates = new Set<string>();
  const addCandidate = (candidate: string | null | undefined) => {
    if (!candidate) return;
    const normalized = normalizeForMatch(candidate);
    if (normalized) {
      candidates.add(normalized);
    }
  };

  addCandidate(challenge.title);
  addCandidate(challenge.description);

  const titleParts = challenge.title.split(':');
  if (titleParts.length > 1) {
    addCandidate(titleParts.slice(1).join(':'));
  }

  const quotedMatches = [...challenge.title.matchAll(/"([^"]+)"/g), ...(challenge.description ? [...challenge.description.matchAll(/"([^"]+)"/g)] : [])];
  quotedMatches.forEach((match) => addCandidate(match[1]));

  return [...candidates];
};

const claimDailyHookBonus = async ({
  studentId,
  vocabularyId,
  word,
}: {
  studentId: string;
  vocabularyId: string;
  word: string;
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data: challengeData, error: challengeError } = await supabase
    .from('daily_challenges')
    .select('id,title,description,reward_points,challenge_type')
    .eq('challenge_date', today)
    .eq('is_active', true)
    .maybeSingle();

  if (challengeError || !challengeData) {
    return { matched: false, bonusPoints: 0, error: null };
  }

  if (challengeData.challenge_type !== 'words') {
    return { matched: false, bonusPoints: 0, error: null };
  }

  const normalizedWord = normalizeForMatch(word);
  const candidates = buildDailyHookCandidates({
    title: challengeData.title,
    description: challengeData.description,
  });
  const matched = candidates.includes(normalizedWord);

  if (!matched) {
    return { matched: false, bonusPoints: 0, error: null };
  }

  const { data: claimRow, error: claimError } = await supabase
    .from('daily_challenge_claims')
    .insert({
      challenge_id: challengeData.id,
      student_id: studentId,
      vocabulary_id: vocabularyId,
      points_awarded: 0,
    })
    .select('id')
    .single();

  if (claimError?.code === '42P01') {
    return { matched: true, bonusPoints: 0, error: null };
  }
  if (claimError?.code === '23505') {
    return { matched: true, bonusPoints: 0, error: null };
  }
  if (claimError) {
    return { matched: true, bonusPoints: 0, error: claimError };
  }

  const awardResult = await awardStudentPoints(studentId, challengeData.reward_points ?? 0);
  if (awardResult.error) {
    await supabase.from('daily_challenge_claims').delete().eq('id', claimRow.id);
    return { matched: true, bonusPoints: 0, error: awardResult.error };
  }

  await supabase
    .from('daily_challenge_claims')
    .update({ points_awarded: awardResult.awardedPoints })
    .eq('id', claimRow.id);

  return { matched: true, bonusPoints: awardResult.awardedPoints, error: null };
};

export const getStudentMetrics = async (studentId: string): Promise<StudentMetrics> => {
  const [profileRes, wordsRes, expressionsRes, reviewStreak] = await Promise.all([
    supabase.from('profiles').select('points').eq('id', studentId).maybeSingle(),
    supabase.from('vocabulary').select('*', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('expressions').select('*', { count: 'exact', head: true }).eq('student_id', studentId),
    getStudentReviewStreak(studentId),
  ]);

  const profile = profileRes.data as Pick<Profile, 'points'> | null;
  return {
    points: profile?.points ?? 0,
    streak: reviewStreak,
    wordsCollected: wordsRes.count ?? 0,
    expressionsCollected: expressionsRes.count ?? 0,
  };
};

export const getStudentVocabulary = async (studentId: string) => {
  const { data, error } = await supabase
    .from('vocabulary')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  return { data: (data as Vocabulary[] | null) ?? [], error };
};

const ensureReviewItem = async ({
  studentId,
  sourceType,
  sourceId,
  prompt,
  answer,
  contextHint,
}: {
  studentId: string;
  sourceType: 'vocabulary' | 'expression';
  sourceId: string;
  prompt: string;
  answer: string;
  contextHint?: string;
}) => {
  const { error } = await supabase.from('review_items').upsert(
    {
      student_id: studentId,
      source_type: sourceType,
      source_id: sourceId,
      prompt,
      answer,
      context_hint: contextHint ?? null,
      due_at: new Date().toISOString(),
    },
    {
      onConflict: 'student_id,source_type,source_id',
      ignoreDuplicates: true,
    },
  );

  if (error && error.code !== '42P01') {
    return { error };
  }

  return { error: null };
};

interface NewVocabularyInput {
  studentId: string;
  word: string;
  definition: string;
  exampleSentence: string;
  category?: string;
  imageUrl?: string;
}

export const createStudentVocabulary = async ({
  studentId,
  word,
  definition,
  exampleSentence,
  category,
  imageUrl,
}: NewVocabularyInput) => {
  const { data, error } = await supabase
    .from('vocabulary')
    .insert({
      word,
      definition,
      example_sentence: exampleSentence,
      image_url: imageUrl?.trim() || null,
      category: category || null,
      student_id: studentId,
      difficulty: 'medium',
      status: 'learning',
      tags: [],
    })
    .select()
    .single();

  if (error) {
    return { data: null, error };
  }

  await ensureReviewItem({
    studentId,
    sourceType: 'vocabulary',
    sourceId: data.id,
    prompt: data.word,
    answer: data.definition,
    contextHint: data.example_sentence ?? undefined,
  });

  await awardStudentPoints(studentId, 10);
  const dailyHookResult = await claimDailyHookBonus({
    studentId,
    vocabularyId: data.id,
    word,
  });
  if (dailyHookResult.error) {
    return { data: null, error: dailyHookResult.error, dailyHookBonusPoints: 0, dailyHookMatched: false };
  }

  return {
    data: data as Vocabulary,
    error: null,
    dailyHookBonusPoints: dailyHookResult.bonusPoints,
    dailyHookMatched: dailyHookResult.matched,
  };
};

interface NewExpressionInput {
  studentId: string;
  expression: string;
  meaning: string;
  usageExample: string;
  category?: string;
}

export const createStudentExpression = async ({
  studentId,
  expression,
  meaning,
  usageExample,
  category,
}: NewExpressionInput) => {
  const { data, error } = await supabase
    .from('expressions')
    .insert({
      expression,
      meaning,
      usage_example: usageExample,
      context: category || null,
      student_id: studentId,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error };
  }

  await ensureReviewItem({
    studentId,
    sourceType: 'expression',
    sourceId: data.id,
    prompt: data.expression,
    answer: data.meaning,
    contextHint: data.usage_example ?? undefined,
  });

  await awardStudentPoints(studentId, 12);

  return { data: data as Expression, error: null };
};
