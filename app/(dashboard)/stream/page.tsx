'use client';

import ActivityStream from '@/components/learning/ActivityStream';

export default function StreamPage() {
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-4 px-3 pb-28 pt-4 sm:px-4 md:px-6 md:pb-8 md:pt-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">Community</p>
        <h1 className="mt-1 text-xl font-extrabold text-slate-900 md:text-2xl">Live Student Stream</h1>
        <p className="mt-1 text-xs text-slate-600 md:text-sm">
          See classmates&apos; progress and share quick updates.
        </p>
      </header>
      <ActivityStream compact />
    </section>
  );
}

