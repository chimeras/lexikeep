import { supabase } from '@/lib/supabase';
import type { ClassMembership, Classroom, Profile } from '@/types';

export const getTeacherClasses = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  return { data: ((data as Classroom[] | null) ?? []), error };
};

export const createClass = async ({
  teacherId,
  name,
  description,
  isActive,
}: {
  teacherId: string;
  name: string;
  description?: string;
  isActive: boolean;
}) => {
  const { data, error } = await supabase
    .from('classes')
    .insert({
      teacher_id: teacherId,
      name,
      description: description || null,
      is_active: isActive,
    })
    .select()
    .single();
  return { data: (data as Classroom | null) ?? null, error };
};

export const updateClass = async ({
  id,
  teacherId,
  name,
  description,
  isActive,
}: {
  id: string;
  teacherId: string;
  name: string;
  description?: string;
  isActive: boolean;
}) => {
  const { data, error } = await supabase
    .from('classes')
    .update({
      name,
      description: description || null,
      is_active: isActive,
    })
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .select()
    .single();
  return { data: (data as Classroom | null) ?? null, error };
};

export const deleteClass = async (id: string, teacherId: string) => {
  const { error } = await supabase.from('classes').delete().eq('id', id).eq('teacher_id', teacherId);
  return { error };
};

export const getClassMemberships = async (classId: string) => {
  const { data, error } = await supabase
    .from('class_memberships')
    .select('*')
    .eq('class_id', classId)
    .order('joined_at', { ascending: true });
  return { data: ((data as ClassMembership[] | null) ?? []), error };
};

export const assignStudentToClass = async ({
  classId,
  studentId,
}: {
  classId: string;
  studentId: string;
}) => {
  const { error } = await supabase
    .from('class_memberships')
    .insert({
      class_id: classId,
      student_id: studentId,
    });
  return { error };
};

export const removeStudentFromClass = async (classId: string, studentId: string) => {
  const { error } = await supabase
    .from('class_memberships')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', studentId);
  return { error };
};

export const getStudentsForClasses = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,avatar_url,points,role')
    .eq('role', 'student')
    .order('points', { ascending: false });
  return {
    data: ((data as Array<Pick<Profile, 'id' | 'username' | 'avatar_url' | 'points' | 'role'>> | null) ?? []),
    error,
  };
};
