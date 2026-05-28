'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { getStudentCapsules, getCapsuleForViewing } from '@/lib/capsule-data';
import type { EducationCapsule, CapsuleQuizQuestion, CapsuleCompletion } from '@/types';
import { GraduationCap, Trophy, HelpCircle, CheckCircle, AlertCircle, FileText, Image as ImageIcon, Volume2, Film, ArrowRight } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';

function getEmbedUrl(url: string) {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    const id = url.split('watch?v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('vimeo.com/')) {
    const id = url.split('vimeo.com/')[1]?.split('?')[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

export default function CapsulesPage() {
  const { profile } = useAuth();
  const studentId = profile?.id;

  const [capsules, setCapsules] = useState<Array<EducationCapsule & { completion: CapsuleCompletion | null; creator?: { username: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null);

  // Active Capsule Viewer State
  const [activeCapsule, setActiveCapsule] = useState<EducationCapsule | null>(null);
  const [questions, setQuestions] = useState<CapsuleQuizQuestion[]>([]);
  const [completion, setCompletion] = useState<CapsuleCompletion | null>(null);
  const [loadingCapsule, setLoadingCapsule] = useState(false);

  const loadCapsules = async () => {
    if (!studentId) return;
    setLoading(true);
    const { data } = await getStudentCapsules(studentId);
    setCapsules(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (studentId) {
      void loadCapsules();
    }
  }, [studentId]);

  const handleOpenCapsule = async (capsuleId: string) => {
    if (!studentId) return;
    setSelectedCapsuleId(capsuleId);
    setLoadingCapsule(true);

    const { data, error } = await getCapsuleForViewing(capsuleId, studentId);
    if (!error && data) {
      setActiveCapsule(data.capsule);
      setQuestions(data.questions);
      setCompletion(data.completion);
    }
    setLoadingCapsule(false);
  };

  // Quiz state is now handled on the dedicated quiz page
  const pendingCapsules = capsules.filter((c) => !c.completion?.passed);
  const completedCapsules = capsules.filter((c) => c.completion?.passed);

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="text-blue-500" size={16} />;
      case 'video':
        return <Film className="text-amber-500" size={16} />;
      case 'audio':
        return <Volume2 className="text-emerald-500" size={16} />;
      default:
        return <FileText className="text-cyan-500" size={16} />;
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl flex items-center gap-2">
            <GraduationCap className="text-blue-600 h-8 w-8" /> Education Capsules
          </h1>
          <p className="text-sm text-gray-600 md:text-base">
            Watch, listen, read, and complete quizzes to earn vocabulary points. Passing grade is 80%!
          </p>
        </div>
        
        {capsules.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
            <Trophy className="text-amber-500 h-6 w-6" />
            <div>
              <p className="text-xs font-semibold text-blue-800">Completion Stats</p>
              <p className="text-sm font-bold text-blue-900">
                {completedCapsules.length} / {capsules.length} Completed
              </p>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
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
              <p className="text-sm font-semibold text-slate-900">Loading Capsules</p>
              <p className="text-xs text-slate-600">Preparing lessons and quizzes...</p>
            </div>
          </div>
        </div>
      ) : capsules.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
          <GraduationCap className="mx-auto text-gray-400 h-12 w-12 mb-3" />
          <p className="text-base font-semibold text-gray-900">No capsules assigned yet</p>
          <p className="text-sm text-gray-600">Your teacher will assign capsules when lessons are ready!</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* List Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {pendingCapsules.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Capsules ({pendingCapsules.length})</h2>
                <div className="grid gap-3">
                  {pendingCapsules.map((capsule) => (
                    <button
                      key={capsule.id}
                      onClick={() => void handleOpenCapsule(capsule.id)}
                      className={`w-full text-left rounded-xl bg-white p-4 shadow-xs ring-1 transition ${
                        selectedCapsuleId === capsule.id ? 'ring-2 ring-blue-600' : 'ring-1 ring-gray-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          {getMediaIcon(capsule.media_type)} {capsule.topic}
                        </span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          +{capsule.reward_points} PTS
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm mt-2">{capsule.title}</h3>
                      {capsule.completion && (
                        <p className="text-xs text-red-600 font-semibold mt-1">
                          Attempted: {capsule.completion.score}/{capsule.completion.total_questions} (Failed)
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {completedCapsules.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed Capsules ({completedCapsules.length})</h2>
                <div className="grid gap-3">
                  {completedCapsules.map((capsule) => (
                    <button
                      key={capsule.id}
                      onClick={() => void handleOpenCapsule(capsule.id)}
                      className={`w-full text-left rounded-xl bg-white/70 p-4 shadow-xs ring-1 transition ${
                        selectedCapsuleId === capsule.id ? 'ring-2 ring-blue-600' : 'ring-1 ring-gray-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle size={10} /> Completed
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          Score: {capsule.completion?.score}/{capsule.completion?.total_questions}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-500 text-sm mt-2 line-through">{capsule.title}</h3>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Viewer Area */}
          <div className="lg:col-span-2">
            {loadingCapsule ? (
              <div className="rounded-2xl border border-gray-250 bg-white p-8 text-center">
                <InlineSpinner size={24} />
                <p className="text-sm text-gray-600 mt-2">Loading capsule content...</p>
              </div>
            ) : activeCapsule ? (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-xs p-5 md:p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {activeCapsule.topic}
                    </span>
                    <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase">
                      {activeCapsule.media_type} Lesson
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 md:text-2xl mt-2">{activeCapsule.title}</h2>
                  {activeCapsule.description && (
                    <p className="text-sm text-gray-600 mt-1">{activeCapsule.description}</p>
                  )}
                </div>

                {/* Media Section */}
                <div className="overflow-hidden rounded-xl bg-slate-900">
                  {activeCapsule.media_type === 'image' && (
                    <img
                      src={activeCapsule.media_url}
                      alt={activeCapsule.title}
                      className="mx-auto max-h-[350px] w-full object-contain"
                    />
                  )}
                  {activeCapsule.media_type === 'video' && (
                    <div className="aspect-video w-full">
                      <iframe
                        src={getEmbedUrl(activeCapsule.media_url)}
                        title={activeCapsule.title}
                        className="h-full w-full border-none"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                  {activeCapsule.media_type === 'audio' && (
                    <div className="p-6 bg-slate-800 flex justify-center items-center">
                      <audio controls className="w-full max-w-md">
                        <source src={activeCapsule.media_url} />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  {activeCapsule.media_type === 'document' && (
                    <div className="p-8 bg-slate-800 text-center space-y-3">
                      <FileText className="mx-auto text-cyan-400 h-16 w-16" />
                      <p className="text-white font-semibold text-sm">Attached PDF Lesson Material</p>
                      <a
                        href={activeCapsule.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-700"
                      >
                        Open Document in New Tab
                      </a>
                    </div>
                  )}
                </div>

                {/* Lesson Body text */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-500 mb-2">Lesson</h3>
                  <div 
                    className="text-gray-800 text-sm md:text-base leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: activeCapsule.content_text }}
                  />
                </div>

                {/* Quiz Section Redirect */}
                <div className="border-t border-gray-150 pt-5 space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <HelpCircle className="text-blue-600" /> Lesson Quiz
                    </h3>
                    <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                      Passing Grade: 80%
                    </span>
                  </div>

                  {completion?.passed ? (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
                      <CheckCircle className="text-emerald-600 shrink-0 h-6 w-6 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-sm">You completed this capsule!</p>
                        <p className="text-xs">Your Best Score: {completion.score} / {completion.total_questions}</p>
                        <div className="pt-2">
                          <Link
                            href={`/capsules/quiz?id=${activeCapsule.id}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition"
                          >
                            Re-take Quiz (For Practice) <ArrowRight size={16} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-xl border border-blue-150 bg-blue-50 text-blue-900 space-y-3">
                      <p className="text-sm font-medium">
                        Done reading and learning? Test your knowledge with the capsule quiz to earn <strong>{activeCapsule.reward_points}</strong> points!
                      </p>
                      <div className="pt-1">
                        <Link
                          href={`/capsules/quiz?id=${activeCapsule.id}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-bold transition shadow-sm"
                        >
                          Ready for the Quiz? Start Quiz <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500 bg-slate-50">
                <GraduationCap className="mx-auto text-gray-300 h-16 w-16 mb-2" />
                <p className="font-semibold">Select a capsule from the list to start learning</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
