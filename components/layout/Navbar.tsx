'use client';

import { BookOpen, Brain, Home, Layers, MoreHorizontal, Trophy, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDashboardRoute } from '@/lib/auth';
import { useAuth } from '@/components/providers/AuthProvider';

const studentNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/materials', label: 'Materials', icon: Layers },
  { href: '/vocabulary', label: 'Vocabulary', icon: BookOpen },
  { href: '/review', label: 'Review', icon: Brain },
  { href: '/competition', label: 'Competition', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: UserRound },
];
const mobileNavItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/vocabulary', label: 'Vocab', icon: BookOpen },
  { href: '/review', label: 'Review', icon: Brain },
  { href: '/competition', label: 'Compete', icon: Trophy },
];

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, logout, isAuthenticated } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdminArea = pathname.startsWith('/admin');
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const homeHref = getDashboardRoute(profile?.role);
  const canAccessTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-blue-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16 md:px-6">
          <Link
            href={isAuthenticated ? homeHref : '/'}
            className="bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-base font-extrabold text-transparent md:text-lg"
          >
            LexiKeep
          </Link>

          {!loading && isAuthenticated && (
            <button
              type="button"
              onClick={() => setMoreOpen((previous) => !previous)}
              className="rounded-md border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100 md:hidden"
              aria-label="Open more menu"
            >
              <MoreHorizontal size={18} />
            </button>
          )}

          <nav className="hidden items-center gap-1 md:flex">
            {isAdminArea ? (
              <Link
                href="/admin/dashboard"
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
              >
                Admin Dashboard
              </Link>
            ) : (
              studentNavItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>

          <div className="hidden items-center gap-2 text-sm md:flex">
            {profile?.avatar_url && (
              <Link href="/profile" className="inline-flex">
                <Image
                  src={profile.avatar_url}
                  alt="Profile avatar"
                  width={40}
                  height={40}
                  sizes="40px"
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-100"
                />
              </Link>
            )}
            <Link href="/dashboard" className="rounded-md px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50">
              Student
            </Link>
            {canAccessTeacher && (
              <Link
                href="/admin/dashboard"
                className="rounded-md bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-black"
              >
                Teacher
              </Link>
            )}
            {!loading && isAuthenticated && (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {!loading && isAuthenticated && moreOpen && (
        <>
          <div className="fixed inset-0 top-14 z-40 bg-black/20 md:hidden" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="fixed right-3 top-16 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl md:hidden">
            <Link href="/dashboard" className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Student Dashboard
            </Link>
            {!isAdminArea && (
              <Link href="/materials" className="mt-1 block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Materials
              </Link>
            )}
            <Link href="/profile" className="mt-1 block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Profile
            </Link>
            {canAccessTeacher && (
              <Link href="/admin/dashboard" className="mt-1 block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Teacher Dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              Logout
            </button>
          </div>
        </>
      )}

      {!loading && isAuthenticated && (
        <nav
          className={`fixed inset-x-0 bottom-0 z-50 border-t border-blue-100 bg-white/95 px-2 pb-3 pt-1.5 backdrop-blur md:hidden ${
            isAdminArea ? 'hidden' : ''
          }`}
        >
          <div className="mx-auto grid max-w-lg gap-1" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}>
            {mobileNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center rounded-md px-1 py-2 text-[11px] font-semibold transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-500'
                  }`}
                >
                  <Icon size={18} />
                  <span className="mt-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
