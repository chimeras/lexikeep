'use client';

import { BookOpen, ImagePlus, Link, Loader2, Sparkles, Upload } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import { syncStudentBadges } from '@/lib/badges-service';
import { scoreContextUsage, type ContextScoreResult } from '@/lib/context-score';
import { awardStudentPoints, createStudentExpression, createStudentVocabulary } from '@/lib/student-data';
import { supabase } from '@/lib/supabase';

type SourceType = 'material' | 'web' | 'manual';
type EntryType = 'word' | 'expression';

interface MicroFeedback {
  tip: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

const sourceOptions: Array<{ id: SourceType; label: string; icon: typeof Upload }> = [
  { id: 'material', icon: BookOpen, label: 'From Material' },
  { id: 'web', icon: Link, label: 'From Web' },
  { id: 'manual', icon: Upload, label: 'Manual Entry' },
];

interface VocabularyCollectorProps {
  onSaved?: () => Promise<void> | void;
}

const MICRO_QUIZ_BONUS_POINTS = 3;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;

const compressImageFile = async (file: File): Promise<File> => {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height));
  const targetWidth = Math.max(1, Math.round(imageBitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }
  context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.82);
  });

  if (!blob) {
    return file;
  }

  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
};

const buildMicroFeedback = (entryType: EntryType, term: string, definition: string, category: string): MicroFeedback => {
  const cleanTerm = term.trim();
  const titleCaseTerm = cleanTerm.length > 0 ? cleanTerm : 'this term';

  if (entryType === 'word') {
    return {
      tip: `Learning tip: Use "${titleCaseTerm}" with a category-specific collocation. In ${category.toLowerCase()}, precise pairings improve fluency.`,
      question: `Which sentence uses "${titleCaseTerm}" more naturally?`,
      options: [
        `I memorize "${titleCaseTerm}" only, no context needed.`,
        `I used "${titleCaseTerm}" in a full sentence related to ${category.toLowerCase()}.`,
        `"${titleCaseTerm}" is useful only in dictionaries.`,
      ],
      correctAnswer: `I used "${titleCaseTerm}" in a full sentence related to ${category.toLowerCase()}.`,
    };
  }

  return {
    tip: `Learning tip: For expressions, match tone and situation. Keep "${titleCaseTerm}" in realistic context, not isolated translation.`,
    question: `What is the best way to study "${titleCaseTerm}" next?`,
    options: [
      `Use "${titleCaseTerm}" in one spoken and one written context.`,
      `Repeat "${titleCaseTerm}" without context five times.`,
      `Avoid linking "${titleCaseTerm}" to real situations.`,
    ],
    correctAnswer: `Use "${titleCaseTerm}" in one spoken and one written context.`,
  };
};

export default function VocabularyCollector({ onSaved }: VocabularyCollectorProps) {
  const { profile, user, refreshProfile } = useAuth();
  const [sourceType, setSourceType] = useState<SourceType>('material');
  const [entryType, setEntryType] = useState<EntryType>('word');
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('Business');
  const [definition, setDefinition] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [microFeedback, setMicroFeedback] = useState<MicroFeedback | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<'correct' | 'incorrect' | null>(null);
  const [bonusAwarded, setBonusAwarded] = useState(false);
  const [isAwardingBonus, setIsAwardingBonus] = useState(false);
  const [badgeUnlockMessage, setBadgeUnlockMessage] = useState<string | null>(null);
  const [contextScore, setContextScore] = useState<ContextScoreResult | null>(null);

  const handleGenerateWithLlama = async () => {
    if (!term.trim()) {
      setErrorMessage('Please enter a word or expression first.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/ai/definition-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term: term.trim(),
          entryType,
          category,
        }),
      });

      const data = (await response.json()) as {
        definition?: string;
        example?: string;
        error?: string;
      };

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to generate content.');
        return;
      }

      if (!data.definition || !data.example) {
        setErrorMessage('Model response was incomplete. Try again.');
        return;
      }

      setDefinition(data.definition);
      setExampleSentence(data.example);
      setStatusMessage('Definition and example generated with Llama 3.');
    } catch {
      setErrorMessage('Could not reach generation service. Check model server and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const applyBadgeSync = async (studentId: string) => {
    const result = await syncStudentBadges(studentId);
    if (result.error) {
      return;
    }
    if (result.unlockedBadges.length === 0) {
      return;
    }
    const unlockedNames = result.unlockedBadges.map((badge) => badge.name).join(', ');
    const rewardTotal = result.unlockedBadges.reduce((sum, badge) => sum + badge.reward_points, 0);
    setBadgeUnlockMessage(
      `Badge unlocked: ${unlockedNames}${rewardTotal > 0 ? ` (+${rewardTotal} badge points)` : ''}`,
    );
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const studentId = profile?.id ?? user?.id ?? null;
    if (!studentId) {
      setErrorMessage('You must be logged in to upload images.');
      event.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMessage('Image is too large. Max size is 5MB.');
      event.target.value = '';
      return;
    }

    setIsUploadingImage(true);
    setErrorMessage(null);

    let uploadFile = file;
    try {
      uploadFile = await compressImageFile(file);
    } catch {
      uploadFile = file;
    }

    if (uploadFile.size > MAX_UPLOAD_BYTES) {
      setErrorMessage('Image is still larger than 5MB after compression. Please use a smaller file.');
      setIsUploadingImage(false);
      event.target.value = '';
      return;
    }

    const extension = uploadFile.name.split('.').pop()?.toLowerCase() || 'webp';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const filePath = `word-images/${studentId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('lexikeep').upload(filePath, uploadFile, {
      upsert: false,
    });

    if (uploadError) {
      setErrorMessage(uploadError.message);
      setIsUploadingImage(false);
      event.target.value = '';
      return;
    }

    const { data } = supabase.storage.from('lexikeep').getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    setStatusMessage('Image uploaded successfully.');
    setIsUploadingImage(false);
    event.target.value = '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const studentId = profile?.id ?? user?.id ?? null;
    if (!studentId) {
      setErrorMessage('You must be logged in as a student profile.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setMicroFeedback(null);
    setSelectedOption(null);
    setQuizResult(null);
    setBonusAwarded(false);
    setIsAwardingBonus(false);
    setBadgeUnlockMessage(null);
    setContextScore(null);

    const savedTerm = term;
    const savedDefinition = definition;
    const savedCategory = category;
    const savedType = entryType;
    let dailyHookBonusPoints = 0;

    if (entryType === 'word') {
      const { error, dailyHookBonusPoints: hookBonus } = await createStudentVocabulary({
        studentId,
        word: term,
        definition,
        exampleSentence,
        category,
        imageUrl,
      });
      if (error) {
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }
      dailyHookBonusPoints = hookBonus ?? 0;
    } else {
      const { error } = await createStudentExpression({
        studentId,
        expression: term,
        meaning: definition,
        usageExample: exampleSentence,
        category,
      });
      if (error) {
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }
    }

    setStatusMessage(
      savedType === 'word'
        ? `Word saved to your profile.${dailyHookBonusPoints > 0 ? ` Daily Hook matched (+${dailyHookBonusPoints} bonus points).` : ''}`
        : 'Expression saved to your profile.',
    );
    setMicroFeedback(buildMicroFeedback(savedType, savedTerm, savedDefinition, savedCategory));
    const contextResult = scoreContextUsage(savedTerm, exampleSentence);
    setContextScore(contextResult);
    if (contextResult.bonusPoints > 0) {
      await awardStudentPoints(studentId, contextResult.bonusPoints);
    }
    setTerm('');
    setDefinition('');
    setExampleSentence('');
    setImageUrl('');
    await applyBadgeSync(studentId);
    await refreshProfile();
    if (onSaved) {
      await onSaved();
    }
    setIsSubmitting(false);
  };

  const handleQuizAnswer = async (option: string) => {
    const studentId = profile?.id ?? user?.id ?? null;
    if (!microFeedback || !studentId || isAwardingBonus) {
      return;
    }
    setSelectedOption(option);
    const isCorrect = option === microFeedback.correctAnswer;
    setQuizResult(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect && !bonusAwarded) {
      setIsAwardingBonus(true);
      const { error } = await awardStudentPoints(studentId, MICRO_QUIZ_BONUS_POINTS);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setBonusAwarded(true);
        await applyBadgeSync(studentId);
        await refreshProfile();
        if (onSaved) {
          await onSaved();
        }
      }
      setIsAwardingBonus(false);
    }
  };

  return (
    <div id="collector" className="rounded-xl bg-white p-4 shadow-lg md:p-6">
      <h2 className="mb-4 text-lg font-bold text-gray-900 md:mb-6 md:text-xl">Collect New Vocabulary</h2>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setEntryType('word')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            entryType === 'word' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          Word
        </button>
        <button
          type="button"
          onClick={() => setEntryType('expression')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            entryType === 'expression' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          Expression
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 md:mb-6 md:gap-4">
        {sourceOptions.map((source) => (
          <button
            key={source.id}
            onClick={() => setSourceType(source.id)}
            className={`flex min-h-24 flex-col items-center justify-center rounded-lg border-2 p-2 text-center transition-all md:p-4 ${
              sourceType === source.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            type="button"
          >
            <source.icon
              className={`mb-1.5 ${sourceType === source.id ? 'text-blue-600' : 'text-gray-500'} md:mb-2`}
              size={20}
            />
            <span
              className={`text-xs font-medium md:text-sm ${sourceType === source.id ? 'text-blue-700' : 'text-gray-700'}`}
            >
              {source.label}
            </span>
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {sourceType === 'material' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Select Learning Material</label>
            <select className="w-full rounded-lg border border-gray-300 p-3">
              <option>Unit 3: Business English</option>
              <option>Article: Climate Change Report</option>
              <option>Podcast: Daily News</option>
            </select>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Word / Expression *</label>
            <input
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
              placeholder="e.g., Sustainable development"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
            <select
              className="w-full rounded-lg border border-gray-300 p-3"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>Business</option>
              <option>Academic</option>
              <option>Conversational</option>
              <option>Technical</option>
              <option>Idiom</option>
            </select>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleGenerateWithLlama}
            disabled={isGenerating || isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Sparkles size={16} />
            {isGenerating ? 'Generating...' : 'Generate with Llama 3'}
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Definition *</label>
          <textarea
            value={definition}
            onChange={(event) => setDefinition(event.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3"
            rows={2}
            placeholder="Clear definition in English..."
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Example Sentence *</label>
          <textarea
            value={exampleSentence}
            onChange={(event) => setExampleSentence(event.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3"
            rows={2}
            placeholder="Show the word in context..."
            required
          />
        </div>

        {entryType === 'word' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Upload Image (optional)</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              {isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {isUploadingImage ? 'Uploading...' : 'Choose Image'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploadingImage || isSubmitting}
              />
            </label>
            <p className="mt-1 text-xs text-gray-500">JPG/PNG/WEBP, max 5MB.</p>
          </div>
        )}

        {entryType === 'word' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Word Image URL (optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
              placeholder="https://... or /assets/words/example.webp"
            />
            {imageUrl && (
              <div className="relative mt-2 h-40 overflow-hidden rounded-lg border border-gray-200">
                <Image
                  src={imageUrl}
                  alt="Word preview"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              </div>
            )}
          </div>
        )}
        {statusMessage && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</p>}
        {errorMessage && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}
        {badgeUnlockMessage && <p className="rounded-lg bg-violet-50 p-3 text-sm font-medium text-violet-700">{badgeUnlockMessage}</p>}
        {contextScore && (
          <div
            className={`rounded-lg p-3 text-sm ${
              contextScore.level === 'excellent'
                ? 'bg-cyan-50 text-cyan-800'
                : contextScore.level === 'strong'
                  ? 'bg-blue-50 text-blue-800'
                  : contextScore.level === 'developing'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
            }`}
          >
            <p className="font-semibold">
              Context Score: {contextScore.score}/100
              {contextScore.bonusPoints > 0 ? ` (+${contextScore.bonusPoints} points)` : ''}
            </p>
            <p className="mt-1">{contextScore.feedback}</p>
          </div>
        )}
        {microFeedback && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <h3 className="text-sm font-bold text-indigo-900">Micro Lesson</h3>
            <p className="mt-1 text-sm text-indigo-800">{microFeedback.tip}</p>
            <div className="mt-3">
              <p className="text-sm font-semibold text-slate-800">{microFeedback.question}</p>
              <div className="mt-2 space-y-2">
                {microFeedback.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleQuizAnswer(option)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedOption === option
                        ? option === microFeedback.correctAnswer
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-rose-300 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {quizResult === 'correct' && (
                <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm font-medium text-emerald-700">
                  Correct. Great context choice.
                  {bonusAwarded ? ` Bonus +${MICRO_QUIZ_BONUS_POINTS} points awarded.` : ' Bonus pending...'}
                </p>
              )}
              {quizResult === 'incorrect' && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-700">
                  Nice try. Choose the option that uses the term in real context.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Collect and Earn Points'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50"
          >
            Save as Draft
          </button>
        </div>
      </form>
    </div>
  );
}
