import { awardStudentPoints } from '@/lib/student-data';
import { supabase } from '@/lib/supabase';
import type { Duel, DuelAnswer, DuelParticipant, DuelRound } from '@/types';

interface DuelPromptSeed {
  prompt: string;
  correctAnswer: string;
  options: string[];
}

const duelPromptSeeds: DuelPromptSeed[] = [
  {
    prompt: 'Choose the best meaning of "sustainable growth".',
    correctAnswer: 'Growth that can continue long-term without harm.',
    options: [
      'Growth that happens in one week only.',
      'Growth that can continue long-term without harm.',
      'Growth that ignores social impact.',
      'Growth that means no change at all.',
    ],
  },
  {
    prompt: 'Pick the sentence with natural usage of "on the same page".',
    correctAnswer: 'Before we start, let us make sure we are on the same page.',
    options: [
      'I put the coffee on the same page.',
      'Before we start, let us make sure we are on the same page.',
      'The page is same because it is big.',
      'She same page the result quickly.',
    ],
  },
  {
    prompt: 'What does "feasible" mean?',
    correctAnswer: 'Possible and practical to do.',
    options: [
      'Extremely expensive.',
      'Possible and practical to do.',
      'Not related to planning.',
      'Always impossible.',
    ],
  },
  {
    prompt: 'Choose the best sentence using "take into account".',
    correctAnswer: 'We should take student feedback into account.',
    options: [
      'I account into took the bag.',
      'We should take student feedback into account.',
      'The account took into quickly.',
      'She into account take every.',
    ],
  },
  {
    prompt: 'What is the closest meaning of "mitigate"?',
    correctAnswer: 'To reduce or make less severe.',
    options: [
      'To increase quickly.',
      'To ignore completely.',
      'To reduce or make less severe.',
      'To publish formally.',
    ],
  },
];

const DUEL_ROUNDS = 5;
const WINNER_BONUS_POINTS = 25;
const PARTICIPATION_BONUS_POINTS = 10;

const shuffled = <T>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
};

const pickRounds = () =>
  shuffled(duelPromptSeeds)
    .slice(0, DUEL_ROUNDS)
    .map((seed, index) => ({
      round_number: index + 1,
      prompt: seed.prompt,
      correct_answer: seed.correctAnswer,
      options: shuffled(seed.options),
    }));

export const getJoinableDuels = async (studentId: string) => {
  const { data, error } = await supabase.from('duels').select('*').eq('status', 'waiting').order('created_at', { ascending: false }).limit(10);
  if (error || !data) {
    return { data: [] as Duel[], error };
  }

  const duelIds = (data as Duel[]).map((duel) => duel.id);
  if (duelIds.length === 0) {
    return { data: [] as Duel[], error: null };
  }

  const { data: ownParticipants } = await supabase
    .from('duel_participants')
    .select('duel_id')
    .eq('student_id', studentId)
    .in('duel_id', duelIds);
  const ownDuelIds = new Set(((ownParticipants as Array<{ duel_id: string }> | null) ?? []).map((item) => item.duel_id));

  return { data: (data as Duel[]).filter((duel) => !ownDuelIds.has(duel.id)), error: null };
};

export const createDuel = async (studentId: string) => {
  const { data: duel, error: duelError } = await supabase
    .from('duels')
    .insert({ created_by: studentId, status: 'waiting' })
    .select()
    .single();

  if (duelError || !duel) {
    return { data: null, error: duelError };
  }

  const { error: participantError } = await supabase.from('duel_participants').insert({
    duel_id: duel.id,
    student_id: studentId,
  });
  if (participantError) {
    return { data: null, error: participantError };
  }

  const rounds = pickRounds().map((round) => ({ ...round, duel_id: duel.id }));
  const { error: roundsError } = await supabase.from('duel_rounds').insert(rounds);
  if (roundsError) {
    return { data: null, error: roundsError };
  }

  return { data: duel as Duel, error: null };
};

export const joinDuel = async (duelId: string, studentId: string) => {
  const { error } = await supabase.from('duel_participants').insert({
    duel_id: duelId,
    student_id: studentId,
  });
  return { error };
};

export const startDuel = async (duelId: string, studentId: string) => {
  const { data: duel, error: duelError } = await supabase
    .from('duels')
    .select('created_by,status')
    .eq('id', duelId)
    .maybeSingle();
  if (duelError || !duel) {
    return { error: duelError };
  }
  if (duel.created_by !== studentId) {
    return { error: { message: 'Only duel creator can start this duel.' } };
  }

  const { count } = await supabase
    .from('duel_participants')
    .select('*', { count: 'exact', head: true })
    .eq('duel_id', duelId);
  if ((count ?? 0) < 2) {
    return { error: { message: 'Need at least 2 participants to start.' } };
  }

  const { error } = await supabase
    .from('duels')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', duelId)
    .eq('created_by', studentId);
  return { error };
};

export const getDuelState = async (duelId: string) => {
  const [duelRes, participantRes, roundsRes, answersRes] = await Promise.all([
    supabase.from('duels').select('*').eq('id', duelId).maybeSingle(),
    supabase.from('duel_participants').select('*').eq('duel_id', duelId).order('joined_at', { ascending: true }),
    supabase.from('duel_rounds').select('*').eq('duel_id', duelId).order('round_number', { ascending: true }),
    supabase.from('duel_answers').select('*').eq('duel_id', duelId),
  ]);

  return {
    duel: (duelRes.data as Duel | null) ?? null,
    participants: (participantRes.data as DuelParticipant[] | null) ?? [],
    rounds: (roundsRes.data as DuelRound[] | null) ?? [],
    answers: (answersRes.data as DuelAnswer[] | null) ?? [],
    error: duelRes.error ?? participantRes.error ?? roundsRes.error ?? answersRes.error,
  };
};

export const getStudentDuelHistory = async (studentId: string, limit = 10) => {
  const { data: participantRows, error: participantError } = await supabase
    .from('duel_participants')
    .select('duel_id,total_score,correct_answers,joined_at')
    .eq('student_id', studentId)
    .order('joined_at', { ascending: false })
    .limit(limit);

  if (participantError || !participantRows) {
    return { data: [] as Array<DuelParticipant & { duel: Duel | null }>, error: participantError };
  }

  const duelIds = (participantRows as Array<{ duel_id: string }>).map((item) => item.duel_id);
  if (duelIds.length === 0) {
    return { data: [] as Array<DuelParticipant & { duel: Duel | null }>, error: null };
  }

  const { data: duels, error: duelError } = await supabase.from('duels').select('*').in('id', duelIds);
  if (duelError) {
    return { data: [] as Array<DuelParticipant & { duel: Duel | null }>, error: duelError };
  }

  const duelMap = new Map<string, Duel>(((duels as Duel[] | null) ?? []).map((duel) => [duel.id, duel]));
  const mapped = ((participantRows as DuelParticipant[] | null) ?? []).map((participant) => ({
    ...participant,
    duel: duelMap.get(participant.duel_id) ?? null,
  }));
  return { data: mapped, error: null };
};

export const submitDuelAnswer = async ({
  duelId,
  round,
  studentId,
  selectedAnswer,
  responseTimeMs,
}: {
  duelId: string;
  round: DuelRound;
  studentId: string;
  selectedAnswer: string;
  responseTimeMs: number;
}) => {
  const isCorrect = selectedAnswer === round.correct_answer;
  const pointsEarned = isCorrect ? 12 : 3;

  const { error: answerError } = await supabase.from('duel_answers').insert({
    duel_id: duelId,
    round_id: round.id,
    student_id: studentId,
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
    response_time_ms: responseTimeMs,
    points_earned: pointsEarned,
  });

  if (answerError) {
    return { error: answerError };
  }

  const { data: currentParticipant, error: participantReadError } = await supabase
    .from('duel_participants')
    .select('total_score,correct_answers')
    .eq('duel_id', duelId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (participantReadError) {
    return { error: participantReadError };
  }

  const { error: participantUpdateError } = await supabase
    .from('duel_participants')
    .update({
      total_score: (currentParticipant?.total_score ?? 0) + pointsEarned,
      correct_answers: (currentParticipant?.correct_answers ?? 0) + (isCorrect ? 1 : 0),
    })
    .eq('duel_id', duelId)
    .eq('student_id', studentId);

  if (participantUpdateError) {
    return { error: participantUpdateError };
  }

  await awardStudentPoints(studentId, pointsEarned);

  return { error: null };
};

export const finalizeDuelIfReady = async (duelId: string, studentId: string) => {
  const { duel, participants, rounds, answers, error } = await getDuelState(duelId);
  if (error || !duel || duel.created_by !== studentId || duel.status !== 'active') {
    return { error: null };
  }

  const roundsCount = rounds.length;
  if (roundsCount === 0 || participants.length < 2) {
    return { error: null };
  }

  const allAnswered = participants.every((participant) => {
    const answeredCount = answers.filter((answer) => answer.student_id === participant.student_id).length;
    return answeredCount >= roundsCount;
  });

  if (!allAnswered) {
    return { error: null };
  }

  const sorted = [...participants].sort((left, right) => right.total_score - left.total_score);
  const winnerId = sorted[0]?.student_id ?? null;

  const { error: finishError } = await supabase
    .from('duels')
    .update({
      status: 'finished',
      winner_id: winnerId,
      finished_at: new Date().toISOString(),
    })
    .eq('id', duelId)
    .eq('status', 'active')
    .eq('created_by', studentId);

  if (finishError) {
    return { error: finishError };
  }

  if (winnerId) {
    await awardStudentPoints(winnerId, WINNER_BONUS_POINTS);
  }

  const losers = participants.filter((participant) => participant.student_id !== winnerId);
  await Promise.all(
    losers.map((participant) => awardStudentPoints(participant.student_id, PARTICIPATION_BONUS_POINTS)),
  );

  return { error: null };
};
