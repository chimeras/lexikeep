'use client';

import { Swords, Timer, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  createDuel,
  finalizeDuelIfReady,
  getDuelState,
  getStudentDuelHistory,
  getJoinableDuels,
  joinDuel,
  startDuel,
  submitDuelAnswer,
} from '@/lib/duel-data';
import type { Duel, DuelAnswer, DuelParticipant, DuelRound } from '@/types';

const toName = (id: string, me?: string) => (id === me ? 'You' : `${id.slice(0, 6)}...`);

export default function DuelPage() {
  const { profile, user, refreshProfile } = useAuth();
  const studentId = profile?.id ?? user?.id ?? null;
  const [joinableDuels, setJoinableDuels] = useState<Duel[]>([]);
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null);
  const [duel, setDuel] = useState<Duel | null>(null);
  const [participants, setParticipants] = useState<DuelParticipant[]>([]);
  const [rounds, setRounds] = useState<DuelRound[]>([]);
  const [answers, setAnswers] = useState<DuelAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [roundShownAt, setRoundShownAt] = useState<number>(Date.now());
  const [history, setHistory] = useState<Array<DuelParticipant & { duel: Duel | null }>>([]);

  const loadLobby = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    const [{ data }, historyResult] = await Promise.all([
      getJoinableDuels(studentId),
      getStudentDuelHistory(studentId),
    ]);
    setJoinableDuels(data);
    setHistory(historyResult.data);
    setLoading(false);
  };

  const loadDuel = async (duelId: string) => {
    const state = await getDuelState(duelId);
    if (!state.duel) {
      setMessage('Duel not found or access denied.');
      return;
    }
    setActiveDuelId(duelId);
    setDuel(state.duel);
    setParticipants(state.participants);
    setRounds(state.rounds);
    setAnswers(state.answers);
  };

  useEffect(() => {
    void loadLobby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!activeDuelId) {
      return;
    }
    const interval = setInterval(() => {
      void loadDuel(activeDuelId);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeDuelId]);

  const myAnswers = useMemo(
    () => answers.filter((answer) => answer.student_id === studentId).map((answer) => answer.round_id),
    [answers, studentId],
  );

  const nextRound = useMemo(
    () => rounds.find((round) => !myAnswers.includes(round.id)) ?? null,
    [myAnswers, rounds],
  );

  const myParticipant = useMemo(
    () => participants.find((participant) => participant.student_id === studentId) ?? null,
    [participants, studentId],
  );

  const canStart = duel?.created_by === studentId && duel.status === 'waiting' && participants.length >= 2;

  const handleCreate = async () => {
    if (!studentId || submitting) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const { data, error } = await createDuel(studentId);
    if (error || !data) {
      setMessage(error?.message ?? 'Failed to create duel.');
      setSubmitting(false);
      return;
    }
    await loadDuel(data.id);
    setRoundShownAt(Date.now());
    setSubmitting(false);
  };

  const handleJoin = async (duelId: string) => {
    if (!studentId || submitting) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const { error } = await joinDuel(duelId, studentId);
    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }
    await loadDuel(duelId);
    setRoundShownAt(Date.now());
    setSubmitting(false);
  };

  const handleStart = async () => {
    if (!studentId || !activeDuelId || submitting) {
      return;
    }
    setSubmitting(true);
    const { error } = await startDuel(activeDuelId, studentId);
    if (error) {
      setMessage(error.message ?? 'Unable to start duel.');
      setSubmitting(false);
      return;
    }
    await loadDuel(activeDuelId);
    setRoundShownAt(Date.now());
    setSubmitting(false);
  };

  const handleAnswer = async (selectedAnswer: string) => {
    if (!studentId || !activeDuelId || !nextRound || submitting) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const responseTimeMs = Date.now() - roundShownAt;
    const { error } = await submitDuelAnswer({
      duelId: activeDuelId,
      round: nextRound,
      studentId,
      selectedAnswer,
      responseTimeMs,
    });
    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    await finalizeDuelIfReady(activeDuelId, studentId);
    await loadDuel(activeDuelId);
    await loadLobby();
    await refreshProfile();
    setRoundShownAt(Date.now());
    setSubmitting(false);
  };

  const handleRematch = async () => {
    if (!studentId || submitting) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const { data, error } = await createDuel(studentId);
    if (error || !data) {
      setMessage(error?.message ?? 'Unable to create rematch.');
      setSubmitting(false);
      return;
    }
    await loadDuel(data.id);
    await loadLobby();
    setRoundShownAt(Date.now());
    setSubmitting(false);
  };

  return (
    <section className="mx-auto grid max-w-5xl gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-8">
      <div className="rounded-3xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
          <Swords size={14} />
          1v1 Duel Arena
        </div>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Timed Vocabulary Duel</h1>
        <p className="mt-1 text-sm text-amber-50">Answer 5 rounds fast. Correct answers earn higher points.</p>
      </div>

      {message && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}

      {!activeDuelId ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Create Duel</h2>
            <p className="mt-1 text-sm text-slate-600">Start a private duel room and wait for another student to join.</p>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting || !studentId}
              className="mt-4 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Duel'}
            </button>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Join Duel</h2>
            {loading ? (
              <p className="mt-2 text-sm text-slate-600">Loading duel rooms...</p>
            ) : joinableDuels.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No open duel rooms right now.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {joinableDuels.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5">
                    <p className="text-sm font-semibold text-slate-800">Room {item.id.slice(0, 6)}</p>
                    <button
                      type="button"
                      onClick={() => void handleJoin(item.id)}
                      disabled={submitting}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">Recent Duels</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No duel history yet.</p>
            ) : (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {history.map((entry) => (
                  <div key={`${entry.duel_id}-${entry.id}`} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Duel {entry.duel_id.slice(0, 6)} | {entry.duel?.status ?? 'unknown'}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Score {entry.total_score} | Correct {entry.correct_answers}
                    </p>
                    {entry.duel?.winner_id && (
                      <p className="mt-1 text-xs text-slate-600">
                        Winner: {toName(entry.duel.winner_id, studentId ?? undefined)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:col-span-1">
            <h2 className="text-lg font-bold text-slate-900">Scoreboard</h2>
            <div className="mt-3 space-y-2">
              {participants
                .slice()
                .sort((left, right) => right.total_score - left.total_score)
                .map((participant, index) => (
                  <div key={participant.id} className="rounded-lg border border-slate-200 p-2.5">
                    <p className="text-sm font-semibold text-slate-900">
                      #{index + 1} {toName(participant.student_id, studentId ?? undefined)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {participant.total_score} pts | {participant.correct_answers} correct
                    </p>
                  </div>
                ))}
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">Status: {duel?.status ?? 'waiting'}</p>
            <Link href="/competition" className="mt-4 inline-block text-xs font-semibold text-blue-700 hover:text-blue-800">
              Back to Competition
            </Link>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
            {duel?.status === 'waiting' && (
              <div>
                <p className="text-base font-semibold text-slate-900">Waiting Room</p>
                <p className="mt-1 text-sm text-slate-600">Participants joined: {participants.length}/2</p>
                {canStart ? (
                  <button
                    type="button"
                    onClick={() => void handleStart()}
                    disabled={submitting}
                    className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Start Duel
                  </button>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    {duel?.created_by === studentId ? 'Need one more student to join.' : 'Host will start once ready.'}
                  </p>
                )}
              </div>
            )}

            {duel?.status === 'active' && nextRound && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Round {nextRound.round_number}/{rounds.length}
                  </p>
                  <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Timer size={14} />
                    Fast answers help
                  </p>
                </div>
                <p className="text-lg font-bold text-slate-900">{nextRound.prompt}</p>
                <div className="mt-4 grid gap-2">
                  {nextRound.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => void handleAnswer(option)}
                      disabled={submitting}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-60"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {duel?.status === 'active' && !nextRound && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-base font-semibold text-slate-900">All your rounds are complete.</p>
                <p className="mt-1 text-sm text-slate-600">Waiting for the other player to finish.</p>
              </div>
            )}

            {duel?.status === 'finished' && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-base font-semibold text-emerald-800">
                  <Trophy size={18} />
                  Duel Finished
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  Winner: {duel.winner_id ? toName(duel.winner_id, studentId ?? undefined) : 'No winner'}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Your final score: {myParticipant?.total_score ?? 0} points
                </p>
                <button
                  type="button"
                  onClick={() => void handleRematch()}
                  disabled={submitting}
                  className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Rematch
                </button>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
