'use client';

import { BookCopy, ClipboardList, Flag, Users, Zap } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getTeacherCapsules,
  createCapsule,
  updateCapsule,
  deleteCapsule,
  publishCapsule,
  getCapsuleQuestions,
  setCapsuleQuestions,
  assignCapsuleToClass,
  removeCapsuleFromClass,
  assignCapsuleToStudent,
  removeCapsuleFromStudent,
  getCapsuleAssignments,
} from '@/lib/capsule-data';
import type {
  DailyChallenge,
  Expression,
  Material,
  Profile,
  Quest,
  Classroom,
  Team,
  TeamMembership,
  TeacherBoost,
  Vocabulary,
  EducationCapsule,
  CapsuleQuizQuestion,
  CapsuleClassAssignment,
  CapsuleStudentAssignment,
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
import { getTeacherClasses } from '@/lib/classes-data';
import { sendBulkClassNotification } from '@/lib/notifications-data';
import InlineSpinner from '@/components/ui/InlineSpinner';

const parseTags = (tagText: string) =>
  tagText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

function getEmbedUrl(url: string) {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    const id = url.split('watch?v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('vimeo.com/')) {
    const id = url.split('vimeo.com/')[1]?.split('?')[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const escapeCsvCell = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const sectionItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'materials-form', label: 'Manage Materials' },
  { id: 'capsules-form', label: 'Manage Capsules' },
  { id: 'daily-form', label: 'Daily Challenges' },
  { id: 'quest-form', label: 'Weekly Quests' },
  { id: 'teams-form', label: 'Manage Teams' },
  { id: 'teams-members', label: 'Team Members' },
  { id: 'students-dictionary', label: 'Student Dictionaries' },
  { id: 'boosts-form', label: 'Teacher Boosts' },
  { id: 'announcements-form', label: 'Send Announcement' },
  { id: 'materials-list', label: 'Your Materials' },
  { id: 'capsules-list', label: 'Your Capsules' },
  { id: 'daily-list', label: 'Your Daily Challenges' },
  { id: 'quest-list', label: 'Your Quests' },
  { id: 'teams-list', label: 'Your Teams' },
  { id: 'boosts-list', label: 'Your Boosts' },
] as const;

type SectionId = (typeof sectionItems)[number]['id'];

export default function AdminDashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const canAccessTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [boosts, setBoosts] = useState<TeacherBoost[]>([]);
  const [students, setStudents] = useState<Array<Pick<Profile, 'id' | 'username' | 'avatar_url' | 'points' | 'role'>>>([]);
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

  const [announcementClassId, setAnnouncementClassId] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

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

  // Education Capsules States
  const [capsules, setCapsules] = useState<EducationCapsule[]>([]);
  const [savingCapsule, setSavingCapsule] = useState(false);
  const [deletingCapsuleId, setDeletingCapsuleId] = useState<string | null>(null);
  const [editingCapsuleId, setEditingCapsuleId] = useState<string | null>(null);

  const [capsuleTitle, setCapsuleTitle] = useState('');
  const [capsuleTopic, setCapsuleTopic] = useState('');
  const [capsuleDescription, setCapsuleDescription] = useState('');
  const [capsuleMediaType, setCapsuleMediaType] = useState<'image' | 'video' | 'document' | 'audio'>('image');
  const [capsuleMediaUrl, setCapsuleMediaUrl] = useState('');
  const [capsuleContentText, setCapsuleContentText] = useState('');
  const [capsuleRewardPoints, setCapsuleRewardPoints] = useState(50);
  const [capsuleIsPublished, setCapsuleIsPublished] = useState(false);

  // Quiz Builder State
  interface LocalQuestion {
    id?: string;
    question_text: string;
    question_type: 'mcq' | 'fill_blank' | 'true_false';
    options: string[];
    correct_option_index: number;
    correct_answer: string;
  }
  const [quizQuestions, setQuizQuestions] = useState<LocalQuestion[]>([
    { question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_option_index: 0, correct_answer: '' }
  ]);

  // Assignments States
  const [selectedCapsuleForAssignment, setSelectedCapsuleForAssignment] = useState<EducationCapsule | null>(null);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignStudentId, setAssignStudentId] = useState('');
  const [currentClassAssignments, setCurrentClassAssignments] = useState<Array<CapsuleClassAssignment & { class: { id: string; name: string } }>>([]);
  const [currentStudentAssignments, setCurrentStudentAssignments] = useState<Array<CapsuleStudentAssignment & { student: { id: string; username: string } }>>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Quill Editor & Preview states
  const quillRef = useRef<any>(null);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [previewCapsule, setPreviewCapsule] = useState<{
    title: string;
    topic: string;
    description: string | null;
    media_type: 'image' | 'video' | 'document' | 'audio';
    media_url: string;
    content_text: string;
    reward_points: number;
  } | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<LocalQuestion[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSelectedAnswers, setPreviewSelectedAnswers] = useState<Record<number, { optionIndex?: number; textAnswer?: string }>>({});
  const [previewResult, setPreviewResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);



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
  const [selectedMaterialClassId, setSelectedMaterialClassId] = useState('');
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
    setSelectedMaterialClassId('');
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

    const [materialsRes, studentsRes, competitionsRes, dailyChallengesRes, questsRes, teamsRes, classesRes, rosterRes, boostsRes, reviewAnalyticsRes, insightsRes, capsulesRes] = await Promise.all([
      getTeacherMaterials(profile.id),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('competitions').select('*', { count: 'exact', head: true }).eq('teacher_id', profile.id),
      getTeacherDailyChallenges(profile.id),
      getTeacherQuests(profile.id),
      getTeacherTeams(profile.id),
      getTeacherClasses(profile.id),
      getStudentsForTeams(),
      getTeacherBoosts(profile.id),
      getReviewAnalytics(),
      getAdminInsights(profile.id),
      getTeacherCapsules(profile.id),
    ]);

    setMaterials(materialsRes.data);
    setDailyChallenges(dailyChallengesRes.data);
    setQuests(questsRes.data);
    setTeams(teamsRes.data);
    setClasses(classesRes.data);
    setStudents(rosterRes.data);
    setBoosts(boostsRes.data);
    setCapsules(capsulesRes.error ? [] : capsulesRes.data);
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

  useEffect(() => {
    if (activeSection !== 'capsules-form') {
      quillRef.current = null;
      return;
    }

    let link = document.querySelector('link[href*="quill.snow.css"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    const scriptId = 'quill-script-cdn';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    const initQuill = () => {
      const Quill = (window as any).Quill;
      const container = document.getElementById('quill-editor-container');
      if (!Quill || !container) return;

      container.innerHTML = '';
      const editorDiv = document.createElement('div');
      editorDiv.id = 'quill-rich-editor';
      editorDiv.style.height = '240px';
      container.appendChild(editorDiv);

      const quill = new Quill('#quill-rich-editor', {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ font: [] }, { size: [] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ script: 'sub' }, { script: 'super' }],
            [{ header: [1, 2, 3, 4, 5, 6, false] }, 'blockquote', 'code-block'],
            [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
            [{ direction: 'rtl' }, { align: [] }],
            ['link', 'image', 'video'],
            ['clean']
          ]
        }
      });

      quill.root.innerHTML = capsuleContentText;
      quillRef.current = quill;

      quill.on('text-change', () => {
        setCapsuleContentText(quill.root.innerHTML);
      });
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';
      script.async = true;
      script.onload = initQuill;
      document.head.appendChild(script);
    } else {
      if ((window as any).Quill) {
        setTimeout(initQuill, 50);
      } else {
        script.addEventListener('load', initQuill);
      }
    }

    return () => {
      quillRef.current = null;
    };
  }, [activeSection]);


  const resetCapsuleForm = () => {
    setEditingCapsuleId(null);
    setCapsuleTitle('');
    setCapsuleTopic('');
    setCapsuleDescription('');
    setCapsuleMediaType('image');
    setCapsuleMediaUrl('');
    setCapsuleContentText('');
    setCapsuleRewardPoints(50);
    setCapsuleIsPublished(false);
    setIsHtmlMode(false);
    setQuizQuestions([
      { question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_option_index: 0, correct_answer: '' }
    ]);
    if (quillRef.current) {
      quillRef.current.root.innerHTML = '';
    }
  };

  const loadCapsules = async () => {
    if (!profile?.id) return;
    const res = await getTeacherCapsules(profile.id);
    setCapsules(res.error ? [] : res.data);
  };

  const loadCapsuleAssignmentsData = async (capsuleId: string) => {
    setLoadingAssignments(true);
    const { classAssignments, studentAssignments } = await getCapsuleAssignments(capsuleId);
    setCurrentClassAssignments(classAssignments);
    setCurrentStudentAssignments(studentAssignments);
    setLoadingAssignments(false);
  };

  const handleCapsuleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) {
      setErrorMessage('Teacher profile is required.');
      return;
    }

    if (quizQuestions.length === 0) {
      setErrorMessage('A capsule must have at least one quiz question.');
      return;
    }

    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      if (!q.question_text.trim()) {
        setErrorMessage(`Question ${i + 1} text is required.`);
        return;
      }
      if (q.question_type === 'mcq') {
        if (q.options.some(opt => !opt.trim())) {
          setErrorMessage(`All 4 options for Question ${i + 1} (MCQ) are required.`);
          return;
        }
      } else if (q.question_type === 'fill_blank') {
        if (!q.correct_answer.trim()) {
          setErrorMessage(`Correct answer for Question ${i + 1} (Fill-in-the-blank) is required.`);
          return;
        }
      }
    }

    setSavingCapsule(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      title: capsuleTitle,
      topic: capsuleTopic,
      description: capsuleDescription,
      mediaType: capsuleMediaType,
      mediaUrl: capsuleMediaUrl,
      contentText: capsuleContentText,
      rewardPoints: capsuleRewardPoints,
      isPublished: capsuleIsPublished,
      createdBy: profile.id,
    };

    let capsuleId = editingCapsuleId;
    let err = null;

    if (editingCapsuleId) {
      const result = await updateCapsule({ id: editingCapsuleId, ...payload });
      if (result.error) {
        err = result.error;
      }
    } else {
      const result = await createCapsule(payload);
      if (result.error) {
        err = result.error;
      } else if (result.data) {
        capsuleId = result.data.id;
      }
    }

    if (err) {
      setErrorMessage(err.message);
      setSavingCapsule(false);
      return;
    }

    if (capsuleId) {
      const questionPayload = quizQuestions.map((q) => {
        if (q.question_type === 'mcq') {
          return {
            question_text: q.question_text,
            question_type: 'mcq' as const,
            options: q.options,
            correct_option_index: q.correct_option_index,
            correct_answer: null,
            order_index: 0,
          };
        } else if (q.question_type === 'true_false') {
          return {
            question_text: q.question_text,
            question_type: 'true_false' as const,
            options: ['True', 'False'],
            correct_option_index: q.correct_option_index,
            correct_answer: null,
            order_index: 0,
          };
        } else {
          return {
            question_text: q.question_text,
            question_type: 'fill_blank' as const,
            options: null,
            correct_option_index: null,
            correct_answer: q.correct_answer.toLowerCase().trim(),
            order_index: 0,
          };
        }
      });

      const qResult = await setCapsuleQuestions(capsuleId, questionPayload);
      if (qResult.error) {
        setErrorMessage(`Capsule saved but failed to update quiz: ${qResult.error.message}`);
        setSavingCapsule(false);
        await loadCapsules();
        return;
      }
    }

    setMessage(editingCapsuleId ? 'Capsule updated successfully.' : 'Capsule created successfully.');
    resetCapsuleForm();
    await loadCapsules();
    setSavingCapsule(false);
    setActiveSection('capsules-list');
  };

  const handleDeleteCapsule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this capsule? This will remove all student scores and completions.')) {
      return;
    }
    setDeletingCapsuleId(id);
    setMessage(null);
    setErrorMessage(null);
    const { error } = await deleteCapsule(id, profile?.id ?? '');
    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage('Capsule deleted successfully.');
      await loadCapsules();
    }
    setDeletingCapsuleId(null);
  };

  const handlePublishCapsule = async (id: string, isPublished: boolean) => {
    setMessage(null);
    setErrorMessage(null);
    const { error } = await publishCapsule(id, profile?.id ?? '', isPublished);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage(isPublished ? 'Capsule published.' : 'Capsule unpublished.');
      await loadCapsules();
    }
  };

  const handleAssignClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCapsuleForAssignment || !assignClassId) return;
    setMessage(null);
    setErrorMessage(null);
    const { error } = await assignCapsuleToClass(selectedCapsuleForAssignment.id, assignClassId);
    if (error) {
      if (error.code === '23505') {
        setErrorMessage('This class is already assigned to this capsule.');
      } else {
        setErrorMessage(error.message);
      }
    } else {
      setMessage('Capsule assigned to class.');
      setAssignClassId('');
      await loadCapsuleAssignmentsData(selectedCapsuleForAssignment.id);
    }
  };

  const handleRemoveClass = async (classId: string) => {
    if (!selectedCapsuleForAssignment) return;
    setMessage(null);
    setErrorMessage(null);
    const { error } = await removeCapsuleFromClass(selectedCapsuleForAssignment.id, classId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage('Class assignment removed.');
      await loadCapsuleAssignmentsData(selectedCapsuleForAssignment.id);
    }
  };

  const handleAssignStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCapsuleForAssignment || !assignStudentId) return;
    setMessage(null);
    setErrorMessage(null);
    const { error } = await assignCapsuleToStudent(selectedCapsuleForAssignment.id, assignStudentId);
    if (error) {
      if (error.code === '23505') {
        setErrorMessage('This student is already directly assigned to this capsule.');
      } else {
        setErrorMessage(error.message);
      }
    } else {
      setMessage('Capsule assigned to student.');
      setAssignStudentId('');
      await loadCapsuleAssignmentsData(selectedCapsuleForAssignment.id);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedCapsuleForAssignment) return;
    setMessage(null);
    setErrorMessage(null);
    const { error } = await removeCapsuleFromStudent(selectedCapsuleForAssignment.id, studentId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage('Student assignment removed.');
      await loadCapsuleAssignmentsData(selectedCapsuleForAssignment.id);
    }
  };

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
      classId: selectedMaterialClassId || undefined,
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

  const handleAnnouncementSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile?.id || !announcementClassId || !announcementTitle.trim() || !announcementBody.trim()) {
      setAnnouncementError('Please fill out all fields.');
      return;
    }
    setSendingAnnouncement(true);
    setAnnouncementSuccess(false);
    setAnnouncementError(null);

    const { error } = await sendBulkClassNotification({
      classId: announcementClassId,
      senderId: profile.id,
      type: 'announcement',
      title: announcementTitle.trim(),
      body: announcementBody.trim(),
      link: '/dashboard',
    });

    setSendingAnnouncement(false);
    if (error) {
      setAnnouncementError(error.message || 'Failed to send announcement.');
    } else {
      setAnnouncementSuccess(true);
      setAnnouncementTitle('');
      setAnnouncementBody('');
    }
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
      case 'capsules-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editingCapsuleId ? 'Edit Education Capsule' : 'Create Education Capsule'}</h2>
              {editingCapsuleId && (
                <button type="button" onClick={resetCapsuleForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">
                  Cancel Edit
                </button>
              )}
            </div>
            <form className="grid gap-4" onSubmit={handleCapsuleSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Capsule Title *</label>
                  <input
                    required
                    value={capsuleTitle}
                    onChange={(e) => setCapsuleTitle(e.target.value)}
                    placeholder="e.g. Mastering Phrasal Verbs"
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Topic *</label>
                  <input
                    required
                    value={capsuleTopic}
                    onChange={(e) => setCapsuleTopic(e.target.value)}
                    placeholder="e.g. Grammar, Business English"
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Reward Points *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={capsuleRewardPoints}
                    onChange={(e) => setCapsuleRewardPoints(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={capsuleDescription}
                    onChange={(e) => setCapsuleDescription(e.target.value)}
                    placeholder="Provide a brief summary of what this capsule covers..."
                    className="w-full rounded-lg border border-gray-300 p-3"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Media Type *</label>
                  <select
                    value={capsuleMediaType}
                    onChange={(e) => setCapsuleMediaType(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 p-3"
                  >
                    <option value="image">Image URL</option>
                    <option value="video">Video Embed (YouTube/Vimeo)</option>
                    <option value="audio">Audio URL</option>
                    <option value="document">Document / PDF Link</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Media URL *</label>
                  <input
                    required
                    value={capsuleMediaUrl}
                    onChange={(e) => setCapsuleMediaUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Educational text *</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (isHtmlMode) {
                          // Switching back to Rich Text: sync textarea to Quill
                          if (quillRef.current) {
                            quillRef.current.root.innerHTML = capsuleContentText;
                          }
                          setIsHtmlMode(false);
                        } else {
                          // Switching to HTML mode: sync Quill to state
                          if (quillRef.current) {
                            setCapsuleContentText(quillRef.current.root.innerHTML);
                          }
                          setIsHtmlMode(true);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg transition"
                    >
                      {isHtmlMode ? '✍️ Switch to Rich Text Editor' : '💻 Switch to HTML/Source Editor'}
                    </button>
                  </div>
                  <div className={isHtmlMode ? 'hidden' : 'block'}>
                    <div id="quill-editor-container" className="bg-white rounded-lg border border-gray-300 overflow-hidden" />
                  </div>
                  {isHtmlMode && (
                    <textarea
                      value={capsuleContentText}
                      onChange={(e) => setCapsuleContentText(e.target.value)}
                      placeholder="<p>Write your educational HTML content here...</p>"
                      className="w-full font-mono text-xs p-4 h-[290px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-900 text-slate-100"
                    />
                  )}
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    id="capsule-active"
                    type="checkbox"
                    checked={capsuleIsPublished}
                    onChange={(e) => setCapsuleIsPublished(e.target.checked)}
                  />
                  <label htmlFor="capsule-active" className="text-sm font-semibold text-gray-700">
                    Publish Capsule immediately (visible to assigned students)
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Quiz Builder (Min 1, Passing grade: 80%)</h3>
                <div className="space-y-4">
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3 relative">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-gray-700">Question {idx + 1}</span>
                        {quizQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
                            }}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove Question
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Question Text *</label>
                        <input
                          required
                          value={q.question_text}
                          onChange={(e) => {
                            const newQ = [...quizQuestions];
                            newQ[idx].question_text = e.target.value;
                            setQuizQuestions(newQ);
                          }}
                          placeholder="e.g. What is the definition of..."
                          className="w-full rounded-lg border border-gray-300 p-2 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Question Type</label>
                          <select
                            value={q.question_type}
                            onChange={(e) => {
                              const newQ = [...quizQuestions];
                              const type = e.target.value as any;
                              newQ[idx].question_type = type;
                              if (type === 'true_false') {
                                newQ[idx].options = ['True', 'False'];
                                newQ[idx].correct_option_index = 0;
                              } else if (type === 'mcq') {
                                newQ[idx].options = ['', '', '', ''];
                                newQ[idx].correct_option_index = 0;
                              } else {
                                newQ[idx].options = [];
                                newQ[idx].correct_answer = '';
                              }
                              setQuizQuestions(newQ);
                            }}
                            className="w-full rounded-lg border border-gray-300 p-2 bg-white"
                          >
                            <option value="mcq">Multiple Choice (MCQ)</option>
                            <option value="true_false">True / False</option>
                            <option value="fill_blank">Fill in the blank</option>
                          </select>
                        </div>

                        {q.question_type === 'mcq' && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Correct Option *</label>
                            <select
                              value={q.correct_option_index}
                              onChange={(e) => {
                                const newQ = [...quizQuestions];
                                newQ[idx].correct_option_index = Number(e.target.value);
                                setQuizQuestions(newQ);
                              }}
                              className="w-full rounded-lg border border-gray-300 p-2 bg-white"
                            >
                              <option value={0}>Option 1</option>
                              <option value={1}>Option 2</option>
                              <option value={2}>Option 3</option>
                              <option value={3}>Option 4</option>
                            </select>
                          </div>
                        )}

                        {q.question_type === 'true_false' && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Correct Answer *</label>
                            <select
                              value={q.correct_option_index}
                              onChange={(e) => {
                                const newQ = [...quizQuestions];
                                newQ[idx].correct_option_index = Number(e.target.value);
                                setQuizQuestions(newQ);
                              }}
                              className="w-full rounded-lg border border-gray-300 p-2 bg-white"
                            >
                              <option value={0}>True</option>
                              <option value={1}>False</option>
                            </select>
                          </div>
                        )}

                        {q.question_type === 'fill_blank' && (
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-gray-600">Correct Text Answer * (Case-insensitive)</label>
                            <input
                              required
                              value={q.correct_answer}
                              onChange={(e) => {
                                const newQ = [...quizQuestions];
                                newQ[idx].correct_answer = e.target.value;
                                setQuizQuestions(newQ);
                              }}
                              placeholder="e.g. run"
                              className="w-full rounded-lg border border-gray-300 p-2 bg-white"
                            />
                          </div>
                        )}
                      </div>

                      {q.question_type === 'mcq' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx}>
                              <label className="text-[10px] text-gray-500 font-semibold">Option {optIdx + 1}</label>
                              <input
                                required
                                value={opt}
                                onChange={(e) => {
                                  const newQ = [...quizQuestions];
                                  newQ[idx].options[optIdx] = e.target.value;
                                  setQuizQuestions(newQ);
                                }}
                                placeholder={`Option ${optIdx + 1}`}
                                className="w-full rounded-lg border border-gray-200 p-2 bg-white text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setQuizQuestions([
                        ...quizQuestions,
                        { question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_option_index: 0, correct_answer: '' }
                      ]);
                    }}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    + Add Question
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingCapsule}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:bg-blue-400"
                >
                  {savingCapsule ? (
                    <>
                      <InlineSpinner size={16} /> Saving...
                    </>
                  ) : editingCapsuleId ? (
                    'Update Capsule'
                  ) : (
                    'Create Capsule'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCapsule({
                      title: capsuleTitle || 'Untitled Capsule',
                      topic: capsuleTopic || 'General',
                      description: capsuleDescription || null,
                      media_type: capsuleMediaType,
                      media_url: capsuleMediaUrl,
                      content_text: capsuleContentText,
                      reward_points: capsuleRewardPoints,
                    });
                    setPreviewQuestions(quizQuestions);
                    setPreviewSelectedAnswers({});
                    setPreviewResult(null);
                    setShowPreviewModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-200 transition"
                >
                  Preview Capsule
                </button>
              </div>
            </form>
          </article>
        );
      case 'capsules-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Education Capsules</h2>
            
            {loading ? (
              <p className="mt-4 text-sm text-gray-600">Loading...</p>
            ) : capsules.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600">No capsules created yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {capsules.map((capsule) => {
                  const isAssigned = selectedCapsuleForAssignment?.id === capsule.id;
                  return (
                    <div key={capsule.id} className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white shadow-xs">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              {capsule.topic}
                            </span>
                            <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              {capsule.media_type.toUpperCase()}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${capsule.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                              {capsule.is_published ? 'Published' : 'Draft'}
                            </span>
                          </div>
                          <p className="font-bold text-gray-900 text-lg mt-1">{capsule.title}</p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{capsule.description || 'No description.'}</p>
                          <p className="text-xs text-gray-500 mt-1">Reward: {capsule.reward_points} Points</p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCapsuleForAssignment(isAssigned ? null : capsule);
                              if (!isAssigned) {
                                void loadCapsuleAssignmentsData(capsule.id);
                              }
                            }}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${isAssigned ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          >
                            {isAssigned ? 'Close Assignments' : 'Assign'}
                          </button>
                           <button
                            type="button"
                            onClick={async () => {
                              setPreviewCapsule({
                                title: capsule.title,
                                topic: capsule.topic,
                                description: capsule.description,
                                media_type: capsule.media_type,
                                media_url: capsule.media_url,
                                content_text: capsule.content_text,
                                reward_points: capsule.reward_points,
                              });
                              const qRes = await getCapsuleQuestions(capsule.id);
                              if (!qRes.error && qRes.data) {
                                setPreviewQuestions(qRes.data.map(q => ({
                                  id: q.id,
                                  question_text: q.question_text,
                                  question_type: q.question_type,
                                  options: q.options || ['', '', '', ''],
                                  correct_option_index: q.correct_option_index ?? 0,
                                  correct_answer: q.correct_answer ?? '',
                                })));
                              } else {
                                setPreviewQuestions([]);
                              }
                              setPreviewSelectedAnswers({});
                              setPreviewResult(null);
                              setShowPreviewModal(true);
                            }}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const editCapsule = async () => {
                                setEditingCapsuleId(capsule.id);
                                setCapsuleTitle(capsule.title);
                                setCapsuleTopic(capsule.topic);
                                setCapsuleDescription(capsule.description ?? '');
                                setCapsuleMediaType(capsule.media_type);
                                setCapsuleMediaUrl(capsule.media_url);
                                setCapsuleContentText(capsule.content_text);
                                setCapsuleRewardPoints(capsule.reward_points);
                                setCapsuleIsPublished(capsule.is_published);
                                
                                const qRes = await getCapsuleQuestions(capsule.id);
                                if (!qRes.error && qRes.data) {
                                  setQuizQuestions(qRes.data.map(q => ({
                                    id: q.id,
                                    question_text: q.question_text,
                                    question_type: q.question_type,
                                    options: q.options || ['', '', '', ''],
                                    correct_option_index: q.correct_option_index ?? 0,
                                    correct_answer: q.correct_answer ?? '',
                                  })));
                                }
                                setActiveSection('capsules-form');
                              };
                              void editCapsule();
                            }}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePublishCapsule(capsule.id, !capsule.is_published)}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            {capsule.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCapsule(capsule.id)}
                            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:bg-rose-400"
                            disabled={deletingCapsuleId === capsule.id}
                          >
                            {deletingCapsuleId === capsule.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      {isAssigned && (
                        <div className="border-t border-gray-100 pt-3 space-y-4">
                          <h4 className="font-semibold text-sm text-gray-900">Manage Assignments for "{capsule.title}"</h4>
                          
                          {loadingAssignments ? (
                            <p className="text-xs text-gray-500">Loading assignments...</p>
                          ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                              {/* Class Assignments */}
                              <div className="space-y-2 border border-gray-150 p-3 rounded-lg bg-gray-50">
                                <span className="font-semibold text-xs text-gray-700 uppercase tracking-wider block">Class Assignments</span>
                                
                                <form onSubmit={handleAssignClass} className="flex gap-2">
                                  <select
                                    required
                                    value={assignClassId}
                                    onChange={(e) => setAssignClassId(e.target.value)}
                                    className="flex-1 rounded-md border border-gray-300 text-xs p-2 bg-white"
                                  >
                                    <option value="">Select a class...</option>
                                    {classes.filter(c => c.is_active).map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                  <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700">
                                    Assign Class
                                  </button>
                                </form>

                                <div className="mt-2 space-y-1">
                                  {currentClassAssignments.length === 0 ? (
                                    <p className="text-xs text-gray-500">No classes assigned.</p>
                                  ) : (
                                    currentClassAssignments.map(assign => (
                                      <div key={assign.id} className="flex justify-between items-center bg-white border border-gray-150 p-2 rounded-md">
                                        <span className="text-xs font-semibold text-gray-700">{assign.class?.name || 'Class'}</span>
                                        <button
                                          type="button"
                                          onClick={() => void handleRemoveClass(assign.class_id)}
                                          className="text-xs font-semibold text-red-600 hover:underline"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Student Assignments */}
                              <div className="space-y-2 border border-gray-150 p-3 rounded-lg bg-gray-50">
                                <span className="font-semibold text-xs text-gray-700 uppercase tracking-wider block">Student Assignments</span>
                                
                                <form onSubmit={handleAssignStudent} className="flex gap-2">
                                  <select
                                    required
                                    value={assignStudentId}
                                    onChange={(e) => setAssignStudentId(e.target.value)}
                                    className="flex-1 rounded-md border border-gray-300 text-xs p-2 bg-white"
                                  >
                                    <option value="">Select a student...</option>
                                    {students.map(s => (
                                      <option key={s.id} value={s.id}>{s.username}</option>
                                    ))}
                                  </select>
                                  <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700">
                                    Assign Student
                                  </button>
                                </form>

                                <div className="mt-2 space-y-1">
                                  {currentStudentAssignments.length === 0 ? (
                                    <p className="text-xs text-gray-500">No students assigned directly.</p>
                                  ) : (
                                    currentStudentAssignments.map(assign => (
                                      <div key={assign.id} className="flex justify-between items-center bg-white border border-gray-150 p-2 rounded-md">
                                        <span className="text-xs font-semibold text-gray-700">{assign.student?.username || 'Student'}</span>
                                        <button
                                          type="button"
                                          onClick={() => void handleRemoveStudent(assign.student_id)}
                                          className="text-xs font-semibold text-red-600 hover:underline"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        );
      case 'materials-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Manage Materials</h2>
              {editingMaterialId && <button type="button" onClick={resetMaterialForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}
            </div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleMaterialSubmit}>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Title *</label><input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={3} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">PDF URL</label><input value={contentUrl} onChange={(event) => setContentUrl(event.target.value)} placeholder="https://your-server.com/materials/file.pdf" className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Target Class</label><select value={selectedMaterialClassId} onChange={(event) => setSelectedMaterialClassId(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3"><option value="">All students (global)</option>{classes.filter((item) => item.is_active).map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}</select></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Tags (comma-separated)</label><input value={tagText} onChange={(event) => setTagText(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2 text-xs text-gray-500">Need to create classes first? Go to <a href="/admin/classes" className="font-semibold text-blue-700 hover:underline">Class Management</a>.</div>
              <div className="md:col-span-2"><button type="submit" disabled={savingMaterial} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingMaterial ? (<><InlineSpinner size={16} />Saving...</>) : editingMaterialId ? 'Update Material' : 'Create Material'}</button></div>
            </form>
          </article>
        );
      case 'daily-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="md:col-span-2"><button type="submit" disabled={savingDailyChallenge} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingDailyChallenge ? (<><InlineSpinner size={16} />Saving...</>) : editingDailyChallengeId ? 'Update Daily Challenge' : 'Create Daily Challenge'}</button></div>
            </form>
          </article>
        );
      case 'quest-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold text-gray-900">Manage Weekly Quests</h2>{editingQuestId && <button type="button" onClick={resetQuestForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}</div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleQuestSubmit}>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Quest Title *</label><input required value={questTitle} onChange={(event) => setQuestTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description *</label><textarea required value={questDescription} onChange={(event) => setQuestDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={2} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Type</label><select value={questType} onChange={(event) => setQuestType(event.target.value as 'words' | 'expressions' | 'points' | 'streak')} className="w-full rounded-lg border border-gray-300 p-3"><option value="words">Words</option><option value="expressions">Expressions</option><option value="points">Points</option><option value="streak">Streak</option></select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Target Value</label><input type="number" min={1} value={questTargetValue} onChange={(event) => setQuestTargetValue(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Reward Points</label><input type="number" min={0} value={questRewardPoints} onChange={(event) => setQuestRewardPoints(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label><input type="date" value={questStartDate} onChange={(event) => setQuestStartDate(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">End Date</label><input type="date" value={questEndDate} onChange={(event) => setQuestEndDate(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2 flex items-center gap-2"><input id="quest-active" type="checkbox" checked={questIsActive} onChange={(event) => setQuestIsActive(event.target.checked)} /><label htmlFor="quest-active" className="text-sm text-gray-700">Active</label></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingQuest} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingQuest ? (<><InlineSpinner size={16} />Saving...</>) : editingQuestId ? 'Update Quest' : 'Create Quest'}</button></div>
            </form>
          </article>
        );
      case 'materials-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Materials</h2>
            {loading ? <p className="mt-4 text-sm text-gray-600">Loading...</p> : materials.length === 0 ? <p className="mt-4 text-sm text-gray-600">No materials yet.</p> : (
              <div className="mt-4 space-y-3">{materials.map((material) => (<div key={material.id} className="rounded-lg border border-gray-200 p-3"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><p className="font-semibold text-gray-900">{material.title}</p><p className="mt-1 text-sm text-gray-600 break-words">{material.description || 'No description provided.'}</p><p className="mt-1 text-xs text-blue-600 break-all">{material.content_url || 'No PDF URL attached.'}</p><p className="mt-1 text-xs text-gray-500">Class: {material.class_id ? (classes.find((item) => item.id === material.class_id)?.name ?? 'Class-only') : 'All students'}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingMaterialId(material.id); setTitle(material.title); setDescription(material.description ?? ''); setContentUrl(material.content_url ?? ''); setSelectedMaterialClassId(material.class_id ?? ''); setTagText((material.tags ?? []).join(', ')); setActiveSection('materials-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">Edit</button><button type="button" onClick={() => void handleDeleteMaterial(material.id)} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:bg-rose-400" disabled={deletingMaterialId === material.id}>{deletingMaterialId === material.id ? (<><InlineSpinner size={12} />Deleting...</>) : 'Delete'}</button></div></div></div>))}</div>
            )}
          </article>
        );
      case 'daily-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Daily Challenges</h2>
            {dailyChallenges.length === 0 ? <p className="mt-4 text-sm text-gray-600">No daily challenges yet.</p> : (
              <div className="mt-4 space-y-3">{dailyChallenges.map((challenge) => (<div key={challenge.id} className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-900">{challenge.title}</p><p className="text-sm text-gray-600">{challenge.description}</p><p className="mt-1 text-xs text-blue-700">{challenge.challenge_date} | {challenge.challenge_type} target {challenge.target_value} | +{challenge.reward_points} pts</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingDailyChallengeId(challenge.id); setChallengeTitle(challenge.title); setChallengeDescription(challenge.description); setChallengeDate(challenge.challenge_date); setChallengeType(challenge.challenge_type); setChallengeTargetValue(challenge.target_value); setChallengeRewardPoints(challenge.reward_points); setChallengeIsActive(challenge.is_active); setActiveSection('daily-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void handleDeleteDailyChallenge(challenge.id)} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={deletingChallengeId === challenge.id}>{deletingChallengeId === challenge.id ? (<><InlineSpinner size={12} />Deleting...</>) : 'Delete'}</button></div></div>))}</div>
            )}
          </article>
        );
      case 'quest-list':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Quests</h2>
            {quests.length === 0 ? <p className="mt-4 text-sm text-gray-600">No quests yet.</p> : (
              <div className="mt-4 space-y-3">{quests.map((quest) => (<div key={quest.id} className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-900">{quest.title}</p><p className="text-sm text-gray-600">{quest.description}</p><p className="mt-1 text-xs text-blue-700">{quest.target_type} target {quest.target_value} | +{quest.reward_points} pts</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingQuestId(quest.id); setQuestTitle(quest.title); setQuestDescription(quest.description); setQuestType(quest.target_type); setQuestTargetValue(quest.target_value); setQuestRewardPoints(quest.reward_points); setQuestStartDate(quest.start_date ?? todayIso()); setQuestEndDate(quest.end_date ?? ''); setQuestIsActive(quest.is_active); setActiveSection('quest-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void handleDeleteQuest(quest.id)} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={deletingQuestId === quest.id}>{deletingQuestId === quest.id ? (<><InlineSpinner size={12} />Deleting...</>) : 'Delete'}</button></div></div>))}</div>
            )}
          </article>
        );
      case 'teams-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold text-gray-900">Manage Teams</h2>{editingTeamId && <button type="button" onClick={resetTeamForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}</div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleTeamSubmit}>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Team Name *</label><input required value={teamName} onChange={(event) => setTeamName(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Color</label><input type="color" value={teamColorHex} onChange={(event) => setTeamColorHex(event.target.value)} className="h-12 w-full rounded-lg border border-gray-300 p-2" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description</label><textarea value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={2} /></div>
              <div className="md:col-span-2 flex items-center gap-2"><input id="team-active" type="checkbox" checked={teamIsActive} onChange={(event) => setTeamIsActive(event.target.checked)} /><label htmlFor="team-active" className="text-sm text-gray-700">Active</label></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingTeam} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingTeam ? (<><InlineSpinner size={16} />Saving...</>) : editingTeamId ? 'Update Team' : 'Create Team'}</button></div>
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
                  <button type="submit" disabled={assigningMember || !selectedTeamId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{assigningMember ? (<><InlineSpinner size={16} />Assigning...</>) : 'Assign'}</button>
                </form>
                <div className="space-y-2">
                  {teamMembers.length === 0 ? <p className="text-sm text-gray-600">No members in this team yet.</p> : teamMembers.map((member) => {
                    const student = students.find((item) => item.id === member.student_id);
                    return (
                      <div key={member.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          {student?.avatar_url ? (
                            <Image
                              src={student.avatar_url}
                              alt={student.username ?? 'Student'}
                              width={28}
                              height={28}
                              sizes="28px"
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                              {((student?.username ?? member.student_id).charAt(0) || 'S').toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{student?.username ?? member.student_id.slice(0, 8)}</p>
                            <p className="text-xs text-gray-600">{member.role} | {student?.points ?? 0} pts</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => void handleRemoveMember(member.student_id)} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={removingMemberStudentId === member.student_id}>{removingMemberStudentId === member.student_id ? (<><InlineSpinner size={12} />Removing...</>) : 'Remove'}</button>
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
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                  {(() => {
                    const selected = students.find((student) => student.id === selectedStudentId);
                    return selected?.avatar_url ? (
                      <Image
                        src={selected.avatar_url}
                        alt={selected.username ?? 'Student'}
                        width={28}
                        height={28}
                        sizes="28px"
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                        {((selected?.username ?? selectedStudentId).charAt(0) || 'S').toUpperCase()}
                      </span>
                    );
                  })()}
                  <p className="text-sm font-semibold text-gray-800">
                    {students.find((student) => student.id === selectedStudentId)?.username ?? selectedStudentId.slice(0, 8)}
                  </p>
                </div>
                <div className="mt-4 grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_180px_auto_auto_auto] lg:items-end">
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
              <div className="mt-4 space-y-3">{teams.map((team) => (<div key={team.id} className="rounded-lg border border-gray-200 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold text-gray-900">{team.name}</p><p className="text-sm text-gray-600 break-words">{team.description || 'No description.'}</p><div className="mt-1 inline-flex items-center gap-2 text-xs text-gray-600"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color_hex ?? '#2563eb' }} />{team.is_active ? 'Active' : 'Inactive'}</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingTeamId(team.id); setTeamName(team.name); setTeamDescription(team.description ?? ''); setTeamColorHex(team.color_hex ?? '#2563eb'); setTeamIsActive(team.is_active); setActiveSection('teams-form'); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void handleDeleteTeam(team.id)} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400" disabled={deletingTeamId === team.id}>{deletingTeamId === team.id ? (<><InlineSpinner size={12} />Deleting...</>) : 'Delete'}</button></div></div></div>))}</div>
            )}
          </article>
        );
      case 'announcements-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Class Announcement</h2>
            {announcementSuccess && (
              <div className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                Announcement sent successfully to all students in the class!
              </div>
            )}
            {announcementError && (
              <div className="mb-4 rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                {announcementError}
              </div>
            )}
            <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Select Class *</label>
                <select
                  required
                  value={announcementClassId}
                  onChange={(event) => setAnnouncementClassId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 bg-white"
                >
                  <option value="">-- Choose a Class --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
                <input
                  required
                  value={announcementTitle}
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                  placeholder="e.g. Test Tomorrow or Reminder"
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Message *</label>
                <textarea
                  required
                  value={announcementBody}
                  onChange={(event) => setAnnouncementBody(event.target.value)}
                  placeholder="Type your announcement details here..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>
              <button
                type="submit"
                disabled={sendingAnnouncement}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
              >
                {sendingAnnouncement ? (
                  <>
                    <InlineSpinner size={16} /> Sending...
                  </>
                ) : (
                  'Send Announcement'
                )}
              </button>
            </form>
          </article>
        );
      case 'boosts-form':
        return (
          <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold text-gray-900">Teacher Boosts</h2>{editingBoostId && <button type="button" onClick={resetBoostForm} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs">Cancel Edit</button>}</div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleBoostSubmit}>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Title *</label><input required value={boostTitle} onChange={(event) => setBoostTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Type</label><select value={boostType} onChange={(event) => setBoostType(event.target.value as 'double_xp' | 'bonus_flat')} className="w-full rounded-lg border border-gray-300 p-3"><option value="double_xp">Double XP (Multiplier)</option><option value="bonus_flat">Flat Bonus</option></select></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Description</label><textarea value={boostDescription} onChange={(event) => setBoostDescription(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" rows={2} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Multiplier</label><input type="number" min={1} step={0.1} value={boostMultiplier} onChange={(event) => setBoostMultiplier(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" disabled={boostType !== 'double_xp'} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Flat Bonus</label><input type="number" min={0} value={boostFlatBonus} onChange={(event) => setBoostFlatBonus(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 p-3" disabled={boostType !== 'bonus_flat'} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Starts At</label><input type="datetime-local" value={boostStartsAt} onChange={(event) => setBoostStartsAt(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Ends At</label><input type="datetime-local" value={boostEndsAt} onChange={(event) => setBoostEndsAt(event.target.value)} className="w-full rounded-lg border border-gray-300 p-3" /></div>
              <div className="md:col-span-2 flex items-center gap-2"><input id="boost-active" type="checkbox" checked={boostIsActive} onChange={(event) => setBoostIsActive(event.target.checked)} /><label htmlFor="boost-active" className="text-sm text-gray-700">Active</label></div>
              <div className="md:col-span-2"><button type="submit" disabled={savingBoost} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-blue-400">{savingBoost ? (<><InlineSpinner size={16} />Saving...</>) : editingBoostId ? 'Update Boost' : 'Create Boost'}</button></div>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                      <div className="flex flex-wrap gap-2">
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
                          className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white disabled:bg-rose-400"
                          disabled={deletingBoostId === boost.id}
                        >
                          {deletingBoostId === boost.id ? (<><InlineSpinner size={12} />Deleting...</>) : 'Delete'}
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

  if (authLoading) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
          Loading teacher dashboard...
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl bg-white p-6 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200">
          <p className="font-semibold text-gray-900">You must be signed in to access teacher mode.</p>
          <p className="mt-1 text-gray-600">Please log in with a teacher account.</p>
        </div>
      </section>
    );
  }

  if (!canAccessTeacher) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl bg-white p-6 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200">
          <p className="font-semibold text-gray-900">Teacher mode is restricted.</p>
          <p className="mt-1 text-gray-600">
            Your account role is <span className="font-semibold">{profile.role ?? 'student'}</span>. Ask an admin to upgrade
            your role to teacher to access this area.
          </p>
        </div>
      </section>
    );
  }

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
      {showPreviewModal && previewCapsule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Teacher Preview: Student View Simulation</h3>
                <p className="text-xs text-gray-500">Test how the lesson and quiz look for your students.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 font-semibold text-sm"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 text-left">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {previewCapsule.topic}
                  </span>
                  <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase">
                    {previewCapsule.media_type} Lesson
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-gray-900 md:text-2xl mt-2">{previewCapsule.title}</h2>
                {previewCapsule.description && (
                  <p className="text-sm text-gray-600 mt-1">{previewCapsule.description}</p>
                )}
              </div>

              {/* Media Section */}
              <div className="overflow-hidden rounded-xl bg-slate-900 max-h-[300px]">
                {previewCapsule.media_type === 'image' && previewCapsule.media_url && (
                  <img
                    src={previewCapsule.media_url}
                    alt="Preview media"
                    className="mx-auto max-h-[300px] w-full object-contain"
                  />
                )}
                {previewCapsule.media_type === 'video' && previewCapsule.media_url && (
                  <div className="aspect-video w-full max-h-[300px]">
                    <iframe
                      src={getEmbedUrl(previewCapsule.media_url)}
                      title="Preview video"
                      className="h-full w-full border-none"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {previewCapsule.media_type === 'audio' && previewCapsule.media_url && (
                  <div className="p-6 bg-slate-800 flex justify-center items-center">
                    <audio controls className="w-full max-w-md">
                      <source src={previewCapsule.media_url} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                {previewCapsule.media_type === 'document' && previewCapsule.media_url && (
                  <div className="p-6 bg-slate-800 text-center space-y-2">
                    <p className="text-white font-semibold text-sm">Attached PDF Lesson Material</p>
                    <a
                      href={previewCapsule.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-700"
                    >
                      Open Document in New Tab
                    </a>
                  </div>
                )}
              </div>

              {/* Lesson Text */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-500 mb-2">Lesson</h3>
                <div className="text-gray-800 text-sm md:text-base leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: previewCapsule.content_text }} />
              </div>

              {/* Quiz section */}
              <div className="border-t border-gray-150 pt-5 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Quiz (Simulator)</h3>
                
                {previewQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No quiz questions added yet.</p>
                ) : (
                  <div className="space-y-4">
                    {previewQuestions.map((q, idx) => {
                      const answer = previewSelectedAnswers[idx];
                      return (
                        <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                          <p className="font-semibold text-sm text-gray-800">
                            Q{idx + 1}. {q.question_text || 'Untitled Question'}
                          </p>

                          {q.question_type === 'fill_blank' ? (
                            <input
                              type="text"
                              value={answer?.textAnswer || ''}
                              onChange={(e) => {
                                setPreviewSelectedAnswers({
                                  ...previewSelectedAnswers,
                                  [idx]: { textAnswer: e.target.value }
                                });
                              }}
                              placeholder="Type your answer here..."
                              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white"
                            />
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(q.options || []).map((option, optIdx) => {
                                const isSelected = answer?.optionIndex === optIdx;
                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => {
                                      setPreviewSelectedAnswers({
                                        ...previewSelectedAnswers,
                                        [idx]: { optionIndex: optIdx }
                                      });
                                    }}
                                    className={`text-left p-3 rounded-lg border text-xs font-semibold transition ${
                                      isSelected
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                                    }`}
                                  >
                                    {option || `Option ${optIdx + 1}`}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {previewResult ? (
                      <div className={`p-4 rounded-xl flex items-start gap-3 ${previewResult.passed ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                        <div className="space-y-1">
                          <p className="font-bold text-sm">
                            {previewResult.passed ? 'Passed! Score is 80%+' : 'Failed! Score is under 80%'}
                          </p>
                          <p className="text-xs">
                            Correct: {previewResult.score} / {previewResult.total}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewSelectedAnswers({});
                              setPreviewResult(null);
                            }}
                            className="mt-2 text-xs font-bold underline cursor-pointer"
                          >
                            Reset Simulator
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          let correct = 0;
                          previewQuestions.forEach((q, idx) => {
                            const answer = previewSelectedAnswers[idx];
                            if (q.question_type === 'fill_blank') {
                              const sAns = (answer?.textAnswer || '').toLowerCase().trim();
                              const cAns = (q.correct_answer || '').toLowerCase().trim();
                              if (sAns && sAns === cAns) correct++;
                            } else {
                              if (answer?.optionIndex === q.correct_option_index) correct++;
                            }
                          });
                          const total = previewQuestions.length;
                          const passed = total > 0 ? (correct / total) >= 0.8 : false;
                          setPreviewResult({ score: correct, total, passed });
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition cursor-pointer"
                      >
                        Submit Answers (Simulation)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
