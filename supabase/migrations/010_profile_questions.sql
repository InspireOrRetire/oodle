-- ============================================================
-- 010 – Profile Questions (Ask Me Anything)
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asker_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question        TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','answered','dismissed')),
  upvote_count    INTEGER     NOT NULL DEFAULT 0,
  answer_post_id  UUID        REFERENCES posts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_question_upvotes (
  question_id  UUID NOT NULL REFERENCES profile_questions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
  PRIMARY KEY (question_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profile_questions_creator_status
  ON profile_questions (creator_id, status, upvote_count DESC);

CREATE INDEX IF NOT EXISTS idx_profile_questions_asker
  ON profile_questions (asker_id);

CREATE INDEX IF NOT EXISTS idx_profile_question_upvotes_user
  ON profile_question_upvotes (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE profile_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_question_upvotes ENABLE ROW LEVEL SECURITY;

-- profile_questions policies
DROP POLICY IF EXISTS "pq_select_open"      ON profile_questions;
DROP POLICY IF EXISTS "pq_insert_asker"     ON profile_questions;
DROP POLICY IF EXISTS "pq_update_creator"   ON profile_questions;
DROP POLICY IF EXISTS "pq_delete_creator"   ON profile_questions;

CREATE POLICY "pq_select_open"
  ON profile_questions FOR SELECT
  USING (status IN ('open', 'answered'));

CREATE POLICY "pq_insert_asker"
  ON profile_questions FOR INSERT
  WITH CHECK (auth.uid() = asker_id);

CREATE POLICY "pq_update_creator"
  ON profile_questions FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "pq_delete_creator"
  ON profile_questions FOR DELETE
  USING (auth.uid() = creator_id);

-- profile_question_upvotes policies
DROP POLICY IF EXISTS "pqu_select"  ON profile_question_upvotes;
DROP POLICY IF EXISTS "pqu_insert"  ON profile_question_upvotes;
DROP POLICY IF EXISTS "pqu_delete"  ON profile_question_upvotes;

CREATE POLICY "pqu_select"
  ON profile_question_upvotes FOR SELECT
  USING (true);

CREATE POLICY "pqu_insert"
  ON profile_question_upvotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pqu_delete"
  ON profile_question_upvotes FOR DELETE
  USING (auth.uid() = user_id);

-- ── RPCs ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upvote_profile_question(
  p_question_id UUID,
  p_user_id     UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profile_question_upvotes (question_id, user_id)
  VALUES (p_question_id, p_user_id)
  ON CONFLICT DO NOTHING;

  UPDATE profile_questions
  SET upvote_count = upvote_count + 1
  WHERE id = p_question_id
    AND NOT EXISTS (
      SELECT 1 FROM profile_question_upvotes
      WHERE question_id = p_question_id AND user_id = p_user_id
        AND ctid != (
          SELECT ctid FROM profile_question_upvotes
          WHERE question_id = p_question_id AND user_id = p_user_id
          LIMIT 1
        )
    );

  -- Simpler: just recalculate from upvotes table
  UPDATE profile_questions
  SET upvote_count = (
    SELECT COUNT(*) FROM profile_question_upvotes
    WHERE question_id = p_question_id
  )
  WHERE id = p_question_id;
END;
$$;

CREATE OR REPLACE FUNCTION unvote_profile_question(
  p_question_id UUID,
  p_user_id     UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM profile_question_upvotes
  WHERE question_id = p_question_id AND user_id = p_user_id;

  UPDATE profile_questions
  SET upvote_count = (
    SELECT COUNT(*) FROM profile_question_upvotes
    WHERE question_id = p_question_id
  )
  WHERE id = p_question_id;
END;
$$;
