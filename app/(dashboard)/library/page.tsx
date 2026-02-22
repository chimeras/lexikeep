'use client';

import { useEffect, useState } from 'react';
import { getLibraryResources } from '@/lib/library-data';
import type { LibraryResource } from '@/types';

const resourceTypeLabel: Record<LibraryResource['resource_type'], string> = {
  book: 'Book',
  article: 'Article',
  website: 'Website',
};

export default function LibraryPage() {
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResources = async () => {
      const { data } = await getLibraryResources();
      setResources(data);
      setLoading(false);
    };
    void loadResources();
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
      <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Library</h1>
      <p className="mt-1 text-sm text-gray-600 md:text-base">
        Books, articles, and websites selected for vocabulary practice.
      </p>

      {loading ? (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
          <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-blue-100/70 blur-2xl" />
          <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-cyan-100/70 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <svg viewBox="0 0 64 64" className="h-12 w-12 shrink-0">
              <circle cx="32" cy="32" r="22" fill="none" stroke="#dbeafe" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="22"
                fill="none"
                stroke="#2563eb"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="72 72"
                className="origin-center animate-spin"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-slate-900">Loading library</p>
              <p className="text-xs text-slate-600">Fetching books, articles, and websites...</p>
            </div>
          </div>
        </div>
      ) : resources.length === 0 ? (
        <div className="mt-5 rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
          No resources yet. Teachers can add items from the admin library page.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:mt-6 md:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((item) => (
            <article key={item.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
              <div className="mb-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {resourceTypeLabel[item.resource_type]}
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{item.description ?? 'No description provided yet.'}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                download={item.downloadable}
                className="mt-3 inline-flex rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {item.downloadable ? 'Download' : 'Open Website'}
              </a>
              <div className="mt-4 flex flex-wrap gap-2">
                {(item.tags ?? []).length > 0 ? (
                  (item.tags ?? []).map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    #resource
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
