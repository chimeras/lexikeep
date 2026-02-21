'use client';

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { getProfileById, signOut, supabase, upsertProfile } from '@/lib/supabase';
import { publishJoinPostIfMissing } from '@/lib/stream-data';
import type { Profile } from '@/types';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const ensureProfile = async (targetUser: User) => {
    const { data: existingProfile } = await getProfileById(targetUser.id);
    if (existingProfile) {
      return existingProfile;
    }

    const fallbackUsername =
      (typeof targetUser.user_metadata?.username === 'string' && targetUser.user_metadata.username.trim()) ||
      targetUser.email?.split('@')[0] ||
      `student-${targetUser.id.slice(0, 8)}`;

    const { data: createdProfile } = await upsertProfile(targetUser.id, fallbackUsername, 'student');
    if (createdProfile) {
      await publishJoinPostIfMissing({
        userId: targetUser.id,
        username: createdProfile.username ?? fallbackUsername,
      });
    }
    return createdProfile;
  };

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const data = await ensureProfile(user);
    setProfile(data);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      const nextSession = data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const profileData = await ensureProfile(nextSession.user);
        if (mounted) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) {
        return;
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const profileData = await ensureProfile(nextSession.user);
        if (mounted) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const value: AuthContextValue = {
    loading,
    session,
    user,
    profile,
    isAuthenticated: Boolean(user),
    refreshProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
