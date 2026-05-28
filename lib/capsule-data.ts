import { supabase } from '@/lib/supabase';
import { awardStudentPoints } from '@/lib/student-data';
import { syncStudentBadges } from '@/lib/badges-service';
import type { EducationCapsule, CapsuleQuizQuestion, CapsuleClassAssignment, CapsuleStudentAssignment, CapsuleCompletion } from '@/types';
import { createNotification, sendBulkClassNotification } from './notifications-data';

// ==========================================
// TEACHER CRUD OPERATIONS
// ==========================================

export const getTeacherCapsules = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('education_capsules')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  return { data: (data as EducationCapsule[] | null) ?? [], error };
};

export const createCapsule = async ({
  title,
  topic,
  description,
  mediaType,
  mediaUrl,
  contentText,
  rewardPoints = 50,
  isPublished = false,
  createdBy,
}: {
  title: string;
  topic: string;
  description?: string;
  mediaType: 'image' | 'video' | 'document' | 'audio';
  mediaUrl: string;
  contentText: string;
  rewardPoints?: number;
  isPublished?: boolean;
  createdBy: string;
}) => {
  const { data, error } = await supabase
    .from('education_capsules')
    .insert({
      title,
      topic,
      description: description || null,
      media_type: mediaType,
      media_url: mediaUrl,
      content_text: contentText,
      reward_points: rewardPoints,
      is_published: isPublished,
      created_by: createdBy,
    })
    .select()
    .single();

  return { data: (data as EducationCapsule | null) ?? null, error };
};

export const updateCapsule = async ({
  id,
  title,
  topic,
  description,
  mediaType,
  mediaUrl,
  contentText,
  rewardPoints,
  isPublished,
  createdBy,
}: {
  id: string;
  title: string;
  topic: string;
  description?: string;
  mediaType: 'image' | 'video' | 'document' | 'audio';
  mediaUrl: string;
  contentText: string;
  rewardPoints: number;
  isPublished: boolean;
  createdBy: string;
}) => {
  const { data, error } = await supabase
    .from('education_capsules')
    .update({
      title,
      topic,
      description: description || null,
      media_type: mediaType,
      media_url: mediaUrl,
      content_text: contentText,
      reward_points: rewardPoints,
      is_published: isPublished,
    })
    .eq('id', id)
    .eq('created_by', createdBy)
    .select()
    .single();

  return { data: (data as EducationCapsule | null) ?? null, error };
};

export const deleteCapsule = async (id: string, createdBy: string) => {
  const { error } = await supabase
    .from('education_capsules')
    .delete()
    .eq('id', id)
    .eq('created_by', createdBy);

  return { error };
};

export const publishCapsule = async (id: string, createdBy: string, isPublished: boolean) => {
  const { data, error } = await supabase
    .from('education_capsules')
    .update({ is_published: isPublished })
    .eq('id', id)
    .eq('created_by', createdBy)
    .select()
    .single();

  return { data: (data as EducationCapsule | null) ?? null, error };
};

// ==========================================
// QUIZ QUESTIONS OPERATIONS
// ==========================================

export const getCapsuleQuestions = async (capsuleId: string) => {
  const { data, error } = await supabase
    .from('capsule_quiz_questions')
    .select('*')
    .eq('capsule_id', capsuleId)
    .order('order_index', { ascending: true });

  return { data: (data as CapsuleQuizQuestion[] | null) ?? [], error };
};

export const setCapsuleQuestions = async (
  capsuleId: string,
  questions: Array<Omit<CapsuleQuizQuestion, 'id' | 'capsule_id'>>
) => {
  // First delete existing questions
  const { error: deleteError } = await supabase
    .from('capsule_quiz_questions')
    .delete()
    .eq('capsule_id', capsuleId);

  if (deleteError) {
    return { error: deleteError };
  }

  if (questions.length === 0) {
    return { error: null };
  }

  // Then insert the new ones
  const rowsToInsert = questions.map((q, index) => ({
    capsule_id: capsuleId,
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options || null,
    correct_option_index: q.correct_option_index !== undefined ? q.correct_option_index : null,
    correct_answer: q.correct_answer || null,
    order_index: index,
  }));

  const { data, error: insertError } = await supabase
    .from('capsule_quiz_questions')
    .insert(rowsToInsert)
    .select();

  return { data: (data as CapsuleQuizQuestion[] | null) ?? [], error: insertError };
};

// ==========================================
// ASSIGNMENT OPERATIONS
// ==========================================

export const assignCapsuleToClass = async (capsuleId: string, classId: string) => {
  const { data, error } = await supabase
    .from('capsule_class_assignments')
    .insert({ capsule_id: capsuleId, class_id: classId })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  const { data: capsule } = await supabase
    .from('education_capsules')
    .select('title, created_by')
    .eq('id', capsuleId)
    .single();

  if (capsule) {
    const { error: notifError } = await sendBulkClassNotification({
      classId,
      senderId: capsule.created_by,
      type: 'capsule',
      title: 'New Capsule Assigned',
      body: `Your teacher assigned the capsule: "${capsule.title}"`,
      link: `/capsules/${capsuleId}`,
    });
    if (notifError) {
      console.error('Failed to send class notifications:', notifError);
    }
  }

  return { data: data as CapsuleClassAssignment, error: null };
};

export const removeCapsuleFromClass = async (capsuleId: string, classId: string) => {
  const { error } = await supabase
    .from('capsule_class_assignments')
    .delete()
    .eq('capsule_id', capsuleId)
    .eq('class_id', classId);

  return { error };
};

export const assignCapsuleToStudent = async (capsuleId: string, studentId: string) => {
  const { data, error } = await supabase
    .from('capsule_student_assignments')
    .insert({ capsule_id: capsuleId, student_id: studentId })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  const { data: capsule } = await supabase
    .from('education_capsules')
    .select('title, created_by')
    .eq('id', capsuleId)
    .single();

  if (capsule) {
    const { error: notifError } = await createNotification({
      recipientId: studentId,
      senderId: capsule.created_by,
      type: 'capsule',
      title: 'New Capsule Assigned',
      body: `Your teacher assigned you the capsule: "${capsule.title}"`,
      link: `/capsules/${capsuleId}`,
    });
    if (notifError) {
      console.error('Failed to create student notification:', notifError);
    }
  }

  return { data: data as CapsuleStudentAssignment, error: null };
};

export const removeCapsuleFromStudent = async (capsuleId: string, studentId: string) => {
  const { error } = await supabase
    .from('capsule_student_assignments')
    .delete()
    .eq('capsule_id', capsuleId)
    .eq('student_id', studentId);

  return { error };
};

export const getCapsuleAssignments = async (capsuleId: string) => {
  const [classesRes, studentsRes] = await Promise.all([
    supabase
      .from('capsule_class_assignments')
      .select('*, class:classes(id, name)')
      .eq('capsule_id', capsuleId),
    supabase
      .from('capsule_student_assignments')
      .select('*, student:profiles(id, username)')
      .eq('capsule_id', capsuleId),
  ]);

  return {
    classAssignments: (classesRes.data as Array<CapsuleClassAssignment & { class: { id: string; name: string } }> | null) ?? [],
    studentAssignments: (studentsRes.data as Array<CapsuleStudentAssignment & { student: { id: string; username: string } }> | null) ?? [],
    error: classesRes.error || studentsRes.error,
  };
};

// ==========================================
// STUDENT VIEW & COMPLETION OPERATIONS
// ==========================================

export const getStudentCapsules = async (studentId: string) => {
  // 1. Get class memberships of student
  const { data: memberships, error: memberError } = await supabase
    .from('class_memberships')
    .select('class_id')
    .eq('student_id', studentId);

  if (memberError) {
    return { data: [], error: memberError };
  }

  const classIds = memberships?.map((m) => m.class_id) || [];

  // 2. Fetch class assignments for student's classes
  let classCapsuleIds: string[] = [];
  if (classIds.length > 0) {
    const { data: classAssigns } = await supabase
      .from('capsule_class_assignments')
      .select('capsule_id')
      .in('class_id', classIds);
    classCapsuleIds = classAssigns?.map((a) => a.capsule_id) || [];
  }

  // 3. Fetch direct student assignments
  const { data: studentAssigns, error: assignError } = await supabase
    .from('capsule_student_assignments')
    .select('capsule_id')
    .eq('student_id', studentId);

  if (assignError) {
    return { data: [], error: assignError };
  }

  const studentCapsuleIds = studentAssigns?.map((a) => a.capsule_id) || [];

  // Union unique capsule IDs
  const allCapsuleIds = Array.from(new Set([...classCapsuleIds, ...studentCapsuleIds]));

  if (allCapsuleIds.length === 0) {
    return { data: [], error: null };
  }

  // 4. Fetch the published capsules
  const { data: capsules, error: capsuleError } = await supabase
    .from('education_capsules')
    .select('*, creator:profiles!education_capsules_created_by_fkey(id, username)')
    .in('id', allCapsuleIds)
    .eq('is_published', true);

  if (capsuleError) {
    return { data: [], error: capsuleError };
  }

  // 5. Fetch completions for this student
  const { data: completions } = await supabase
    .from('capsule_completions')
    .select('*')
    .eq('student_id', studentId);

  const completionsMap = new Map<string, CapsuleCompletion>(
    (completions as CapsuleCompletion[] | null)?.map((c) => [c.capsule_id, c]) || []
  );

  // Combine
  const enrichedCapsules = (capsules as Array<EducationCapsule & { creator?: { username: string } }>).map((capsule) => {
    const completion = completionsMap.get(capsule.id) || null;
    return {
      ...capsule,
      completion,
    };
  });

  return { data: enrichedCapsules, error: null };
};

export const getCapsuleForViewing = async (capsuleId: string, studentId: string) => {
  const [capsuleRes, questionsRes, completionRes] = await Promise.all([
    supabase
      .from('education_capsules')
      .select('*')
      .eq('id', capsuleId)
      .maybeSingle(),
    supabase
      .from('capsule_quiz_questions')
      .select('*')
      .eq('capsule_id', capsuleId)
      .order('order_index', { ascending: true }),
    supabase
      .from('capsule_completions')
      .select('*')
      .eq('capsule_id', capsuleId)
      .eq('student_id', studentId)
      .maybeSingle(),
  ]);

  if (capsuleRes.error) {
    return { data: null, error: capsuleRes.error };
  }

  return {
    data: {
      capsule: capsuleRes.data as EducationCapsule,
      questions: (questionsRes.data as CapsuleQuizQuestion[]) || [],
      completion: (completionRes.data as CapsuleCompletion) || null,
    },
    error: null,
  };
};

export const submitCapsuleCompletion = async ({
  studentId,
  capsuleId,
  score,
  totalQuestions,
}: {
  studentId: string;
  capsuleId: string;
  score: number;
  totalQuestions: number;
}) => {
  // Pass threshold is 80%
  const passingScoreThreshold = 0.8;
  const isPassed = totalQuestions > 0 ? (score / totalQuestions) >= passingScoreThreshold : false;

  // Check if student has already completed and passed this capsule
  const { data: previousCompletion, error: selectError } = await supabase
    .from('capsule_completions')
    .select('passed, points_awarded')
    .eq('capsule_id', capsuleId)
    .eq('student_id', studentId)
    .maybeSingle();

  const wasAlreadyPassed = previousCompletion?.passed ?? false;
  const pointsToAward = (isPassed && !wasAlreadyPassed) ? 50 : 0;

  // Upsert completion record
  const { data, error: upsertError } = await supabase
    .from('capsule_completions')
    .upsert({
      capsule_id: capsuleId,
      student_id: studentId,
      score,
      total_questions: totalQuestions,
      passed: isPassed || wasAlreadyPassed,
      points_awarded: wasAlreadyPassed ? (previousCompletion?.points_awarded ?? 50) : pointsToAward,
      completed_at: new Date().toISOString(),
    }, {
      onConflict: 'capsule_id,student_id'
    })
    .select()
    .single();

  if (upsertError) {
    return { data: null, error: upsertError };
  }

  // Award points if passed for the first time
  let awardedPointsInfo = null;
  if (pointsToAward > 0) {
    awardedPointsInfo = await awardStudentPoints(studentId, pointsToAward);
    await syncStudentBadges(studentId);
  }

  // Trigger notification to the teacher who created the capsule
  const { data: capsule } = await supabase
    .from('education_capsules')
    .select('title, created_by')
    .eq('id', capsuleId)
    .single();

  if (capsule) {
    const { data: student } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', studentId)
      .single();

    const studentName = student?.username || 'A student';

    const { error: notifError } = await createNotification({
      recipientId: capsule.created_by,
      senderId: studentId,
      type: 'capsule',
      title: 'Capsule Completed',
      body: `${studentName} completed "${capsule.title}" (Score: ${score}/${totalQuestions})`,
      link: '/admin/dashboard',
    });
    if (notifError) {
      console.error('Failed to create completion notification:', notifError);
    }
  }

  return {
    data: data as CapsuleCompletion,
    error: null,
    passed: isPassed,
    pointsAwarded: pointsToAward,
    awardedPointsInfo,
  };
};
