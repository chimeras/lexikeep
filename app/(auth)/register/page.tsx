'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { getDashboardRoute } from '@/lib/auth';
import { signInWithGoogle, signUp, upsertProfile } from '@/lib/supabase';
import InlineSpinner from '@/components/ui/InlineSpinner';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await signUp(email, password, username);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.user?.id) {
        // Only upsert while authenticated; when email confirmation is enabled,
        // signUp can return a user without an active session and RLS will reject writes.
        if (data.session) {
          const { error: profileError } = await upsertProfile(data.user.id, username, 'student');
          if (profileError) {
            setErrorMessage(profileError.message);
            return;
          }
        }
      }

      if (data.session) {
        window.location.assign(getDashboardRoute('student'));
        return;
      }

      window.location.assign('/login');
    } catch {
      setErrorMessage('Unable to register right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleSubmitting(true);
    setErrorMessage(null);
    try {
      const origin = window.location.origin;
      const { error } = await signInWithGoogle(`${origin}/auth/callback?next=/dashboard`);
      if (error) {
        setErrorMessage(error.message);
        setGoogleSubmitting(false);
      }
    } catch {
      setErrorMessage('Unable to start Google sign up right now.');
      setGoogleSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-md items-center px-6 py-8">
      <div className="w-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
        <p className="mt-1 text-sm text-gray-600">Start collecting vocabulary and compete weekly.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
              required
              minLength={6}
            />
          </div>
          {errorMessage && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <InlineSpinner size={16} />
                Creating account...
              </>
            ) : (
              'Register'
            )}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogleSignUp()}
          disabled={googleSubmitting}
          className="group inline-flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-3 font-semibold text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-400 hover:bg-gray-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.38 3.61v3h3.85c2.25-2.07 3.58-5.11 3.58-8.64Z"
                fill="#4285F4"
              />
              <path
                d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.85-3c-1.07.72-2.44 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.95H1.28v3.09A12 12 0 0 0 12 24Z"
                fill="#34A853"
              />
              <path
                d="M5.26 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.98-3.09Z"
                fill="#FBBC05"
              />
              <path
                d="M12 4.77c1.76 0 3.33.61 4.57 1.8l3.43-3.43C17.95 1.2 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.98 3.09C6.21 6.88 8.87 4.77 12 4.77Z"
                fill="#EA4335"
              />
            </svg>
          </span>
          {googleSubmitting ? (
            <>
              <InlineSpinner size={16} />
              Redirecting to Google...
            </>
          ) : (
            'Continue with Google'
          )}
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Login
          </Link>
        </p>
      </div>
    </section>
  );
}
