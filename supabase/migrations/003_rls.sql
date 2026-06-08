-- ============================================================
-- oodle — Row Level Security Policies
-- Run after 002_indexes_and_functions.sql
-- ============================================================

-- Enable RLS on every table
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_following ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS
--
-- SELECT: any authenticated user can read public profile fields.
--   Sensitive fields (stripe_account_id, stripe_onboarded) are never
--   selected by client queries — the policy doesn't restrict columns,
--   but all service-layer queries must explicitly select only public fields.
--   Earnings are computed from post_purchases (see that table's policy).
--
-- UPDATE: users can only update their own row.
--
-- INSERT: handled exclusively by the handle_new_user() trigger
--   (SECURITY DEFINER). No client can INSERT directly.
--
-- DELETE: not permitted from the client. Users are deleted via
--   Supabase auth admin API which cascades to this table.
-- ============================================================
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- POSTS
--
-- SELECT: any authenticated user can browse posts.
--
-- INSERT: only creators can create posts, and only as themselves.
--   The role check queries the users table to confirm the caller
--   is a creator before allowing the insert.
--
-- UPDATE / DELETE: creator owns their own posts.
-- ============================================================
CREATE POLICY "posts_select_authenticated"
  ON posts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "posts_insert_creator_only"
  ON posts FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'creator'
  );

CREATE POLICY "posts_update_own"
  ON posts FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "posts_delete_own"
  ON posts FOR DELETE
  USING (auth.uid() = creator_id);

-- ============================================================
-- THREADS
--
-- SELECT: the thread's creator, the fan who started it, or any
--   user who has purchased the answer may read the thread row
--   (which includes answer_blocks). Everyone else is denied.
--
-- INSERT: fans create threads. They supply their own fan_id and
--   the matching creator_id is derived from the post.
--
-- UPDATE: the creator updates the thread (set answer, price, status).
--   Fans can update asker_has_viewed only — enforced at application
--   layer; the RLS policy allows fan updates to keep it simple.
-- ============================================================
CREATE POLICY "threads_select_participants_or_purchasers"
  ON threads FOR SELECT
  USING (
    auth.uid() = creator_id
    OR auth.uid() = fan_id
    OR EXISTS (
      SELECT 1 FROM post_purchases pp
      WHERE pp.thread_id = threads.id
        AND pp.buyer_id  = auth.uid()
    )
  );

CREATE POLICY "threads_insert_fan"
  ON threads FOR INSERT
  WITH CHECK (auth.uid() = fan_id);

CREATE POLICY "threads_update_participant"
  ON threads FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = fan_id);

-- ============================================================
-- MESSAGES
--
-- SELECT / INSERT: only the two participants in the parent thread
--   can read or write messages. The subquery joins threads to
--   enforce this without exposing the thread row itself.
-- ============================================================
CREATE POLICY "messages_select_participants"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = messages.thread_id
        AND (t.creator_id = auth.uid() OR t.fan_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_participants"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = messages.thread_id
        AND (t.creator_id = auth.uid() OR t.fan_id = auth.uid())
    )
  );

-- ============================================================
-- POST_PURCHASES
--
-- SELECT: only the buyer or the creator of the purchased content
--   can see the purchase record. This prevents fans from seeing
--   each other's purchase history, and creators cannot see other
--   creators' earnings.
--
-- INSERT: the buyer inserts their own purchase row. In production
--   (Step 6) this will be moved to a SECURITY DEFINER function
--   called by the Stripe webhook, and this direct-insert policy
--   will be revoked.
--
-- UPDATE / DELETE: not permitted from the client.
-- ============================================================
CREATE POLICY "purchases_select_buyer_or_creator"
  ON post_purchases FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = creator_id);

CREATE POLICY "purchases_insert_own"
  ON post_purchases FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- ============================================================
-- USER_FOLLOWING
--
-- SELECT: public — any authenticated user can see the social graph.
--   Needed so the feed can query who a user follows.
--
-- INSERT: users follow others as themselves.
--   The CHECK constraint on the table already prevents self-follows.
--
-- DELETE: users can only unfollow relationships they created.
-- ============================================================
CREATE POLICY "following_select_authenticated"
  ON user_following FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "following_insert_own"
  ON user_following FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "following_delete_own"
  ON user_following FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================================
-- REALTIME
-- Enable Supabase Realtime on messages and threads so the
-- messaging screen can subscribe to live updates.
-- Run these in the Supabase dashboard > Database > Replication,
-- or uncomment if your project config supports it via SQL:
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE threads;
-- ============================================================
