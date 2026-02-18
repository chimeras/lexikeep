import { supabase } from '@/lib/supabase';
import type { Material, Team, TeamMembership } from '@/types';

export interface MaterialInsight {
  materialId: string;
  title: string;
  vocabularyCount: number;
  expressionCount: number;
  totalCollected: number;
}

export interface TeamInsight {
  teamId: string;
  name: string;
  memberCount: number;
  totalPoints: number;
  averagePoints: number;
}

interface AdminInsights {
  materialInsights: MaterialInsight[];
  teamInsights: TeamInsight[];
}

const isMissingRelation = (message?: string, code?: string) =>
  code === '42P01' || (message ?? '').toLowerCase().includes('does not exist');

export const getAdminInsights = async (teacherId: string): Promise<AdminInsights> => {
  const [materialsRes, teamsRes] = await Promise.all([
    supabase.from('materials').select('id,title').eq('teacher_id', teacherId),
    supabase.from('teams').select('id,name').eq('created_by', teacherId),
  ]);

  const materials = ((materialsRes.data as Array<Pick<Material, 'id' | 'title'>> | null) ?? []);
  const teams = ((teamsRes.data as Array<Pick<Team, 'id' | 'name'>> | null) ?? []);

  const materialIds = materials.map((material) => material.id);
  const teamIds = teams.map((team) => team.id);

  const [vocabularyRes, expressionsRes, membershipsRes] = await Promise.all([
    materialIds.length > 0
      ? supabase.from('vocabulary').select('material_id').in('material_id', materialIds)
      : Promise.resolve({ data: [], error: null }),
    materialIds.length > 0
      ? supabase.from('expressions').select('material_id').in('material_id', materialIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length > 0
      ? supabase.from('team_memberships').select('team_id,student_id').in('team_id', teamIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const memberships = ((membershipsRes.data as Array<Pick<TeamMembership, 'team_id' | 'student_id'>> | null) ?? []);
  const studentIds = [...new Set(memberships.map((membership) => membership.student_id))];
  const pointsRes = studentIds.length > 0
    ? await supabase.from('profiles').select('id,points').in('id', studentIds)
    : { data: [], error: null };

  const emptyInsights: AdminInsights = { materialInsights: [], teamInsights: [] };

  if (
    [materialsRes.error, teamsRes.error, vocabularyRes.error, expressionsRes.error, membershipsRes.error, pointsRes.error]
      .filter(Boolean)
      .some((error) => isMissingRelation(error?.message, error?.code))
  ) {
    return emptyInsights;
  }

  const vocabByMaterial = new Map<string, number>();
  (((vocabularyRes.data as Array<{ material_id: string | null }> | null) ?? [])).forEach((row) => {
    if (!row.material_id) return;
    vocabByMaterial.set(row.material_id, (vocabByMaterial.get(row.material_id) ?? 0) + 1);
  });

  const expressionsByMaterial = new Map<string, number>();
  (((expressionsRes.data as Array<{ material_id: string | null }> | null) ?? [])).forEach((row) => {
    if (!row.material_id) return;
    expressionsByMaterial.set(row.material_id, (expressionsByMaterial.get(row.material_id) ?? 0) + 1);
  });

  const materialInsights = materials
    .map((material) => {
      const vocabularyCount = vocabByMaterial.get(material.id) ?? 0;
      const expressionCount = expressionsByMaterial.get(material.id) ?? 0;
      return {
        materialId: material.id,
        title: material.title,
        vocabularyCount,
        expressionCount,
        totalCollected: vocabularyCount + expressionCount,
      };
    })
    .sort((left, right) => right.totalCollected - left.totalCollected)
    .slice(0, 5);

  const pointsByStudent = new Map<string, number>(
    (((pointsRes.data as Array<{ id: string; points: number | null }> | null) ?? []).map((row) => [row.id, row.points ?? 0])),
  );

  const teamInsights = teams
    .map((team) => {
      const memberIds = memberships.filter((membership) => membership.team_id === team.id).map((membership) => membership.student_id);
      const totalPoints = memberIds.reduce((sum, studentId) => sum + (pointsByStudent.get(studentId) ?? 0), 0);
      const memberCount = memberIds.length;
      return {
        teamId: team.id,
        name: team.name,
        memberCount,
        totalPoints,
        averagePoints: memberCount > 0 ? Math.round(totalPoints / memberCount) : 0,
      };
    })
    .sort((left, right) => right.totalPoints - left.totalPoints)
    .slice(0, 5);

  return { materialInsights, teamInsights };
};
