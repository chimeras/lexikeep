export interface ContextScoreResult {
  score: number;
  level: 'needs_work' | 'developing' | 'strong' | 'excellent';
  feedback: string;
  bonusPoints: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalize = (value: string) => value.trim().toLowerCase();

export const scoreContextUsage = (term: string, sentence: string): ContextScoreResult => {
  const cleanTerm = normalize(term);
  const cleanSentence = sentence.trim();
  const sentenceLower = normalize(sentence);
  const words = cleanSentence.split(/\s+/).filter(Boolean);

  let score = 20;

  const hasTerm = cleanTerm.length > 0 && sentenceLower.includes(cleanTerm);
  if (hasTerm) {
    score += 30;
  }

  if (words.length >= 8) {
    score += 20;
  } else if (words.length >= 5) {
    score += 10;
  }

  if (/[.!?]$/.test(cleanSentence)) {
    score += 10;
  }

  if (/^[A-Z]/.test(cleanSentence)) {
    score += 10;
  }

  const uniqueWordRatio = words.length > 0 ? new Set(words.map((word) => normalize(word))).size / words.length : 0;
  if (uniqueWordRatio >= 0.75) {
    score += 10;
  }

  score = clamp(score, 0, 100);

  if (score >= 85) {
    return {
      score,
      level: 'excellent',
      feedback: 'Excellent context usage. Natural, specific, and clear.',
      bonusPoints: 6,
    };
  }

  if (score >= 70) {
    return {
      score,
      level: 'strong',
      feedback: 'Strong sentence. Keep adding detail to make usage even more natural.',
      bonusPoints: 4,
    };
  }

  if (score >= 50) {
    return {
      score,
      level: 'developing',
      feedback: 'Good start. Include the term clearly in a fuller real-life sentence.',
      bonusPoints: 2,
    };
  }

  return {
    score,
    level: 'needs_work',
    feedback: 'Needs improvement. Use the term directly in a complete contextual sentence.',
    bonusPoints: 0,
  };
};
