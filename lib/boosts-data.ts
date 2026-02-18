import { supabase } from '@/lib/supabase';
import type { TeacherBoost } from '@/types';

export const getActiveBoost = async () => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('teacher_boosts')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error && error.code === '42P01') {
    return { data: null as TeacherBoost | null, error: null };
  }

  return { data: (data as TeacherBoost | null) ?? null, error };
};

export const calculateBoostedPoints = (basePoints: number, boost: TeacherBoost | null) => {
  if (!boost) {
    return basePoints;
  }
  if (boost.boost_type === 'double_xp') {
    return Math.max(0, Math.round(basePoints * boost.multiplier));
  }
  return Math.max(0, basePoints + boost.flat_bonus);
};

export const getTeacherBoosts = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('teacher_boosts')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  return { data: (data as TeacherBoost[] | null) ?? [], error };
};

export const createTeacherBoost = async ({
  teacherId,
  title,
  description,
  boostType,
  multiplier,
  flatBonus,
  startsAt,
  endsAt,
  isActive,
}: {
  teacherId: string;
  title: string;
  description?: string;
  boostType: 'double_xp' | 'bonus_flat';
  multiplier: number;
  flatBonus: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}) => {
  const { data, error } = await supabase
    .from('teacher_boosts')
    .insert({
      created_by: teacherId,
      title,
      description: description || null,
      boost_type: boostType,
      multiplier,
      flat_bonus: flatBonus,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: isActive,
    })
    .select()
    .single();
  return { data: (data as TeacherBoost | null) ?? null, error };
};

export const updateTeacherBoost = async ({
  id,
  teacherId,
  title,
  description,
  boostType,
  multiplier,
  flatBonus,
  startsAt,
  endsAt,
  isActive,
}: {
  id: string;
  teacherId: string;
  title: string;
  description?: string;
  boostType: 'double_xp' | 'bonus_flat';
  multiplier: number;
  flatBonus: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}) => {
  const { data, error } = await supabase
    .from('teacher_boosts')
    .update({
      title,
      description: description || null,
      boost_type: boostType,
      multiplier,
      flat_bonus: flatBonus,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: isActive,
    })
    .eq('id', id)
    .eq('created_by', teacherId)
    .select()
    .single();
  return { data: (data as TeacherBoost | null) ?? null, error };
};

export const deleteTeacherBoost = async (id: string, teacherId: string) => {
  const { error } = await supabase.from('teacher_boosts').delete().eq('id', id).eq('created_by', teacherId);
  return { error };
};
