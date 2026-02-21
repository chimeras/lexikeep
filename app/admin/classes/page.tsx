'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import InlineSpinner from '@/components/ui/InlineSpinner';
import {
  assignStudentToClass,
  createClass,
  deleteClass,
  getClassMemberships,
  getStudentsForClasses,
  getTeacherClasses,
  removeStudentFromClass,
  updateClass,
} from '@/lib/classes-data';
import type { ClassMembership, Classroom, Profile } from '@/types';

export default function AdminClassesPage() {
  const { profile, loading: authLoading } = useAuth();
  const canAccessTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const [classes, setClasses] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Array<Pick<Profile, 'id' | 'username' | 'avatar_url' | 'points' | 'role'>>>([]);
  const [memberships, setMemberships] = useState<ClassMembership[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentIdToAssign, setStudentIdToAssign] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingClass, setSavingClass] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMemberships = async (classId: string) => {
    const { data } = await getClassMemberships(classId);
    setMemberships(data);
  };

  const loadData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [classesRes, studentsRes] = await Promise.all([getTeacherClasses(profile.id), getStudentsForClasses()]);
    setClasses(classesRes.data);
    setStudents(studentsRes.data);

    if (classesRes.data.length > 0) {
      const firstClassId = selectedClassId && classesRes.data.some((item) => item.id === selectedClassId)
        ? selectedClassId
        : classesRes.data[0].id;
      setSelectedClassId(firstClassId);
      await loadMemberships(firstClassId);
    } else {
      setSelectedClassId('');
      setMemberships([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!profile?.id) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (!selectedClassId) return;
    void loadMemberships(selectedClassId);
  }, [selectedClassId]);

  const resetClassForm = () => {
    setName('');
    setDescription('');
    setIsActive(true);
    setEditingClassId(null);
  };

  const handleClassSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) return;
    setSavingClass(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      teacherId: profile.id,
      name,
      description,
      isActive,
    };
    const result = editingClassId
      ? await updateClass({ id: editingClassId, ...payload })
      : await createClass(payload);

    if (result.error) {
      setErrorMessage(result.error.message);
      setSavingClass(false);
      return;
    }

    setMessage(editingClassId ? 'Class updated.' : 'Class created.');
    resetClassForm();
    await loadData();
    setSavingClass(false);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!profile?.id) return;
    setDeletingClassId(classId);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteClass(classId, profile.id);
    if (error) {
      setErrorMessage(error.message);
      setDeletingClassId(null);
      return;
    }
    setMessage('Class deleted.');
    if (selectedClassId === classId) {
      setSelectedClassId('');
    }
    await loadData();
    setDeletingClassId(null);
  };

  const handleAssignStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId || !studentIdToAssign) return;
    setAssigning(true);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await assignStudentToClass({ classId: selectedClassId, studentId: studentIdToAssign });
    if (error) {
      setErrorMessage(error.message);
      setAssigning(false);
      return;
    }
    setMessage('Student assigned to class.');
    setStudentIdToAssign('');
    await loadMemberships(selectedClassId);
    setAssigning(false);
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedClassId) return;
    setRemovingStudentId(studentId);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await removeStudentFromClass(selectedClassId, studentId);
    if (error) {
      setErrorMessage(error.message);
      setRemovingStudentId(null);
      return;
    }
    setMessage('Student removed from class.');
    await loadMemberships(selectedClassId);
    setRemovingStudentId(null);
  };

  if (authLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <p className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">Loading classes...</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <p className="rounded-xl bg-white p-4 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200">You must be signed in.</p>
      </section>
    );
  }

  if (!canAccessTeacher) {
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
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Classes</h1>
          <p className="text-sm text-gray-600 md:text-base">Create classes, assign students, and target materials by class.</p>
        </div>
        <Link href="/admin/dashboard" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          Back to Dashboard
        </Link>
      </div>

      {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {errorMessage && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{editingClassId ? 'Edit Class' : 'Create Class'}</h2>
            {editingClassId && (
              <button type="button" onClick={resetClassForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                Cancel Edit
              </button>
            )}
          </div>
          <form className="grid gap-3" onSubmit={handleClassSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Class Name *</label>
              <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 p-3" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Active
            </label>
            <button type="submit" disabled={savingClass} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">
              {savingClass ? (<><InlineSpinner size={16} />Saving...</>) : editingClassId ? 'Update Class' : 'Create Class'}
            </button>
          </form>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
          <h2 className="text-lg font-semibold text-gray-900">Your Classes</h2>
          {loading ? (
            <p className="mt-3 text-sm text-gray-600">Loading...</p>
          ) : classes.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No classes yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {classes.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-600">{item.description || 'No description.'}</p>
                      <p className="mt-1 text-xs text-blue-700">{item.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClassId(item.id);
                          setName(item.name);
                          setDescription(item.description ?? '');
                          setIsActive(item.is_active);
                        }}
                        className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteClass(item.id)}
                        disabled={deletingClassId === item.id}
                        className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-rose-400"
                      >
                        {deletingClassId === item.id ? (<><InlineSpinner size={12} />Deleting...</>) : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
        <h2 className="text-lg font-semibold text-gray-900">Class Members</h2>
        {classes.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">Create a class first.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Select Class</label>
              <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3">
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleAssignStudent}>
              <select value={studentIdToAssign} onChange={(event) => setStudentIdToAssign(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" required>
                <option value="">Select student...</option>
                {students
                  .filter((student) => !memberships.some((membership) => membership.student_id === student.id))
                  .map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.username ?? student.id.slice(0, 8)} ({student.points} pts)
                    </option>
                  ))}
              </select>
              <button type="submit" disabled={assigning || !selectedClassId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">
                {assigning ? (<><InlineSpinner size={16} />Assigning...</>) : 'Assign'}
              </button>
            </form>

            {memberships.length === 0 ? (
              <p className="text-sm text-gray-600">No students in this class yet.</p>
            ) : (
              <div className="space-y-2">
                {memberships.map((membership) => {
                  const student = students.find((item) => item.id === membership.student_id);
                  return (
                    <div key={membership.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        {student?.avatar_url ? (
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
                            {((student?.username ?? membership.student_id).charAt(0) || 'S').toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{student?.username ?? membership.student_id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-600">{student?.points ?? 0} pts</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveStudent(membership.student_id)}
                        disabled={removingStudentId === membership.student_id}
                        className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-rose-400"
                      >
                        {removingStudentId === membership.student_id ? (<><InlineSpinner size={12} />Removing...</>) : 'Remove'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
