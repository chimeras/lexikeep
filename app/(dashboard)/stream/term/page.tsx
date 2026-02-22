'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStreamTermPreview, type StreamTermPreview } from '@/lib/stream-data';

export default function StreamTermPage() {
  const searchParams = useSearchParams();
  const entryType = (searchParams.get('type') ?? 'vocabulary') as 'vocabulary' | 'expression';
  const term = searchParams.get('term') ?? '';

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<StreamTermPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!term.trim()) {
        setErrorMessage('Missing term.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      const { data, error } = await getStreamTermPreview({ entryType, term });
      if (error || !data) {
        setPreview(null);
        setErrorMessage('Details not found.');
        setLoading(false);
        return;
      }
      setPreview(data);
      setLoading(false);
    };
    void load();
  }, [entryType, term]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-5 md:px-6 md:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {entryType === 'expression' ? 'Expression Details' : 'Vocabulary Details'}
        </h1>
        <Link href="/stream" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
          Back to Stream
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
          Loading details...
        </div>
      ) : errorMessage ? (
        <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          {errorMessage}
        </div>
      ) : preview ? (
        <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
            {preview.entryType === 'expression' ? 'Expression' : 'Vocabulary'}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{preview.term}</h2>
          <p className="mt-2 text-sm text-slate-700">{preview.definitionOrMeaning}</p>
          {preview.exampleOrUsage && (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm italic text-slate-600">
              &quot;{preview.exampleOrUsage}&quot;
            </p>
          )}
          {preview.categoryOrContext && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {preview.entryType === 'expression' ? 'Context' : 'Category'}: {preview.categoryOrContext}
            </p>
          )}
        </article>
      ) : null}
    </section>
  );
}
