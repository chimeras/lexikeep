'use client';

import { useState } from 'react';
import { Bookmark, Volume2, CheckCircle } from 'lucide-react';
import Image from 'next/image';

interface VocabularyCardProps {
  word: string;
  definition: string;
  definitionFr?: string | null;
  example: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  aiAssisted?: boolean;
  imageUrl?: string | null;
}

export default function VocabularyCard({ 
  word, 
  definition, 
  definitionFr,
  example, 
  category,
  difficulty,
  aiAssisted,
  imageUrl,
}: VocabularyCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [status, setStatus] = useState<'new' | 'learning' | 'mastered'>('new');
  const statuses: Array<'new' | 'learning' | 'mastered'> = ['new', 'learning', 'mastered'];

  const speakWord = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800'
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md transition-all duration-300 hover:shadow-lg md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 md:text-2xl">{word}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${difficultyColors[difficulty]}`}>
              {difficulty}
            </span>
            {aiAssisted && (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                AI-assisted
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`p-2 rounded-full ${isBookmarked ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}
          >
            <Bookmark size={20} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={speakWord}
            className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
          >
            <Volume2 size={20} />
          </button>
        </div>
      </div>

      <div className="mb-4">
        {imageUrl && (
          <div className="relative mb-3 h-40 overflow-hidden rounded-lg border border-gray-200">
            <Image src={imageUrl} alt={word} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" unoptimized />
          </div>
        )}
        {definitionFr && (
          <p className="mb-1 rounded-md bg-blue-50 px-2 py-1 text-sm text-blue-800 md:text-base">
            FR: {definitionFr}
          </p>
        )}
        <p className="mb-2 text-sm text-gray-700 md:text-base">{definition}</p>
        <p className="text-gray-600 italic">&quot;{example}&quot;</p>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
          {category}
        </span>
        
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                status === s 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status === s && <CheckCircle size={14} />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
