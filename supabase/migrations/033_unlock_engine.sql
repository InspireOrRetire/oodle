-- ============================================================
-- 033 — Unlock Engine
-- Replaces the single-price model with extensible unlock requirements.
-- Existing priced posts are backfilled as Cash transaction unlocks.
-- Rollback: DELETE FROM unlock_configs WHERE is_migration = TRUE;
--           DROP TABLE audience_contacts, transaction_completions,
--                      relationship_completions, unlock_configs CASCADE;
-- ============================================================

-- ── unlock_configs: requirements attached to a post ───────────────────────────
CREATE TABLE unlock_configs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  unlock_type  TEXT        NOT NULL,
  unlock_class TEXT        NOT NULL CHECK (unlock_class IN ('relationship', 'transaction')),
  config       JSONB       NOT NULL DEFAULT '{}',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  is_migration BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unlock_configs_post_id ON unlock_configs(post_id);

-- ── relationship_completions: creator-scoped, once per type per creator ────────
CREATE TABLE relationship_completions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlock_type           TEXT        NOT NULL CHECK (unlock_type IN ('email', 'sms', 'follow_creator')),
  completed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_from_post_id UUID        REFERENCES posts(id) ON DELETE SET NULL,
  captured_email        TEXT,
  captured_phone        TEXT,
  UNIQUE(user_id, creator_id, unlock_type)
);

CREATE INDEX idx_rel_completions_user_creator ON relationship_completions(user_id, creator_id);

-- ── transaction_completions: product-scoped ───────────────────────────────────
CREATE TABLE transaction_completions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id          UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  unlock_type      TEXT        NOT NULL,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  form_data        JSONB,
  post_purchase_id UUID        REFERENCES post_purchases(id),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_tx_completions_user_post ON transaction_completions(user_id, post_id);

-- ── audience_contacts: creator CRM, one record per (creator, user) ────────────
CREATE TABLE audience_contacts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT,
  email                 TEXT,
  phone                 TEXT,
  date_connected        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                 TEXT,
  -- OODLE Intelligence — never exported
  captured_from_post_id UUID        REFERENCES posts(id) ON DELETE SET NULL,
  first_unlock_at       TIMESTAMPTZ,
  latest_unlock_at      TIMESTAMPTZ,
  lifetime_value        NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(creator_id, user_id)
);

CREATE INDEX idx_audience_creator ON audience_contacts(creator_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE unlock_configs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_completions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_contacts        ENABLE ROW LEVEL SECURITY;

-- unlock_configs: any authenticated user can read (needed for chip display)
CREATE POLICY "unlock_configs_select"
  ON unlock_configs FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only the post's creator can write unlock configs
CREATE POLICY "unlock_configs_insert"
  ON unlock_configs FOR INSERT
  WITH CHECK (auth.uid() = (SELECT creator_id FROM posts WHERE id = post_id));

CREATE POLICY "unlock_configs_delete"
  ON unlock_configs FOR DELETE
  USING (auth.uid() = (SELECT creator_id FROM posts WHERE id = post_id));

-- relationship_completions: user sees their own; creator sees their fans'
CREATE POLICY "rel_completions_select"
  ON relationship_completions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = creator_id);

CREATE POLICY "rel_completions_insert"
  ON relationship_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- transaction_completions: user sees their own; creator sees for their posts
CREATE POLICY "tx_completions_select"
  ON transaction_completions FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT creator_id FROM posts WHERE id = post_id)
  );

CREATE POLICY "tx_completions_insert"
  ON transaction_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- audience_contacts: creator reads their own audience; user upserts their own contact
CREATE POLICY "audience_select"
  ON audience_contacts FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "audience_insert"
  ON audience_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audience_update"
  ON audience_contacts FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = user_id);

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, DELETE ON unlock_configs           TO authenticated;
GRANT SELECT, INSERT         ON relationship_completions TO authenticated;
GRANT SELECT, INSERT         ON transaction_completions  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON audience_contacts        TO authenticated;

-- ── Backfill existing priced posts → Cash transaction unlock ──────────────────
INSERT INTO unlock_configs (post_id, unlock_type, unlock_class, config, is_migration)
SELECT
  id,
  'cash',
  'transaction',
  jsonb_build_object('amount', price),
  TRUE
FROM posts
WHERE price > 0 AND price IS NOT NULL
ON CONFLICT DO NOTHING;
