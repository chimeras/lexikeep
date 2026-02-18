'use client';

import { useEffect, useState } from 'react';
import { getMaterials } from '@/lib/materials-data';
import type { Material } from '@/types';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMaterials = async () => {
      const { data } = await getMaterials();
      setMaterials(data);
      setLoading(false);
    };
    void loadMaterials();
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
      <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Learning Materials</h1>
      <p className="mt-1 text-sm text-gray-600 md:text-base">Choose a source and collect new vocabulary from it.</p>

      {loading ? (
        <div className="mt-5 rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
          Loading learning materials...
        </div>
      ) : materials.length === 0 ? (
        <div className="mt-5 rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
          No materials available yet. Teachers can publish materials from the admin side.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:mt-6 md:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <article key={material.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
              <h2 className="text-lg font-semibold text-gray-900">{material.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{material.description ?? 'No description provided yet.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(material.tags ?? []).length > 0 ? (
                  (material.tags ?? []).map((tag) => (
                    <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    #general
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
