import { supabase } from '@/lib/supabase';
import type { Profile, Team, TeamMembership } from '@/types';

export interface TeamLeaderboardEntry {
  id: string;
  name: string;
  colorHex: string;
  points: number;
  members: number;
  avgPoints: number;
}

const fallbackTeams: TeamLeaderboardEntry[] = [
  { id: 'team-1', name: 'Blue Rockets', colorHex: '#2563eb', points: 1260, members: 6, avgPoints: 210 },
  { id: 'team-2', name: 'Orange Sparks', colorHex: '#ea580c', points: 1010, members: 5, avgPoints: 202 },
  { id: 'team-3', name: 'Green Titans', colorHex: '#059669', points: 940, members: 5, avgPoints: 188 },
];

const missingTable = (code?: string, message?: string) =>
  code === '42P01' || (message ?? '').toLowerCase().includes('does not exist');

export interface TeamLeaderboardResult {
  entries: TeamLeaderboardEntry[];
  currentTeamPosition: number | null;
  currentTeamName: string | null;
  fallbackMode: boolean;
}

export const getTeamLeaderboard = async (currentStudentId?: string): Promise<TeamLeaderboardResult> => {
  const { data: teamsRaw, error: teamError } = await supabase
    .from('teams')
    .select('id,name,color_hex')
    .eq('is_active', true);

  if (teamError && missingTable(teamError.code, teamError.message)) {
    return {
      entries: fallbackTeams,
      currentTeamPosition: null,
      currentTeamName: null,
      fallbackMode: true,
    };
  }

  if (teamError || !teamsRaw) {
    return {
      entries: [],
      currentTeamPosition: null,
      currentTeamName: null,
      fallbackMode: false,
    };
  }

  const teams = (teamsRaw as Array<Pick<Team, 'id' | 'name' | 'color_hex'>>) ?? [];
  if (teams.length === 0) {
    return {
      entries: [],
      currentTeamPosition: null,
      currentTeamName: null,
      fallbackMode: false,
    };
  }

  const { data: membershipsRaw, error: membershipsError } = await supabase
    .from('team_memberships')
    .select('team_id,student_id');

  if (membershipsError && missingTable(membershipsError.code, membershipsError.message)) {
    return {
      entries: fallbackTeams,
      currentTeamPosition: null,
      currentTeamName: null,
      fallbackMode: true,
    };
  }

  if (membershipsError || !membershipsRaw) {
    return {
      entries: [],
      currentTeamPosition: null,
      currentTeamName: null,
      fallbackMode: false,
    };
  }

  const memberships = (membershipsRaw as Array<Pick<TeamMembership, 'team_id' | 'student_id'>>) ?? [];
  const uniqueStudentIds = [...new Set(memberships.map((membership) => membership.student_id))];

  const { data: profilesRaw } = uniqueStudentIds.length
    ? await supabase.from('profiles').select('id,points').in('id', uniqueStudentIds)
    : { data: [] };
  const pointsByStudent = new Map<string, number>(
    (((profilesRaw as Array<{ id: string; points: number | null }> | null) ?? []).map((profile) => [
      profile.id,
      profile.points ?? 0,
    ])),
  );

  const entries = teams
    .map((team) => {
      const memberIds = memberships.filter((membership) => membership.team_id === team.id).map((membership) => membership.student_id);
      const points = memberIds.reduce((sum, studentId) => sum + (pointsByStudent.get(studentId) ?? 0), 0);
      const members = memberIds.length;
      return {
        id: team.id,
        name: team.name,
        colorHex: team.color_hex ?? '#2563eb',
        points,
        members,
        avgPoints: members > 0 ? Math.round(points / members) : 0,
      } satisfies TeamLeaderboardEntry;
    })
    .sort((left, right) => right.points - left.points);

  let currentTeamPosition: number | null = null;
  let currentTeamName: string | null = null;

  if (currentStudentId) {
    const currentMembership = memberships.find((membership) => membership.student_id === currentStudentId);
    if (currentMembership) {
      const currentIndex = entries.findIndex((entry) => entry.id === currentMembership.team_id);
      if (currentIndex >= 0) {
        currentTeamPosition = currentIndex + 1;
        currentTeamName = entries[currentIndex].name;
      }
    }
  }

  return {
    entries,
    currentTeamPosition,
    currentTeamName,
    fallbackMode: false,
  };
};

export const getTeacherTeams = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  return { data: ((data as Team[] | null) ?? []), error };
};

export const createTeam = async ({
  teacherId,
  name,
  description,
  colorHex,
  isActive,
}: {
  teacherId: string;
  name: string;
  description?: string;
  colorHex?: string;
  isActive: boolean;
}) => {
  const { data, error } = await supabase
    .from('teams')
    .insert({
      created_by: teacherId,
      name,
      description: description || null,
      color_hex: colorHex || '#2563eb',
      is_active: isActive,
    })
    .select()
    .single();
  return { data: (data as Team | null) ?? null, error };
};

export const updateTeam = async ({
  id,
  teacherId,
  name,
  description,
  colorHex,
  isActive,
}: {
  id: string;
  teacherId: string;
  name: string;
  description?: string;
  colorHex?: string;
  isActive: boolean;
}) => {
  const { data, error } = await supabase
    .from('teams')
    .update({
      name,
      description: description || null,
      color_hex: colorHex || '#2563eb',
      is_active: isActive,
    })
    .eq('id', id)
    .eq('created_by', teacherId)
    .select()
    .single();
  return { data: (data as Team | null) ?? null, error };
};

export const deleteTeam = async (id: string, teacherId: string) => {
  const { error } = await supabase.from('teams').delete().eq('id', id).eq('created_by', teacherId);
  return { error };
};

export const getStudentsForTeams = async () => {
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

export const getTeamMemberships = async (teamId: string) => {
  const { data, error } = await supabase
    .from('team_memberships')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });
  return { data: ((data as TeamMembership[] | null) ?? []), error };
};

export const assignStudentToTeam = async ({
  teamId,
  studentId,
  role,
}: {
  teamId: string;
  studentId: string;
  role: 'member' | 'captain';
}) => {
  const { error } = await supabase
    .from('team_memberships')
    .insert({
      team_id: teamId,
      student_id: studentId,
      role,
    });
  return { error };
};

export const removeStudentFromTeam = async (teamId: string, studentId: string) => {
  const { error } = await supabase
    .from('team_memberships')
    .delete()
    .eq('team_id', teamId)
    .eq('student_id', studentId);
  return { error };
};
