'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import InlineSpinner from '@/components/ui/InlineSpinner';
import {
  approvePendingItem,
  getModerationStudents,
  getPendingModerationItems,
  rejectPendingItem,
  setStudentWatchMode,
  type ModerationStudent,
  type PendingModerationItem,
} from '@/lib/moderation-data';

export default function AdminModerationPage() {
  const { profile, loading: authLoading } = useAuth();
  const canAccessTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const [students, setStudents] = useState<ModerationStudent[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [watchingStudentId, setWatchingStudentId] = useState<string | null>(null);
  const [actingItemId, setActingItemId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [studentsRes, pendingRes] = await Promise.all([getModerationStudents(), getPendingModerationItems()]);
    setStudents(studentsRes.data);
    setPendingItems(pendingRes.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!profile?.id) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const handleToggleWatch = async (studentId: string, current: boolean) => {
    setWatchingStudentId(studentId);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await setStudentWatchMode(studentId, !current);
    if (error) {
      setErrorMessage(error.message);
      setWatchingStudentId(null);
      return;
    }
    setMessage(!current ? 'Student is now under watch.' : 'Student removed from watch.');
    await loadData();
    setWatchingStudentId(null);
  };

  const handleApprove = async (item: PendingModerationItem) => {
    if (!profile?.id) return;
    setActingItemId(item.id);
    setMessage(null);
    setErrorMessage(null);
    const { error, awardedPoints } = await approvePendingItem({
      entryType: item.entryType,
      itemId: item.id,
      moderatorId: profile.id,
    });
    if (error) {
      setErrorMessage(error.message);
      setActingItemId(null);
      return;
    }
    setMessage(`Approved ${item.entryType}. Student awarded +${awardedPoints} points.`);
    await loadData();
    setActingItemId(null);
  };

  const handleReject = async (item: PendingModerationItem) => {
    if (!profile?.id) return;
    setActingItemId(item.id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await rejectPendingItem({
      entryType: item.entryType,
      itemId: item.id,
      moderatorId: profile.id,
    });
    if (error) {
      setErrorMessage(error.message);
      setActingItemId(null);
      return;
    }
    setMessage(`Rejected ${item.entryType}.`);
    await loadData();
    setActingItemId(null);
  };

  if (authLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <p className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">Loading moderation...</p>
      </section>
    );
  }

  if (!profile || !canAccessTeacher) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <p className="rounded-xl bg-white p-4 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200">Teacher mode is required.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Moderation</h1>
          <p className="text-sm text-gray-600 md:text-base">Watch selected students and approve/reject pending submissions.</p>
        </div>
        <Link href="/admin/dashboard" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          Back to Dashboard
        </Link>
      </div>

      {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {errorMessage && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Students Watchlist</h2>
        {loading ? (
          <p className="mt-3 text-sm text-gray-600">Loading students...</p>
        ) : (
          <div className="mt-3 space-y-2">
            {students.map((student) => (
              <div key={student.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  {student.avatar_url ? (
                    <Image
                      src={student.avatar_url}
                      alt={student.username ?? 'Student'}
                      width={28}
                      height={28}
                      sizes="28px"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                      {((student.username ?? student.id).charAt(0) || 'S').toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{student.username ?? student.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-600">{student.points} pts | {student.requires_moderation ? 'Under watch' : 'Free mode'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleWatch(student.id, student.requires_moderation)}
                  disabled={watchingStudentId === student.id}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
                    student.requires_moderation ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                  } disabled:opacity-70`}
                >
                  {watchingStudentId === student.id ? <InlineSpinner size={12} /> : null}
                  {student.requires_moderation ? 'Remove Watch' : 'Put Under Watch'}
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Pending Queue</h2>
        {loading ? (
          <p className="mt-3 text-sm text-gray-600">Loading queue...</p>
        ) : pendingItems.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No pending submissions.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pendingItems.map((item) => (
              <div key={`${item.entryType}-${item.id}`} className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{item.entryType}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{item.term}</p>
                <p className="mt-1 text-sm text-gray-700">{item.definitionOrMeaning}</p>
                {item.exampleOrUsage && <p className="mt-1 text-xs italic text-gray-600">&quot;{item.exampleOrUsage}&quot;</p>}
                <p className="mt-1 text-xs text-gray-500">By {item.studentName}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApprove(item)}
                    disabled={actingItemId === item.id}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                  >
                    {actingItemId === item.id ? <InlineSpinner size={12} /> : null}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReject(item)}
                    disabled={actingItemId === item.id}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:bg-rose-400"
                  >
                    {actingItemId === item.id ? <InlineSpinner size={12} /> : null}
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
