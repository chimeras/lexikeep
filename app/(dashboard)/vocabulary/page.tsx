'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import VocabularyCard from '@/components/learning/VocabularyCard';
import VocabularyCollector from '@/components/learning/VocabularyCollector';
import { getStudentVocabulary } from '@/lib/student-data';
import type { Vocabulary } from '@/types';

export default function VocabularyPage() {
  const { profile } = useAuth();
  const [vocabularyItems, setVocabularyItems] = useState<Vocabulary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVocabulary = async () => {
    if (!profile?.id) {
      setVocabularyItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await getStudentVocabulary(profile.id);
    setVocabularyItems(data);
    setLoading(false);
  };

  useEffect(() => {
    void loadVocabulary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <section className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Vocabulary</h1>
        <p className="mt-1 text-sm text-gray-600 md:text-base">Collect words and expressions and mark mastery status.</p>
      </div>

      <VocabularyCollector onSaved={loadVocabulary} />

      {loading ? (
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm md:p-5">
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
                stroke="#0284c7"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="72 72"
                className="origin-center animate-spin"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-slate-900">Loading your vocabulary</p>
              <p className="text-xs text-slate-600">Syncing words, expressions, and mastery state...</p>
            </div>
          </div>
        </div>
      ) : vocabularyItems.length === 0 ? (
        <div className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm">
          No vocabulary saved yet. Add your first word or expression above.
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4 md:grid-cols-2">
          {vocabularyItems.map((item) => (
            <VocabularyCard
              key={item.id}
              word={item.word}
              definition={item.definition}
              definitionFr={item.definition_fr}
              example={item.example_sentence ?? 'No example sentence yet.'}
              category={item.category ?? 'General'}
              difficulty={(item.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium'}
              aiAssisted={item.ai_assisted}
              imageUrl={item.image_url}
            />
          ))}
        </div>
      )}
    </section>
  );
}
