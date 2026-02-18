import { supabase } from '@/lib/supabase';
import type { Material } from '@/types';

export const getMaterials = async () => {
  const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
  return { data: (data as Material[] | null) ?? [], error };
};

export const getTeacherMaterials = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  return { data: (data as Material[] | null) ?? [], error };
};

interface MaterialInput {
  teacherId: string;
  title: string;
  description?: string;
  contentUrl?: string;
  tags?: string[];
}

export const createMaterial = async ({ teacherId, title, description, contentUrl, tags = [] }: MaterialInput) => {
  const { data, error } = await supabase
    .from('materials')
    .insert({
      teacher_id: teacherId,
      title,
      description: description || null,
      content_url: contentUrl || null,
      tags,
    })
    .select()
    .single();
  return { data: (data as Material | null) ?? null, error };
};

interface MaterialUpdateInput {
  id: string;
  teacherId: string;
  title: string;
  description?: string;
  contentUrl?: string;
  tags?: string[];
}

export const updateMaterial = async ({
  id,
  teacherId,
  title,
  description,
  contentUrl,
  tags = [],
}: MaterialUpdateInput) => {
  const { data, error } = await supabase
    .from('materials')
    .update({
      teacher_id: teacherId,
      title,
      description: description || null,
      content_url: contentUrl || null,
      tags,
    })
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .select()
    .single();
  return { data: (data as Material | null) ?? null, error };
};

export const deleteMaterial = async (id: string, teacherId: string) => {
  const { error } = await supabase.from('materials').delete().eq('id', id).eq('teacher_id', teacherId);
  return { error };
};
