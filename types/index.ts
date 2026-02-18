export interface Profile {
  id: string;
  username: string;
  role: 'student' | 'teacher' | 'admin';
  points: number;
  streak: number;
  avatar_url: string | null;
  created_at: string;
}

export interface Material {
  id: string;
  title: string;
  description: string | null;
  content_url: string | null;
  teacher_id: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface Vocabulary {
  id: string;
  word: string;
  definition: string;
  example_sentence: string | null;
  image_url: string | null;
  student_id: string | null;
  material_id: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string | null;
  tags: string[];
  status: 'new' | 'learning' | 'mastered';
  created_at: string;
}

export interface Expression {
  id: string;
  expression: string;
  meaning: string;
  context: string | null;
  student_id: string | null;
  material_id: string | null;
  usage_example: string | null;
  created_at: string;
}

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  rules: Record<string, unknown> | null;
  teacher_id: string;
  is_active: boolean;
}

export interface CompetitionProgress {
  id: string;
  competition_id: string;
  student_id: string;
  words_collected: number;
  expressions_collected: number;
  last_activity: string;
}

export type ChallengeMetric = 'words' | 'expressions' | 'points' | 'streak';

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  challenge_date: string;
  challenge_type: ChallengeMetric;
  target_value: number;
  reward_points: number;
  is_active: boolean;
  created_by: string | null;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  target_type: ChallengeMetric;
  target_value: number;
  reward_points: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
}

export interface StudentBadge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: 'spark' | 'book' | 'chat' | 'flame' | 'trophy' | 'target';
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
  target: number;
  progress: number;
  unlocked: boolean;
  reward_points: number;
}

export type ReviewSourceType = 'vocabulary' | 'expression';
export type ReviewStatus = 'learning' | 'mastered';

export interface ReviewItem {
  id: string;
  student_id: string;
  source_type: ReviewSourceType;
  source_id: string;
  prompt: string;
  answer: string;
  context_hint: string | null;
  status: ReviewStatus;
  due_at: string;
  last_reviewed_at: string | null;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  created_at: string;
  updated_at: string;
}

export interface Duel {
  id: string;
  created_by: string | null;
  status: 'waiting' | 'active' | 'finished' | 'cancelled';
  started_at: string | null;
  finished_at: string | null;
  winner_id: string | null;
  created_at: string;
}

export interface DuelParticipant {
  id: string;
  duel_id: string;
  student_id: string;
  joined_at: string;
  total_score: number;
  correct_answers: number;
}

export interface DuelRound {
  id: string;
  duel_id: string;
  round_number: number;
  prompt: string;
  correct_answer: string;
  options: string[];
  created_at: string;
}

export interface DuelAnswer {
  id: string;
  duel_id: string;
  round_id: string;
  student_id: string;
  selected_answer: string;
  is_correct: boolean;
  response_time_ms: number | null;
  points_earned: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TeamMembership {
  id: string;
  team_id: string;
  student_id: string;
  role: 'member' | 'captain';
  joined_at: string;
}

export interface TeacherBoost {
  id: string;
  title: string;
  description: string | null;
  boost_type: 'double_xp' | 'bonus_flat';
  multiplier: number;
  flat_bonus: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface DailyChallengeClaim {
  id: string;
  challenge_id: string;
  student_id: string;
  vocabulary_id: string | null;
  points_awarded: number;
  created_at: string;
}
