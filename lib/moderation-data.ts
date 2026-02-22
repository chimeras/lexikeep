import { supabase } from '@/lib/supabase';
import {
  approveExpressionEntry,
  approveVocabularyEntry,
  rejectExpressionEntry,
  rejectVocabularyEntry,
} from '@/lib/student-data';
import type { Profile } from '@/types';

export interface ModerationStudent extends Pick<Profile, 'id' | 'username' | 'avatar_url' | 'points'> {
  requires_moderation: boolean;
}

export interface PendingModerationItem {
  id: string;
  entryType: 'vocabulary' | 'expression';
  term: string;
  definitionOrMeaning: string;
  exampleOrUsage: string | null;
  studentId: string;
  studentName: string;
  createdAt: string;
}

export const getModerationStudents = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,avatar_url,points,requires_moderation')
    .eq('role', 'student')
    .order('points', { ascending: false });
  return { data: ((data as ModerationStudent[] | null) ?? []), error };
};

export const setStudentWatchMode = async (studentId: string, requiresModeration: boolean) => {
  const { error } = await supabase
    .from('profiles')
    .update({ requires_moderation: requiresModeration })
    .eq('id', studentId);
  return { error };
};

export const getPendingModerationItems = async () => {
  const [vocabRes, expressionRes, studentsRes] = await Promise.all([
    supabase
      .from('vocabulary')
      .select('id,word,definition,example_sentence,student_id,created_at')
      .eq('moderation_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200),
    supabase
      .from('expressions')
      .select('id,expression,meaning,usage_example,student_id,created_at')
      .eq('moderation_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200),
    supabase.from('profiles').select('id,username').eq('role', 'student'),
  ]);

  if (vocabRes.error) {
    return { data: [] as PendingModerationItem[], error: vocabRes.error };
  }
  if (expressionRes.error) {
    return { data: [] as PendingModerationItem[], error: expressionRes.error };
  }
  if (studentsRes.error) {
    return { data: [] as PendingModerationItem[], error: studentsRes.error };
  }

  const studentMap = new Map<string, string>(
    (((studentsRes.data as Array<{ id: string; username: string | null }> | null) ?? []).map((row) => [
      row.id,
      row.username ?? 'Student',
    ])),
  );

  const vocabItems: PendingModerationItem[] = (((vocabRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id),
    entryType: 'vocabulary',
    term: String(row.word ?? ''),
    definitionOrMeaning: String(row.definition ?? ''),
    exampleOrUsage: (row.example_sentence as string | null) ?? null,
    studentId: String(row.student_id ?? ''),
    studentName: studentMap.get(String(row.student_id ?? '')) ?? 'Student',
    createdAt: String(row.created_at ?? ''),
  })));

  const expressionItems: PendingModerationItem[] = (((expressionRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id),
    entryType: 'expression',
    term: String(row.expression ?? ''),
    definitionOrMeaning: String(row.meaning ?? ''),
    exampleOrUsage: (row.usage_example as string | null) ?? null,
    studentId: String(row.student_id ?? ''),
    studentName: studentMap.get(String(row.student_id ?? '')) ?? 'Student',
    createdAt: String(row.created_at ?? ''),
  })));

  const data = [...vocabItems, ...expressionItems].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return { data, error: null };
};

export const approvePendingItem = async ({
  entryType,
  itemId,
  moderatorId,
}: {
  entryType: 'vocabulary' | 'expression';
  itemId: string;
  moderatorId: string;
}) =>
  entryType === 'vocabulary'
    ? approveVocabularyEntry({ vocabularyId: itemId, moderatorId })
    : approveExpressionEntry({ expressionId: itemId, moderatorId });

export const rejectPendingItem = async ({
  entryType,
  itemId,
  moderatorId,
  reason,
}: {
  entryType: 'vocabulary' | 'expression';
  itemId: string;
  moderatorId: string;
  reason?: string;
}) =>
  entryType === 'vocabulary'
    ? rejectVocabularyEntry({ vocabularyId: itemId, moderatorId, reason })
    : rejectExpressionEntry({ expressionId: itemId, moderatorId, reason });
