'use client';

import { BookCopy, ClipboardList, Flag, Users, Zap } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import StatsCard from '@/components/dashboard/StatsCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { getAdminInsights, type MaterialInsight, type TeamInsight } from '@/lib/admin-analytics';
import {
  createDailyChallenge,
  createQuest,
  deleteDailyChallenge,
  deleteQuest,
  getTeacherDailyChallenges,
  getTeacherQuests,
  updateDailyChallenge,
  updateQuest,
} from '@/lib/challenges-data';
import { createMaterial, deleteMaterial, getTeacherMaterials, updateMaterial } from '@/lib/materials-data';
import { getReviewAnalytics, type ReviewAnalytics } from '@/lib/review-analytics';
import { supabase } from '@/lib/supabase';
import type {
  DailyChallenge,
  Expression,
  Material,
  Profile,
  Quest,
  Team,
  TeamMembership,
  TeacherBoost,
  Vocabulary,
} from '@/types';
import {
  assignStudentToTeam,
  createTeam,
  deleteTeam,
  getTeacherTeams,
  getTeamMemberships,
  getStudentsForTeams,
  removeStudentFromTeam,
  updateTeam,
} from '@/lib/team-data';
import {
  createTeacherBoost,
  deleteTeacherBoost,
  getTeacherBoosts,
  updateTeacherBoost,
} from '@/lib/boosts-data';

const parseTags = (tagText: string) =>
  tagText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const todayIso = () => new Date().toISOString().slice(0, 10);
const escapeCsvCell = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const sectionItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'materials-form', label: 'Manage Materials' },
  { id: 'daily-form', label: 'Daily Challenges' },
  { id: 'quest-form', label: 'Weekly Quests' },
  { id: 'teams-form', label: 'Manage Teams' },
  { id: 'teams-members', label: 'Team Members' },
  { id: 'students-dictionary', label: 'Student Dictionaries' },
  { id: 'boosts-form', label: 'Teacher Boosts' },
  { id: 'materials-list', label: 'Your Materials' },
  { id: 'daily-list', label: 'Your Daily Challenges' },
  { id: 'quest-list', label: 'Your Quests' },
  { id: 'teams-list', label: 'Your Teams' },
  { id: 'boosts-list', label: 'Your Boosts' },
] as const;

type SectionId = (typeof sectionItems)[number]['id'];

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const [materials, setMaterials] = useState<Material[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [boosts, setBoosts] = useState<TeacherBoost[]>([]);
  const [students, setStudents] = useState<Array<Pick<Profile, 'id' | 'username' | 'points' | 'role'>>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentStreak, setSelectedStudentStreak] = useState(0);
  const [selectedStudentWordCount, setSelectedStudentWordCount] = useState(0);
  const [selectedStudentExpressionCount, setSelectedStudentExpressionCount] = useState(0);
  const [selectedStudentVocabulary, setSelectedStudentVocabulary] = useState<Vocabulary[]>([]);
  const [selectedStudentExpressions, setSelectedStudentExpressions] = useState<Expression[]>([]);
  const [studentDictionarySearchQuery, setStudentDictionarySearchQuery] = useState('');
  const [studentDictionaryCategoryFilter, setStudentDictionaryCategoryFilter] = useState('all');
  const [studentDictionaryDateFilter, setStudentDictionaryDateFilter] = useState('');
  const [studentDictionaryRecentOnly, setStudentDictionaryRecentOnly] = useState(false);
  const [loadingStudentDictionary, setLoadingStudentDictionary] = useState(false);
  const [studentDictionaryError, setStudentDictionaryError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMembership[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(true);

  const [savingMaterial, setSavingMaterial] = useState(false);
  const [savingDailyChallenge, setSavingDailyChallenge] = useState(false);
  const [savingQuest, setSavingQuest] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingBoost, setSavingBoost] = useState(false);
  const [assigningMember, setAssigningMember] = useState(false);

  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [deletingChallengeId, setDeletingChallengeId] = useState<string | null>(null);
  const [deletingQuestId, setDeletingQuestId] = useState<string | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [deletingBoostId, setDeletingBoostId] = useState<string | null>(null);
  const [removingMemberStudentId, setRemovingMemberStudentId] = useState<string | null>(null);

  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingDailyChallengeId, setEditingDailyChallengeId] = useState<string | null>(null);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingBoostId, setEditingBoostId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [competitionCount, setCompetitionCount] = useState(0);
  const [reviewAnalytics, setReviewAnalytics] = useState<ReviewAnalytics>({
    dueNow: 0,
    completedToday: 0,
    masteredCount: 0,
    totalReviewItems: 0,
    activeStudentsToday: 0,
  });
  const [materialInsights, setMaterialInsights] = useState<MaterialInsight[]>([]);
  const [teamInsights, setTeamInsights] = useState<TeamInsight[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentUrl, setContentUrl] = useState('');
  const [tagText, setTagText] = useState('');

  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDescription, setChallengeDescription] = useState('');
  const [challengeDate, setChallengeDate] = useState(todayIso());
  const [challengeType, setChallengeType] = useState<'words' | 'expressions' | 'points' | 'streak'>('words');
  const [challengeTargetValue, setChallengeTargetValue] = useState(1);
  const [challengeRewardPoints, setChallengeRewardPoints] = useState(20);
  const [challengeIsActive, setChallengeIsActive] = useState(true);

  const [questTitle, setQuestTitle] = useState('');
  const [questDescription, setQuestDescription] = useState('');
  const [questType, setQuestType] = useState<'words' | 'expressions' | 'points' | 'streak'>('words');
  const [questTargetValue, setQuestTargetValue] = useState(5);
  const [questRewardPoints, setQuestRewardPoints] = useState(40);
  const [questStartDate, setQuestStartDate] = useState(todayIso());
  const [questEndDate, setQuestEndDate] = useState('');
  const [questIsActive, setQuestIsActive] = useState(true);

  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamColorHex, setTeamColorHex] = useState('#2563eb');
  const [teamIsActive, setTeamIsActive] = useState(true);
  const [memberStudentId, setMemberStudentId] = useState('');
  const [memberRole, setMemberRole] = useState<'member' | 'captain'>('member');
  const [boostTitle, setBoostTitle] = useState('');
  const [boostDescription, setBoostDescription] = useState('');
  const [boostType, setBoostType] = useState<'double_xp' | 'bonus_flat'>('double_xp');
  const [boostMultiplier, setBoostMultiplier] = useState(2);
  const [boostFlatBonus, setBoostFlatBonus] = useState(0);
  const [boostStartsAt, setBoostStartsAt] = useState(`${todayIso()}T08:00`);
  const [boostEndsAt, setBoostEndsAt] = useState(`${todayIso()}T20:00`);
  const [boostIsActive, setBoostIsActive] = useState(true);

  const resetMaterialForm = () => {
    setTitle('');
    setDescription('');
    setContentUrl('');
    setTagText('');
    setEditingMaterialId(null);
  };

  const resetDailyChallengeForm = () => {
    setChallengeTitle('');
    setChallengeDescription('');
    setChallengeDate(todayIso());
    setChallengeType('words');
    setChallengeTargetValue(1);
    setChallengeRewardPoints(20);
    setChallengeIsActive(true);
    setEditingDailyChallengeId(null);
  };

  const resetQuestForm = () => {
    setQuestTitle('');
    setQuestDescription('');
    setQuestType('words');
    setQuestTargetValue(5);
    setQuestRewardPoints(40);
    setQuestStartDate(todayIso());
    setQuestEndDate('');
    setQuestIsActive(true);
    setEditingQuestId(null);
  };

  const resetTeamForm = () => {
    setTeamName('');
    setTeamDescription('');
    setTeamColorHex('#2563eb');
    setTeamIsActive(true);
    setEditingTeamId(null);
  };

  const resetBoostForm = () => {
    setBoostTitle('');
    setBoostDescription('');
    setBoostType('double_xp');
    setBoostMultiplier(2);
    setBoostFlatBonus(0);
    setBoostStartsAt(`${todayIso()}T08:00`);
    setBoostEndsAt(`${todayIso()}T20:00`);
    setBoostIsActive(true);
    setEditingBoostId(null);
  };

  const loadTeamMembers = async (teamId: string) => {
    const { data } = await getTeamMemberships(teamId);
    setTeamMembers(data);
  };

  const studentDictionaryCategoryOptions = useMemo(() => {
    const options = new Set<string>();
    selectedStudentVocabulary.forEach((item) => {
      if (item.category?.trim()) {
        options.add(item.category.trim());
      }
    });
    selectedStudentExpressions.forEach((item) => {
      if (item.context?.trim()) {
        options.add(item.context.trim());
      }
    });
    return [...options].sort((left, right) => left.localeCompare(right));
  }, [selectedStudentVocabulary, selectedStudentExpressions]);

  const filteredStudentVocabulary = useMemo(() => {
    const query = studentDictionarySearchQuery.trim().toLowerCase();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return selectedStudentVocabulary.filter((item) => {
      const itemDate = new Date(item.created_at);
      if (studentDictionaryDateFilter && item.created_at.slice(0, 10) !== studentDictionaryDateFilter) {
        return false;
      }
      if (studentDictionaryRecentOnly && itemDate.getTime() < sevenDaysAgo) {
        return false;
      }
      if (studentDictionaryCategoryFilter !== 'all' && (item.category ?? '') !== studentDictionaryCategoryFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        item.word.toLowerCase().includes(query) ||
        item.definition.toLowerCase().includes(query) ||
        (item.example_sentence ?? '').toLowerCase().includes(query)
      );
    });
  }, [
    selectedStudentVocabulary,
    studentDictionarySearchQuery,
    studentDictionaryCategoryFilter,
    studentDictionaryDateFilter,
    studentDictionaryRecentOnly,
  ]);

  const filteredStudentExpressions = useMemo(() => {
    const query = studentDictionarySearchQuery.trim().toLowerCase();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return selectedStudentExpressions.filter((item) => {
      const itemDate = new Date(item.created_at);
      if (studentDictionaryDateFilter && item.created_at.slice(0, 10) !== studentDictionaryDateFilter) {
        return false;
      }
      if (studentDictionaryRecentOnly && itemDate.getTime() < sevenDaysAgo) {
        return false;
      }
      if (studentDictionaryCategoryFilter !== 'all' && (item.context ?? '') !== studentDictionaryCategoryFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        item.expression.toLowerCase().includes(query) ||
        item.meaning.toLowerCase().includes(query) ||
        (item.usage_example ?? '').toLowerCase().includes(query)
      );
    });
  }, [
    selectedStudentExpressions,
    studentDictionarySearchQuery,
    studentDictionaryCategoryFilter,
    studentDictionaryDateFilter,
    studentDictionaryRecentOnly,
  ]);

  const loadStudentDictionary = async (studentId: string) => {
    if (!studentId) {
      setSelectedStudentVocabulary([]);
      setSelectedStudentExpressions([]);
      setSelectedStudentWordCount(0);
      setSelectedStudentExpressionCount(0);
      setSelectedStudentStreak(0);
      setStudentDictionaryError(null);
      return;
    }

    setLoadingStudentDictionary(true);
    setStudentDictionaryError(null);

    const [profileRes, vocabRes, expressionRes, vocabCountRes, expressionCountRes] = await Promise.all([
      supabase.from('profiles').select('streak').eq('id', studentId).maybeSingle(),
      supabase
        .from('vocabulary')
        .select('id,word,definition,example_sentence,image_url,category,status,created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('expressions')
        .select('id,expression,meaning,usage_example,context,created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('vocabulary').select('*', { count: 'exact', head: true }).eq('student_id', studentId),
      supabase.from('expressions').select('*', { count: 'exact', head: true }).eq('student_id', studentId),
    ]);

    const errors = [
      profileRes.error,
      vocabRes.error,
      expressionRes.error,
      vocabCountRes.error,
      expressionCountRes.error,
    ].filter(Boolean);
    if (errors.length > 0) {
      setStudentDictionaryError(errors[0]?.message ?? 'Failed to load student dictionary.');
      setSelectedStudentVocabulary([]);
      setSelectedStudentExpressions([]);
      setSelectedStudentWordCount(0);
      setSelectedStudentExpressionCount(0);
      setSelectedStudentStreak(0);
      setLoadingStudentDictionary(false);
      return;
    }

    const profileRow = profileRes.data as Pick<Profile, 'streak'> | null;
    setSelectedStudentStreak(profileRow?.streak ?? 0);
    setSelectedStudentVocabulary((vocabRes.data as Vocabulary[] | null) ?? []);
    setSelectedStudentExpressions((expressionRes.data as Expression[] | null) ?? []);
    setSelectedStudentWordCount(vocabCountRes.count ?? 0);
    setSelectedStudentExpressionCount(expressionCountRes.count ?? 0);
    setLoadingStudentDictionary(false);
  };

  const loadDashboardData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    const [materialsRes, studentsRes, competitionsRes, dailyChallengesRes, questsRes, teamsRes, rosterRes, boostsRes, reviewAnalyticsRes, insightsRes] = await Promise.all([
      getTeacherMaterials(profile.id),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('competitions').select('*', { count: 'exact', head: true }).eq('teacher_id', profile.id),
      getTeacherDailyChallenges(profile.id),
      getTeacherQuests(profile.id),
      getTeacherTeams(profile.id),
      getStudentsForTeams(),
      getTeacherBoosts(profile.id),
      getReviewAnalytics(),
      getAdminInsights(profile.id),
    ]);

    setMaterials(materialsRes.data);
    setDailyChallenges(dailyChallengesRes.data);
    setQuests(questsRes.data);
    setTeams(teamsRes.data);
    setStudents(rosterRes.data);
    setBoosts(boostsRes.data);
    setReviewAnalytics(reviewAnalyticsRes);
    setMaterialInsights(insightsRes.materialInsights);
    setTeamInsights(insightsRes.teamInsights);
    setStudentCount(studentsRes.count ?? 0);
    setCompetitionCount(competitionsRes.count ?? 0);
    if (rosterRes.data.length === 0) {
      setSelectedStudentId('');
      setSelectedStudentVocabulary([]);
      setSelectedStudentExpressions([]);
      setSelectedStudentWordCount(0);
      setSelectedStudentExpressionCount(0);
      setSelectedStudentStreak(0);
      setStudentDictionaryError(null);
    } else if (!selectedStudentId || !rosterRes.data.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(rosterRes.data[0].id);
    }
    if (selectedTeamId) {
      await loadTeamMembers(selectedTeamId);
    } else if (teamsRes.data.length > 0) {
      setSelectedTeamId(teamsRes.data[0].id);
      await loadTeamMembers(teamsRes.data[0].id);
    } else {
      setTeamMembers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!profile?.id) return;
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (!selectedTeamId) return;
    void loadTeamMembers(selectedTeamId);
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedStudentId) return;
    void loadStudentDictionary(selectedStudentId);
  }, [selectedStudentId]);

  useEffect(() => {
    setStudentDictionarySearchQuery('');
    setStudentDictionaryCategoryFilter('all');
    setStudentDictionaryDateFilter('');
    setStudentDictionaryRecentOnly(false);
  }, [selectedStudentId]);

  const handleMaterialSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) {
      setErrorMessage('Teacher profile is required.');
      return;
    }

    setSavingMaterial(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      teacherId: profile.id,
      title,
      description,
      contentUrl,
      tags: parseTags(tagText),
    };

    const result = editingMaterialId ? await updateMaterial({ id: editingMaterialId, ...payload }) : await createMaterial(payload);

    if (result.error) {
      setErrorMessage(result.error.message);
      setSavingMaterial(false);
      return;
    }

    setMessage(editingMaterialId ? 'Material updated.' : 'Material created.');
    resetMaterialForm();
    await loadDashboardData();
    setSavingMaterial(false);
  };

  const handleDailyChallengeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) {
      setErrorMessage('Teacher profile is required.');
      return;
    }

    setSavingDailyChallenge(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      teacherId: profile.id,
      title: challengeTitle,
      description: challengeDescription,
      challengeDate,
      challengeType,
      targetValue: challengeTargetValue,
      rewardPoints: challengeRewardPoints,
      isActive: challengeIsActive,
    };

    const result = editingDailyChallengeId
      ? await updateDailyChallenge({ id: editingDailyChallengeId, ...payload })
      : await createDailyChallenge(payload);

    if (result.error) {
      setErrorMessage(result.error.message);
      setSavingDailyChallenge(false);
      return;
    }

    setMessage(editingDailyChallengeId ? 'Daily challenge updated.' : 'Daily challenge created.');
    resetDailyChallengeForm();
    await loadDashboardData();
    setSavingDailyChallenge(false);
  };

  const handleQuestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) {
      setErrorMessage('Teacher profile is required.');
      return;
    }

    setSavingQuest(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      teacherId: profile.id,
      title: questTitle,
      description: questDescription,
      targetType: questType,
      targetValue: questTargetValue,
      rewardPoints: questRewardPoints,
      startDate: questStartDate,
      endDate: questEndDate || undefined,
      isActive: questIsActive,
    };

    const result = editingQuestId ? await updateQuest({ id: editingQuestId, ...payload }) : await createQuest(payload);

    if (result.error) {
      setErrorMessage(result.error.message);
      setSavingQuest(false);
      return;
    }

    setMessage(editingQuestId ? 'Quest updated.' : 'Quest created.');
    resetQuestForm();
    await loadDashboardData();
    setSavingQuest(false);
  };

  const handleTeamSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) {
      setErrorMessage('Teacher profile is required.');
      return;
    }

    setSavingTeam(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      teacherId: profile.id,
      name: teamName,
      description: teamDescription,
      colorHex: teamColorHex,
      isActive: teamIsActive,
    };

    const result = editingTeamId ? await updateTeam({ id: editingTeamId, ...payload }) : await createTeam(payload);

    if (result.error) {
      setErrorMessage(result.error.message);
      setSavingTeam(false);
      return;
    }

    setMessage(editingTeamId ? 'Team updated.' : 'Team created.');
    resetTeamForm();
    await loadDashboardData();
    setSavingTeam(false);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!profile?.id) return;
    setDeletingMaterialId(id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteMaterial(id, profile.id);
    if (error) {
      setErrorMessage(error.message);
      setDeletingMaterialId(null);
      return;
    }
    setMessage('Material deleted.');
    await loadDashboardData();
    setDeletingMaterialId(null);
  };

  const handleDeleteDailyChallenge = async (id: string) => {
    if (!profile?.id) return;
    setDeletingChallengeId(id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteDailyChallenge(id, profile.id);
    if (error) {
      setErrorMessage(error.message);
      setDeletingChallengeId(null);
      return;
    }
    setMessage('Daily challenge deleted.');
    await loadDashboardData();
    setDeletingChallengeId(null);
  };

  const handleDeleteQuest = async (id: string) => {
    if (!profile?.id) return;
    setDeletingQuestId(id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteQuest(id, profile.id);
    if (error) {
      setErrorMessage(error.message);
      setDeletingQuestId(null);
      return;
    }
    setMessage('Quest deleted.');
    await loadDashboardData();
    setDeletingQuestId(null);
  };

  const handleDeleteTeam = async (id: string) => {
    if (!profile?.id) return;
    setDeletingTeamId(id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteTeam(id, profile.id);
    if (error) {
      setErrorMessage(error.message);
      setDeletingTeamId(null);
      return;
    }
    setMessage('Team deleted.');
    if (selectedTeamId === id) {
      setSelectedTeamId('');
    }
    await loadDashboardData();
    setDeletingTeamId(null);
  };

  const handleBoostSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) {
      setErrorMessage('Teacher profile is required.');
      return;
    }

    setSavingBoost(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      teacherId: profile.id,
      title: boostTitle,
      description: boostDescription,
      boostType,
      multiplier: boostMultiplier,
      flatBonus: boostFlatBonus,
      startsAt: new Date(boostStartsAt).toISOString(),
      endsAt: new Date(boostEndsAt).toISOString(),
      isActive: boostIsActive,
    };

    const result = editingBoostId ? await updateTeacherBoost({ id: editingBoostId, ...payload }) : await createTeacherBoost(payload);
    if (result.error) {
      setErrorMessage(result.error.message);
      setSavingBoost(false);
      return;
    }

    setMessage(editingBoostId ? 'Boost updated.' : 'Boost created.');
    resetBoostForm();
    await loadDashboardData();
    setSavingBoost(false);
  };

  const handleDeleteBoost = async (id: string) => {
    if (!profile?.id) return;
    setDeletingBoostId(id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteTeacherBoost(id, profile.id);
    if (error) {
      setErrorMessage(error.message);
      setDeletingBoostId(null);
      return;
    }
    setMessage('Boost deleted.');
    await loadDashboardData();
    setDeletingBoostId(null);
  };

  const handleAssignMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTeamId || !memberStudentId) return;
    setAssigningMember(true);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await assignStudentToTeam({ teamId: selectedTeamId, studentId: memberStudentId, role: memberRole });
    if (error) {
      setErrorMessage(error.message);
      setAssigningMember(false);
      return;
    }
    setMessage('Student assigned to team.');
    setMemberStudentId('');
    setMemberRole('member');
    await loadTeamMembers(selectedTeamId);
    setAssigningMember(false);
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!selectedTeamId) return;
    setRemovingMemberStudentId(studentId);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await removeStudentFromTeam(selectedTeamId, studentId);
    if (error) {
      setErrorMessage(error.message);
      setRemovingMemberStudentId(null);
      return;
    }
    setMessage('Member removed from team.');
    await loadTeamMembers(selectedTeamId);
    setRemovingMemberStudentId(null);
  };

  const navItemClass = (sectionId: SectionId) =>
    `block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
      activeSection === sectionId ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
    }`;

  const mobileNavClass = (sectionId: SectionId) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      activeSection === sectionId ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
    }`;

  const exportSelectedStudentDictionaryCsv = () => {
    if (!selectedStudentId) {
      return;
    }
    const selectedStudent = students.find((student) => student.id === selectedStudentId);
    const studentLabel = selectedStudent?.username ?? selectedStudentId.slice(0, 8);
    const rows: string[] = [];
    rows.push([
      'entry_type',
      'term',
      'definition_or_meaning',
      'example',
      'image_url',
      'category_or_context',
      'created_at',
    ].map(escapeCsvCell).join(','));

    filteredStudentVocabulary.forEach((item) => {
      rows.push([
        'vocabulary',
        item.word,
        item.definition,
        item.example_sentence ?? '',
        item.image_url ?? '',
        item.category ?? '',
        item.created_at,
      ].map(escapeCsvCell).join(','));
    });

    filteredStudentExpressions.forEach((item) => {
      rows.push([
        'expression',
        item.expression,
        item.meaning,
        item.usage_example ?? '',
        '',
        item.context ?? '',
        item.created_at,
      ].map(escapeCsvCell).join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `dictionary-${studentLabel}-${now}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
            <p className="mt-2 text-sm text-gray-600">Select a section from the sidebar to manage materials, daily challenges, and weekly quests.</p>
          </article>
        );
      case 'materials-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Manage Materials</h2>
              {editingMaterialId && <button type="button" onClick={resetMaterialForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}
            </div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleMaterialSubmit}>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Title *</label><input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={3} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Content URL</label><input value={contentUrl} onChange={(event) => setContentUrl(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Tags (comma-separated)</label><input value={tagText} onChange={(event) => setTagText(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingMaterial} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingMaterial ? 'Saving...' : editingMaterialId ? 'Update Material' : 'Create Material'}</button></div>
            </form>
          </article>
        );
      case 'daily-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Manage Daily Challenges</h2>
              {editingDailyChallengeId && <button type="button" onClick={resetDailyChallengeForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}
            </div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleDailyChallengeSubmit}>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Challenge Title *</label><input required value={challengeTitle} onChange={(event) => setChallengeTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description *</label><textarea required value={challengeDescription} onChange={(event) => setChallengeDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={2} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Date</label><input type="date" value={challengeDate} onChange={(event) => setChallengeDate(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Type</label><select value={challengeType} onChange={(event) => setChallengeType(event.target.value as 'words' | 'expressions' | 'points' | 'streak')} className="w-full rounded-lg border border-gray-300 p-3"><option value="words">Words</option><option value="expressions">Expressions</option><option value="points">Points</option><option value="streak">Streak</option></select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Target Value</label><input type="number" min={1} value={challengeTargetValue} onChange={(event) => setChallengeTargetValue(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Reward Points</label><input type="number" min={0} value={challengeRewardPoints} onChange={(event) => setChallengeRewardPoints(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2 flex items-center gap-2"><input id="daily-active" type="checkbox" checked={challengeIsActive} onChange={(event) => setChallengeIsActive(event.target.checked)} /><label htmlFor="daily-active" className="text-sm text-gray-700">Active</label></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingDailyChallenge} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingDailyChallenge ? 'Saving...' : editingDailyChallengeId ? 'Update Daily Challenge' : 'Create Daily Challenge'}</button></div>
            </form>
          </article>
        );
      case 'quest-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Manage Weekly Quests</h2>{editingQuestId && <button type="button" onClick={resetQuestForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}</div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleQuestSubmit}>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Quest Title *</label><input required value={questTitle} onChange={(event) => setQuestTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description *</label><textarea required value={questDescription} onChange={(event) => setQuestDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={2} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Type</label><select value={questType} onChange={(event) => setQuestType(event.target.value as 'words' | 'expressions' | 'points' | 'streak')} className="w-full rounded-lg border border-gray-300 p-3"><option value="words">Words</option><option value="expressions">Expressions</option><option value="points">Points</option><option value="streak">Streak</option></select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Target Value</label><input type="number" min={1} value={questTargetValue} onChange={(event) => setQuestTargetValue(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Reward Points</label><input type="number" min={0} value={questRewardPoints} onChange={(event) => setQuestRewardPoints(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label><input type="date" value={questStartDate} onChange={(event) => setQuestStartDate(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">End Date</label><input type="date" value={questEndDate} onChange={(event) => setQuestEndDate(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2 flex items-center gap-2"><input id="quest-active" type="checkbox" checked={questIsActive} onChange={(event) => setQuestIsActive(event.target.checked)} /><label htmlFor="quest-active" className="text-sm text-gray-700">Active</label></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingQuest} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingQuest ? 'Saving...' : editingQuestId ? 'Update Quest' : 'Create Quest'}</button></div>
            </form>
          </article>
        );
      case 'materials-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Materials</h2>
            {loading ? <p className="mt-4 text-sm text-gray-600">Loading...</p> : materials.length === 0 ? <p className="mt-4 text-sm text-gray-600">No materials yet.</p> : (
              <div className="mt-4 space-y-3">{materials.map((material) => (<div key={material.id} className="rounded-lg border border-gray-200 p-3"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="font-semibold text-gray-900">{material.title}</p><p className="mt-1 text-sm text-gray-600">{material.description || 'No description provided.'}</p><p className="mt-1 text-xs text-blue-600">{material.content_url || 'No URL attached.'}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setEditingMaterialId(material.id); setTitle(material.title); setDescription(material.description ?? ''); setContentUrl(material.content_url ?? ''); setTagText((material.tags ?? []).join(', ')); setActiveSection('materials-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">Edit</button><button type="button" onClick={() => void handleDeleteMaterial(material.id)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:bg-rose-400" disabled={deletingMaterialId === material.id}>{deletingMaterialId === material.id ? 'Deleting...' : 'Delete'}</button></div></div></div>))}</div>
            )}
          </article>
        );
      case 'daily-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Daily Challenges</h2>
            {dailyChallenges.length === 0 ? <p className="mt-4 text-sm text-gray-600">No daily challenges yet.</p> : (
              <div className="mt-4 space-y-3">{dailyChallenges.map((challenge) => (<div key={challenge.id} className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-900">{challenge.title}</p><p className="text-sm text-gray-600">{challenge.description}</p><p className="mt-1 text-xs text-blue-700">{challenge.challenge_date} | {challenge.challenge_type} target {challenge.target_value} | +{challenge.reward_points} pts</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { setEditingDailyChallengeId(challenge.id); setChallengeTitle(challenge.title); setChallengeDescription(challenge.description); setChallengeDate(challenge.challenge_date); setChallengeType(challenge.challenge_type); setChallengeTargetValue(challenge.target_value); setChallengeRewardPoints(challenge.reward_points); setChallengeIsActive(challenge.is_active); setActiveSection('daily-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void handleDeleteDailyChallenge(challenge.id)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={deletingChallengeId === challenge.id}>{deletingChallengeId === challenge.id ? 'Deleting...' : 'Delete'}</button></div></div>))}</div>
            )}
          </article>
        );
      case 'quest-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Quests</h2>
            {quests.length === 0 ? <p className="mt-4 text-sm text-gray-600">No quests yet.</p> : (
              <div className="mt-4 space-y-3">{quests.map((quest) => (<div key={quest.id} className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-900">{quest.title}</p><p className="text-sm text-gray-600">{quest.description}</p><p className="mt-1 text-xs text-blue-700">{quest.target_type} target {quest.target_value} | +{quest.reward_points} pts</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { setEditingQuestId(quest.id); setQuestTitle(quest.title); setQuestDescription(quest.description); setQuestType(quest.target_type); setQuestTargetValue(quest.target_value); setQuestRewardPoints(quest.reward_points); setQuestStartDate(quest.start_date ?? todayIso()); setQuestEndDate(quest.end_date ?? ''); setQuestIsActive(quest.is_active); setActiveSection('quest-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void handleDeleteQuest(quest.id)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={deletingQuestId === quest.id}>{deletingQuestId === quest.id ? 'Deleting...' : 'Delete'}</button></div></div>))}</div>
            )}
          </article>
        );
      case 'teams-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Manage Teams</h2>{editingTeamId && <button type="button" onClick={resetTeamForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}</div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleTeamSubmit}>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Team Name *</label><input required value={teamName} onChange={(event) => setTeamName(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Color</label><input type="color" value={teamColorHex} onChange={(event) => setTeamColorHex(event.target.value)} className="h-12 w-full rounded-lg border border-gray-300 p-2" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description</label><textarea value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={2} /></div>
              <div className="md:col-span-2 flex items-center gap-2"><input id="team-active" type="checkbox" checked={teamIsActive} onChange={(event) => setTeamIsActive(event.target.checked)} /><label htmlFor="team-active" className="text-sm text-gray-700">Active</label></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingTeam} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingTeam ? 'Saving...' : editingTeamId ? 'Update Team' : 'Create Team'}</button></div>
            </form>
          </article>
        );
      case 'teams-members':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            {teams.length === 0 ? <p className="mt-3 text-sm text-gray-600">Create a team first.</p> : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Select Team</label>
                  <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3">
                    {teams.map((team) => (<option key={team.id} value={team.id}>{team.name}</option>))}
                  </select>
                </div>
                <form className="grid gap-3 md:grid-cols-[1fr_150px_auto]" onSubmit={handleAssignMember}>
                  <select value={memberStudentId} onChange={(event) => setMemberStudentId(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" required>
                    <option value="">Select student...</option>
                    {students.filter((student) => !teamMembers.some((member) => member.student_id === student.id)).map((student) => (
                      <option key={student.id} value={student.id}>{student.username ?? student.id.slice(0, 8)} ({student.points} pts)</option>
                    ))}
                  </select>
                  <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as 'member' | 'captain')} className="w-full rounded-lg border border-gray-300 p-3">
                    <option value="member">Member</option>
                    <option value="captain">Captain</option>
                  </select>
                  <button type="submit" disabled={assigningMember || !selectedTeamId} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{assigningMember ? 'Assigning...' : 'Assign'}</button>
                </form>
                <div className="space-y-2">
                  {teamMembers.length === 0 ? <p className="text-sm text-gray-600">No members in this team yet.</p> : teamMembers.map((member) => {
                    const student = students.find((item) => item.id === member.student_id);
                    return (
                      <div key={member.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{student?.username ?? member.student_id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-600">{member.role} | {student?.points ?? 0} pts</p>
                        </div>
                        <button type="button" onClick={() => void handleRemoveMember(member.student_id)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={removingMemberStudentId === member.student_id}>{removingMemberStudentId === member.student_id ? 'Removing...' : 'Remove'}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        );
      case 'students-dictionary':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Student Dictionaries</h2>
                <p className="mt-1 text-sm text-gray-600">View each student&apos;s words, expressions, and progress stats.</p>
              </div>
              <div className="w-full md:w-80">
                <label className="mb-1 block text-sm font-medium text-gray-700">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3"
                  disabled={students.length === 0}
                >
                  {students.length === 0 && <option value="">No students available</option>}
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.username ?? student.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {studentDictionaryError && (
              <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {studentDictionaryError}
              </p>
            )}

            {selectedStudentId && (
              <>
                <div className="mt-4 grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-[1fr_220px_180px_auto_auto_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Search</label>
                    <input
                      type="text"
                      value={studentDictionarySearchQuery}
                      onChange={(event) => setStudentDictionarySearchQuery(event.target.value)}
                      placeholder="Word, expression, or meaning..."
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                    <select
                      value={studentDictionaryCategoryFilter}
                      onChange={(event) => setStudentDictionaryCategoryFilter(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-sm"
                    >
                      <option value="all">All categories</option>
                      {studentDictionaryCategoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={studentDictionaryDateFilter}
                      onChange={(event) => setStudentDictionaryDateFilter(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-sm"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={studentDictionaryRecentOnly}
                      onChange={(event) => setStudentDictionaryRecentOnly(event.target.checked)}
                    />
                    Last 7 days
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentDictionarySearchQuery('');
                      setStudentDictionaryCategoryFilter('all');
                      setStudentDictionaryDateFilter('');
                      setStudentDictionaryRecentOnly(false);
                    }}
                    className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Clear Filters
                  </button>
                  <button
                    type="button"
                    onClick={exportSelectedStudentDictionaryCsv}
                    className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatsCard
                    title="Student Points"
                    value={students.find((student) => student.id === selectedStudentId)?.points ?? 0}
                    icon={<Flag className="text-white" />}
                  />
                  <StatsCard title="Review Streak" value={selectedStudentStreak} icon={<Zap className="text-white" />} />
                  <StatsCard title="Words Collected" value={selectedStudentWordCount} icon={<BookCopy className="text-white" />} />
                  <StatsCard title="Expressions Collected" value={selectedStudentExpressionCount} icon={<ClipboardList className="text-white" />} />
                </div>

                {loadingStudentDictionary ? (
                  <p className="mt-4 text-sm text-gray-600">Loading student dictionary...</p>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <h3 className="text-base font-semibold text-gray-900">
                        Vocabulary ({filteredStudentVocabulary.length}/{selectedStudentVocabulary.length} shown)
                      </h3>
                      {filteredStudentVocabulary.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-600">No words collected yet.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {filteredStudentVocabulary.map((item) => (
                            <div key={item.id} className="rounded-md border border-gray-100 bg-gray-50 p-2.5">
                              <p className="text-sm font-semibold text-gray-900">{item.word}</p>
                              {item.image_url && (
                                <div className="relative mt-1 h-24 w-full overflow-hidden rounded-md border border-gray-200">
                                  <Image
                                    src={item.image_url}
                                    alt={item.word}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1024px) 100vw, 33vw"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <p className="text-xs text-gray-700">{item.definition}</p>
                              {item.example_sentence && (
                                <p className="mt-1 text-xs italic text-gray-600">&quot;{item.example_sentence}&quot;</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <h3 className="text-base font-semibold text-gray-900">
                        Expressions ({filteredStudentExpressions.length}/{selectedStudentExpressions.length} shown)
                      </h3>
                      {filteredStudentExpressions.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-600">No expressions collected yet.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {filteredStudentExpressions.map((item) => (
                            <div key={item.id} className="rounded-md border border-gray-100 bg-gray-50 p-2.5">
                              <p className="text-sm font-semibold text-gray-900">{item.expression}</p>
                              <p className="text-xs text-gray-700">{item.meaning}</p>
                              {item.usage_example && (
                                <p className="mt-1 text-xs italic text-gray-600">&quot;{item.usage_example}&quot;</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </article>
        );
      case 'teams-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Teams</h2>
            {teams.length === 0 ? <p className="mt-4 text-sm text-gray-600">No teams yet.</p> : (
              <div className="mt-4 space-y-3">{teams.map((team) => (<div key={team.id} className="rounded-lg border border-gray-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{team.name}</p><p className="text-sm text-gray-600">{team.description || 'No description.'}</p><div className="mt-1 inline-flex items-center gap-2 text-xs text-gray-600"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color_hex ?? '#2563eb' }} />{team.is_active ? 'Active' : 'Inactive'}</div></div><div className="flex gap-2"><button type="button" onClick={() => { setEditingTeamId(team.id); setTeamName(team.name); setTeamDescription(team.description ?? ''); setTeamColorHex(team.color_hex ?? '#2563eb'); setTeamIsActive(team.is_active); setActiveSection('teams-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void handleDeleteTeam(team.id)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={deletingTeamId === team.id}>{deletingTeamId === team.id ? 'Deleting...' : 'Delete'}</button></div></div></div>))}</div>
            )}
          </article>
        );
      case 'boosts-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Teacher Boosts</h2>{editingBoostId && <button type="button" onClick={resetBoostForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}</div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleBoostSubmit}>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Title *</label><input required value={boostTitle} onChange={(event) => setBoostTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Type</label><select value={boostType} onChange={(event) => setBoostType(event.target.value as 'double_xp' | 'bonus_flat')} className="w-full rounded-lg border border-gray-300 p-3"><option value="double_xp">Double XP (Multiplier)</option><option value="bonus_flat">Flat Bonus</option></select></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description</label><textarea value={boostDescription} onChange={(event) => setBoostDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={2} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Multiplier</label><input type="number" min={1} step={0.1} value={boostMultiplier} onChange={(event) => setBoostMultiplier(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" disabled={boostType !== 'double_xp'} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Flat Bonus</label><input type="number" min={0} value={boostFlatBonus} onChange={(event) => setBoostFlatBonus(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" disabled={boostType !== 'bonus_flat'} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Starts At</label><input type="datetime-local" value={boostStartsAt} onChange={(event) => setBoostStartsAt(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Ends At</label><input type="datetime-local" value={boostEndsAt} onChange={(event) => setBoostEndsAt(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2 flex items-center gap-2"><input id="boost-active" type="checkbox" checked={boostIsActive} onChange={(event) => setBoostIsActive(event.target.checked)} /><label htmlFor="boost-active" className="text-sm text-gray-700">Active</label></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingBoost} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingBoost ? 'Saving...' : editingBoostId ? 'Update Boost' : 'Create Boost'}</button></div>
            </form>
          </article>
        );
      case 'boosts-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Boosts</h2>
            {boosts.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600">No boosts yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {boosts.map((boost) => (
                  <div key={boost.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{boost.title}</p>
                        <p className="text-sm text-gray-600">{boost.description || 'No description.'}</p>
                        <p className="mt-1 text-xs text-blue-700">
                          {boost.boost_type === 'double_xp' ? `${boost.multiplier}x` : `+${boost.flat_bonus}`} |{' '}
                          {new Date(boost.starts_at).toLocaleString()}
                          {' -> '}
                          {new Date(boost.ends_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBoostId(boost.id);
                            setBoostTitle(boost.title);
                            setBoostDescription(boost.description ?? '');
                            setBoostType(boost.boost_type);
                            setBoostMultiplier(Number(boost.multiplier));
                            setBoostFlatBonus(boost.flat_bonus);
                            setBoostStartsAt(new Date(boost.starts_at).toISOString().slice(0, 16));
                            setBoostEndsAt(new Date(boost.ends_at).toISOString().slice(0, 16));
                            setBoostIsActive(boost.is_active);
                            setActiveSection('boosts-form');
                          }}
                          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBoost(boost.id)}
                          className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400"
                          disabled={deletingBoostId === boost.id}
                        >
                          {deletingBoostId === boost.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      default:
        return null;
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Admin Sections</p>
            <nav className="space-y-1">
              {sectionItems.map((section) => (
                <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={navItemClass(section.id)}>
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="grid gap-5 md:gap-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Teacher Dashboard</h1>
              <p className="text-sm text-gray-600 md:text-base">Manage materials, challenges, quests, and teams from one place.</p>
            </div>
          </div>

          <div className="lg:hidden">
            <div className="flex gap-2 overflow-x-auto rounded-lg bg-white p-2 ring-1 ring-gray-200">
              {sectionItems.map((section) => (
                <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={mobileNavClass(section.id)}>
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {activeSection === 'overview' && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard title="Active Students" value={studentCount} icon={<Users className="text-white" />} />
              <StatsCard title="Materials Published" value={materials.length} icon={<BookCopy className="text-white" />} />
              <StatsCard title="Daily Challenges" value={dailyChallenges.length} icon={<ClipboardList className="text-white" />} />
              <StatsCard title="Active Competitions" value={competitionCount} icon={<Flag className="text-white" />} />
              <StatsCard title="Teams" value={teams.length} icon={<Users className="text-white" />} />
              <StatsCard title="Boost Windows" value={boosts.length} icon={<Zap className="text-white" />} />
              <StatsCard title="Reviews Due Now" value={reviewAnalytics.dueNow} icon={<ClipboardList className="text-white" />} />
              <StatsCard title="Reviewed Today" value={reviewAnalytics.completedToday} icon={<BookCopy className="text-white" />} />
              <StatsCard title="Mastered Reviews" value={reviewAnalytics.masteredCount} icon={<Flag className="text-white" />} />
              <StatsCard title="Active Reviewers" value={reviewAnalytics.activeStudentsToday} icon={<Users className="text-white" />} />
            </div>
          )}

          {activeSection === 'overview' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
                <h2 className="text-base font-semibold text-gray-900 md:text-lg">Top Materials (Usage)</h2>
                {materialInsights.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-600">No material activity yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {materialInsights.map((item, index) => (
                      <div key={item.materialId} className="rounded-lg border border-gray-200 p-2.5">
                        <p className="text-sm font-semibold text-gray-900">#{index + 1} {item.title}</p>
                        <p className="mt-1 text-xs text-gray-600">
                          {item.totalCollected} collected ({item.vocabularyCount} words, {item.expressionCount} expressions)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
                <h2 className="text-base font-semibold text-gray-900 md:text-lg">Top Teams (Points)</h2>
                {teamInsights.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-600">No team data yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {teamInsights.map((item, index) => (
                      <div key={item.teamId} className="rounded-lg border border-gray-200 p-2.5">
                        <p className="text-sm font-semibold text-gray-900">#{index + 1} {item.name}</p>
                        <p className="mt-1 text-xs text-gray-600">
                          {item.totalPoints} total | {item.memberCount} members | avg {item.averagePoints}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>
          )}

          {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          {errorMessage && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}

          {renderActiveSection()}
        </div>
      </div>
    </section>
  );
}
