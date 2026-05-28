-- Education Capsules Database Migration Schema

-- 1. Create capsules table
CREATE TABLE IF NOT EXISTS education_capsules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'document', 'audio')),
  media_url TEXT NOT NULL,
  content_text TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 50 CHECK (reward_points >= 0),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create quiz questions table
CREATE TABLE IF NOT EXISTS capsule_quiz_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  capsule_id UUID NOT NULL REFERENCES education_capsules(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'fill_blank', 'true_false')),
  options TEXT[], -- array of options for MCQ/True-False
  correct_option_index INTEGER, -- index for MCQ/True-False
  correct_answer TEXT, -- string match for fill_blank
  order_index INTEGER NOT NULL DEFAULT 0
);

-- 3. Create class assignments table
CREATE TABLE IF NOT EXISTS capsule_class_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  capsule_id UUID NOT NULL REFERENCES education_capsules(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(capsule_id, class_id)
);

-- 4. Create student assignments table
CREATE TABLE IF NOT EXISTS capsule_student_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  capsule_id UUID NOT NULL REFERENCES education_capsules(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(capsule_id, student_id)
);

-- 5. Create capsule completions table
CREATE TABLE IF NOT EXISTS capsule_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  capsule_id UUID NOT NULL REFERENCES education_capsules(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  completed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(capsule_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS education_capsules_created_by_idx ON education_capsules(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS education_capsules_published_idx ON education_capsules(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS capsule_quiz_questions_capsule_idx ON capsule_quiz_questions(capsule_id, order_index);
CREATE INDEX IF NOT EXISTS capsule_class_assignments_capsule_idx ON capsule_class_assignments(capsule_id);
CREATE INDEX IF NOT EXISTS capsule_class_assignments_class_idx ON capsule_class_assignments(class_id);
CREATE INDEX IF NOT EXISTS capsule_student_assignments_student_idx ON capsule_student_assignments(student_id);
CREATE INDEX IF NOT EXISTS capsule_completions_student_idx ON capsule_completions(student_id, completed_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE education_capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsule_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsule_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsule_student_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsule_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Education Capsules
DROP POLICY IF EXISTS "education_capsules_select" ON education_capsules;
CREATE POLICY "education_capsules_select" ON education_capsules
  FOR SELECT USING (
    created_by = auth.uid()
    OR is_published = true
  );

DROP POLICY IF EXISTS "education_capsules_modify" ON education_capsules;
CREATE POLICY "education_capsules_modify" ON education_capsules
  FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Capsule Quiz Questions
DROP POLICY IF EXISTS "capsule_quiz_questions_select" ON capsule_quiz_questions;
CREATE POLICY "capsule_quiz_questions_select" ON capsule_quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM education_capsules ec
      WHERE ec.id = capsule_quiz_questions.capsule_id
        AND (ec.created_by = auth.uid() OR ec.is_published = true)
    )
  );

DROP POLICY IF EXISTS "capsule_quiz_questions_modify" ON capsule_quiz_questions;
CREATE POLICY "capsule_quiz_questions_modify" ON capsule_quiz_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM education_capsules ec
      WHERE ec.id = capsule_quiz_questions.capsule_id AND ec.created_by = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_capsules ec
      WHERE ec.id = capsule_quiz_questions.capsule_id AND ec.created_by = auth.uid()
    )
  );

-- Capsule Class Assignments
DROP POLICY IF EXISTS "capsule_class_assignments_select" ON capsule_class_assignments;
CREATE POLICY "capsule_class_assignments_select" ON capsule_class_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes c WHERE c.id = capsule_class_assignments.class_id AND c.teacher_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM class_memberships cm WHERE cm.class_id = capsule_class_assignments.class_id AND cm.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "capsule_class_assignments_modify" ON capsule_class_assignments;
CREATE POLICY "capsule_class_assignments_modify" ON capsule_class_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM education_capsules ec WHERE ec.id = capsule_class_assignments.capsule_id AND ec.created_by = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_capsules ec WHERE ec.id = capsule_class_assignments.capsule_id AND ec.created_by = auth.uid()
    )
  );

-- Capsule Student Assignments
DROP POLICY IF EXISTS "capsule_student_assignments_select" ON capsule_student_assignments;
CREATE POLICY "capsule_student_assignments_select" ON capsule_student_assignments
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM education_capsules ec WHERE ec.id = capsule_student_assignments.capsule_id AND ec.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "capsule_student_assignments_modify" ON capsule_student_assignments;
CREATE POLICY "capsule_student_assignments_modify" ON capsule_student_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM education_capsules ec WHERE ec.id = capsule_student_assignments.capsule_id AND ec.created_by = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_capsules ec WHERE ec.id = capsule_student_assignments.capsule_id AND ec.created_by = auth.uid()
    )
  );

-- Capsule Completions
DROP POLICY IF EXISTS "capsule_completions_select" ON capsule_completions;
CREATE POLICY "capsule_completions_select" ON capsule_completions
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM education_capsules ec WHERE ec.id = capsule_completions.capsule_id AND ec.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "capsule_completions_modify" ON capsule_completions;
CREATE POLICY "capsule_completions_modify" ON capsule_completions
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
