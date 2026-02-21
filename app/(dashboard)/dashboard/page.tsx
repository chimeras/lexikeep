'use client';

import { BookOpen, Brain, CircleCheckBig, Flame, Plus, Sparkles, Target, Trophy } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import BadgeShelf from '@/components/dashboard/BadgeShelf';
import { useAuth } from '@/components/providers/AuthProvider';
import CompetitionLeaderboard from '@/components/learning/CompetitionLeaderboard';
import { syncStudentBadges } from '@/lib/badges-service';
import { getActiveBoost } from '@/lib/boosts-data';
import { getTodayDailyChallenge, getWeeklyQuestProgress, type QuestProgress } from '@/lib/challenges-data';
import { getLevelInfo } from '@/lib/levels';
import { getDueReviewCount, getReviewsCompletedTodayCount } from '@/lib/review-data';
import { getStudentMetrics, type StudentMetrics } from '@/lib/student-data';
import type { DailyChallenge, StudentBadge, TeacherBoost } from '@/types';

const ProgressChart = dynamic(() => import('@/components/dashboard/ProgressChart'), {
  ssr: false,
});

const emptyMetrics: StudentMetrics = {
  points: 0,
  streak: 0,
  wordsCollected: 0,
  expressionsCollected: 0,
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StudentMetrics>(emptyMetrics);
  const [badges, setBadges] = useState<StudentBadge[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [questProgress, setQuestProgress] = useState<QuestProgress[]>([]);
  const [reviewsDue, setReviewsDue] = useState(0);
  const [reviewsCompletedToday, setReviewsCompletedToday] = useState(0);
  const [activeBoost, setActiveBoost] = useState<TeacherBoost | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; title: string } | null>(null);
  const level = getLevelInfo(metrics.points);
  const nextQuest = questProgress.find((quest) => !quest.is_completed) ?? null;
  const fastTips: string[] = [];
  const boostRewardLabel = activeBoost
    ? activeBoost.boost_type === 'double_xp'
      ? `${activeBoost.multiplier}x XP`
      : `+${activeBoost.flat_bonus} points`
    : null;
  const boostRuleLabel = activeBoost
    ? activeBoost.boost_type === 'double_xp'
      ? 'Any valid word/expression earns multiplied points.'
      : 'Any valid word/expression earns flat bonus points.'
    : null;
  const boostEndsLabel = activeBoost
    ? new Date(activeBoost.ends_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  if (reviewsDue > 0) {
    fastTips.push(`Complete ${reviewsDue} review${reviewsDue === 1 ? '' : 's'} due now for quick points.`);
  }
  if (nextQuest) {
    const remaining = Math.max(0, nextQuest.target_value - nextQuest.current_value);
    fastTips.push(`${remaining} more for "${nextQuest.title}" (+${nextQuest.reward_points} pts).`);
  }
  if (!nextQuest && reviewsDue === 0) {
    fastTips.push('Add new words/expressions to keep your streak and points growing.');
  }
  if (level.pointsToNext !== null) {
    fastTips.push(`${level.pointsToNext} points to reach Level ${level.level + 1}.`);
  }

  useEffect(() => {
    if (!profile?.id) {
      return;
    }
    const loadDashboardData = async () => {
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const nextMetrics = await getStudentMetrics(profile.id);
        const [challenge, quests, dueCountResult, completedTodayResult, boostResult] = await Promise.all([
          getTodayDailyChallenge(),
          getWeeklyQuestProgress(profile.id, nextMetrics),
          getDueReviewCount(profile.id),
          getReviewsCompletedTodayCount(profile.id),
          getActiveBoost(),
        ]);
        const badgeSync = await syncStudentBadges(profile.id, nextMetrics);
        const metricsWithBadgeRewards =
          badgeSync.unlockedBadges.length > 0 ? await getStudentMetrics(profile.id) : nextMetrics;
        const currentLevelInfo = getLevelInfo(metricsWithBadgeRewards.points);
        if (typeof window !== 'undefined') {
          const key = `lexikeep:last_level:${profile.id}`;
          const previousLevelRaw = window.localStorage.getItem(key);
          const previousLevel = previousLevelRaw ? Number(previousLevelRaw) : null;
          if (previousLevel !== null && currentLevelInfo.level > previousLevel) {
            setLevelUpInfo({ level: currentLevelInfo.level, title: currentLevelInfo.title });
          }
          window.localStorage.setItem(key, String(currentLevelInfo.level));
        }
        setMetrics(metricsWithBadgeRewards);
        setBadges(badgeSync.badges);
        setDailyChallenge(challenge);
        setReviewsDue(dueCountResult.count);
        setReviewsCompletedToday(completedTodayResult.count);
        setActiveBoost(boostResult.data);
        setQuestProgress(
          badgeSync.unlockedBadges.length > 0
            ? await getWeeklyQuestProgress(profile.id, metricsWithBadgeRewards)
            : quests,
        );
      } catch {
        setDashboardError('Could not load dashboard data. Pull to refresh or retry.');
      } finally {
        setDashboardLoading(false);
      }
    };
    void loadDashboardData();
  }, [profile?.id, reloadKey]);

  if (dashboardLoading) {
    return (
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-32 pt-5 md:px-6 md:pb-8 md:pt-8">
        <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm">Loading dashboard...</div>
      </section>
    );
  }

  if (dashboardError) {
    return (
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-32 pt-5 md:px-6 md:pb-8 md:pt-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p>{dashboardError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="student-shell mx-auto grid max-w-6xl gap-5 px-4 pb-32 pt-5 md:gap-6 md:px-6 md:pb-8 md:pt-8">
      <div className="float-in relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 p-5 text-white shadow-lg shadow-blue-200">
        <svg
          className="pointer-events-none absolute -right-2 top-0 h-24 w-24 opacity-80"
          viewBox="0 0 100 100"
          fill="none"
        >
          <circle cx="50" cy="50" r="46" stroke="white" strokeOpacity="0.4" strokeWidth="8" />
          <path d="M34 54L46 66L69 40" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Weekly Challenge</p>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
          {profile?.username ? `${profile.username}'s Dashboard` : 'Student Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-blue-50 md:text-base">
          Push your streak and outrank your classmates this week.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
          <span>Level {level.level}</span>
          <span className="text-blue-100">{level.title}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white/20 px-2 py-2">
            <p className="font-semibold">Words</p>
            <p className="text-base font-extrabold">{metrics.wordsCollected}</p>
          </div>
          <div className="rounded-xl bg-white/20 px-2 py-2">
            <p className="font-semibold">Streak</p>
            <p className="text-base font-extrabold">{metrics.streak}d</p>
          </div>
          <div className="rounded-xl bg-white/20 px-2 py-2">
            <p className="font-semibold">Points</p>
            <p className="text-base font-extrabold">{metrics.points}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${level.progressPercent}%` }} />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-blue-100">
            {level.pointsToNext === null ? 'Max level reached' : `${level.pointsToNext} pts to Level ${level.level + 1}`}
          </p>
        </div>
        <div className="mt-3 rounded-xl bg-white/20 p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100">How To Level Up Faster</p>
          <p className="mt-1 text-xs font-semibold text-white">{fastTips[0]}</p>
          {fastTips[1] && <p className="mt-0.5 text-[11px] text-blue-100">{fastTips[1]}</p>}
        </div>
        {activeBoost && (
          <div className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            Boost Live: {activeBoost.title} ({activeBoost.boost_type === 'double_xp' ? `${activeBoost.multiplier}x XP` : `+${activeBoost.flat_bonus} pts`})
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Words Collected" value={metrics.wordsCollected} icon={<BookOpen className="text-white" />} />
        <StatsCard title="Expressions" value={metrics.expressionsCollected} icon={<Sparkles className="text-white" />} />
        <StatsCard title="Current Streak" value={metrics.streak} icon={<Flame className="text-white" />} />
        <StatsCard title="Leaderboard Points" value={metrics.points} icon={<Trophy className="text-white" />} />
        <StatsCard title="Reviews Due" value={reviewsDue} icon={<Brain className="text-white" />} />
        <StatsCard title="Reviewed Today" value={reviewsCompletedToday} icon={<CircleCheckBig className="text-white" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="card-pop rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-cyan-100 p-2">
              <Target size={18} className="text-cyan-700" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Daily Hook</h2>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Word of the Day</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{dailyChallenge?.title ?? 'Loading challenge...'}</p>
          <p className="mt-1 text-sm text-slate-600">{dailyChallenge?.description}</p>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-cyan-50 px-3 py-2 text-sm">
            <span className="font-medium text-cyan-800">Target: {dailyChallenge?.target_value ?? 0}</span>
            <span className="font-semibold text-cyan-700">+{dailyChallenge?.reward_points ?? 0} pts</span>
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Teacher Boost</p>
            {activeBoost ? (
              <>
                <p className="mt-1 text-sm font-bold text-amber-900">{activeBoost.title}</p>
                <p className="mt-1 text-xs text-amber-800">{activeBoost.description ?? boostRuleLabel}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="rounded-full bg-white px-2 py-1 font-semibold text-amber-800">
                    Reward: {boostRewardLabel}
                  </span>
                  <span className="font-medium text-amber-700">Ends: {boostEndsLabel}</span>
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-amber-700">No active boost right now. Ask your teacher to launch one.</p>
            )}
          </div>
        </article>

        <article className="card-pop rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-indigo-100 p-2">
              <CircleCheckBig size={18} className="text-indigo-700" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Weekly Quests</h2>
          </div>
          <div className="space-y-3">
            {questProgress.map((quest) => (
              <div key={quest.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{quest.title}</p>
                    <p className="text-sm text-slate-600">{quest.description}</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    +{quest.reward_points}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      quest.is_completed ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                    }`}
                    style={{ width: `${quest.completion_percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {quest.current_value}/{quest.target_value} ({quest.completion_percent}%)
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <BadgeShelf badges={badges} />

      <ProgressChart />
      <CompetitionLeaderboard />

      <Link
        href="/vocabulary#collector"
        className="pulse-glow fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-blue-200 md:bottom-8 md:right-8"
        aria-label="Add vocabulary or expression"
      >
        <span className="rounded-full bg-white/25 p-1">
          <Plus size={18} />
        </span>
        Add Word
      </Link>

      {levelUpInfo && (
        <div className="float-in fixed inset-x-4 bottom-40 z-50 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-100 to-orange-100 p-4 shadow-xl md:inset-x-auto md:bottom-8 md:right-8 md:w-96">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Level Up</p>
          <p className="mt-1 text-lg font-extrabold text-amber-900">
            You reached Level {levelUpInfo.level}
          </p>
          <p className="text-sm font-semibold text-amber-800">{levelUpInfo.title}</p>
          <button
            type="button"
            onClick={() => setLevelUpInfo(null)}
            className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Awesome
          </button>
        </div>
      )}
    </section>
  );
}
