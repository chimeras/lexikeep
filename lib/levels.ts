export interface LevelInfo {
  level: number;
  title: string;
  minPoints: number;
  nextMinPoints: number | null;
  progressPercent: number;
  pointsIntoLevel: number;
  pointsToNext: number | null;
}

const levelTiers = [
  { minPoints: 0, title: 'Starter' },
  { minPoints: 120, title: 'Word Scout' },
  { minPoints: 280, title: 'Phrase Builder' },
  { minPoints: 520, title: 'Context Rider' },
  { minPoints: 860, title: 'Fluency Challenger' },
  { minPoints: 1300, title: 'League Climber' },
  { minPoints: 1850, title: 'Lexi Captain' },
  { minPoints: 2500, title: 'Master Linguist' },
];

export const getLevelInfo = (points: number): LevelInfo => {
  const normalizedPoints = Math.max(0, points);
  const tierIndex = levelTiers.reduce((current, tier, index) => {
    if (normalizedPoints >= tier.minPoints) {
      return index;
    }
    return current;
  }, 0);

  const currentTier = levelTiers[tierIndex];
  const nextTier = levelTiers[tierIndex + 1] ?? null;
  const pointsIntoLevel = normalizedPoints - currentTier.minPoints;
  const pointsToNext = nextTier ? Math.max(0, nextTier.minPoints - normalizedPoints) : null;
  const levelSpan = nextTier ? Math.max(1, nextTier.minPoints - currentTier.minPoints) : 1;
  const progressPercent = nextTier ? Math.min(100, Math.round((pointsIntoLevel / levelSpan) * 100)) : 100;

  return {
    level: tierIndex + 1,
    title: currentTier.title,
    minPoints: currentTier.minPoints,
    nextMinPoints: nextTier?.minPoints ?? null,
    progressPercent,
    pointsIntoLevel,
    pointsToNext,
  };
};
