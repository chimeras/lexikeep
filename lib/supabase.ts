import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type AppRole, getDashboardRoute } from '@/lib/auth';
import type { Profile } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const missingSupabaseEnvMessage = 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY';

let browserClient: SupabaseClient | null = null;

const createMissingSupabaseClient = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(missingSupabaseEnvMessage);
      },
    },
  ) as SupabaseClient;

const getSupabaseBrowserClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      throw new Error(missingSupabaseEnvMessage);
    }
    return createMissingSupabaseClient();
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
};

export const supabase = getSupabaseBrowserClient();

export { getDashboardRoute };

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signUp = async (email: string, password: string, username: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, role: 'student' satisfies AppRole },
    },
  });
  return { data, error };
};

export const signInWithGoogle = async (redirectTo: string) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return { data, error };
};

export const upsertProfile = async (userId: string, username: string, role: AppRole = 'student') => {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        username,
        role,
      },
      { onConflict: 'id' },
    )
    .select()
    .single();
  return { data: data as Profile | null, error };
};

export const getProfileById = async (userId: string) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return { data: (data as Profile | null) ?? null, error };
};

export const updateProfileAvatar = async (userId: string, avatarUrl: string | null) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
    .select()
    .single();
  return { data: (data as Profile | null) ?? null, error };
};

export const updateProfileUsername = async (userId: string, username: string) => {
  const trimmed = username.trim();
  if (!trimmed) {
    return { data: null as Profile | null, error: { message: 'Username cannot be empty.' } };
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({ username: trimmed })
    .eq('id', userId)
    .select()
    .single();
  return { data: (data as Profile | null) ?? null, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
