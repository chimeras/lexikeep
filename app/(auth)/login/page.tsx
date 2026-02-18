'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getDashboardRoute } from '@/lib/auth';
import { getProfileById, signIn, upsertProfile } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setErrorMessage('Login succeeded but no user session was found.');
        return;
      }

      let { data: profile } = await getProfileById(userId);

      if (!profile) {
        const fallbackUsername =
          (typeof data.user?.user_metadata?.username === 'string' && data.user.user_metadata.username.trim()) ||
          email.split('@')[0];
        const { data: createdProfile, error: profileError } = await upsertProfile(userId, fallbackUsername, 'student');
        if (profileError) {
          setErrorMessage(profileError.message);
          return;
        }
        profile = createdProfile;
      }

      router.replace(getDashboardRoute(profile?.role));
    } catch {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-md items-center px-6 py-8">
      <div className="w-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Login</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to continue your vocabulary streak.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
            />
          </div>
          {errorMessage && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}
          <button
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          No account yet?{' '}
          <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">
            Register
          </Link>
        </p>
      </div>
    </section>
  );
}
