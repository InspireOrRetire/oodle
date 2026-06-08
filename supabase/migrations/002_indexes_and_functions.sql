-- ============================================================
-- oodle — Indexes, Triggers, and Helper Functions
-- Run after 001_schema.sql
-- ============================================================

-- ============================================================
-- INDEXES
-- ============================================================

-- users
CREATE INDEX idx_users_username      ON users (username);
CREATE INDEX idx_users_role          ON users (role);
CREATE INDEX idx_users_username_trgm ON users USING gin (username gin_trgm_ops);

-- posts (feed queries filter by creator and time)
CREATE INDEX idx_posts_creator_id    ON posts (creator_id);
CREATE INDEX idx_posts_created_at    ON posts (created_at DESC);

-- threads (inbox queries filter by creator or fan)
CREATE INDEX idx_threads_creator_id  ON threads (creator_id);
CREATE INDEX idx_threads_fan_id      ON threads (fan_id);
CREATE INDEX idx_threads_post_id     ON threads (post_id);
CREATE INDEX idx_threads_status      ON threads (status);

-- messages (chat queries load by thread, ordered by time)
CREATE INDEX idx_messages_thread_id  ON messages (thread_id, created_at ASC);

-- purchases
CREATE INDEX idx_purchases_buyer_id    ON post_purchases (buyer_id);
CREATE INDEX idx_purchases_creator_id  ON post_purchases (creator_id);
CREATE INDEX idx_purchases_post_id     ON post_purchases (post_id);
CREATE INDEX idx_purchases_thread_id   ON post_purchases (thread_id);

-- following
CREATE INDEX idx_following_follower_id ON user_following (follower_id);
CREATE INDEX idx_following_creator_id  ON user_following (creator_id);

-- ============================================================
-- TRIGGER: auto-create users row on auth signup
--
-- The client sends role in signUp options.data:
--   supabase.auth.signUp({ email, password, options: { data: { role: 'creator' } } })
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'fan')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER posts_updated_at   BEFORE UPDATE ON posts   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER threads_updated_at BEFORE UPDATE ON threads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- TRIGGER: maintain posts.question_count
-- ============================================================
CREATE OR REPLACE FUNCTION sync_question_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET question_count = question_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET question_count = GREATEST(0, question_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_thread_count
  AFTER INSERT OR DELETE ON threads
  FOR EACH ROW EXECUTE FUNCTION sync_question_count();

-- ============================================================
-- TRIGGER: maintain posts.answer_count
-- ============================================================
CREATE OR REPLACE FUNCTION sync_answer_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'answered' AND (OLD.status IS DISTINCT FROM 'answered') THEN
    UPDATE posts SET answer_count = answer_count + 1 WHERE id = NEW.post_id;
  END IF;
  IF OLD.status = 'answered' AND NEW.status != 'answered' THEN
    UPDATE posts SET answer_count = GREATEST(0, answer_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_thread_answered
  AFTER UPDATE OF status ON threads
  FOR EACH ROW EXECUTE FUNCTION sync_answer_count();

-- ============================================================
-- TRIGGER: maintain followers_count / following_count
-- ============================================================
CREATE OR REPLACE FUNCTION sync_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.creator_id;
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.creator_id;
    UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_follow_change
  AFTER INSERT OR DELETE ON user_following
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();

-- ============================================================
-- RPC: get_feed_data(p_user_id uuid)
-- Returns all data needed by feedComposer in one round-trip.
-- Client call: supabase.rpc('get_feed_data', { p_user_id: uid })
-- ============================================================
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

  -- Followed posts: last 48h, max 60
  SELECT JSON_AGG(row_to_json(p)) INTO v_followed_posts FROM (
    SELECT posts.id, posts.creator_id, u.username AS creator_username,
           u.categories, posts.created_at, posts.question_count,
           posts.answer_count, posts.price,
           (posts.id = ANY(v_purchased_post_ids)) AS is_purchased
    FROM posts JOIN users u ON u.id = posts.creator_id
    WHERE posts.creator_id = ANY(v_followed_ids)
      AND posts.created_at >= NOW() - INTERVAL '48 hours'
    ORDER BY posts.created_at DESC LIMIT 60
  ) p;

  -- Discovery posts: non-followed, last 72h, max 100
  SELECT JSON_AGG(row_to_json(p)) INTO v_discovery_posts FROM (
    SELECT posts.id, posts.creator_id, u.username AS creator_username,
           u.categories, posts.created_at, posts.question_count,
           posts.answer_count, posts.price,
           (posts.id = ANY(v_purchased_post_ids)) AS is_purchased
    FROM posts JOIN users u ON u.id = posts.creator_id
    WHERE NOT (posts.creator_id = ANY(v_followed_ids))
      AND posts.creator_id != p_user_id
      AND posts.created_at >= NOW() - INTERVAL '72 hours'
    ORDER BY posts.created_at DESC LIMIT 100
  ) p;

  RETURN JSON_BUILD_OBJECT(
    'followedPosts',             COALESCE(v_followed_posts,     '[]'::JSON),
    'discoveryPosts',            COALESCE(v_discovery_posts,    '[]'::JSON),
    'followedCreatorCategories', v_followed_categories,
    'followedCreatorCount',      v_followed_count
  );
END;
$$;
