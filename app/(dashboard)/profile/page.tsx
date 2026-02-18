'use client';

import { Award, Flame, UserRound } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import { getLevelInfo } from '@/lib/levels';
import { useAuth } from '@/components/providers/AuthProvider';
import { updateProfileAvatar } from '@/lib/supabase';
import { getStudentMetrics, type StudentMetrics } from '@/lib/student-data';

const emptyMetrics: StudentMetrics = {
  points: 0,
  streak: 0,
  wordsCollected: 0,
  expressionsCollected: 0,
};

const avatarOptions = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  preferred: `/assets/avatars/${index + 1}.webp`,
  fallback: `/assets/avatars/${index + 1}.jpg`,
}));

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [metrics, setMetrics] = useState<StudentMetrics>(emptyMetrics);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null | undefined>(undefined);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [failedPreferredAvatars, setFailedPreferredAvatars] = useState<Record<string, boolean>>({});
  const level = getLevelInfo(metrics.points);
  const activeAvatar = selectedAvatar === undefined ? (profile?.avatar_url ?? null) : selectedAvatar;

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const loadMetrics = async () => {
      const nextMetrics = await getStudentMetrics(profile.id);
      setMetrics(nextMetrics);
    };
    void loadMetrics();
  }, [profile?.id]);

  const handleSaveAvatar = async () => {
    if (!profile?.id) return;
    setSavingAvatar(true);
    setAvatarMessage(null);
    setAvatarError(null);
    const { error } = await updateProfileAvatar(profile.id, activeAvatar);
    if (error) {
      setAvatarError(error.message);
      setSavingAvatar(false);
      return;
    }
    await refreshProfile();
    setAvatarMessage('Avatar updated.');
    setSavingAvatar(false);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
      <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Profile</h1>
      <p className="mt-1 text-sm text-gray-600 md:text-base">Your learning profile and current progress.</p>

      <div className="mt-5 grid gap-3 md:mt-6 md:gap-4 md:grid-cols-3">
        <StatsCard title="Total Points" value={metrics.points} icon={<Award className="text-white" />} />
        <StatsCard title="Current Streak" value={metrics.streak} icon={<Flame className="text-white" />} />
        <StatsCard title="Words Tracked" value={metrics.wordsCollected} icon={<UserRound className="text-white" />} />
      </div>

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:mt-6 md:p-6">
        <h2 className="text-xl font-semibold text-gray-900">Level Progress</h2>
        <p className="mt-1 text-sm text-gray-600">
          Level {level.level}: {level.title}
        </p>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${level.progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold text-blue-700">
          {level.pointsToNext === null ? 'You reached max level.' : `${level.pointsToNext} points to Level ${level.level + 1}`}
        </p>
      </article>

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:mt-6 md:p-6">
        <h2 className="text-xl font-semibold text-gray-900">Choose Avatar</h2>
        <p className="mt-1 text-sm text-gray-600">Pick one avatar for your student profile.</p>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {avatarOptions.map((avatar) => {
            const resolvedSrc = failedPreferredAvatars[avatar.preferred] ? avatar.fallback : avatar.preferred;
            return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => setSelectedAvatar(resolvedSrc)}
              className={`overflow-hidden rounded-xl border-2 transition ${
                activeAvatar === resolvedSrc ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
              }`}
            >
              <Image
                src={resolvedSrc}
                alt="Avatar option"
                width={96}
                height={96}
                sizes="(max-width: 768px) 20vw, 96px"
                className="h-20 w-full object-cover"
                onError={() =>
                  setFailedPreferredAvatars((previous) => ({
                    ...previous,
                    [avatar.preferred]: true,
                  }))
                }
              />
            </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveAvatar()}
            disabled={savingAvatar}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-blue-400"
          >
            {savingAvatar ? 'Saving...' : 'Save Avatar'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedAvatar(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Clear
          </button>
        </div>
        {avatarMessage && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{avatarMessage}</p>}
        {avatarError && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{avatarError}</p>}
      </article>

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:mt-6 md:p-6">
        <h2 className="text-xl font-semibold text-gray-900">Student Summary</h2>
        <p className="mt-2 text-gray-600">
          Avatar:
          {profile?.avatar_url ? (
            <span className="ml-2 inline-flex items-center gap-2 align-middle">
              <Image
                src={profile.avatar_url}
                alt="Current avatar"
                width={40}
                height={40}
                sizes="40px"
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="text-sm text-gray-700">{profile.avatar_url}</span>
            </span>
          ) : (
            ' Not set'
          )}
          <br />
          Username: {profile?.username ?? 'Unknown'}
          <br />
          Role: {profile?.role ?? 'student'}
          <br />
          Total words collected: {metrics.wordsCollected}
          <br />
          Total expressions collected: {metrics.expressionsCollected}
        </p>
      </article>
    </section>
  );
}
