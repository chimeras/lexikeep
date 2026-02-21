CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE,
  role TEXT DEFAULT 'student',
  points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_url TEXT,
  teacher_id UUID REFERENCES profiles(id),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  normalized_word TEXT,
  definition TEXT NOT NULL,
  example_sentence TEXT,
  image_url TEXT,
  student_id UUID REFERENCES profiles(id),
  material_id UUID REFERENCES materials(id),
  difficulty TEXT DEFAULT 'medium',
  category TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'learning',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expressions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expression TEXT NOT NULL,
  normalized_expression TEXT,
  meaning TEXT NOT NULL,
  context TEXT,
  student_id UUID REFERENCES profiles(id),
  material_id UUID REFERENCES materials(id),
  usage_example TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  rules JSONB,
  teacher_id UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS competition_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES competitions(id),
  student_id UUID REFERENCES profiles(id),
  words_collected INTEGER DEFAULT 0,
  expressions_collected INTEGER DEFAULT 0,
  last_activity TIMESTAMP DEFAULT NOW(),
  UNIQUE(competition_id, student_id)
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_date DATE NOT NULL UNIQUE,
  challenge_type TEXT DEFAULT 'words',
  target_value INTEGER DEFAULT 1,
  reward_points INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_type TEXT DEFAULT 'words',
  target_value INTEGER DEFAULT 5,
  reward_points INTEGER DEFAULT 40,
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('vocabulary', 'expression')),
  source_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  context_hint TEXT,
  status TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('learning', 'mastered')),
  due_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMP,
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days >= 1),
  ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50 CHECK (ease_factor >= 1.30 AND ease_factor <= 3.50),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS review_items_student_due_idx ON review_items(student_id, due_at);
CREATE INDEX IF NOT EXISTS review_items_student_status_idx ON review_items(student_id, status);

CREATE OR REPLACE FUNCTION set_review_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_review_items_updated_at ON review_items;
CREATE TRIGGER trg_set_review_items_updated_at
BEFORE UPDATE ON review_items
FOR EACH ROW
EXECUTE FUNCTION set_review_items_updated_at();

CREATE TABLE IF NOT EXISTS duels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  winner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS duel_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  UNIQUE(duel_id, student_id)
);

CREATE TABLE IF NOT EXISTS duel_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  prompt TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(duel_id, round_number)
);

CREATE TABLE IF NOT EXISTS duel_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES duel_rounds(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  response_time_ms INTEGER,
  points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(round_id, student_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color_hex TEXT DEFAULT '#2563eb',
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'captain')),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, student_id),
  UNIQUE(student_id)
);

CREATE TABLE IF NOT EXISTS teacher_boosts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  boost_type TEXT NOT NULL DEFAULT 'double_xp' CHECK (boost_type IN ('double_xp', 'bonus_flat')),
  multiplier NUMERIC(4,2) NOT NULL DEFAULT 2.00 CHECK (multiplier >= 1.00 AND multiplier <= 10.00),
  flat_bonus INTEGER NOT NULL DEFAULT 0 CHECK (flat_bonus >= 0),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS daily_challenge_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE SET NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(challenge_id, student_id)
);

CREATE TABLE IF NOT EXISTS stream_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stream_post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES stream_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS stream_post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES stream_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 280),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stream_user_mutes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, muted_user_id),
  CHECK (user_id <> muted_user_id)
);

ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS normalized_word TEXT;

ALTER TABLE expressions
  ADD COLUMN IF NOT EXISTS normalized_expression TEXT;

CREATE OR REPLACE FUNCTION normalize_lexikeep_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(
    regexp_replace(
      regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9\s]', ' ', 'g'),
      '\s+',
      ' ',
      'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_vocabulary_normalized_word()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_word = normalize_lexikeep_text(NEW.word);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_vocabulary_normalized_word ON vocabulary;
CREATE TRIGGER trg_set_vocabulary_normalized_word
BEFORE INSERT OR UPDATE OF word ON vocabulary
FOR EACH ROW
EXECUTE FUNCTION set_vocabulary_normalized_word();

CREATE OR REPLACE FUNCTION set_expression_normalized_expression()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_expression = normalize_lexikeep_text(NEW.expression);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_expression_normalized_expression ON expressions;
CREATE TRIGGER trg_set_expression_normalized_expression
BEFORE INSERT OR UPDATE OF expression ON expressions
FOR EACH ROW
EXECUTE FUNCTION set_expression_normalized_expression();

UPDATE vocabulary
SET normalized_word = normalize_lexikeep_text(word)
WHERE normalized_word IS NULL OR normalized_word = '';

UPDATE expressions
SET normalized_expression = normalize_lexikeep_text(expression)
WHERE normalized_expression IS NULL OR normalized_expression = '';

CREATE INDEX IF NOT EXISTS duels_status_created_idx ON duels(status, created_at DESC);
CREATE INDEX IF NOT EXISTS duel_participants_student_idx ON duel_participants(student_id);
CREATE INDEX IF NOT EXISTS duel_rounds_duel_round_idx ON duel_rounds(duel_id, round_number);
CREATE INDEX IF NOT EXISTS duel_answers_student_duel_idx ON duel_answers(student_id, duel_id);
CREATE INDEX IF NOT EXISTS teams_active_idx ON teams(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS team_memberships_team_idx ON team_memberships(team_id);
CREATE INDEX IF NOT EXISTS team_memberships_student_idx ON team_memberships(student_id);
CREATE INDEX IF NOT EXISTS teacher_boosts_active_window_idx ON teacher_boosts(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS daily_challenge_claims_student_idx ON daily_challenge_claims(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stream_posts_created_idx ON stream_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS stream_post_likes_post_idx ON stream_post_likes(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stream_post_comments_post_idx ON stream_post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stream_user_mutes_user_idx ON stream_user_mutes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stream_user_mutes_muted_idx ON stream_user_mutes(muted_user_id);
CREATE INDEX IF NOT EXISTS vocabulary_normalized_word_idx ON vocabulary(normalized_word);
CREATE INDEX IF NOT EXISTS vocabulary_normalized_word_trgm_idx ON vocabulary USING gin (normalized_word gin_trgm_ops);
CREATE INDEX IF NOT EXISTS expressions_normalized_expression_idx ON expressions(normalized_expression);
CREATE INDEX IF NOT EXISTS expressions_normalized_expression_trgm_idx ON expressions USING gin (normalized_expression gin_trgm_ops);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE expressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_user_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "materials_select_all" ON materials;
CREATE POLICY "materials_select_all" ON materials
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "materials_teacher_manage" ON materials;
CREATE POLICY "materials_teacher_manage" ON materials
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "vocabulary_select_authenticated" ON vocabulary;
CREATE POLICY "vocabulary_select_authenticated" ON vocabulary
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "vocabulary_insert_own" ON vocabulary;
CREATE POLICY "vocabulary_insert_own" ON vocabulary
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "vocabulary_update_own" ON vocabulary;
CREATE POLICY "vocabulary_update_own" ON vocabulary
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "vocabulary_delete_own" ON vocabulary;
CREATE POLICY "vocabulary_delete_own" ON vocabulary
  FOR DELETE
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "expressions_select_authenticated" ON expressions;
CREATE POLICY "expressions_select_authenticated" ON expressions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "expressions_insert_own" ON expressions;
CREATE POLICY "expressions_insert_own" ON expressions
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "expressions_update_own" ON expressions;
CREATE POLICY "expressions_update_own" ON expressions
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "expressions_delete_own" ON expressions;
CREATE POLICY "expressions_delete_own" ON expressions
  FOR DELETE
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "competitions_select_all" ON competitions;
CREATE POLICY "competitions_select_all" ON competitions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "competitions_teacher_manage" ON competitions;
CREATE POLICY "competitions_teacher_manage" ON competitions
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "competition_progress_select_own" ON competition_progress;
CREATE POLICY "competition_progress_select_own" ON competition_progress
  FOR SELECT
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "competition_progress_insert_own" ON competition_progress;
CREATE POLICY "competition_progress_insert_own" ON competition_progress
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "competition_progress_update_own" ON competition_progress;
CREATE POLICY "competition_progress_update_own" ON competition_progress
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "daily_challenges_select_authenticated" ON daily_challenges;
CREATE POLICY "daily_challenges_select_authenticated" ON daily_challenges
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "daily_challenges_teacher_manage" ON daily_challenges;
CREATE POLICY "daily_challenges_teacher_manage" ON daily_challenges
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "quests_select_authenticated" ON quests;
CREATE POLICY "quests_select_authenticated" ON quests
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "quests_teacher_manage" ON quests;
CREATE POLICY "quests_teacher_manage" ON quests
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "review_items_select_own" ON review_items;
CREATE POLICY "review_items_select_own" ON review_items
  FOR SELECT
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "review_items_insert_own" ON review_items;
CREATE POLICY "review_items_insert_own" ON review_items
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "review_items_update_own" ON review_items;
CREATE POLICY "review_items_update_own" ON review_items
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "review_items_delete_own" ON review_items;
CREATE POLICY "review_items_delete_own" ON review_items
  FOR DELETE
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "duels_select_authenticated" ON duels;
CREATE POLICY "duels_select_authenticated" ON duels
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "duels_insert_authenticated" ON duels;
CREATE POLICY "duels_insert_authenticated" ON duels
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "duels_update_creator" ON duels;
CREATE POLICY "duels_update_creator" ON duels
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "duel_participants_select_own_or_duel" ON duel_participants;
CREATE POLICY "duel_participants_select_own_or_duel" ON duel_participants
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM duel_participants dp
      WHERE dp.duel_id = duel_participants.duel_id
        AND dp.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "duel_participants_insert_own" ON duel_participants;
CREATE POLICY "duel_participants_insert_own" ON duel_participants
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "duel_participants_update_own" ON duel_participants;
CREATE POLICY "duel_participants_update_own" ON duel_participants
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "duel_rounds_select_participants" ON duel_rounds;
CREATE POLICY "duel_rounds_select_participants" ON duel_rounds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM duel_participants dp
      WHERE dp.duel_id = duel_rounds.duel_id
        AND dp.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "duel_rounds_insert_creator" ON duel_rounds;
CREATE POLICY "duel_rounds_insert_creator" ON duel_rounds
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM duels d
      WHERE d.id = duel_rounds.duel_id
        AND d.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "duel_answers_select_own_or_duel" ON duel_answers;
CREATE POLICY "duel_answers_select_own_or_duel" ON duel_answers
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM duel_participants dp
      WHERE dp.duel_id = duel_answers.duel_id
        AND dp.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "duel_answers_insert_own" ON duel_answers;
CREATE POLICY "duel_answers_insert_own" ON duel_answers
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM duel_participants dp
      WHERE dp.duel_id = duel_answers.duel_id
        AND dp.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teams_select_authenticated" ON teams;
CREATE POLICY "teams_select_authenticated" ON teams
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "teams_teacher_manage" ON teams;
CREATE POLICY "teams_teacher_manage" ON teams
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "team_memberships_select_authenticated" ON team_memberships;
CREATE POLICY "team_memberships_select_authenticated" ON team_memberships
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "team_memberships_insert_own" ON team_memberships;
CREATE POLICY "team_memberships_insert_own" ON team_memberships
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "team_memberships_insert_teacher_manage" ON team_memberships;
CREATE POLICY "team_memberships_insert_teacher_manage" ON team_memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM teams t
      WHERE t.id = team_memberships.team_id
        AND t.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "team_memberships_update_own" ON team_memberships;
CREATE POLICY "team_memberships_update_own" ON team_memberships
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "team_memberships_update_teacher_manage" ON team_memberships;
CREATE POLICY "team_memberships_update_teacher_manage" ON team_memberships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM teams t
      WHERE t.id = team_memberships.team_id
        AND t.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM teams t
      WHERE t.id = team_memberships.team_id
        AND t.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "team_memberships_delete_own" ON team_memberships;
CREATE POLICY "team_memberships_delete_own" ON team_memberships
  FOR DELETE
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "team_memberships_delete_teacher_manage" ON team_memberships;
CREATE POLICY "team_memberships_delete_teacher_manage" ON team_memberships
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM teams t
      WHERE t.id = team_memberships.team_id
        AND t.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teacher_boosts_select_authenticated" ON teacher_boosts;
CREATE POLICY "teacher_boosts_select_authenticated" ON teacher_boosts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "teacher_boosts_teacher_manage" ON teacher_boosts;
CREATE POLICY "teacher_boosts_teacher_manage" ON teacher_boosts
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "daily_challenge_claims_select_own" ON daily_challenge_claims;
CREATE POLICY "daily_challenge_claims_select_own" ON daily_challenge_claims
  FOR SELECT
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "daily_challenge_claims_insert_own" ON daily_challenge_claims;
CREATE POLICY "daily_challenge_claims_insert_own" ON daily_challenge_claims
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "stream_posts_select_authenticated" ON stream_posts;
DROP POLICY IF EXISTS "stream_posts_select_authenticated_not_muted" ON stream_posts;
CREATE POLICY "stream_posts_select_authenticated_not_muted" ON stream_posts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM stream_user_mutes m
      WHERE m.user_id = auth.uid()
        AND m.muted_user_id = stream_posts.author_id
    )
  );

DROP POLICY IF EXISTS "stream_posts_insert_own" ON stream_posts;
CREATE POLICY "stream_posts_insert_own" ON stream_posts
  FOR INSERT
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "stream_posts_delete_own" ON stream_posts;
CREATE POLICY "stream_posts_delete_own" ON stream_posts
  FOR DELETE
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "stream_post_likes_select_authenticated" ON stream_post_likes;
CREATE POLICY "stream_post_likes_select_authenticated" ON stream_post_likes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stream_post_likes_insert_own" ON stream_post_likes;
CREATE POLICY "stream_post_likes_insert_own" ON stream_post_likes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "stream_post_likes_delete_own" ON stream_post_likes;
CREATE POLICY "stream_post_likes_delete_own" ON stream_post_likes
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "stream_post_comments_select_authenticated" ON stream_post_comments;
CREATE POLICY "stream_post_comments_select_authenticated" ON stream_post_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stream_post_comments_insert_own" ON stream_post_comments;
CREATE POLICY "stream_post_comments_insert_own" ON stream_post_comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "stream_post_comments_delete_own" ON stream_post_comments;
CREATE POLICY "stream_post_comments_delete_own" ON stream_post_comments
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "stream_user_mutes_select_own" ON stream_user_mutes;
CREATE POLICY "stream_user_mutes_select_own" ON stream_user_mutes
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "stream_user_mutes_insert_own" ON stream_user_mutes;
CREATE POLICY "stream_user_mutes_insert_own" ON stream_user_mutes
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND user_id <> muted_user_id);

DROP POLICY IF EXISTS "stream_user_mutes_delete_own" ON stream_user_mutes;
CREATE POLICY "stream_user_mutes_delete_own" ON stream_user_mutes
  FOR DELETE
  USING (user_id = auth.uid());
