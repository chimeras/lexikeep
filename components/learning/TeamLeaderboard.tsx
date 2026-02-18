'use client';

import { Flag, Shield, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getTeamLeaderboard, type TeamLeaderboardEntry } from '@/lib/team-data';

export default function TeamLeaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TeamLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTeamPosition, setCurrentTeamPosition] = useState<number | null>(null);
  const [currentTeamName, setCurrentTeamName] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      const result = await getTeamLeaderboard(user?.id);
      setEntries(result.entries);
      setCurrentTeamPosition(result.currentTeamPosition);
      setCurrentTeamName(result.currentTeamName);
      setFallbackMode(result.fallbackMode);
      setLoading(false);
    };
    void load();
  }, [user?.id]);

  return (
    <div className="float-in overflow-hidden rounded-2xl border border-cyan-100 bg-white p-4 shadow-lg md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bob rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-2 text-white shadow-md">
            <Shield size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Team Leaderboard</h2>
            <p className="text-sm text-gray-600 md:text-base">Compete as squads and push your team to the top.</p>
          </div>
        </div>
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">Team Mode</span>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading team rankings...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No teams yet. Ask a teacher to create teams.</div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 8).map((team, index) => (
            <div
              key={team.id}
              className={`card-pop flex items-center justify-between rounded-xl border p-3 md:p-4 ${
                index === 0 ? 'border-cyan-200 bg-cyan-50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.colorHex }} />
                    <p className="font-semibold text-slate-900">{team.name}</p>
                    {index === 0 && (
                      <span className="rounded-full bg-cyan-200 px-2 py-0.5 text-[11px] font-semibold text-cyan-900">Top Team</span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-3 text-xs text-slate-600 md:text-sm">
                    <span className="flex items-center gap-1"><Users size={12} /> {team.members} members</span>
                    <span className="flex items-center gap-1"><Flag size={12} /> Avg {team.avgPoints}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-900 md:text-2xl">{team.points}</p>
                <p className="text-xs text-slate-600">team points</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-600 md:text-sm">
        {currentTeamPosition && currentTeamName ? (
          <p>
            Your team: <span className="font-semibold text-cyan-700">{currentTeamName}</span> at rank{' '}
            <span className="font-bold text-blue-700">#{currentTeamPosition}</span>
          </p>
        ) : (
          <p>You are not in a team yet.</p>
        )}
        {fallbackMode && <p className="mt-1 text-[11px] text-slate-500">Showing fallback data until team tables are available.</p>}
      </div>
    </div>
  );
}
