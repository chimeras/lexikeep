import { getStudentBadges } from '@/lib/badges-data';
import { incrementStudentPoints, getStudentMetrics, type StudentMetrics } from '@/lib/student-data';
import { supabase } from '@/lib/supabase';
import type { ChallengeMetric, StudentBadge } from '@/types';

interface BadgeDefinitionRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: StudentBadge['icon'];
  color: StudentBadge['color'];
  target_type: ChallengeMetric;
  target_value: number;
  reward_points: number;
}

interface StudentBadgeRow {
  badge_id: string;
  progress_value: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
  awarded_points: number;
}

const isMissingRelationError = (message: string | undefined) =>
  (message ?? '').toLowerCase().includes('does not exist');

const metricForTargetType = (metrics: StudentMetrics, targetType: ChallengeMetric) => {
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

const mapDefinitionToBadge = (definition: BadgeDefinitionRow, row: StudentBadgeRow | undefined): StudentBadge => {
  const progress = row?.progress_value ?? 0;
  return {
    id: definition.id,
    slug: definition.slug,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    target: definition.target_value,
    progress,
    unlocked: row?.is_unlocked ?? false,
    reward_points: definition.reward_points,
  };
};

const getActiveBadgeDefinitions = async () => {
  const { data, error } = await supabase
    .from('badge_definitions')
    .select('id,slug,name,description,icon,color,target_type,target_value,reward_points')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    return { data: [] as BadgeDefinitionRow[], error };
  }

  return { data: (data as BadgeDefinitionRow[] | null) ?? [], error: null };
};

export interface BadgeSyncResult {
  badges: StudentBadge[];
  unlockedBadges: StudentBadge[];
  fallbackMode: boolean;
  error: string | null;
}

export const syncStudentBadges = async (
  studentId: string,
  providedMetrics?: StudentMetrics,
): Promise<BadgeSyncResult> => {
  const metrics = providedMetrics ?? (await getStudentMetrics(studentId));
  const definitionResult = await getActiveBadgeDefinitions();

  if (
    definitionResult.error &&
    (definitionResult.error.code === '42P01' || isMissingRelationError(definitionResult.error.message))
  ) {
    return {
      badges: getStudentBadges(metrics),
      unlockedBadges: [],
      fallbackMode: true,
      error: null,
    };
  }

  if (definitionResult.error) {
    return {
      badges: getStudentBadges(metrics),
      unlockedBadges: [],
      fallbackMode: true,
      error: definitionResult.error.message,
    };
  }

  const definitions = definitionResult.data;
  if (definitions.length === 0) {
    return { badges: [], unlockedBadges: [], fallbackMode: false, error: null };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('student_badges')
    .select('badge_id,progress_value,is_unlocked,unlocked_at,awarded_points')
    .eq('student_id', studentId);

  if (existingError && (existingError.code === '42P01' || isMissingRelationError(existingError.message))) {
    return {
      badges: getStudentBadges(metrics),
      unlockedBadges: [],
      fallbackMode: true,
      error: null,
    };
  }

  if (existingError) {
    return {
      badges: getStudentBadges(metrics),
      unlockedBadges: [],
      fallbackMode: true,
      error: existingError.message,
    };
  }

  const existingByBadgeId = new Map<string, StudentBadgeRow>(
    (((existingRows as StudentBadgeRow[] | null) ?? [])).map((row) => [row.badge_id, row]),
  );

  const nowIso = new Date().toISOString();
  let newBadgeRewardPoints = 0;
  const unlockedBadges: StudentBadge[] = [];

  const rowsToUpsert = definitions.map((definition) => {
    const previous = existingByBadgeId.get(definition.id);
    const metricValue = Math.max(0, metricForTargetType(metrics, definition.target_type));
    const alreadyUnlocked = previous?.is_unlocked ?? false;
    const shouldBeUnlocked = alreadyUnlocked || metricValue >= definition.target_value;
    const isNewUnlock = !alreadyUnlocked && shouldBeUnlocked;
    const awardedPoints = previous?.awarded_points ?? 0;
    const nextAwardedPoints = isNewUnlock ? Math.max(awardedPoints, definition.reward_points) : awardedPoints;

    if (isNewUnlock) {
      newBadgeRewardPoints += definition.reward_points;
      unlockedBadges.push({
        id: definition.id,
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        icon: definition.icon,
        color: definition.color,
        target: definition.target_value,
        progress: metricValue,
        unlocked: true,
        reward_points: definition.reward_points,
      });
    }

    return {
      student_id: studentId,
      badge_id: definition.id,
      progress_value: metricValue,
      is_unlocked: shouldBeUnlocked,
      unlocked_at: shouldBeUnlocked ? (previous?.unlocked_at ?? nowIso) : null,
      awarded_points: nextAwardedPoints,
    };
  });

  const { error: upsertError } = await supabase.from('student_badges').upsert(rowsToUpsert, {
    onConflict: 'student_id,badge_id',
  });

  if (upsertError) {
    return {
      badges: getStudentBadges(metrics),
      unlockedBadges: [],
      fallbackMode: true,
      error: upsertError.message,
    };
  }

  if (newBadgeRewardPoints > 0) {
    await incrementStudentPoints(studentId, newBadgeRewardPoints);
  }

  const badgeRowsById = new Map<string, StudentBadgeRow>();
  rowsToUpsert.forEach((row) => {
    badgeRowsById.set(row.badge_id, {
      badge_id: row.badge_id,
      progress_value: row.progress_value,
      is_unlocked: row.is_unlocked,
      unlocked_at: row.unlocked_at,
      awarded_points: row.awarded_points,
    });
  });

  return {
    badges: definitions.map((definition) => mapDefinitionToBadge(definition, badgeRowsById.get(definition.id))),
    unlockedBadges,
    fallbackMode: false,
    error: null,
  };
};
