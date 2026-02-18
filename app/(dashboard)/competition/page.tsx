import CompetitionLeaderboard from '@/components/learning/CompetitionLeaderboard';
import TeamLeaderboard from '@/components/learning/TeamLeaderboard';
import Link from 'next/link';

export default function CompetitionPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
      <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Competition</h1>
      <p className="mt-1 text-sm text-gray-600 md:text-base">Weekly leaderboard for words, expressions, and streaks.</p>
      <div className="mt-4">
        <Link
          href="/competition/duel"
          className="inline-flex rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white hover:from-rose-700 hover:to-orange-600"
        >
          Enter Duel Arena
        </Link>
      </div>
      <div className="mt-5 md:mt-6">
        <CompetitionLeaderboard />
      </div>
      <div className="mt-5 md:mt-6">
        <TeamLeaderboard />
      </div>
    </section>
  );
}
