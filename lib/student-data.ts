import { calculateBoostedPoints, getActiveBoost } from '@/lib/boosts-data';
import { getLevelInfo } from '@/lib/levels';
import { getStudentReviewStreak } from '@/lib/review-streak';
import { createSystemStreamPost } from '@/lib/stream-data';
import { supabase } from '@/lib/supabase';
import type { DailyChallenge, Expression, Profile, Vocabulary } from '@/types';

export interface StudentMetrics {
  points: number;
  streak: number;
  wordsCollected: number;
  expressionsCollected: number;
}

type EntryUniquenessTier = 'unique' | 'near_duplicate' | 'duplicate';

interface EntryUniquenessResult {
  tier: EntryUniquenessTier;
  basePointsToAward: number;
}

const UNIQUENESS_NEAR_DUPLICATE_THRESHOLD = 0.86;
const UNIQUENESS_NEAR_DUPLICATE_MULTIPLIER = 0.5;
const UNIQUENESS_SCAN_LIMIT = 1500;
const DB_UNDEFINED_COLUMN_CODE = '42703';

export const incrementStudentPoints = async (studentId: string, delta: number) => {
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', studentId)
    .maybeSingle();

  if (readError) {
    return { error: readError, previousPoints: null as number | null, nextPoints: null as number | null };
  }

  const previousPoints = profile?.points ?? 0;
  const nextPoints = previousPoints + delta;
  const { error: updateError } = await supabase.from('profiles').update({ points: nextPoints }).eq('id', studentId);
  return { error: updateError, previousPoints, nextPoints };
};

export const awardStudentPoints = async (studentId: string, basePoints: number) => {
  const boostResult = await getActiveBoost();
  const awardedPoints = calculateBoostedPoints(basePoints, boostResult.data);
  const result = await incrementStudentPoints(studentId, awardedPoints);
  if (!result.error && result.previousPoints !== null && result.nextPoints !== null) {
    const previousLevel = getLevelInfo(result.previousPoints);
    const nextLevel = getLevelInfo(result.nextPoints);
    if (nextLevel.level > previousLevel.level) {
      await createSystemStreamPost({
        authorId: studentId,
        body: `Reached Level ${nextLevel.level} (${nextLevel.title}).`,
      });
    }
  }

  return { ...result, awardedPoints, boost: boostResult.data };
};

const normalizeForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const previous = new Array(right.length + 1).fill(0).map((_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
};

const tokenJaccardSimilarity = (left: string, right: string) => {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const stringSimilarity = (left: string, right: string) => {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 1;
  const editSimilarity = 1 - levenshteinDistance(left, right) / maxLength;
  const tokenSimilarity = tokenJaccardSimilarity(left, right);
  return Math.max(editSimilarity, tokenSimilarity);
};

const evaluateEntryUniqueness = async ({
  table,
  normalizedColumn,
  valueColumn,
  studentId,
  rawValue,
  basePoints,
}: {
  table: 'vocabulary' | 'expressions';
  normalizedColumn: 'normalized_word' | 'normalized_expression';
  valueColumn: 'word' | 'expression';
  studentId: string;
  rawValue: string;
  basePoints: number;
}): Promise<EntryUniquenessResult> => {
  const normalizedCandidate = normalizeForMatch(rawValue);
  if (!normalizedCandidate) {
    return { tier: 'unique', basePointsToAward: basePoints };
  }

  const exactMatchResult = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(normalizedColumn, normalizedCandidate)
    .neq('student_id', studentId)
    .limit(1);

  if (!exactMatchResult.error && (exactMatchResult.count ?? 0) > 0) {
    return { tier: 'duplicate', basePointsToAward: 0 };
  }

  const useRawFallback = exactMatchResult.error?.code === DB_UNDEFINED_COLUMN_CODE;
  const candidateQuery = useRawFallback
    ? supabase
        .from(table)
        .select(`${valueColumn}`)
        .neq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(UNIQUENESS_SCAN_LIMIT)
    : supabase
        .from(table)
        .select(`${normalizedColumn}`)
        .neq('student_id', studentId)
        .not(normalizedColumn, 'is', null)
        .order('created_at', { ascending: false })
        .limit(UNIQUENESS_SCAN_LIMIT);

  const { data, error } = await candidateQuery;

  if (error || !data) {
    return { tier: 'unique', basePointsToAward: basePoints };
  }

  let maxSimilarity = 0;
  for (const row of data as Array<Record<string, unknown>>) {
    const rawExisting = useRawFallback ? row[valueColumn] : row[normalizedColumn];
    if (typeof rawExisting !== 'string') {
      continue;
    }
    const normalizedExisting = useRawFallback ? normalizeForMatch(rawExisting) : rawExisting.trim();
    if (!normalizedExisting) {
      continue;
    }
    if (normalizedExisting === normalizedCandidate) {
      return { tier: 'duplicate', basePointsToAward: 0 };
    }
    const similarity = stringSimilarity(normalizedCandidate, normalizedExisting);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }
  }

  if (maxSimilarity >= UNIQUENESS_NEAR_DUPLICATE_THRESHOLD) {
    return {
      tier: 'near_duplicate',
      basePointsToAward: Math.max(1, Math.round(basePoints * UNIQUENESS_NEAR_DUPLICATE_MULTIPLIER)),
    };
  }

  return { tier: 'unique', basePointsToAward: basePoints };
};

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

  const uniquenessResult = await evaluateEntryUniqueness({
    table: 'vocabulary',
    normalizedColumn: 'normalized_word',
    valueColumn: 'word',
    studentId,
    rawValue: data.word,
    basePoints: 10,
  });
  const baseAwardResult =
    uniquenessResult.basePointsToAward > 0
      ? await awardStudentPoints(studentId, uniquenessResult.basePointsToAward)
      : { error: null, awardedPoints: 0 };
  if (baseAwardResult.error) {
    return { data: null, error: baseAwardResult.error, dailyHookBonusPoints: 0, dailyHookMatched: false };
  }

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
    baseAwardedPoints: baseAwardResult.awardedPoints ?? 0,
    uniquenessTier: uniquenessResult.tier,
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

  const uniquenessResult = await evaluateEntryUniqueness({
    table: 'expressions',
    normalizedColumn: 'normalized_expression',
    valueColumn: 'expression',
    studentId,
    rawValue: data.expression,
    basePoints: 12,
  });
  const baseAwardResult =
    uniquenessResult.basePointsToAward > 0
      ? await awardStudentPoints(studentId, uniquenessResult.basePointsToAward)
      : { error: null, awardedPoints: 0 };
  if (baseAwardResult.error) {
    return { data: null, error: baseAwardResult.error };
  }

  return {
    data: data as Expression,
    error: null,
    baseAwardedPoints: baseAwardResult.awardedPoints ?? 0,
    uniquenessTier: uniquenessResult.tier,
  };
};
