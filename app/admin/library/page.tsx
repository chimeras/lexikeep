'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import InlineSpinner from '@/components/ui/InlineSpinner';
import {
  createLibraryResource,
  deleteLibraryResource,
  getTeacherLibraryResources,
} from '@/lib/library-data';
import type { LibraryResource } from '@/types';

const parseTags = (tagText: string) =>
  tagText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

export default function AdminLibraryPage() {
  const { profile, loading: authLoading } = useAuth();
  const canAccessTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [resourceType, setResourceType] = useState<'book' | 'article' | 'website'>('book');
  const [downloadable, setDownloadable] = useState(false);
  const [tagText, setTagText] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadResources = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await getTeacherLibraryResources(profile.id);
    setResources(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!profile?.id) return;
    void loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setUrl('');
    setResourceType('book');
    setDownloadable(false);
    setTagText('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await createLibraryResource({
      createdBy: profile.id,
      title,
      description,
      resourceType,
      url,
      downloadable,
      tags: parseTags(tagText),
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage('Resource added to library.');
    resetForm();
    await loadResources();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!profile?.id) return;
    setDeletingId(id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteLibraryResource(id, profile.id);
    if (error) {
      setErrorMessage(error.message);
      setDeletingId(null);
      return;
    }
    setMessage('Resource deleted.');
    await loadResources();
    setDeletingId(null);
  };

  if (authLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <p className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">Loading library manager...</p>
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
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Library Manager</h1>
          <p className="text-sm text-gray-600 md:text-base">Add books, articles, and websites for students.</p>
        </div>
        <Link href="/admin/dashboard" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          Back to Dashboard
        </Link>
      </div>

      {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {errorMessage && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Add Resource</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
            <input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 p-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select value={resourceType} onChange={(event) => setResourceType(event.target.value as 'book' | 'article' | 'website')} className="w-full rounded-lg border border-gray-300 p-3">
              <option value="book">Book</option>
              <option value="article">Article</option>
              <option value="website">Website</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
            <input value={tagText} onChange={(event) => setTagText(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">URL *</label>
            <input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://your-server.com/file.pdf or https://site.com/article" className="w-full rounded-lg border border-gray-300 p-3" />
          </div>
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={downloadable} onChange={(event) => setDownloadable(event.target.checked)} />
              This link is downloadable (PDF/file)
            </label>
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">
              {saving ? (<><InlineSpinner size={16} />Saving...</>) : 'Add Resource'}
            </button>
          </div>
        </form>
      </article>

      <article className="mt-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Your Library Resources</h2>
        {loading ? (
          <p className="mt-3 text-sm text-gray-600">Loading...</p>
        ) : resources.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No resources yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {resources.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600">{item.description || 'No description.'}</p>
                    <p className="mt-1 text-xs text-blue-700 break-all">{item.url}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.resource_type} | {item.downloadable ? 'downloadable' : 'open link'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-rose-400"
                  >
                    {deletingId === item.id ? (<><InlineSpinner size={12} />Deleting...</>) : 'Delete'}
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
