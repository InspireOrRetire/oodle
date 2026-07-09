-- ============================================================
-- 034_reposts.sql  —  Self-repost feature
-- ============================================================
-- A creator can resurface one of their own posts by creating a
-- repost record.  Comments and likes always live on the original
-- post — the repost is a lightweight pointer + optional caption.
-- ============================================================

CREATE TABLE IF NOT EXISTS reposts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  original_post_id UUID        NOT NULL REFERENCES posts(id)  ON DELETE CASCADE,
  caption          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS reposts_creator_id_idx        ON reposts(creator_id);
CREATE INDEX IF NOT EXISTS reposts_original_post_id_idx  ON reposts(original_post_id);
CREATE INDEX IF NOT EXISTS reposts_created_at_idx        ON reposts(created_at DESC);
-- Fast cooldown check: most recent repost for a given (creator, post) pair
CREATE INDEX IF NOT EXISTS reposts_cooldown_idx          ON reposts(creator_id, original_post_id, created_at DESC);

-- Row-level security
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reposts_select_all"  ON reposts
  FOR SELECT USING (true);

CREATE POLICY "reposts_insert_own"  ON reposts
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "reposts_delete_own"  ON reposts
  FOR DELETE USING (auth.uid() = creator_id);
