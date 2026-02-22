import { supabase } from '@/lib/supabase';
import type { LibraryResource } from '@/types';

export const getLibraryResources = async () => {
  const { data, error } = await supabase
    .from('library_resources')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: ((data as LibraryResource[] | null) ?? []), error };
};

export const getTeacherLibraryResources = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('library_resources')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  return { data: ((data as LibraryResource[] | null) ?? []), error };
};

interface LibraryResourceInput {
  createdBy: string;
  title: string;
  description?: string;
  resourceType: 'book' | 'article' | 'website';
  url: string;
  downloadable: boolean;
  tags?: string[];
}

export const createLibraryResource = async ({
  createdBy,
  title,
  description,
  resourceType,
  url,
  downloadable,
  tags = [],
}: LibraryResourceInput) => {
  const { data, error } = await supabase
    .from('library_resources')
    .insert({
      created_by: createdBy,
      title,
      description: description || null,
      resource_type: resourceType,
      url,
      downloadable,
      tags,
    })
    .select()
    .single();

  return { data: (data as LibraryResource | null) ?? null, error };
};

export const deleteLibraryResource = async (id: string, teacherId: string) => {
  const { error } = await supabase
    .from('library_resources')
    .delete()
    .eq('id', id)
    .eq('created_by', teacherId);
  return { error };
};
