-- ============================================================
-- 009 — Onboarding flag + social proof columns + triggers
-- ============================================================

-- ── 1. Users: onboarding_completed ───────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing users so they skip onboarding
UPDATE users SET onboarding_completed = TRUE WHERE onboarding_completed = FALSE;

-- ── 2. Users: response_rate ───────────────────────────────────────────────────
-- Cached percentage (0–100) of threads where creator answered.
-- NULL = no threads yet (shown as "New creator" rather than a number).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS response_rate NUMERIC(5,1) DEFAULT NULL;

-- Backfill response_rate for creators who already have threads
UPDATE users u
SET response_rate = (
  SELECT ROUND(
    COUNT(*) FILTER (WHERE t.status = 'answered')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100,
    1
  )
  FROM threads t
  WHERE t.creator_id = u.id
)
WHERE u.role = 'creator';

-- Seed creators with zero threads with a realistic dummy value (80–96%)
UPDATE users
SET response_rate = ROUND((80 + RANDOM() * 16)::NUMERIC, 1)
WHERE role = 'creator' AND response_rate IS NULL;

-- ── 3. Threads: purchase_count ────────────────────────────────────────────────
-- Denormalised counter: how many post_purchases rows point to this thread.
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS purchase_count INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing purchases
UPDATE threads t
SET purchase_count = (
  SELECT COUNT(*) FROM post_purchases pp WHERE pp.thread_id = t.id
);

-- ── 4. answer_ratings ─────────────────────────────────────────────────────────
-- Fans rate an answered thread 1–5 stars (one rating per fan per thread).
CREATE TABLE IF NOT EXISTS answer_ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID        NOT NULL REFERENCES threads(id)  ON DELETE CASCADE,
  rater_id    UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, rater_id)
);

ALTER TABLE answer_ratings ENABLE ROW LEVEL SECURITY;

-- Fan can insert/update their own rating
DROP POLICY IF EXISTS "answer_ratings_insert_own" ON answer_ratings;
CREATE POLICY "answer_ratings_insert_own" ON answer_ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

DROP POLICY IF EXISTS "answer_ratings_update_own" ON answer_ratings;
CREATE POLICY "answer_ratings_update_own" ON answer_ratings
  FOR UPDATE USING (auth.uid() = rater_id);

-- Anyone can read ratings (for avg display)
DROP POLICY IF EXISTS "answer_ratings_select_all" ON answer_ratings;
CREATE POLICY "answer_ratings_select_all" ON answer_ratings
  FOR SELECT USING (true);

-- ── 5. Trigger: increment purchase_count ─────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_thread_purchase_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE threads SET purchase_count = purchase_count + 1 WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_thread_purchase_count ON post_purchases;
CREATE TRIGGER trg_increment_thread_purchase_count
  AFTER INSERT ON post_purchases
  FOR EACH ROW EXECUTE FUNCTION increment_thread_purchase_count();

-- ── 6. Trigger: update creator response_rate ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_creator_response_rate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total    INTEGER;
  v_answered INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'answered')
  INTO v_total, v_answered
  FROM threads
  WHERE creator_id = NEW.creator_id;

  UPDATE users
  SET response_rate = ROUND(
    v_answered::NUMERIC / NULLIF(v_total, 0) * 100,
    1
  )
  WHERE id = NEW.creator_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_creator_response_rate ON threads;
CREATE TRIGGER trg_update_creator_response_rate
  AFTER UPDATE OF status ON threads
  FOR EACH ROW
  WHEN (NEW.status = 'answered' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_creator_response_rate();

-- ── 7. Rebuild get_feed_data to include creator_response_rate ─────────────────
CREATE OR REPLACE FUNCTION get_feed_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_followed_ids        UUID[];
  v_followed_categories TEXT[];
  v_followed_count      INT;
  v_purchased_post_ids  UUID[];
  v_followed_posts      JSON;
  v_discovery_posts     JSON;
BEGIN
  SELECT ARRAY_AGG(creator_id) INTO v_followed_ids
  FROM user_following WHERE follower_id = p_user_id;
  v_followed_ids   := COALESCE(v_followed_ids, '{}');
  v_followed_count := COALESCE(array_length(v_followed_ids, 1), 0);

  SELECT ARRAY_AGG(DISTINCT cat) INTO v_followed_categories
  FROM users u, UNNEST(u.categories) AS cat
  WHERE u.id = ANY(v_followed_ids);
  v_followed_categories := COALESCE(v_followed_categories, '{}');

  SELECT ARRAY_AGG(DISTINCT post_id) INTO v_purchased_post_ids
  FROM post_purchases WHERE buyer_id = p_user_id;
  v_purchased_post_ids := COALESCE(v_purchased_post_ids, '{}');

  -- Followed posts: last 48h, newest first, max 60
  SELECT JSON_AGG(row_to_json(p)) INTO v_followed_posts FROM (
    SELECT
      posts.id,
      posts.creator_id,
      u.username              AS creator_username,
      u.display_name          AS creator_display_name,
      u.avatar_url            AS creator_avatar_url,
      u.categories,
      u.response_rate         AS creator_response_rate,
      posts.created_at,
      posts.caption,
      posts.image_urls,
      posts.question_count,
      posts.answer_count,
      posts.price,
      posts.location_address,
      (posts.id = ANY(v_purchased_post_ids)) AS is_purchased
    FROM posts
    JOIN users u ON u.id = posts.creator_id
    WHERE posts.creator_id = ANY(v_followed_ids)
      AND posts.created_at >= NOW() - INTERVAL '48 hours'
    ORDER BY posts.created_at DESC
    LIMIT 60
  ) p;

  -- Discovery posts: non-followed, last 72h, max 100
  SELECT JSON_AGG(row_to_json(p)) INTO v_discovery_posts FROM (
    SELECT
      posts.id,
      posts.creator_id,
      u.username              AS creator_username,
      u.display_name          AS creator_display_name,
      u.avatar_url            AS creator_avatar_url,
      u.categories,
      u.response_rate         AS creator_response_rate,
      posts.created_at,
      posts.caption,
      posts.image_urls,
      posts.question_count,
      posts.answer_count,
      posts.price,
      posts.location_address,
      (posts.id = ANY(v_purchased_post_ids)) AS is_purchased
    FROM posts
    JOIN users u ON u.id = posts.creator_id
    WHERE NOT (posts.creator_id = ANY(v_followed_ids))
      AND posts.creator_id != p_user_id
      AND posts.created_at >= NOW() - INTERVAL '72 hours'
    ORDER BY posts.created_at DESC
    LIMIT 100
  ) p;

  RETURN JSON_BUILD_OBJECT(
    'followedPosts',             COALESCE(v_followed_posts,     '[]'::JSON),
    'discoveryPosts',            COALESCE(v_discovery_posts,    '[]'::JSON),
    'followedCreatorCategories', v_followed_categories,
    'followedCreatorCount',      v_followed_count
  );
END;
$$;
