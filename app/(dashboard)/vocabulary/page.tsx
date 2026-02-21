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
        <div className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm">Loading your vocabulary...</div>
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
