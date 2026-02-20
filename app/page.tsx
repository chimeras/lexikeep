import Link from 'next/link';

export default function Home() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 md:py-20">
      <div className="grid gap-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8 md:grid-cols-2 md:items-center md:p-10">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            LexiKeep
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Vocabulary and Expressions Tracker
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Collect words from learning materials, build a streak, and compete with your class.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Open Dashboard
            </Link>
            <Link
              href="/competition"
              className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-50"
            >
              See Competition
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 p-6 sm:p-8">
          <p className="mb-2 text-sm font-semibold text-gray-500">Weekly Snapshot</p>
          <p className="text-3xl font-bold text-gray-900">127 points</p>
          <div className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-gray-500">Words</p>
              <p className="text-xl font-bold text-blue-700">18</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-gray-500">Expressions</p>
              <p className="text-xl font-bold text-emerald-700">9</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-gray-500">Streak</p>
              <p className="text-xl font-bold text-amber-700">7 days</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-gray-500">Rank</p>
              <p className="text-xl font-bold text-violet-700">#5</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
