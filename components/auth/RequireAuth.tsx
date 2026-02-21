'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

interface RequireAuthProps {
  children: ReactNode;
  requireTeacher?: boolean;
}

export default function RequireAuth({ children, requireTeacher = false }: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated, profile } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (requireTeacher) {
      const role = profile?.role ?? 'student';
      if (role !== 'teacher' && role !== 'admin') {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, loading, profile?.role, requireTeacher, router]);

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
          Checking session...
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireTeacher) {
    const role = profile?.role ?? 'student';
    if (role !== 'teacher' && role !== 'admin') {
      return null;
    }
  }

  return <>{children}</>;
}
