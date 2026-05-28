'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { getCapsuleForViewing, submitCapsuleCompletion } from '@/lib/capsule-data';
import type { EducationCapsule, CapsuleQuizQuestion, CapsuleCompletion } from '@/types';
import { HelpCircle, CheckCircle, AlertCircle, ArrowLeft, GraduationCap, Award } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import Link from 'next/link';

function QuizPageContent() {
  const { profile } = useAuth();
  const studentId = profile?.id;
  const searchParams = useSearchParams();
  const router = useRouter();
  const capsuleId = searchParams.get('id');

  const [activeCapsule, setActiveCapsule] = useState<EducationCapsule | null>(null);
  const [questions, setQuestions] = useState<CapsuleQuizQuestion[]>([]);
  const [completion, setCompletion] = useState<CapsuleCompletion | null>(null);
  const [loading, setLoading] = useState(true);

  // Quiz submission states
  const [answers, setAnswers] = useState<Record<string, { optionIndex?: number; textAnswer?: string }>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    submitted: boolean;
    score: number;
    total: number;
    passed: boolean;
    pointsAwarded: number;
  } | null>(null);

  useEffect(() => {
    if (!studentId || !capsuleId) return;

    const loadData = async () => {
      setLoading(true);
      const { data, error } = await getCapsuleForViewing(capsuleId, studentId);
      if (!error && data) {
        setActiveCapsule(data.capsule);
        setQuestions(data.questions);
        setCompletion(data.completion);
      } else {
        alert('Failed to load capsule quiz data.');
        router.push('/capsules');
      }
      setLoading(false);
    };

    void loadData();
  }, [studentId, capsuleId, router]);

  const handleSelectOption = (questionId: string, index: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { optionIndex: index },
    }));
  };

  const handleTextChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { textAnswer: text },
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!studentId || !activeCapsule) return;

    // Validate that all questions are answered
    for (const q of questions) {
      const ans = answers[q.id];
      if (q.question_type === 'fill_blank') {
        if (!ans?.textAnswer?.trim()) {
          alert('Please fill out all quiz questions.');
          return;
        }
      } else {
        if (ans?.optionIndex === undefined) {
          alert('Please answer all quiz questions.');
          return;
        }
      }
    }

    setSubmittingQuiz(true);

    // Calculate score locally
    let correctCount = 0;
    questions.forEach((q) => {
      const ans = answers[q.id];
      if (q.question_type === 'fill_blank') {
        const studentText = (ans.textAnswer || '').toLowerCase().trim();
        const correctText = (q.correct_answer || '').toLowerCase().trim();
        if (studentText === correctText) {
          correctCount++;
        }
      } else {
        if (ans.optionIndex === q.correct_option_index) {
          correctCount++;
        }
      }
    });

    const totalQuestions = questions.length;

    // Submit to DB
    const res = await submitCapsuleCompletion({
      studentId,
      capsuleId: activeCapsule.id,
      score: correctCount,
      totalQuestions,
    });

    if (!res.error) {
      setQuizResult({
        submitted: true,
        score: correctCount,
        total: totalQuestions,
        passed: res.passed,
        pointsAwarded: res.pointsAwarded,
      });
    } else {
      alert(`Error submitting quiz: ${res.error.message}`);
    }

    setSubmittingQuiz(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <InlineSpinner size={32} />
        <p className="text-sm text-gray-600">Loading quiz questions...</p>
      </div>
    );
  }

  if (!activeCapsule) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-rose-500 mb-3" />
        <p className="font-semibold text-gray-900">Quiz not found</p>
        <Link href="/capsules" className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:underline">
          <ArrowLeft size={16} /> Back to Capsules
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 space-y-6">
      {/* Header / Simple Navigation */}
      <div className="flex items-center justify-between border-b border-gray-150 pb-4">
        <Link
          href="/capsules"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft size={16} /> Back to Lesson
        </Link>
        <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-full">
          Passing Grade: 80%
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="text-blue-600 h-5 w-5" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">{activeCapsule.topic}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Quiz: {activeCapsule.title}</h1>
        <p className="text-sm text-slate-600">
          Answer the questions below to test your understanding. First pass awards {activeCapsule.reward_points} PTS.
        </p>
      </div>

      <div className="space-y-5">
        {questions.map((q, qIdx) => {
          const ans = answers[q.id];
          const isCorrect = q.question_type === 'fill_blank' 
            ? (ans?.textAnswer || '').toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim()
            : ans?.optionIndex === q.correct_option_index;

          return (
            <div
              key={q.id}
              className={`p-5 rounded-2xl border bg-white shadow-xs space-y-3 transition ${
                quizResult 
                  ? isCorrect 
                    ? 'border-emerald-200 ring-2 ring-emerald-500/10' 
                    : 'border-rose-250 ring-2 ring-rose-500/10'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-slate-800 text-sm md:text-base">
                  Question {qIdx + 1}
                </span>
                {quizResult && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                )}
              </div>
              
              <p className="text-gray-900 font-semibold text-sm md:text-base">
                {q.question_text}
              </p>

              {q.question_type === 'fill_blank' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={ans?.textAnswer || ''}
                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                    placeholder="Type your answer here..."
                    disabled={!!quizResult}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {quizResult && !isCorrect && (
                    <p className="text-xs text-rose-700 font-semibold">
                      Correct Answer: <span className="underline">{q.correct_answer}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(q.options || []).map((option, optIdx) => {
                    const isSelected = ans?.optionIndex === optIdx;
                    const isCorrectOption = q.correct_option_index === optIdx;
                    
                    let btnStyle = 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50';
                    if (isSelected) {
                      btnStyle = 'bg-blue-600 text-white border-blue-600';
                    }
                    
                    if (quizResult) {
                      if (isCorrectOption) {
                        btnStyle = 'bg-emerald-50 text-emerald-800 border-emerald-500 font-bold';
                      } else if (isSelected) {
                        btnStyle = 'bg-rose-50 text-rose-800 border-rose-500';
                      } else {
                        btnStyle = 'opacity-60 border-gray-250 bg-slate-50 text-slate-400';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        disabled={!!quizResult}
                        onClick={() => handleSelectOption(q.id, optIdx)}
                        className={`text-left p-3.5 rounded-xl border text-xs font-semibold transition ${btnStyle}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results and submission block */}
      <div className="pt-4">
        {quizResult ? (
          <div className="rounded-2xl border p-6 space-y-4 bg-white shadow-xs">
            <div className={`p-4 rounded-xl flex items-start gap-3 ${
              quizResult.passed 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border border-rose-250 text-rose-800'
            }`}>
              {quizResult.passed ? (
                <CheckCircle className="text-emerald-600 shrink-0 h-6 w-6 mt-0.5" />
              ) : (
                <AlertCircle className="text-rose-600 shrink-0 h-6 w-6 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-extrabold text-base">
                  {quizResult.passed ? 'Passed! Score is 80%+' : 'Failed! Score is under 80%'}
                </p>
                <p className="text-sm">
                  You scored {quizResult.score} out of {quizResult.total} questions correct ({Math.round((quizResult.score / quizResult.total) * 100)}%).
                </p>
                {quizResult.passed && quizResult.pointsAwarded > 0 && (
                  <p className="text-sm font-bold text-emerald-800 mt-2 flex items-center gap-1.5 bg-emerald-100/55 p-2 rounded-lg border border-emerald-200/50">
                    <Award size={18} className="text-amber-600 animate-bounce" /> Congratulations! 🎉 +{quizResult.pointsAwarded} Vocabulary Points awarded!
                  </p>
                )}
                {quizResult.passed && quizResult.pointsAwarded === 0 && (
                  <p className="text-xs font-semibold text-emerald-700 mt-1">
                    Quiz passed! (Practice run - no extra points awarded).
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/capsules"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 px-5 py-3 text-sm font-bold transition shadow-sm"
              >
                Back to Capsules
              </Link>
              {!quizResult.passed && (
                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setQuizResult(null);
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 text-white hover:bg-rose-700 px-5 py-3 text-sm font-bold transition shadow-sm"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border p-4 bg-white shadow-xs">
            <button
              type="button"
              disabled={submittingQuiz}
              onClick={handleSubmitQuiz}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl disabled:bg-blue-400 transition text-sm shadow-sm"
            >
              {submittingQuiz ? 'Submitting Answers...' : 'Submit Answers'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <InlineSpinner size={32} />
        <p className="text-sm text-gray-600">Loading quiz page...</p>
      </div>
    }>
      <QuizPageContent />
    </Suspense>
  );
}
