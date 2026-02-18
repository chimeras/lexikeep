'use client';

import { BookOpen, Flame, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import type { StudentBadge } from '@/types';

interface BadgeShelfProps {
  badges: StudentBadge[];
}

const iconMap = {
  spark: Sparkles,
  book: BookOpen,
  chat: Zap,
  flame: Flame,
  trophy: Trophy,
  target: Target,
} as const;

const colorMap = {
  blue: 'from-blue-500 to-cyan-500 text-blue-900',
  emerald: 'from-emerald-500 to-teal-500 text-emerald-900',
  amber: 'from-amber-400 to-orange-500 text-amber-900',
  rose: 'from-rose-500 to-pink-500 text-rose-900',
  violet: 'from-violet-500 to-indigo-500 text-violet-900',
  cyan: 'from-cyan-500 to-sky-500 text-cyan-900',
} as const;

export default function BadgeShelf({ badges }: BadgeShelfProps) {
  return (
    <article className="card-pop rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Badge Hunt</h2>
        <p className="text-xs font-semibold text-violet-700">
          {badges.filter((badge) => badge.unlocked).length}/{badges.length} unlocked
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {badges.map((badge) => {
          const Icon = iconMap[badge.icon];
          const progressPercent = Math.min(100, Math.round((badge.progress / Math.max(1, badge.target)) * 100));
          return (
            <div
              key={badge.id}
              className={`rounded-xl border p-2.5 ${
                badge.unlocked ? 'border-transparent bg-slate-50 shadow-sm' : 'border-slate-200 bg-white'
              }`}
            >
              <div
                className={`bob inline-flex rounded-lg bg-gradient-to-br p-2 ${
                  badge.unlocked ? colorMap[badge.color] : 'from-slate-200 to-slate-300 text-slate-600'
                }`}
              >
                <Icon size={16} />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{badge.name}</p>
              <p className="mt-0.5 text-xs text-slate-600">{badge.description}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    badge.unlocked ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-slate-300'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-600">
                {Math.min(badge.progress, badge.target)}/{badge.target}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}
