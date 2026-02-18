'use client';

import { Target, TrendingUp, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getCompetitionLeaderboard, type LeaderboardEntry } from '@/lib/competition-data';
import { getLevelInfo } from '@/lib/levels';

export default function CompetitionLeaderboard() {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [currentPosition, setCurrentPosition] = useState<number | null>(null);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      const { entries, currentUserPosition, currentUserPoints } = await getCompetitionLeaderboard(user?.id);
      setLeaderboardData(entries);
      setCurrentPosition(currentUserPosition);
      setCurrentPoints(currentUserPoints);
      setLoading(false);
    };
    void loadLeaderboard();
  }, [user?.id]);

  return (
    <div className="float-in overflow-hidden rounded-2xl border border-indigo-100 bg-white p-4 shadow-lg md:p-6">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="bob rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 p-2 text-white shadow-md shadow-orange-100">
            <Trophy className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Weekly Competition</h2>
            <p className="text-sm text-gray-600 md:text-base">Collect vocabulary to climb the leaderboard.</p>
          </div>
        </div>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 md:text-sm">
          Live Ranking
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading leaderboard...</div>
      ) : leaderboardData.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          No leaderboard data yet. Start collecting to appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboardData.map((student, index) => {
            const level = getLevelInfo(student.points);
            return (
            <div
              key={student.id}
              className={`card-pop flex items-center justify-between rounded-xl p-3 md:p-4 ${
                index === 0
                  ? 'border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50'
                  : 'border border-gray-100 bg-gray-50'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3 md:gap-4">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    index === 0
                      ? 'bg-yellow-100 text-yellow-800'
                      : index === 1
                        ? 'bg-gray-200 text-gray-700'
                        : index === 2
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-gray-900">{student.username}</h3>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      L{level.level}
                    </span>
                    {index === 0 && (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Champion
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600 md:gap-3 md:text-sm">
                    <span className="flex items-center gap-1">
                      <Target size={12} />
                      {student.words} words
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp size={12} />
                      {student.expressions} expressions
                    </span>
                    <span>{student.streak} day streak</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-gray-900 md:text-2xl">{student.points}</div>
                <div className="text-xs text-gray-600 md:text-sm">points</div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 border-t border-gray-200 pt-4 md:pt-6">
        <div className="flex flex-col items-start justify-between gap-3 text-sm sm:flex-row sm:items-center">
          <div className="text-xs text-gray-600 md:text-sm">
            Your position:{' '}
            <span className="font-bold text-blue-600">{currentPosition ? `#${currentPosition}` : 'Unranked'}</span> with {currentPoints} points
          </div>
          <button className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 font-semibold text-white hover:opacity-95">
            View Full Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
