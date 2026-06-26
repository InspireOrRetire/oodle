-- ============================================================
-- User settings columns + blocked_users table
-- ============================================================

-- Add preference columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_profile        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS push_notifications    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_notifications   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_answer_price     BOOLEAN NOT NULL DEFAULT TRUE;

-- Blocked users
CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own block list
CREATE POLICY "blocked_users_select_own"
  ON blocked_users FOR SELECT
  USING (blocker_id = auth.uid());

-- Users can block others
CREATE POLICY "blocked_users_insert_own"
  ON blocked_users FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

-- Users can unblock
CREATE POLICY "blocked_users_delete_own"
  ON blocked_users FOR DELETE
  USING (blocker_id = auth.uid());

-- Users can update their own settings columns
CREATE POLICY "users_update_own_settings"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
