import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type AppRole, getDashboardRoute } from '@/lib/auth';
import type { Profile } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

let browserClient: SupabaseClient | null = null;

const getSupabaseBrowserClient = () => {
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

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
