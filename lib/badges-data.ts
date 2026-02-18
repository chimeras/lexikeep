import type { StudentBadge } from '@/types';
import type { StudentMetrics } from '@/lib/student-data';

type BadgeMetric = 'wordsCollected' | 'expressionsCollected' | 'streak' | 'points';

interface BadgeDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: StudentBadge['icon'];
  color: StudentBadge['color'];
  target: number;
  metric: BadgeMetric;
  reward_points: number;
}

export const fallbackBadgeDefinitions: BadgeDefinition[] = [
  {
    id: 'first-steps',
    slug: 'first-steps',
    name: 'First Steps',
    description: 'Collect 5 vocabulary words.',
    icon: 'book',
    color: 'blue',
    target: 5,
    metric: 'wordsCollected',
    reward_points: 20,
  },
  {
    id: 'phrase-finder',
    slug: 'phrase-finder',
    name: 'Phrase Finder',
    description: 'Add 5 expressions.',
    icon: 'chat',
    color: 'cyan',
    target: 5,
    metric: 'expressionsCollected',
    reward_points: 20,
  },
  {
    id: 'streak-starter',
    slug: 'streak-starter',
    name: 'Streak Starter',
    description: 'Reach a 3-day streak.',
    icon: 'flame',
    color: 'amber',
    target: 3,
    metric: 'streak',
    reward_points: 30,
  },
  {
    id: 'point-racer',
    slug: 'point-racer',
    name: 'Point Racer',
    description: 'Earn 150 points.',
    icon: 'target',
    color: 'emerald',
    target: 150,
    metric: 'points',
    reward_points: 40,
  },
  {
    id: 'vocab-sprinter',
    slug: 'vocab-sprinter',
    name: 'Vocab Sprinter',
    description: 'Collect 20 vocabulary words.',
    icon: 'spark',
    color: 'violet',
    target: 20,
    metric: 'wordsCollected',
    reward_points: 60,
  },
  {
    id: 'league-contender',
    slug: 'league-contender',
    name: 'League Contender',
    description: 'Earn 400 points.',
    icon: 'trophy',
    color: 'rose',
    target: 400,
    metric: 'points',
    reward_points: 80,
  },
];

export const metricValueForBadge = (metrics: StudentMetrics, metric: BadgeMetric) => Math.max(0, metrics[metric]);

export const getStudentBadges = (metrics: StudentMetrics): StudentBadge[] =>
  fallbackBadgeDefinitions.map((badge) => {
    const progress = metricValueForBadge(metrics, badge.metric);
    return {
      id: badge.id,
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      color: badge.color,
      target: badge.target,
      progress,
      unlocked: progress >= badge.target,
      reward_points: badge.reward_points,
    };
  });
